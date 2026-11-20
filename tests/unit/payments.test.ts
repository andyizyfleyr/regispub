import { describe, expect, it } from "vitest";
import { mapFedapayStatus, operatorFromFedapayMode, signFedapayPayload, verifyFedapaySignature, FedapayProvider } from "@/lib/payments/fedapay";
import { SandboxProvider } from "@/lib/payments/sandbox";
import { PaymentProviderError, WebhookSignatureError, type InitiateInput } from "@/lib/payments/types";

const SECRET = "wh_test_secret";
const body = JSON.stringify({ id: "evt_1", name: "transaction.approved", entity: { id: 42 } });
const now = 1_800_000_000;

/** Faux serveur FedaPay, fidèle à la documentation : réponses enveloppées sous « v1/transaction », erreurs « message » + « errors ». */
type Call = { method: string; path: string; host: string; auth: string | null; body: Record<string, unknown> | null };
function fakeFedapay(routes: Record<string, (call: Call) => { status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: Call = {
      method: init?.method ?? "GET", path: url.pathname.replace(/^\/v1/, ""), host: url.host,
      auth: new Headers(init?.headers).get("authorization"), body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    const res = route ? route(call) : { status: 404, json: { message: "Not found" } };
    return new Response(JSON.stringify(res.json), { status: res.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const created = () => ({ json: { "v1/transaction": { id: 258, klass: "v1/transaction", status: "pending", amount: 45_810 } } });
const tokenRoute = () => ({ json: { token: "tok_abc", url: "https://process.fedapay.com/tok_abc" } });
const fedapayInput = (): InitiateInput => ({
  paymentId: "pay_1", orderReference: "CMD-TEST", amount: 45_810, currency: "XOF", customer: { name: "Awa Dossou Kpadonou", email: "awa@example.com" },
  description: "RegisPub — commande CMD-TEST", callbackUrl: "https://regispub.example/app/paiements/ord_1",
});

describe("FedaPay : demande de paiement", () => {
  it("crée la collecte puis donne le lien de la page de paiement FedaPay, sans rien demander d'autre", async () => {
    const api = fakeFedapay({ "POST /transactions": created, "POST /transactions/258/token": tokenRoute });
    const provider = new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: SECRET, environment: "live", fetchImpl: api.fetchImpl });
    expect(provider.checkout).toBe("hosted");
    const res = await provider.initiate(fedapayInput());
    expect(res).toEqual({ providerRef: "258", status: "PENDING", providerStatus: "pending", redirectUrl: "https://process.fedapay.com/tok_abc" });
    // Deux appels seulement : c'est la page FedaPay qui demande le moyen de paiement et le numéro.
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /transactions", "POST /transactions/258/token"]);
    expect(api.calls.every((c) => c.host === "api.fedapay.com" && c.auth === "Bearer sk_live_x")).toBe(true);
    expect(api.calls[0]!.body).toEqual({
      description: "RegisPub — commande CMD-TEST", amount: 45_810, currency: { iso: "XOF" }, callback_url: "https://regispub.example/app/paiements/ord_1",
      merchant_reference: "pay_1", custom_metadata: { payment_id: "pay_1", order_reference: "CMD-TEST" },
      customer: { firstname: "Awa", lastname: "Dossou Kpadonou", email: "awa@example.com" },
    });
  });

  it("vise le serveur de test en mode test, et prévient le client que seuls les numéros d'essai passent", async () => {
    const api = fakeFedapay({ "POST /transactions": created, "POST /transactions/258/token": tokenRoute });
    const provider = new FedapayProvider({ secretKey: "sk_sandbox_x", webhookSecret: SECRET, environment: "sandbox", fetchImpl: api.fetchImpl });
    expect((await provider.initiate(fedapayInput())).redirectUrl).toBe("https://process.fedapay.com/tok_abc");
    expect(api.calls.every((c) => c.host === "sandbox-api.fedapay.com")).toBe(true);
    expect(provider.mode).toBe("test");
    expect(provider.testNotice).toMatch(/aucun argent n'est débité.*01 64 00 00 01 ou 01 66 00 00 01.*refusé/);
    // La sandbox refuse l'ancienne écriture à 8 chiffres : seuls les numéros à 10 chiffres sont annoncés.
    expect(provider.testNumbers?.every((n) => /^01\d{8}$/.test(n))).toBe(true);
    expect(new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: "", environment: "live" }).testNotice).toBeNull();
    expect(provider.testNumbers).toEqual(["0164000001", "0166000001"]);
    expect(new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: "", environment: "live" }).testNumbers).toBeNull();
  });

  it("refuse de continuer si FedaPay ne donne pas de lien de page de paiement", async () => {
    const api = fakeFedapay({ "POST /transactions": created, "POST /transactions/258/token": () => ({ json: { token: "tok_abc" } }) });
    const provider = new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: SECRET, environment: "live", fetchImpl: api.fetchImpl });
    await expect(provider.initiate(fedapayInput())).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it("signale une clé refusée, sans rien proposer au client", async () => {
    const api = fakeFedapay({ "POST /transactions": () => ({ status: 401, json: { message: "Erreur d'authentification" } }) });
    const provider = new FedapayProvider({ secretKey: "sk_live_mauvaise", webhookSecret: SECRET, environment: "live", fetchImpl: api.fetchImpl });
    const error = await provider.initiate(fedapayInput()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentProviderError);
    expect(error).toMatchObject({ kind: "auth", userMessage: expect.stringContaining("indisponible") });
    expect(api.calls).toHaveLength(1);
  });

  it("classe une panne de FedaPay ou du réseau comme une indisponibilité", async () => {
    const down = new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: "", environment: "live", fetchImpl: (async () => { throw new Error("ECONNRESET"); }) as typeof fetch });
    await expect(down.verify("258")).rejects.toMatchObject({ kind: "unavailable" });
    const api = fakeFedapay({ "GET /transactions/258": () => ({ status: 500, json: { message: "Oups" } }) });
    await expect(new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: "", environment: "live", fetchImpl: api.fetchImpl }).verify("258")).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("n'est pas considéré comme configuré sans clé secrète, et n'appelle alors jamais l'API", async () => {
    let calls = 0;
    const off = new FedapayProvider({ secretKey: "", webhookSecret: "", environment: "sandbox", fetchImpl: (async () => { calls++; return new Response("{}"); }) as typeof fetch });
    expect(off.isConfigured()).toBe(false);
    await expect(off.verify("42")).rejects.toMatchObject({ kind: "config" });
    expect(calls).toBe(0);
    expect(new FedapayProvider({ secretKey: "sk_sandbox_x", webhookSecret: "wh_x", environment: "sandbox" }).isConfigured()).toBe(true);
  });
});

describe("FedaPay : état d'une collecte", () => {
  it("ne considère payé que ce qui a été encaissé", () => {
    for (const s of ["approved", "transferred", "approved_partially_refunded", "transferred_partially_refunded"]) expect(mapFedapayStatus(s).status).toBe("SUCCEEDED");
    expect(mapFedapayStatus("pending").status).toBe("PENDING");
    expect(mapFedapayStatus("statut_inconnu").status).toBe("PENDING");
    expect(mapFedapayStatus("refunded").status).toBe("FAILED");
    expect(mapFedapayStatus("expired").status).toBe("FAILED");
  });
  it("explique un refus selon la documentation : « declined » vient du client, « canceled » du solde ou de l'opérateur", () => {
    expect(mapFedapayStatus("declined")).toMatchObject({ status: "CANCELLED", reason: expect.stringContaining("pas été validé") });
    expect(mapFedapayStatus("canceled")).toMatchObject({ status: "FAILED", reason: expect.stringContaining("solde") });
  });
  it("relit la collecte : montant, notre référence, statut et dernier code d'erreur", async () => {
    const api = fakeFedapay({
      "GET /transactions/258": () => ({ json: { "v1/transaction": { id: 258, status: "approved", amount: 45_810, merchant_reference: "pay_1", last_error_code: "NO_ERROR", mode: "mtn_open" } } }),
      "GET /transactions/259": () => ({ json: { "v1/transaction": { id: 259, status: "canceled", amount: 45_810, merchant_reference: "pay_2", last_error_code: "INSUFFICIENT_FUNDS" } } }),
      "GET /transactions/260": () => ({ json: { "v1/transaction": { status: "approved" } } }),
    });
    const provider = new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: "", environment: "live", fetchImpl: api.fetchImpl });
    expect(await provider.verify("258")).toEqual({ providerRef: "258", status: "SUCCEEDED", providerStatus: "approved", amount: 45_810, merchantReference: "pay_1", operator: "MTN", failureReason: undefined });
    expect(["mtn_open", "mtn", "moov", "sbin", "momo_test", undefined].map(operatorFromFedapayMode)).toEqual(["MTN", "MTN", "MOOV", "CELTIIS", null, null]);
    expect(await provider.verify("259")).toMatchObject({ status: "FAILED", providerStatus: "canceled (INSUFFICIENT_FUNDS)", amount: 45_810, merchantReference: "pay_2" });
    // Une réponse sans transaction n'est jamais prise pour un paiement.
    await expect(provider.verify("260")).rejects.toThrow(PaymentProviderError);
  });
});

describe("FedaPay : notifications (webhook)", () => {
  it("accepte une signature valide et récente", () => {
    const header = `t=${now},s=${signFedapayPayload(body, SECRET, now)}`;
    expect(() => verifyFedapaySignature(body, header, SECRET, now + 10)).not.toThrow();
  });
  it("rejette un corps modifié, un mauvais secret, un en-tête absent ou un secret non configuré", () => {
    const header = `t=${now},s=${signFedapayPayload(body, SECRET, now)}`;
    expect(() => verifyFedapaySignature(body.replace("42", "43"), header, SECRET, now)).toThrow(WebhookSignatureError);
    expect(() => verifyFedapaySignature(body, header, "autre", now)).toThrow(WebhookSignatureError);
    expect(() => verifyFedapaySignature(body, null, SECRET, now)).toThrow(WebhookSignatureError);
    expect(() => verifyFedapaySignature(body, header, "", now)).toThrow(WebhookSignatureError);
    expect(() => verifyFedapaySignature(body, "n'importe quoi", SECRET, now)).toThrow(WebhookSignatureError);
    // L'horodatage fait partie de ce qui est signé : le rajeunir invalide la signature.
    expect(() => verifyFedapaySignature(body, `t=${now + 500},s=${signFedapayPayload(body, SECRET, now)}`, SECRET, now + 500)).toThrow(/invalide/);
  });
  it("rejette une notification rejouée hors délai, mais tolère une horloge en avance chez FedaPay", () => {
    const header = `t=${now},s=${signFedapayPayload(body, SECRET, now)}`;
    expect(() => verifyFedapaySignature(body, header, SECRET, now + 301)).toThrow(/tolérance/);
    expect(() => verifyFedapaySignature(body, header, SECRET, now - 400)).not.toThrow();
  });
  it("lit le nom de l'événement et la collecte concernée, et ignore ce qui ne concerne pas une collecte", () => {
    const provider = new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: SECRET, environment: "live" });
    const at = Math.floor(Date.now() / 1000);
    const headers = (raw: string) => new Headers({ "X-FEDAPAY-SIGNATURE": `t=${at},s=${signFedapayPayload(raw, SECRET, at)}` });
    expect(provider.parseWebhook(body, headers(body))).toMatchObject({ eventKey: "transaction.approved:evt_1", type: "transaction.approved", providerRef: "42" });
    // Sans identifiant d'événement, l'empreinte du corps sert de clé : un nouvel envoi du même corps est reconnu.
    const anonymous = JSON.stringify({ name: "transaction.canceled", entity: { id: 43, status: "canceled" } });
    const first = provider.parseWebhook(anonymous, headers(anonymous));
    expect(first.providerRef).toBe("43");
    expect(provider.parseWebhook(anonymous, headers(anonymous)).eventKey).toBe(first.eventKey);
    const customer = JSON.stringify({ name: "customer.created", entity: { id: 7 } });
    expect(provider.parseWebhook(customer, headers(customer)).providerRef).toBeNull();
    const stub = JSON.stringify({ name: "transaction.created", entity: {} });
    expect(provider.parseWebhook(stub, headers(stub)).providerRef).toBeNull();
    expect(() => provider.parseWebhook(body, new Headers({ "x-fedapay-signature": "t=1,s=faux" }))).toThrow(WebhookSignatureError);
  });
});

describe("FedaPay : essai des clés depuis l'administration", () => {
  const url = "https://regispub.example/api/webhooks/payments/fedapay";
  const provider = (routes: Parameters<typeof fakeFedapay>[0]) => new FedapayProvider({ secretKey: "sk_live_x", webhookSecret: SECRET, environment: "live", fetchImpl: fakeFedapay(routes).fetchImpl });
  it("reconnaît un webhook actif, désactivé ou absent", async () => {
    const list = (items: unknown[]) => ({ "GET /webhooks": () => ({ json: { "v1/webhooks": items } }) });
    expect(await provider(list([{ id: 1, url: "https://autre.example/hook", enabled: true }, { id: 2, url: `${url}/`, enabled: true }])).diagnose(url)).toEqual({ keyAccepted: true, webhook: "active" });
    expect(await provider(list([{ id: 2, url, enabled: false }])).diagnose(url)).toEqual({ keyAccepted: true, webhook: "disabled" });
    expect(await provider(list([{ id: 1, url: "https://autre.example/hook", enabled: true }])).diagnose(url)).toEqual({ keyAccepted: true, webhook: "missing" });
    expect(await provider({ "GET /webhooks": () => ({ json: [{ id: 2, url, enabled: true }] }) }).diagnose(url)).toEqual({ keyAccepted: true, webhook: "active" });
  });
  it("dit quand la clé est refusée, et ne conclut pas quand la liste est illisible", async () => {
    await expect(provider({ "GET /webhooks": () => ({ status: 401, json: { message: "Unauthorized" } }) }).diagnose(url)).rejects.toMatchObject({ kind: "auth" });
    expect(await provider({ "GET /webhooks": () => ({ status: 422, json: { message: "?" } }), "GET /balances": () => ({ json: { "v1/balances": [] } }) }).diagnose(url)).toEqual({ keyAccepted: true, webhook: "unknown" });
    expect(await provider({ "GET /webhooks": () => ({ json: { message: "rien" } }) }).diagnose(url)).toEqual({ keyAccepted: true, webhook: "unknown" });
  });
});

describe("simulateur de paiement", () => {
  const input = (national: string): InitiateInput => ({
    paymentId: "pay_1", orderReference: "CMD-TEST", amount: 45_810, currency: "XOF", operator: "MTN",
    phone: { e164: `+229${national}`, national, country: "BJ" }, customer: { name: "Test", email: "t@example.com" }, description: "Test", callbackUrl: "http://localhost/cb",
  });
  it("reste en attente puis confirme après le délai, avec le montant demandé", async () => {
    let t = 1_000_000;
    const p = new SandboxProvider("secret", () => t, 6_000);
    const { providerRef, status } = await p.initiate(input("0197000001"));
    expect(status).toBe("PENDING");
    expect((await p.verify(providerRef)).status).toBe("PENDING");
    t += 6_001;
    const v = await p.verify(providerRef);
    expect(v).toMatchObject({ status: "SUCCEEDED", amount: 45_810, merchantReference: "pay_1" });
  });
  it("simule un refus (…00) et une absence de réponse (…99)", async () => {
    let t = 0;
    const p = new SandboxProvider("secret", () => t, 1_000);
    const ko = await p.initiate(input("0197000000")), wait = await p.initiate(input("0197000099"));
    t = 60_000;
    expect((await p.verify(ko.providerRef)).status).toBe("FAILED");
    expect((await p.verify(wait.providerRef)).status).toBe("PENDING");
  });
  it("rejette une référence falsifiée (montant modifié)", async () => {
    const p = new SandboxProvider("secret", () => 0, 0);
    const { providerRef } = await p.initiate(input("0197000001"));
    const [b, sig] = providerRef.replace("sim_", "").split(".");
    const forged = JSON.parse(Buffer.from(b!, "base64url").toString()); forged.a = 1;
    await expect(p.verify(`sim_${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`)).rejects.toThrow(PaymentProviderError);
    await expect(new SandboxProvider("autre-secret").verify(providerRef)).rejects.toThrow(PaymentProviderError);
  });
});
