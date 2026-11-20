"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { assertUser, clientIp } from "@/lib/auth/session";
import { createSubscriptionOrder, upsertCampaignOrder } from "@/lib/campaigns/service";
import { db } from "@/lib/db";
import { startPayment } from "@/lib/payments/service";
import type { OperatorCode } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { loadSettings } from "@/lib/settings";
import { addDays, formatFcfa, randomCode } from "@/lib/utils";
import { safeAction, UserError } from "@/server/action";

const OPERATORS: OperatorCode[] = ["MTN", "MOOV", "CELTIIS"];

/**
 * Lance le paiement d'une commande. Avec un prestataire qui a sa propre page de paiement (FedaPay), la réponse porte
 * l'adresse où envoyer le client ; opérateur et numéro ne sont demandés que par le simulateur.
 * La confirmation ne vient jamais de cette réponse : elle est vérifiée auprès du prestataire.
 */
export async function startPaymentAction(input: { orderId: string; idempotencyKey: string; operator?: string | null; phone?: string | null }) {
  return safeAction(async () => {
    const user = await assertUser();
    const operator = OPERATORS.includes(input.operator as OperatorCode) ? (input.operator as OperatorCode) : null;
    if (!(await rateLimit(`pay:${user.id}`, 12, 900))) throw new UserError("Trop de tentatives de paiement. Réessayez dans quelques minutes.");
    const res = await startPayment({ orderId: String(input.orderId ?? ""), userId: user.id, operator, phoneInput: input.phone ? String(input.phone) : null, idempotencyKey: String(input.idempotencyKey ?? "") });
    await audit({ actorId: user.id, action: res.ok ? "payment.started" : "payment.start_failed", entity: "Order", entityId: input.orderId, meta: { operator, paymentId: res.paymentId }, ip: await clientIp() });
    if (!res.ok) throw new UserError(res.error);
    return { paymentId: res.paymentId, redirectUrl: res.redirectUrl ?? null, expiresAt: res.expiresAt.toISOString() };
  });
}

export async function applyPromoAction(orderId: string, code: string) {
  return safeAction(async () => {
    const user = await assertUser();
    if (!(await rateLimit(`promo:${user.id}`, 20, 600))) throw new UserError("Trop d'essais de codes. Réessayez dans quelques minutes.");
    const order = await db.order.findFirst({ where: { id: orderId, userId: user.id, status: "PENDING" }, select: { campaignId: true, subscription: { select: { serviceCode: true, businessId: true } } } });
    if (!order) throw new UserError("Commande introuvable ou déjà réglée.");
    const res = order.campaignId
      ? await upsertCampaignOrder(user.id, order.campaignId, code.trim() || null)
      : order.subscription ? await createSubscriptionOrder(user.id, order.subscription.serviceCode, order.subscription.businessId, code.trim() || null) : { ok: false as const, error: "Commande invalide." };
    if (!res.ok) throw new UserError(res.error);
  });
}

export async function cancelOrderAction(orderId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, userId: user.id, status: "PENDING" } });
      if (!order) throw new UserError("Commande introuvable ou déjà traitée.");
      const open = await tx.payment.count({ where: { orderId, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: new Date() } } });
      if (open) throw new UserError("Un paiement est en cours. Attendez sa confirmation ou son expiration avant d'annuler.");
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      if (order.campaignId) {
        const res = await tx.campaign.updateMany({ where: { id: order.campaignId, status: "PENDING_PAYMENT" }, data: { status: "DRAFT" } });
        if (res.count) await tx.campaignStatusEvent.create({ data: { campaignId: order.campaignId, fromStatus: "PENDING_PAYMENT", toStatus: "DRAFT", actorId: user.id, note: "Commande annulée par le client." } });
      }
      if (order.subscriptionId) await tx.subscription.updateMany({ where: { id: order.subscriptionId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.boostOrder.updateMany({ where: { orderId, status: "AWAITING_PAYMENT" }, data: { status: "CANCELLED", cancelReason: "Annulée par le client avant paiement." } });
    });
    await audit({ actorId: user.id, action: "order.cancelled", entity: "Order", entityId: orderId });
  });
}

export async function subscribeAction(formData: FormData) {
  const user = await assertUser();
  const res = await createSubscriptionOrder(user.id, String(formData.get("serviceCode") ?? ""), String(formData.get("businessId") ?? "") || null, null);
  if (!res.ok) redirect(`/app/compte?onglet=abonnement&erreur=${encodeURIComponent(res.error)}`);
  redirect(`/app/paiements/${res.orderId}`);
}

/** Convertit des points de fidélité en bon d'achat personnel, valable sur les frais de prestation. */
export async function redeemLoyaltyAction(points: number) {
  return safeAction(async () => {
    const user = await assertUser();
    const settings = await loadSettings();
    const n = Math.floor(Number(points));
    if (!Number.isFinite(n) || n < settings.loyaltyMinRedeem) throw new UserError(`Le minimum convertible est de ${settings.loyaltyMinRedeem} points.`);
    const value = n * settings.loyaltyPointValue;
    const code = `FID-${randomCode(6)}`;
    await db.$transaction(async (tx) => {
      const res = await tx.user.updateMany({ where: { id: user.id, loyaltyPoints: { gte: n } }, data: { loyaltyPoints: { decrement: n } } });
      if (!res.count) throw new UserError("Solde de points insuffisant.");
      await tx.loyaltyEntry.create({ data: { userId: user.id, points: -n, reason: `Conversion en bon ${code}` } });
      await tx.promoCode.create({ data: { code, type: "FIXED", value, maxUses: 1, perUserLimit: 1, source: "LOYALTY", ownerId: user.id, endsAt: addDays(new Date(), 180), description: `Bon fidélité de ${formatFcfa(value)}` } });
    });
    await audit({ actorId: user.id, action: "loyalty.redeemed", entity: "User", entityId: user.id, meta: { points: n, value } });
    return { code, value };
  });
}
