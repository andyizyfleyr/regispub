// Parcours FedaPay de bout en bout, sur une vraie base et face à un faux serveur FedaPay écrit d'après la documentation
// (collecte, lien de la page de paiement, réponses « v1/transaction », notifications signées).
// Le client paie sur la page FedaPay : ici, « payOnFedapayPage » joue ce qu'il y fait.
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

type Tx = { id: number; status: string; amount: number; merchant_reference: string; last_error_code: string | null; mode: string | null };
const fedapay = {
  transactions: new Map<number, Tx>(),
  calls: [] as { method: string; path: string; body: Record<string, unknown> | null }[],
  nextId: 1000,
  acceptedKey: SECRET_KEY,
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
    const tx: Tx = { id: fedapay.nextId++, status: "pending", amount: Number(body?.amount), merchant_reference: reference, last_error_code: null, mode: null };
    fedapay.transactions.set(tx.id, tx);
    return json(200, { "v1/transaction": { ...tx, klass: "v1/transaction" } });
  }
  const token = path.match(/^\/transactions\/(\d+)\/token$/);
  if (method === "POST" && token) return json(200, { token: `tok_${token[1]}`, url: `https://sandbox-process.fedapay.com/tok_${token[1]}` });
  const one = path.match(/^\/transactions\/(\d+)$/);
  if (method === "GET" && one) {
    const tx = fedapay.transactions.get(Number(one[1]));
    return tx ? json(200, { "v1/transaction": { ...tx, klass: "v1/transaction" } }) : json(404, { message: "Transaction introuvable" });
  }
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
beforeEach(() => { fedapay.calls.length = 0; fedapay.acceptedKey = SECRET_KEY; });
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
/** Le client touche « Payer » : aucun numéro, aucun opérateur ne lui est demandé chez nous. */
const pay = (orderId: string) => startPayment({ orderId, userId, idempotencyKey: key() });
/** Ce que le client fait sur la page FedaPay. En mode test, FedaPay n'accepte que ses deux numéros d'essai. */
async function payOnFedapayPage(paymentId: string, number: string, mode = "momo_test") {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const tx = fedapay.transactions.get(Number(payment.providerRef))!;
  tx.mode = mode;
  if (TEST_NUMBERS.includes(number)) tx.status = "approved";
  else { tx.status = "declined"; tx.last_error_code = null; }
  return tx;
}
const orderStatus = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;

function fedapayNotification(name: string, transactionId: number, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify({ name, entity: { id: transactionId, klass: "v1/transaction", status: name.split(".")[1] } });
  const t = Math.floor(Date.now() / 1000);
  return { raw, headers: new Headers({ "X-FEDAPAY-SIGNATURE": `t=${t},s=${signFedapayPayload(raw, secret, t)}` }) };
}

describe("FedaPay : paiement sur la page FedaPay", () => {
  it("n'a rien à faire saisir au client : ni mode test, ni numéro, ni opérateur", async () => {
    const mode = await paymentModeInfo();
    expect(mode).toMatchObject({ available: true, providerId: "fedapay", mode: "test", checkout: "hosted" });
    // Le client est prévenu avant d'aller sur la page FedaPay : en test, seuls les numéros d'essai passent.
    expect(mode.testNotice).toContain("64 00 00 01 ou 66 00 00 01");
    // Rappel réservé à l'équipe.
    expect(mode.testNumbers).toEqual(["64000001", "66000001"]);
  });

  it("envoie le client sur la page FedaPay, puis encaisse après relecture de la collecte", async () => {
    const order = await newOrder();
    const started = await pay(order.id);
    expect(started).toMatchObject({ ok: true, redirectUrl: expect.stringContaining("https://sandbox-process.fedapay.com/") });
    if (!started.ok) return;
    // Deux appels : la collecte, puis le lien de sa page de paiement. Aucun numéro ne part de chez nous.
    expect(fedapay.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /transactions", expect.stringMatching(/^POST \/transactions\/\d+\/token$/)]);
    expect(fedapay.calls[0]!.body).toMatchObject({ amount: 50_900, currency: { iso: "XOF" }, merchant_reference: started.paymentId, callback_url: expect.stringContaining(`/app/paiements/${order.id}`) });
    expect(JSON.stringify(fedapay.calls[0]!.body)).not.toContain("phone");
    // Rien n'est tenu pour payé avant la relecture auprès de FedaPay.
    expect(await orderStatus(order.id)).toBe("PENDING");
    expect(await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } })).toMatchObject({ status: "PENDING", provider: "fedapay", phone: null, operator: null, redirectUrl: started.redirectUrl });

    // Le client paie sur la page FedaPay et revient : la commande est relue (l'adresse de retour n'est pas crue).
    await payOnFedapayPage(started.paymentId, "64000001", "mtn_open");
    expect(await refreshOrderPayments(order.id, { force: true })).toBe(true);
    // L'opérateur utilisé est repris de FedaPay.
    expect(await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } })).toMatchObject({ status: "SUCCEEDED", providerStatus: "approved", operator: "MTN" });
    expect(await orderStatus(order.id)).toBe("PAID");
  });

  it("renvoie sur la même page si le client revient sans avoir payé : une seule collecte, donc un seul paiement possible", async () => {
    const order = await newOrder();
    const first = await pay(order.id);
    const again = await pay(order.id);
    if (!first.ok || !again.ok) throw new Error("démarrage refusé");
    expect(again.paymentId).toBe(first.paymentId);
    expect(again.redirectUrl).toBe(first.redirectUrl);
    expect(fedapay.calls.filter((c) => c.path === "/transactions")).toHaveLength(1);
    await db.payment.update({ where: { id: first.paymentId }, data: { status: "CANCELLED" } });
  });

  it("explique un refus, puis ouvre une nouvelle page de paiement au clic suivant", async () => {
    const order = await newOrder();
    const first = await pay(order.id);
    if (!first.ok) throw new Error(first.error);
    await payOnFedapayPage(first.paymentId, "0197000001");
    await refreshPayment(first.paymentId, { force: true });
    const failed = await db.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    expect(failed).toMatchObject({ status: "CANCELLED", providerStatus: "declined" });
    expect(failed.failureReason).toMatch(/pas été validé/);
    expect(await orderStatus(order.id)).toBe("PENDING");

    const second = await pay(order.id);
    if (!second.ok) throw new Error(second.error);
    expect(second.paymentId).not.toBe(first.paymentId);
    expect(second.redirectUrl).not.toBe(first.redirectUrl);
    await payOnFedapayPage(second.paymentId, "66000001");
    await refreshPayment(second.paymentId, { force: true });
    expect(await orderStatus(order.id)).toBe("PAID");
    expect(new Set([...fedapay.transactions.values()].map((t) => t.merchant_reference)).size).toBe(fedapay.transactions.size);
  });

  it("ouvre tout de suite une nouvelle page quand le refus n'est découvert qu'au clic sur « Payer »", async () => {
    const order = await newOrder();
    const first = await pay(order.id);
    if (!first.ok) throw new Error(first.error);
    await payOnFedapayPage(first.paymentId, "0197000001"); // refusé chez FedaPay, pas encore relu chez nous
    const second = await pay(order.id);
    if (!second.ok) throw new Error(second.error);
    expect(second.paymentId).not.toBe(first.paymentId);
    expect(second.redirectUrl).toContain("https://sandbox-process.fedapay.com/");
    expect((await db.payment.findUniqueOrThrow({ where: { id: first.paymentId } })).status).toBe("CANCELLED");
    await db.payment.update({ where: { id: second.paymentId }, data: { status: "CANCELLED" } });
  });
});

describe("FedaPay : notifications signées", () => {
  it("encaisse à la notification, après avoir relu la collecte chez FedaPay", async () => {
    const order = await newOrder();
    const started = await pay(order.id);
    if (!started.ok) throw new Error(started.error);
    await payOnFedapayPage(started.paymentId, "64000001");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef));
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ status: 200, body: { outcome: "verified:SUCCEEDED" } });
    expect(await orderStatus(order.id)).toBe("PAID");
    // FedaPay renvoie parfois la même notification : elle est reconnue.
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ status: 200, body: { duplicate: true } });
  });

  it("ne croit pas le contenu d'une notification : seule la relecture chez FedaPay compte", async () => {
    const order = await newOrder();
    const started = await pay(order.id);
    if (!started.ok) throw new Error(started.error);
    await payOnFedapayPage(started.paymentId, "64000001");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    fedapay.transactions.get(Number(payment.providerRef))!.status = "pending";
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef));
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ status: 200, body: { outcome: "verified:PENDING" } });
    expect(await orderStatus(order.id)).toBe("PENDING");
    await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  });

  it("refuse une notification signée avec un autre secret", async () => {
    const order = await newOrder();
    const started = await pay(order.id);
    if (!started.ok) throw new Error(started.error);
    await payOnFedapayPage(started.paymentId, "64000001");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef), "wh_sandbox_autre");
    expect((await handlePaymentWebhook("fedapay", n.raw, n.headers)).status).toBe(400);
    expect(await orderStatus(order.id)).toBe("PENDING");
    await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  });

  it("rattache une notification arrivée avant que la référence FedaPay ne soit enregistrée", async () => {
    const order = await newOrder();
    const started = await pay(order.id);
    if (!started.ok) throw new Error(started.error);
    await payOnFedapayPage(started.paymentId, "64000001");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: null } });
    const n = fedapayNotification("transaction.approved", Number(payment.providerRef));
    expect(await handlePaymentWebhook("fedapay", n.raw, n.headers)).toMatchObject({ body: { outcome: "verified:SUCCEEDED" } });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "SUCCEEDED", providerRef: payment.providerRef });
  });
});

describe("FedaPay : quand ça ne se passe pas comme prévu", () => {
  it("encaisse un paiement fait sur la page FedaPay après l'expiration de notre demande", async () => {
    const order = await newOrder();
    const started = await pay(order.id);
    if (!started.ok) throw new Error(started.error);
    await db.payment.update({ where: { id: started.paymentId }, data: { status: "EXPIRED" } });
    await payOnFedapayPage(started.paymentId, "64000001");
    expect(await refreshOrderPayments(order.id)).toBe(true);
    expect(await orderStatus(order.id)).toBe("PAID");
  });

  it("prévient l'équipe, une seule fois, quand FedaPay refuse la clé", async () => {
    const order = await newOrder();
    fedapay.acceptedKey = "sk_sandbox_une_autre";
    await db.notification.deleteMany({ where: { type: "payment.provider_rejected" } });
    const first = await pay(order.id);
    expect(first).toMatchObject({ ok: false, error: expect.stringContaining("momentanément indisponible") });
    const second = await pay(order.id);
    expect(second.ok).toBe(false);
    const alerts = await db.notification.findMany({ where: { type: "payment.provider_rejected" } });
    expect(alerts.length).toBeGreaterThan(0);
    expect(new Set(alerts.map((a) => a.userId)).size).toBe(alerts.length);
    expect(alerts[0]!.body).toContain("Clés et connexions");
    expect(await db.payment.count({ where: { orderId: order.id, status: "FAILED", providerStatus: "initiation_error" } })).toBe(2);
    expect(await orderStatus(order.id)).toBe("PENDING");
  });
});
