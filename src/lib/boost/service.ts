import "server-only";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify, notifyStaff } from "@/lib/notifications/service";
import { refundableAmount, requestRefund } from "@/lib/payments/service";
import { loadSettings } from "@/lib/settings";
import { formatFcfa, makeReference } from "@/lib/utils";
import {
  BoostError, boostLabel, canMoveBoost, computeBoostQuote, normalizeTarget, parseComments, parsePacks, validateComments,
  type BoostKindCode, type BoostProductData, type BoostStatusName,
} from "./catalog";

type ProductRow = { id: string; platform: string; kind: string; pricePer1000: number; minQuantity: number; maxQuantity: number; packs: unknown; delay: string; active: boolean };

export function toProductData(row: ProductRow): BoostProductData {
  return {
    id: row.id, platform: row.platform as PlatformCode, kind: row.kind as BoostKindCode, pricePer1000: row.pricePer1000, minQuantity: row.minQuantity,
    maxQuantity: row.maxQuantity, packs: parsePacks(row.packs), delay: row.delay, active: row.active,
  };
}

export async function loadBoostProducts(opts: { activeOnly?: boolean } = {}): Promise<BoostProductData[]> {
  const rows = await db.boostProduct.findMany({ where: opts.activeOnly ? { active: true } : {}, orderBy: [{ platform: "asc" }, { kind: "asc" }] });
  return rows.map(toProductData);
}

export type BoostOrderResult = { ok: true; orderId: string } | { ok: false; error: string; field?: "quantity" | "link" | "comments" };

/**
 * Crée la commande et son détail. Le prix est toujours recalculé ici, à partir des tarifs enregistrés :
 * rien de ce que le navigateur envoie comme montant n'est pris en compte.
 */
export async function createBoostOrder(userId: string, input: { productId: string; quantity: number; link: string; comments?: string }): Promise<BoostOrderResult> {
  const row = await db.boostProduct.findUnique({ where: { id: input.productId } });
  if (!row || !row.active) return { ok: false, error: "Ce produit n'est plus proposé pour le moment." };
  const product = toProductData(row);

  const target = normalizeTarget(product.platform, product.kind, input.link);
  if (!target.ok) return { ok: false, error: target.error, field: "link" };

  let comments: string[] = [];
  if (product.kind === "COMMENTS") {
    comments = parseComments(input.comments ?? "");
    const issue = validateComments(comments, input.quantity);
    if (issue) return { ok: false, error: issue, field: "comments" };
  }

  let quote;
  try {
    quote = computeBoostQuote(product, input.quantity, await loadSettings());
  } catch (error) {
    if (error instanceof BoostError) return { ok: false, error: error.message, field: "quantity" };
    throw error;
  }

  const orderId = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        reference: makeReference("CMD"), userId, serviceCode: quote.serviceCode, serviceLabel: quote.serviceLabel, adBudget: 0, serviceFee: quote.serviceFee,
        discount: 0, paymentFee: quote.paymentFee, total: quote.total, quote: quote as never,
      },
    });
    await tx.boostOrder.create({ data: { orderId: order.id, userId, productId: product.id, platform: product.platform, kind: product.kind, quantity: input.quantity, link: target.link, comments } });
    return order.id;
  });
  return { ok: true, orderId };
}

/**
 * Avancement d'une livraison par l'équipe. Une annulation après paiement ouvre d'office une demande
 * de remboursement du montant encore remboursable : elle reste à traiter dans Gestion → Paiements.
 */
export async function changeBoostStatus(args: { boostId: string; to: BoostStatusName; actor: SessionUser; note?: string; reason?: string }) {
  const note = args.note?.trim().slice(0, 500) || null;
  const reason = args.reason?.trim().slice(0, 300) || null;
  if (args.to === "CANCELLED" && !reason) throw new DomainError("Indiquez le motif de l'annulation : il est envoyé au client.");

  const boost = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BoostOrder" WHERE id = ${args.boostId} FOR UPDATE`;
    const current = await tx.boostOrder.findUnique({ where: { id: args.boostId }, include: { order: true } });
    if (!current) throw new DomainError("Commande introuvable.");
    if (!canMoveBoost(current.status as BoostStatusName, args.to)) throw new DomainError("Cette commande ne peut pas passer à cet état.");
    const now = new Date();
    await tx.boostOrder.update({
      where: { id: current.id },
      data: {
        status: args.to, handledById: args.actor.id, ...(note ? { staffNote: note } : {}),
        ...(args.to === "IN_PROGRESS" ? { startedAt: now } : {}),
        ...(args.to === "DELIVERED" ? { deliveredAt: now, startedAt: current.startedAt ?? now } : {}),
        ...(args.to === "CANCELLED" ? { cancelReason: reason } : {}),
      },
    });
    return current;
  });

  const label = boostLabel(boost.platform as PlatformCode, boost.kind as BoostKindCode, boost.quantity);
  const link = `/app/paiements/${boost.orderId}`;
  await audit({ actorId: args.actor.id, action: `boost.${args.to.toLowerCase()}`, entity: "BoostOrder", entityId: boost.id, meta: { reference: boost.order.reference, from: boost.status } });

  if (args.to === "IN_PROGRESS") {
    await notify({ userId: boost.userId, type: "boost.in_progress", title: "Votre commande est lancée", body: `${label} : la livraison a commencé. Elle arrive progressivement.`, link });
  } else if (args.to === "DELIVERED") {
    await notify({ userId: boost.userId, type: "boost.delivered", title: "Commande livrée", body: `${label} : votre commande ${boost.order.reference} est livrée.`, link, email: true, whatsapp: true });
  } else if (args.to === "CANCELLED") {
    let refunded = 0;
    const payment = await db.payment.findFirst({ where: { orderId: boost.orderId, status: "SUCCEEDED", duplicate: false } });
    if (payment) {
      const amount = await refundableAmount(payment.id);
      if (amount > 0) {
        await requestRefund({ paymentId: payment.id, amount, reason: `Commande ${boost.order.reference} annulée avant livraison : ${reason}`, actorId: args.actor.id });
        refunded = amount;
        await notifyStaff("payment.refund", { type: "refund.requested", title: "Remboursement à traiter", body: `Commande ${boost.order.reference} annulée — ${formatFcfa(amount)}.`, link: "/gestion/paiements?vue=remboursements" });
      }
    }
    await notify({
      userId: boost.userId, type: "boost.cancelled", title: "Commande annulée",
      body: `${label} : nous n'avons pas pu livrer votre commande ${boost.order.reference}. Motif : ${reason}${refunded ? ` Un remboursement de ${formatFcfa(refunded)} est en cours.` : ""}`,
      link, email: true, whatsapp: true,
    });
  }
  return boost;
}
