import { DomainError } from "@/lib/errors";
import "server-only";
import { createHash } from "node:crypto";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { loadSettings } from "@/lib/settings";
import { notify, notifyStaff } from "@/lib/notifications/service";
import { normalizeBeninPhone, PAYMENT_COUNTRIES, type OperatorCode } from "@/lib/phone";
import { loyaltyPointsFor, type PromoInput } from "@/lib/pricing/quote";
import { addDays, formatFcfa, randomCode } from "@/lib/utils";
import { getActiveProvider, getProviderById } from "./registry";
import { PaymentProviderError, WebhookSignatureError, type VerifyResult } from "./types";

const log = createLogger("payments");

const OPEN_PAYMENT = ["INITIATED", "PENDING"] as const;
const VERIFY_MIN_INTERVAL_MS = 3_000;

export type StartPaymentResult =
  | { ok: true; paymentId: string; redirectUrl?: string }
  | { ok: false; error: string; paymentId?: string };

// ─────────────────────────── Codes promotionnels ───────────────────────────

export async function resolvePromo(rawCode: string, userId: string, client: Tx | typeof db = db): Promise<{ promo: PromoInput } | { error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Saisissez un code." };
  const promo = await client.promoCode.findUnique({ where: { code } });
  const now = new Date();
  if (!promo || !promo.active) return { error: "Ce code n'existe pas ou n'est plus actif." };
  if (promo.ownerId && promo.ownerId !== userId) return { error: "Ce bon est réservé à un autre compte." };
  if (promo.startsAt && promo.startsAt > now) return { error: "Ce code n'est pas encore valable." };
  if (promo.endsAt && promo.endsAt < now) return { error: "Ce code a expiré." };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { error: "Ce code a atteint son nombre maximal d'utilisations." };
  const used = await client.promoRedemption.count({ where: { promoCodeId: promo.id, userId } });
  if (used >= promo.perUserLimit) return { error: "Vous avez déjà utilisé ce code." };
  return { promo: { id: promo.id, code: promo.code, type: promo.type, value: promo.value, minServiceFee: promo.minServiceFee } };
}

// ─────────────────────────── Démarrage d'un paiement ───────────────────────────

export async function startPayment(args: { orderId: string; userId: string; operator: OperatorCode; phoneInput: string; idempotencyKey: string }): Promise<StartPaymentResult> {
  const provider = getActiveProvider();
  if (!provider) return { ok: false, error: "Le paiement Mobile Money n'est pas encore activé sur cette plateforme. Contactez le support." };
  if (!provider.supportedOperators.includes(args.operator)) return { ok: false, error: "Cet opérateur n'est pas disponible pour le moment." };
  const phone = normalizeBeninPhone(args.phoneInput);
  if (!phone) return { ok: false, error: "Numéro invalide. Saisissez un numéro béninois à 10 chiffres, par exemple 01 97 00 00 00." };
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(args.idempotencyKey)) return { ok: false, error: "Requête invalide. Rechargez la page." };
  const settings = await loadSettings();
  const idempotencyKey = createHash("sha256").update(`${args.orderId}:${args.idempotencyKey}`).digest("hex");

  // Verrou sur la commande : deux demandes simultanées ne peuvent pas créer deux paiements.
  const prepared = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${args.orderId} FOR UPDATE`;
    const order = await tx.order.findFirst({ where: { id: args.orderId, userId: args.userId }, include: { user: { select: { name: true, email: true } } } });
    if (!order) return { error: "Commande introuvable." } as const;
    const same = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (same) return { existing: same.id } as const;
    if (order.status === "PAID") return { error: "Cette commande est déjà réglée." } as const;
    if (order.status !== "PENDING") return { error: "Cette commande n'est plus payable." } as const;
    const open = await tx.payment.findFirst({ where: { orderId: order.id, status: { in: [...OPEN_PAYMENT] }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (open) return { busy: open.id } as const;
    const payment = await tx.payment.create({
      data: {
        orderId: order.id, userId: order.userId, provider: provider.id, operator: args.operator, phone: phone.e164, amount: order.total,
        currency: order.currency, idempotencyKey, expiresAt: new Date(Date.now() + settings.paymentExpiryMinutes * 60_000),
      },
    });
    return { payment, order } as const;
  });

  if ("error" in prepared) return { ok: false, error: prepared.error! };
  if ("existing" in prepared) return { ok: true, paymentId: prepared.existing! };
  if ("busy" in prepared) {
    // Un paiement est déjà en cours : on rafraîchit son état avant de refuser.
    const refreshed = await refreshPayment(prepared.busy!, { force: true });
    if (refreshed?.status === "SUCCEEDED") return { ok: true, paymentId: prepared.busy! };
    if (refreshed && (OPEN_PAYMENT as readonly string[]).includes(refreshed.status)) {
      return { ok: false, paymentId: prepared.busy!, error: "Un paiement est déjà en cours pour cette commande. Validez-le sur votre téléphone ou attendez son expiration avant de réessayer." };
    }
    return { ok: false, error: "Le paiement précédent vient d'échouer. Vous pouvez réessayer." };
  }

  const { payment, order } = prepared;
  try {
    const result = await provider.initiate({
      paymentId: payment.id, orderReference: order.reference, amount: payment.amount, currency: "XOF", operator: args.operator, phone,
      customer: { name: order.user.name, email: order.user.email },
      description: `RegisPub — commande ${order.reference}`,
      callbackUrl: `${env.appUrl}/app/paiements/${order.id}`,
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { providerRef: result.providerRef, status: "PENDING", providerStatus: result.providerStatus ?? null, redirectUrl: result.redirectUrl ?? null },
    });
    log.info("paiement initié", { paymentId: payment.id, provider: provider.id, operator: args.operator, amount: payment.amount });
    return { ok: true, paymentId: payment.id, redirectUrl: result.redirectUrl };
  } catch (error) {
    const userMessage = error instanceof PaymentProviderError && error.userMessage ? error.userMessage : "La demande de paiement n'a pas pu être envoyée. Vérifiez le numéro et réessayez.";
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: userMessage, providerStatus: "initiation_error" } });
    log.error("échec de l'initiation du paiement", { error, paymentId: payment.id, details: error instanceof PaymentProviderError ? error.details : undefined });
    return { ok: false, error: userMessage };
  }
}

// ─────────────────────────── Vérification serveur ───────────────────────────

/**
 * Interroge le prestataire et applique le résultat. Appelée par le webhook, par le suivi de la page de paiement
 * et par la tâche planifiée : l'état « payé » ne provient jamais du navigateur.
 */
export async function refreshPayment(paymentId: string, opts: { force?: boolean } = {}) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (payment.status === "SUCCEEDED" || !payment.providerRef) return payment;
  const provider = getProviderById(payment.provider);
  if (!provider) return payment;
  if (!opts.force) {
    // Limite la fréquence des appels au prestataire lorsque plusieurs onglets interrogent le statut.
    const claimed = await db.payment.updateMany({
      where: { id: payment.id, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - VERIFY_MIN_INTERVAL_MS) } }] },
      data: { lastCheckedAt: new Date() },
    });
    if (claimed.count === 0) return payment;
  }
  try {
    const verification = await provider.verify(payment.providerRef);
    await applyVerification(payment.id, verification);
  } catch (error) {
    log.warn("vérification du paiement impossible", { error, paymentId: payment.id });
  }
  const fresh = await db.payment.findUnique({ where: { id: paymentId } });
  if (fresh && (OPEN_PAYMENT as readonly string[]).includes(fresh.status) && fresh.expiresAt < new Date()) {
    const expired = await db.payment.updateMany({
      where: { id: fresh.id, status: { in: [...OPEN_PAYMENT] } },
      data: { status: "EXPIRED", failureReason: "Délai de validation dépassé. Aucune confirmation reçue de l'opérateur." },
    });
    if (expired.count) return db.payment.findUnique({ where: { id: paymentId } });
  }
  return fresh;
}

export async function applyVerification(paymentId: string, v: VerifyResult) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  const mismatch =
    (v.amount !== null && v.amount !== payment.amount ? `montant ${v.amount} ≠ ${payment.amount}` : null) ??
    (v.merchantReference && v.merchantReference !== payment.id ? "référence marchande différente" : null);

  if (v.status === "SUCCEEDED") {
    if (mismatch) {
      log.error("paiement confirmé mais incohérent", { paymentId, mismatch });
      const flagged = await db.payment.updateMany({
        where: { id: paymentId, status: { not: "SUCCEEDED" }, OR: [{ providerStatus: null }, { providerStatus: { not: "mismatch" } }] },
        data: { status: "FAILED", providerStatus: "mismatch", failureReason: `Contrôle de cohérence en échec (${mismatch}). Vérification manuelle requise.` },
      });
      if (flagged.count) {
        await notifyStaff("payment.refund", { type: "payment.mismatch", title: "Paiement incohérent à vérifier", body: `Le prestataire confirme un encaissement qui ne correspond pas à la commande (${mismatch}).`, link: "/gestion/paiements" });
      }
      return;
    }
    await settlePayment(paymentId, v.providerStatus);
    return;
  }
  if (v.status === "FAILED" || v.status === "CANCELLED") {
    const updated = await db.payment.updateMany({
      where: { id: paymentId, status: { in: [...OPEN_PAYMENT] } },
      data: { status: v.status, providerStatus: v.providerStatus, failureReason: v.failureReason ?? "Paiement non abouti.", verifiedAt: new Date() },
    });
    if (updated.count) {
      await notify({
        userId: payment.userId, type: "payment.failed", title: "Paiement non abouti",
        body: `${v.failureReason ?? "Votre paiement n'a pas abouti."} Aucun montant n'a été encaissé. Vous pouvez réessayer.`,
        link: `/app/paiements/${payment.orderId}`,
      });
    }
    return;
  }
  await db.payment.updateMany({ where: { id: paymentId, status: { in: [...OPEN_PAYMENT] } }, data: { providerStatus: v.providerStatus } });
}

async function nextInvoiceNumber(tx: Tx) {
  const year = new Date().getUTCFullYear();
  const key = `invoice:${year}`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1 RETURNING "value"`;
  return `FAC-${year}-${String(rows[0]!.value).padStart(6, "0")}`;
}

/**
 * Enregistre un encaissement vérifié. Idempotent : un second appel pour le même paiement ne fait rien.
 * Si la commande est déjà réglée par un autre paiement, celui-ci est marqué « doublon » et un remboursement est ouvert.
 */
async function settlePayment(paymentId: string, providerStatus: string) {
  const settings = await loadSettings();
  const outcome = await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "SUCCEEDED" } },
      data: { status: "SUCCEEDED", providerStatus, verifiedAt: new Date(), failureReason: null },
    });
    if (claimed.count === 0) return { kind: "already" as const };
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${payment.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { user: { select: { referredById: true } } } });

    if (order.status !== "PENDING" && order.status !== "EXPIRED") {
      await tx.payment.update({ where: { id: paymentId }, data: { duplicate: true } });
      const refund = await tx.refund.create({
        data: { paymentId, orderId: order.id, amount: payment.amount, reason: "Double paiement détecté automatiquement : la commande était déjà réglée ou annulée.", requestedById: order.userId },
      });
      return { kind: "duplicate" as const, payment, order, refundId: refund.id };
    }

    const invoiceNumber = await nextInvoiceNumber(tx);
    await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), invoiceNumber } });

    if (order.campaignId) {
      const campaign = await tx.campaign.findUnique({ where: { id: order.campaignId }, select: { status: true } });
      if (campaign && (campaign.status === "PENDING_PAYMENT" || campaign.status === "DRAFT")) {
        await tx.campaign.update({ where: { id: order.campaignId }, data: { status: "PAID" } });
        await tx.campaignStatusEvent.create({ data: { campaignId: order.campaignId, fromStatus: campaign.status, toStatus: "PAID", note: `Paiement Mobile Money vérifié (${invoiceNumber}).` } });
      }
    }

    if (order.subscriptionId) {
      const sub = await tx.subscription.findUnique({ where: { id: order.subscriptionId } });
      const service = await tx.service.findUnique({ where: { code: order.serviceCode } });
      if (sub) {
        const now = new Date();
        const start = sub.status === "ACTIVE" && sub.periodEnd && sub.periodEnd > now ? sub.periodEnd : now;
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: "ACTIVE", periodStart: sub.status === "ACTIVE" && sub.periodStart ? sub.periodStart : now, periodEnd: addDays(start, service?.periodDays ?? 30) },
        });
      }
    }

    if (order.promoCodeId && order.discount > 0) {
      await tx.promoRedemption.create({ data: { promoCodeId: order.promoCodeId, userId: order.userId, orderId: order.id, amount: order.discount } });
      await tx.promoCode.update({ where: { id: order.promoCodeId }, data: { usedCount: { increment: 1 } } });
    }

    const points = loyaltyPointsFor(order.serviceFee - order.discount, settings);
    if (points > 0) {
      await tx.loyaltyEntry.create({ data: { userId: order.userId, points, reason: `Commande ${order.reference}`, orderId: order.id } });
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: points } } });
    }

    let referrerId: string | null = null;
    if (order.user.referredById && settings.referralReward > 0) {
      const already = await tx.referralReward.findUnique({ where: { refereeId: order.userId } });
      if (!already) {
        const voucher = await tx.promoCode.create({
          data: { code: `PARRAIN-${randomCode(6)}`, description: "Récompense de parrainage", type: "FIXED", value: settings.referralReward, maxUses: 1, perUserLimit: 1, source: "REFERRAL", ownerId: order.user.referredById },
        });
        await tx.referralReward.create({ data: { referrerId: order.user.referredById, refereeId: order.userId, orderId: order.id, promoCodeId: voucher.id } });
        referrerId = order.user.referredById;
      }
    }
    return { kind: "settled" as const, payment, order, invoiceNumber, points, referrerId };
  });

  if (outcome.kind === "already") return;
  const { payment, order } = outcome;
  if (outcome.kind === "duplicate") {
    log.warn("double paiement détecté", { paymentId, orderId: order.id });
    await audit({ action: "payment.duplicate_detected", entity: "Payment", entityId: paymentId, meta: { orderId: order.id, refundId: outcome.refundId } });
    await notify({ userId: order.userId, type: "payment.duplicate", title: "Double paiement détecté", body: `Nous avons reçu un second paiement de ${formatFcfa(payment.amount)} pour la commande ${order.reference}. Une demande de remboursement a été ouverte automatiquement.`, link: "/app/paiements", email: true, whatsapp: true });
    await notifyStaff("payment.refund", { type: "refund.requested", title: "Remboursement à traiter (double paiement)", body: `Commande ${order.reference} — ${formatFcfa(payment.amount)}.`, link: "/gestion/paiements?vue=remboursements" });
    return;
  }

  log.info("paiement encaissé", { paymentId, orderId: order.id, invoice: outcome.invoiceNumber, amount: payment.amount });
  await audit({ action: "payment.settled", entity: "Order", entityId: order.id, meta: { paymentId, invoice: outcome.invoiceNumber, amount: payment.amount, provider: payment.provider } });
  await notify({
    userId: order.userId, type: "payment.succeeded", title: "Paiement confirmé",
    body: `Nous avons bien reçu ${formatFcfa(payment.amount)} pour la commande ${order.reference}. Votre reçu ${outcome.invoiceNumber} est disponible.`,
    link: order.campaignId ? `/app/campagnes/${order.campaignId}` : `/app/paiements/${order.id}`, email: true, whatsapp: true,
  });
  if (order.campaignId) {
    await notifyStaff("campaign.assign", { type: "order.paid", title: "Nouvelle commande payée", body: `Commande ${order.reference} — ${order.serviceLabel}. À attribuer.`, link: `/gestion/campagnes/${order.campaignId}`, email: true });
  }
  if (outcome.referrerId) {
    await notify({ userId: outcome.referrerId, type: "referral.reward", title: "Votre parrainage est récompensé", body: `Un filleul vient de passer sa première commande. Un bon de ${formatFcfa(settings.referralReward)} a été ajouté à votre compte.`, link: "/app/compte?onglet=fidelite", email: true });
  }
}

// ─────────────────────────── Webhooks ───────────────────────────

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

export async function handlePaymentWebhook(providerId: string, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  const provider = getProviderById(providerId);
  if (!provider) return { status: 404, body: { error: "unknown_provider" } };
  let event;
  try {
    event = provider.parseWebhook(rawBody, headers);
  } catch (error) {
    if (!(error instanceof WebhookSignatureError)) throw error;
    log.warn("webhook rejeté", { provider: providerId, reason: error.message });
    await db.paymentEvent.createMany({
      data: [{ provider: providerId, eventKey: `invalid:${createHash("sha256").update(rawBody).digest("hex")}`, type: "invalid_signature", payload: { size: rawBody.length }, signatureValid: false, outcome: error.message }],
      skipDuplicates: true,
    });
    return { status: 400, body: { error: "invalid_signature" } };
  }

  const inserted = await db.paymentEvent.createMany({
    data: [{ provider: providerId, eventKey: event.eventKey, type: event.type, payload: event.payload as never, signatureValid: true }],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return { status: 200, body: { received: true, duplicate: true } };

  let outcome = "ignored";
  let paymentId: string | null = null;
  if (event.providerRef) {
    // Le contenu du webhook n'est qu'un signal : l'état est relu chez le prestataire.
    const verification = await provider.verify(event.providerRef);
    let payment = await db.payment.findUnique({ where: { provider_providerRef: { provider: providerId, providerRef: event.providerRef } } });
    if (!payment && verification.merchantReference) {
      // Le webhook peut arriver avant que la référence du prestataire ne soit enregistrée.
      const attached = await db.payment.updateMany({ where: { id: verification.merchantReference, provider: providerId, providerRef: null }, data: { providerRef: event.providerRef } });
      if (attached.count) payment = await db.payment.findUnique({ where: { id: verification.merchantReference } });
    }
    if (payment) {
      paymentId = payment.id;
      await applyVerification(payment.id, verification);
      outcome = `verified:${verification.status}`;
    } else {
      outcome = "unknown_payment";
      log.warn("webhook pour un paiement inconnu", { provider: providerId, providerRef: event.providerRef });
    }
  }
  await db.paymentEvent.update({ where: { provider_eventKey: { provider: providerId, eventKey: event.eventKey } }, data: { outcome, paymentId } });
  return { status: 200, body: { received: true, outcome } };
}

// ─────────────────────────── Maintenance ───────────────────────────

/** Tâche planifiée : relance la vérification des paiements ouverts et expire ceux restés sans réponse. */
export async function reconcileOpenPayments(limit = 50) {
  const open = await db.payment.findMany({ where: { status: { in: [...OPEN_PAYMENT] } }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  for (const p of open) await refreshPayment(p.id, { force: true });
  return open.length;
}

// ─────────────────────────── Remboursements ───────────────────────────

export async function refundableAmount(paymentId: string, client: Tx | typeof db = db) {
  const payment = await client.payment.findUnique({ where: { id: paymentId }, include: { refunds: { where: { status: { not: "REJECTED" } } } } });
  if (!payment || payment.status !== "SUCCEEDED") return 0;
  return payment.amount - payment.refunds.reduce((sum, r) => sum + r.amount, 0);
}

export async function requestRefund(args: { paymentId: string; amount: number; reason: string; actorId: string }) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${args.paymentId} FOR UPDATE`;
    const max = await refundableAmount(args.paymentId, tx);
    if (max <= 0) throw new DomainError("Ce paiement ne peut pas être remboursé.");
    if (!Number.isInteger(args.amount) || args.amount <= 0 || args.amount > max) throw new DomainError(`Le montant doit être compris entre 1 F et ${formatFcfa(max)}.`);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: args.paymentId } });
    return tx.refund.create({ data: { paymentId: payment.id, orderId: payment.orderId, amount: args.amount, reason: args.reason, requestedById: args.actorId } });
  });
}

/**
 * Clôture un remboursement. Le transfert Mobile Money est effectué depuis le compte du prestataire
 * (FedaPay ne propose pas de remboursement automatique des paiements mobiles) puis sa référence est consignée ici.
 */
export async function resolveRefund(args: { refundId: string; decision: "PROCESSED" | "REJECTED"; reference?: string; note?: string; actorId: string }) {
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.refund.updateMany({
      where: { id: args.refundId, status: "REQUESTED" },
      data: { status: args.decision, reference: args.reference || null, note: args.note || null, processedById: args.actorId, processedAt: new Date() },
    });
    if (claimed.count === 0) throw new DomainError("Ce remboursement a déjà été traité.");
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: args.refundId }, include: { payment: true, order: true } });
    if (args.decision === "PROCESSED" && !refund.payment.duplicate) {
      const processed = await tx.refund.aggregate({ where: { orderId: refund.orderId, status: "PROCESSED", payment: { duplicate: false } }, _sum: { amount: true } });
      const total = processed._sum.amount ?? 0;
      await tx.order.update({ where: { id: refund.orderId }, data: { status: total >= refund.order.total ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    }
    return refund;
  });
  await audit({ actorId: args.actorId, action: `refund.${args.decision.toLowerCase()}`, entity: "Refund", entityId: result.id, meta: { amount: result.amount, reference: args.reference } });
  await notify({
    userId: result.order.userId,
    type: args.decision === "PROCESSED" ? "refund.processed" : "refund.rejected",
    title: args.decision === "PROCESSED" ? "Remboursement effectué" : "Demande de remboursement refusée",
    body: args.decision === "PROCESSED"
      ? `${formatFcfa(result.amount)} vous ont été reversés par Mobile Money pour la commande ${result.order.reference}.${args.reference ? ` Référence : ${args.reference}.` : ""}`
      : `Votre demande concernant la commande ${result.order.reference} n'a pas été acceptée.${args.note ? ` Motif : ${args.note}` : ""}`,
    link: "/app/paiements", email: true, whatsapp: true,
  });
  return result;
}

export function paymentModeInfo() {
  const provider = getActiveProvider();
  const operators = PAYMENT_COUNTRIES[0]!.operators.filter((o) => provider?.supportedOperators.includes(o.code));
  return { available: Boolean(provider), providerId: provider?.id ?? null, providerLabel: provider?.label ?? null, mode: provider?.mode ?? null, operators };
}

