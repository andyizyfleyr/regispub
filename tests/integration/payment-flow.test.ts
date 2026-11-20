// Parcours de paiement de bout en bout sur une vraie base PostgreSQL (prestataire : simulateur).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSubscriptionOrder } from "@/lib/campaigns/service";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { applyVerification, handlePaymentWebhook, refundableAmount, requestRefund, resolvePromo, resolveRefund, startPayment } from "@/lib/payments/service";

let userId = "", adminId = "";
const key = () => randomUUID();

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: "client@regispub.local" } })).id;
  adminId = (await db.user.findUniqueOrThrow({ where: { email: "admin@regispub.local" } })).id;
});
afterAll(async () => { await db.$disconnect(); });

async function newOrder() {
  // Chaque commande d'abonnement en attente est réutilisée : on la solde ou on l'annule entre deux tests.
  await db.order.updateMany({ where: { userId, status: "PENDING", subscriptionId: { not: null } }, data: { status: "CANCELLED" } });
  const res = await createSubscriptionOrder(userId, "monthly_support", null, null);
  if (!res.ok) throw new Error(res.error);
  return db.order.findUniqueOrThrow({ where: { id: res.orderId } });
}

describe("paiement Mobile Money", () => {
  it("crée une commande au tarif du serveur (50 000 F + 1,8 % de frais)", async () => {
    const order = await newOrder();
    expect(order).toMatchObject({ status: "PENDING", adBudget: 0, serviceFee: 50_000, paymentFee: 900, total: 50_900 });
  });

  it("refuse un numéro invalide et la commande d'un autre utilisateur", async () => {
    const order = await newOrder();
    expect(await startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "12345", idempotencyKey: key() })).toMatchObject({ ok: false });
    expect(await startPayment({ orderId: order.id, userId: adminId, operator: "MTN", phoneInput: "0197000001", idempotencyKey: key() })).toMatchObject({ ok: false, error: "Commande introuvable." });
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("est idempotent : la même demande ne crée qu'un paiement, et un paiement en cours bloque le suivant", async () => {
    const order = await newOrder();
    const k = key();
    const [a, b] = await Promise.all([
      startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "0197000099", idempotencyKey: k }),
      startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "0197000099", idempotencyKey: k }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    const other = await startPayment({ orderId: order.id, userId, operator: "MOOV", phoneInput: "0195000001", idempotencyKey: key() });
    expect(other.ok).toBe(false);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    await db.payment.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
  });

  it("ne valide pas une commande si le montant confirmé diffère du montant attendu", async () => {
    const order = await newOrder();
    const started = await startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "0197000001", idempotencyKey: key() });
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    await applyVerification(payment.id, { providerRef: payment.providerRef!, status: "SUCCEEDED", amount: 100, providerStatus: "approved", merchantReference: payment.id });
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("valide la commande une seule fois après vérification, même si la confirmation est rejouée", async () => {
    const order = await newOrder();
    const started = await startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "0197000001", idempotencyKey: key() });
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    expect(payment.amount).toBe(50_900);
    const ok = { providerRef: payment.providerRef!, status: "SUCCEEDED" as const, amount: 50_900, providerStatus: "approved", merchantReference: payment.id };
    await Promise.all([applyVerification(payment.id, ok), applyVerification(payment.id, ok), applyVerification(payment.id, ok)]);
    await applyVerification(payment.id, ok);

    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { subscription: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.invoiceNumber).toMatch(/^FAC-\d{4}-\d{6}$/);
    expect(paid.subscription?.status).toBe("ACTIVE");
    expect(await db.loyaltyEntry.count({ where: { orderId: order.id } })).toBe(1);
    expect((await db.loyaltyEntry.findFirstOrThrow({ where: { orderId: order.id } })).points).toBe(50);
    expect(await db.notification.count({ where: { userId, type: "payment.succeeded", link: { contains: order.id } } })).toBe(1);
    // Un échec tardif ne revient pas sur un paiement confirmé.
    await applyVerification(payment.id, { ...ok, status: "FAILED", providerStatus: "declined" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    // Une commande payée ne peut plus être payée.
    expect((await startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "0197000001", idempotencyKey: key() })).ok).toBe(false);
  });

  it("rejette un webhook mal signé (consigné, sans effet) et un prestataire inconnu", async () => {
    const order = await newOrder();
    const started = await startPayment({ orderId: order.id, userId, operator: "MTN", phoneInput: "0197000001", idempotencyKey: key() });
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    const raw = JSON.stringify({ id: `evt_${payment.id}`, type: "payment.approved", providerRef: payment.providerRef });
    const bad = await handlePaymentWebhook("sandbox", raw, new Headers({ "x-sandbox-signature": "faux" }));
    expect(bad.status).toBe(400);
    expect((await handlePaymentWebhook("sandbox", raw, new Headers({ "x-sandbox-signature": "faux" }))).status).toBe(400);
    expect(await db.paymentEvent.count({ where: { provider: "sandbox", type: "invalid_signature", signatureValid: false } })).toBe(1);
    expect((await handlePaymentWebhook("inconnu", "{}", new Headers())).status).toBe(404);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).not.toBe("SUCCEEDED");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  });
});

describe("remboursements", () => {
  it("plafonne le total remboursé au montant encaissé et trace le traitement", async () => {
    const payment = await db.payment.findFirstOrThrow({ where: { userId, status: "SUCCEEDED", amount: 50_900 }, orderBy: { createdAt: "desc" } });
    expect(await refundableAmount(payment.id)).toBe(50_900);
    await expect(requestRefund({ paymentId: payment.id, amount: 60_000, reason: "trop", actorId: adminId })).rejects.toThrow(DomainError);
    const first = await requestRefund({ paymentId: payment.id, amount: 20_000, reason: "Geste commercial", actorId: adminId });
    await expect(requestRefund({ paymentId: payment.id, amount: 40_000, reason: "dépasse", actorId: adminId })).rejects.toThrow(DomainError);
    await resolveRefund({ refundId: first.id, decision: "PROCESSED", reference: "MM-123456", actorId: adminId });
    expect((await db.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status).toBe("PARTIALLY_REFUNDED");
    await expect(resolveRefund({ refundId: first.id, decision: "REJECTED", actorId: adminId })).rejects.toThrow(/déjà/);
    const rest = await requestRefund({ paymentId: payment.id, amount: 30_900, reason: "Solde", actorId: adminId });
    await resolveRefund({ refundId: rest.id, decision: "PROCESSED", reference: "MM-123457", actorId: adminId });
    expect((await db.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status).toBe("REFUNDED");
    expect(await refundableAmount(payment.id)).toBe(0);
    expect(await db.auditLog.count({ where: { action: "refund.processed", entityId: { in: [first.id, rest.id] } } })).toBe(2);
  });

  it("ne rembourse pas un paiement non encaissé", async () => {
    const failed = await db.payment.findFirstOrThrow({ where: { userId, status: "FAILED" } });
    await expect(requestRefund({ paymentId: failed.id, amount: 100, reason: "x", actorId: adminId })).rejects.toThrow(DomainError);
  });
});

describe("codes promotionnels", () => {
  it("accepte le code de démonstration et refuse un code inconnu", async () => {
    expect(await resolvePromo("bienvenue10", userId)).toHaveProperty("promo");
    expect(await resolvePromo("INEXISTANT", userId)).toHaveProperty("error");
  });
});
