// Parcours FedaPay de bout en bout, sur une vraie base et face à un faux serveur FedaPay écrit d'après la documentation
// (mode test « momo_test », numéros 64000001 / 66000001, réponses « v1/transaction », notifications signées).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSubscriptionOrder } from "@/lib/campaigns/service";
import { resetConfigCache, saveKeys } from "@/lib/config";
import { db } from "@/lib/db";
import { signFedapayPayload } from "@/lib/payments/fedapay";
import { handlePaymentWebhook, paymentModeInfo, refreshOrderPayments, refreshPayment, startPayment } from "@/lib/payments/service";

const SECRET_KEY = "sk_sandbox_cleDeTest0123456789";
const WEBHOOK_SECRET = "wh_sandbox_secretDeTest";
const TEST_NUMBERS = ["64000001", "66000001"];

type Tx = { id: number; status: string; amount: number; merchant_reference: string; last_error_code: string | null };
const fedapay = {
  transactions: new Map<number, Tx>(),
  calls: [] as { method: string; path: string; body: Record<string, unknown> | null }[],
  nextId: 1000,
  acceptedKey: SECRET_KEY,
  pushFails: false,
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  if (url.host !== "sandbox-api.fedapay.com") throw new Error(`appel inattendu vers ${url.host}`);
  const method = init?.method ?? "GET";
  const path = url.pathname.replace(/^\/v1/, "");
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
  fedapay.calls.push({ method, path, body });
  if (new Headers(init?.headers).get("authorization") !== `Bearer ${fedapay.acceptedKey}`) return json(401, { message: "Erreur d'authentification" });

  if (method === "POST" && path === "/transactions") {
    const reference = String(body?.merchant_reference);
    if ([...fedapay.transactions.values()].some((t) => t.merchant_reference === reference)) return json(422, { message: "La création a échoué", errors: { merchant_reference: ["est déjà utilisé"] } });
    const tx: Tx = { id: fedapay.nextId++, status: "pending", amount: Number(body?.amount), merchant_reference: reference, last_error_code: null };
    fedapay.transactions.set(tx.id, tx);
    return json(200, { "v1/transaction": { ...tx, klass: "v1/transaction" } });
  }
  const token = path.match(/^\/transactions\/(\d+)\/token$/);
  if (method === "POST" && token) return json(200, { token: `tok_${token[1]}`, url: `https://sandbox-process.fedapay.com/tok_${token[1]}` });
  if (method === "POST" && path === "/momo_test") {
    if (fedapay.pushFails) return json(422, { message: "Envoi impossible", errors: { mode: ["indisponible"] } });
    const tx = fedapay.transactions.get(Number(String(body?.token).replace("tok_", "")));
    if (!tx) return json(404, { message: "Jeton inconnu" });
    const number = String((body?.phone_number as { number?: string } | undefined)?.number);
    if (TEST_NUMBERS.includes(number)) tx.status = "approved";
    else { tx.status = "canceled"; tx.last_error_code = "INSUFFICIENT_FUNDS"; }
    return json(200, { message: "Paiement envoyé" });
  }
  const one = path.match(/^\/transactions\/(\d+)$/);
  if (method === "GET" && one) {
    const tx = fedapay.transactions.get(Number(one[1]));
    return tx ? json(200, { "v1/transaction": { ...tx, klass: "v1/transaction" } }) : json(404, { message: "Transaction introuvable" });
  }
  // Un opérateur réel en mode test : le mode n'existe plus chez FedaPay.
  return json(404, { message: "Not found" });
}

let userId = "", adminId = "";
const key = () => randomUUID();

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: "client@regispub.local" } })).id;
  adminId = (await db.user.findUniqueOrThrow({ where: { email: "admin@regispub.local" } })).id;
  vi.stubGlobal("fetch", fakeFetch);
  await db.appKey.deleteMany();
  resetConfigCache();
  await saveKeys({ values: { PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_SECRET_KEY: SECRET_KEY, FEDAPAY_WEBHOOK_SECRET: WEBHOOK_SECRET }, clear: [] }, adminId);
});
beforeEach(() => { fedapay.calls.length = 0; fedapay.acceptedKey = SECRET_KEY; fedapay.pushFails = false; });
afterAll(async () => {
  vi.unstubAllGlobals();
  await db.appKey.deleteMany();
  resetConfigCache();
  await db.$disconnect();
});

async function newOrder() {
  await db.order.updateMany({ where: { userId, status: "PENDING", subscriptionId: { not: null } }, data: { status: "CANCELLED" } });
  const res = await createSubscriptionOrder(userId, "monthly_support", null, null);
  if (!res.ok) throw new Error(res.error);
  return db.order.findUniqueOrThrow({ where: { id: res.orderId } });
}
const pay = (orderId: string, phone: string, operator: "MTN" | "MOOV" | "CELTIIS" = "MTN") => startPayment({ orderId, userId, operator, phoneInput: phone, idempotencyKey: key() });
const orderStatus = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;

function fedapayNotification(name: string, transactionId: number, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify({ name, entity: { id: transactionId, klass: "v1/transaction", status: name.split(".")[1] } });
  const t = Math.floor(Date.now() / 1000);
  return { raw, headers: new Headers({ "X-FEDAPAY-SIGNATURE": `t=${t},s=${signFedapayPayload(raw, secret, t)}` }) };
}

describe("FedaPay en mode test", () => {
  it("annonce le mode test et ses numéros au client", async () => {
    const mode = await paymentModeInfo();
    expect(mode).toMatchObject({ available: true, providerId: "fedapay", mode: "test" });
    expect(mode.testNotice).toMatch(/64 00 00 01/);
    expect(mode.operators.map((o) => o.code)).toEqual(["MTN", "MOOV", "CELTIIS"]);
  });

  it("encaisse avec le numéro de test, quel que soit l'opérateur choisi", async () => {
    const order = await newOrder();
    const started = await pay(order.id, "64 00 00 01", "CELTIIS");
    expect(started).toMatchObject({ ok: true, pushed: true, redirectUrl: expect.stringContaining("https://sandbox-process.fedapay.com/") });
    if (!started.ok) return;
    expect(fedapay.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /transactions", expect.stringMatching(/^POST \/transactions\/\d+\/token$/), "POST /momo_test"]);
    expect(fedapay.calls[0]!.body).toMatchObject({ amount: 50_900, currency: { iso: "XOF" }, merchant_reference: started.paymentId, callback_url: expect.stringContaining(`/app/paiements/${order.id}`) });
    expect(fedapay.calls[2]!.body).toMatchObject({ phone_number: { number: "64000001", country: "bj" } });
    // Rien n'est tenu pour payé avant la relecture auprès de FedaPay.
    expect(await orderStatus(order.id)).toBe("PENDING");
    expect(await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } })).toMatchObject({ status: "PENDING", provider: "fedapay", phone: "+2290164000001" });

    await refreshPayment(started.paymentId, { force: true });
    expect(await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } })).toMatchObject({ status: "SUCCEEDED", providerStatus: "approved" });
    expect(await orderStatus(order.id)).toBe("PAID");
  });

  it("explique un refus et laisse le client réessayer avec une nouvelle collecte", async () => {
    const order = await newOrder();
    const first = await pay(order.id, "0197000001");
    if (!first.ok) throw new Error(first.error);
    await refreshPayment(first.paymentId, { force: true });
    const failed = await db.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    expect(failed).toMatchObject({ status: "FAILED", providerStatus: "canceled (INSUFFICIENT_FUNDS)" });
    expect(failed.failureReason).toMatch(/solde/);
    expect(await orderStatus(order.id)).toBe("PENDING");

    const second = await pay(order.id, "66000001");
    if (!second.ok) throw new Error(second.error);
    expect(second.paymentId).not.toBe(first.paymentId);
    await refreshPayment(second.paymentId, { force: true });
    expect(await orderStatus(order.id)).toBe("PAID");
    expect(new Set([...fedapay.transactions.values()].map((t) => t.merchant_reference)).size).toBe(fedapay.transactions.size);
  });
});

describe("FedaPay : notifications signées", () => {
  it("encaisse à la notification, après avoir relu la collecte chez FedaPay", async () => {
    const order = await newOrder();
    const started = await pay(order.id, "64000001");
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef));
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ status: 200, body: { outcome: "verified:SUCCEEDED" } });
    expect(await orderStatus(order.id)).toBe("PAID");
    // FedaPay renvoie parfois la même notification : elle est reconnue.
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ status: 200, body: { duplicate: true } });
  });

  it("ne croit pas le contenu d'une notification : seule la relecture chez FedaPay compte", async () => {
    const order = await newOrder();
    const started = await pay(order.id, "64000001");
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    fedapay.transactions.get(Number(payment.providerRef))!.status = "pending";
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef));
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ status: 200, body: { outcome: "verified:PENDING" } });
    expect(await orderStatus(order.id)).toBe("PENDING");
    await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  });

  it("refuse une notification signée avec un autre secret", async () => {
    const order = await newOrder();
    const started = await pay(order.id, "64000001");
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef), "wh_sandbox_autre");
    expect((await handlePaymentWebhook("fedapay", n.raw, n.headers)).status).toBe(400);
    expect(await orderStatus(order.id)).toBe("PENDING");
    await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  });

  it("rattache une notification arrivée avant que la référence FedaPay ne soit enregistrée", async () => {
    const order = await newOrder();
    const started = await pay(order.id, "64000001");
    if (!started.ok) throw new Error(started.error);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: null } });
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef));
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ body: { outcome: "verified:SUCCEEDED" } });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "SUCCEEDED", providerRef: payment.providerRef });
  });
});

describe("FedaPay : quand ça ne se passe pas comme prévu", () => {
  it("propose la page FedaPay de la même collecte quand la demande ne part pas sur le téléphone", async () => {
    const order = await newOrder();
    fedapay.pushFails = true;
    const started = await pay(order.id, "64000001");
    expect(started).toMatchObject({ ok: true, pushed: false, redirectUrl: expect.stringContaining("https://sandbox-process.fedapay.com/") });
    if (!started.ok) return;
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    expect(payment).toMatchObject({ status: "PENDING", redirectUrl: started.redirectUrl });
    const trace = await db.auditLog.findFirstOrThrow({ where: { action: "payment.push_failed", entityId: payment.id } });
    expect(JSON.stringify(trace.meta)).toContain("Envoi impossible");
    // Une seule collecte existe : pas de second paiement possible pour cette tentative.
    expect(fedapay.calls.filter((c) => c.path === "/transactions")).toHaveLength(1);

    // Le client paie sur la page FedaPay, après l'expiration de notre demande, puis revient sur la commande.
    fedapay.transactions.get(Number(payment.providerRef))!.status = "approved";
    await db.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
    expect(await refreshOrderPayments(order.id)).toBe(true);
    expect(await orderStatus(order.id)).toBe("PAID");
  });

  it("prévient l'équipe, une seule fois, quand FedaPay refuse la clé", async () => {
    const order = await newOrder();
    fedapay.acceptedKey = "sk_sandbox_une_autre";
    await db.notification.deleteMany({ where: { type: "payment.provider_rejected" } });
    const first = await pay(order.id, "64000001");
    expect(first).toMatchObject({ ok: false, error: expect.stringContaining("momentanément indisponible") });
    const second = await pay(order.id, "64000001");
    expect(second.ok).toBe(false);
    const alerts = await db.notification.findMany({ where: { type: "payment.provider_rejected" } });
    expect(alerts.length).toBeGreaterThan(0);
    expect(new Set(alerts.map((a) => a.userId)).size).toBe(alerts.length);
    expect(alerts[0]!.body).toContain("Clés et connexions");
    expect(await db.payment.count({ where: { orderId: order.id, status: "FAILED", providerStatus: "initiation_error" } })).toBe(2);
    expect(await orderStatus(order.id)).toBe("PENDING");
  });
});
