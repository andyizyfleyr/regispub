import { describe, expect, it } from "vitest";
import { mapFedapayStatus, signFedapayPayload, verifyFedapaySignature, FedapayProvider } from "@/lib/payments/fedapay";
import { SandboxProvider } from "@/lib/payments/sandbox";
import { PaymentProviderError, WebhookSignatureError, type InitiateInput } from "@/lib/payments/types";

const SECRET = "wh_test_secret";
const body = JSON.stringify({ id: "evt_1", name: "transaction.approved", entity: { id: 42 } });
const now = 1_800_000_000;

describe("webhook FedaPay", () => {
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
  });
  it("rejette une notification rejouée hors délai", () => {
    const header = `t=${now},s=${signFedapayPayload(body, SECRET, now)}`;
    expect(() => verifyFedapaySignature(body, header, SECRET, now + 301)).toThrow(/tolérance/);
  });
  it("ne considère payé que les statuts « approved » et « transferred »", () => {
    expect(mapFedapayStatus("approved").status).toBe("SUCCEEDED");
    expect(mapFedapayStatus("transferred").status).toBe("SUCCEEDED");
    expect(mapFedapayStatus("pending").status).toBe("PENDING");
    expect(mapFedapayStatus("statut_inconnu").status).toBe("PENDING");
    expect(mapFedapayStatus("declined").status).toBe("FAILED");
    expect(mapFedapayStatus("canceled").status).toBe("CANCELLED");
    expect(mapFedapayStatus("refunded").status).toBe("FAILED");
  });
  it("n'est pas considéré comme configuré sans clé secrète, et n'appelle alors jamais l'API", async () => {
    let calls = 0;
    const off = new FedapayProvider({ secretKey: "", webhookSecret: "", environment: "sandbox", fetchImpl: (async () => { calls++; return new Response("{}"); }) as typeof fetch });
    expect(off.isConfigured()).toBe(false);
    await expect(off.verify("42")).rejects.toThrow();
    expect(calls).toBe(0);
    expect(new FedapayProvider({ secretKey: "sk_sandbox_x", webhookSecret: "wh_x", environment: "sandbox" }).isConfigured()).toBe(true);
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
