// Ce que la documentation FedaPay impose au-delà du simple paiement : répondre vite aux notifications puis les traiter,
// reprendre un traitement interrompu, et ne jamais tenir un refus pour définitif (prestataire : simulateur).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSubscriptionOrder } from "@/lib/campaigns/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { SandboxProvider } from "@/lib/payments/sandbox";
import {
  applyVerification, handlePaymentWebhook, processPaymentEvent, receivePaymentWebhook, reconcileOpenPayments, refreshOrderPayments, startPayment,
} from "@/lib/payments/service";

let userId = "";
const key = () => randomUUID();
const sandbox = () => new SandboxProvider(env.appSecret);

beforeAll(async () => { userId = (await db.user.findUniqueOrThrow({ where: { email: "client@regispub.local" } })).id; });
afterAll(async () => { await db.$disconnect(); });

async function newPayment(phone = "0197000001") {
  await db.order.updateMany({ where: { userId, status: "PENDING", subscriptionId: { not: null } }, data: { status: "CANCELLED" } });
  const res = await createSubscriptionOrder(userId, "monthly_support", null, null);
  if (!res.ok) throw new Error(res.error);
  const started = await startPayment({ orderId: res.orderId, userId, operator: "MTN", phoneInput: phone, idempotencyKey: key() });
  if (!started.ok) throw new Error(started.error);
  return { started, payment: await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } }) };
}

/** Référence de simulation « déjà approuvée chez le prestataire » pour ce paiement (comme si la demande datait d'une minute). */
async function approvedRef(payment: { id: string; amount: number }) {
  const past = new SandboxProvider(env.appSecret, () => Date.now() - 60_000);
  const { providerRef } = await past.initiate({
    paymentId: payment.id, orderReference: "CMD", amount: payment.amount, currency: "XOF", operator: "MTN",
    phone: { e164: "+2290197000001", national: "0197000001", country: "BJ" }, customer: { name: "Test", email: "t@example.com" }, description: "Test", callbackUrl: "http://localhost/cb",
  });
  return providerRef;
}

function notification(providerRef: string | null) {
  const raw = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.updated", providerRef });
  return { raw, headers: new Headers({ "x-sandbox-signature": sandbox().signWebhook(raw) }) };
}

describe("démarrage d'un paiement", () => {
  it("renvoie l'échéance réelle de la demande ; avec le simulateur, aucune page extérieure à ouvrir", async () => {
    const { started, payment } = await newPayment();
    expect(started.redirectUrl).toBeUndefined();
    expect(started.expiresAt.getTime()).toBe(payment.expiresAt.getTime());
    expect(started.expiresAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });
});

describe("notifications du prestataire", () => {
  it("répond d'abord, traite ensuite : la notification est enregistrée « à traiter » sans appel extérieur", async () => {
    const { payment } = await newPayment();
    const n = notification(payment.providerRef);
    const receipt = await receivePaymentWebhook("sandbox", n.raw, n.headers);
    expect(receipt.status).toBe(200);
    expect(receipt.pending).toBeDefined();
    const stored = await db.paymentEvent.findUniqueOrThrow({ where: { provider_eventKey: { provider: "sandbox", eventKey: receipt.pending!.eventKey } } });
    expect(stored).toMatchObject({ signatureValid: true, outcome: null, paymentId: null });
    expect(await processPaymentEvent("sandbox", receipt.pending!.eventKey)).toBe("verified:PENDING");
    expect((await db.paymentEvent.findUniqueOrThrow({ where: { id: stored.id } }))).toMatchObject({ outcome: "verified:PENDING", paymentId: payment.id });
  });

  it("reprend au nouvel envoi une notification dont le traitement n'avait pas abouti, puis reconnaît le doublon", async () => {
    const { payment } = await newPayment();
    const n = notification(payment.providerRef);
    // Premier envoi : reçu, mais le traitement n'a pas eu lieu (panne, coupure…).
    expect((await receivePaymentWebhook("sandbox", n.raw, n.headers)).pending).toBeDefined();
    // FedaPay renvoie la même notification : elle n'est pas écartée comme doublon, elle est traitée.
    const retry = await handlePaymentWebhook("sandbox", n.raw, n.headers);
    expect(retry).toMatchObject({ status: 200, body: { received: true, outcome: "verified:PENDING" } });
    // Une fois traitée, tout nouvel envoi est ignoré.
    const again = await receivePaymentWebhook("sandbox", n.raw, n.headers);
    expect(again).toMatchObject({ status: 200, body: { received: true, duplicate: true } });
    expect(again.pending).toBeUndefined();
    expect(await db.paymentEvent.count({ where: { provider: "sandbox", paymentId: payment.id } })).toBe(1);
  });

  it("accuse réception d'une notification qui ne concerne aucune collecte, sans rien faire", async () => {
    const n = notification(null);
    expect(await handlePaymentWebhook("sandbox", n.raw, n.headers)).toMatchObject({ status: 200, body: { outcome: "ignored" } });
  });
});

describe("un refus n'est pas définitif", () => {
  it("encaisse la commande si le prestataire approuve après un refus", async () => {
    const { payment } = await newPayment();
    const base = { providerRef: payment.providerRef!, amount: payment.amount, merchantReference: payment.id };
    await applyVerification(payment.id, { ...base, status: "CANCELLED", providerStatus: "declined", failureReason: "La validation sur le téléphone n'est pas allée au bout." });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "CANCELLED", providerStatus: "declined" });
    expect(await db.notification.count({ where: { userId, type: "payment.failed", link: { contains: payment.orderId } } })).toBe(1);

    await applyVerification(payment.id, { ...base, status: "SUCCEEDED", providerStatus: "approved" });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "SUCCEEDED", failureReason: null });
    expect((await db.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status).toBe("PAID");
  });

  it("relit la dernière tentative close à l'ouverture de la commande (retour depuis la page du prestataire)", async () => {
    const { payment } = await newPayment();
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: await approvedRef(payment), status: "EXPIRED", failureReason: "Délai de validation dépassé." } });
    expect(await refreshOrderPayments(payment.orderId)).toBe(true);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await db.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status).toBe("PAID");
    // Commande réglée : plus rien à relire.
    expect(await refreshOrderPayments(payment.orderId)).toBe(false);
  });

  it("la tâche planifiée reprend les notifications en attente et revérifie les tentatives closes depuis peu", async () => {
    const waiting = await newPayment();
    const ref = await approvedRef(waiting.payment);
    await db.payment.update({ where: { id: waiting.payment.id }, data: { providerRef: ref } });
    const n = notification(ref);
    const receipt = await receivePaymentWebhook("sandbox", n.raw, n.headers);

    const closed = await newPayment();
    await db.payment.update({ where: { id: closed.payment.id }, data: { providerRef: await approvedRef(closed.payment), status: "FAILED", failureReason: "L'opérateur n'a pas accepté le paiement." } });
    // Une tentative trop ancienne n'est plus interrogée : la collecte a expiré chez le prestataire.
    const old = await newPayment();
    await db.payment.update({ where: { id: old.payment.id }, data: { providerRef: await approvedRef(old.payment), status: "FAILED", createdAt: new Date(Date.now() - 3 * 86_400_000) } });

    await reconcileOpenPayments(200);

    expect((await db.paymentEvent.findUniqueOrThrow({ where: { provider_eventKey: { provider: "sandbox", eventKey: receipt.pending!.eventKey } } })).outcome).toBe("verified:SUCCEEDED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: waiting.payment.id } })).status).toBe("SUCCEEDED");
    // La commande de « waiting » a été annulée par la commande suivante : son encaissement tardif ouvre un remboursement.
    expect(await db.payment.findUniqueOrThrow({ where: { id: waiting.payment.id } })).toMatchObject({ duplicate: true });
    expect(await db.refund.count({ where: { paymentId: waiting.payment.id, status: "REQUESTED" } })).toBe(1);
    expect((await db.payment.findUniqueOrThrow({ where: { id: closed.payment.id } })).status).toBe("SUCCEEDED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: old.payment.id } })).status).toBe("FAILED");
  });
});
