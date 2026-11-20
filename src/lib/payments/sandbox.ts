import { createHmac, timingSafeEqual } from "node:crypto";
import type { OperatorCode } from "@/lib/phone";
import { isRecord } from "@/lib/utils";
import {
  PaymentProviderError, WebhookSignatureError,
  type InitiateInput, type InitiateResult, type PaymentProvider, type VerifyResult, type WebhookEvent,
} from "./types";

/**
 * Simulateur de paiement pour le développement et les démonstrations. AUCUN argent ne circule.
 * Il respecte le même contrat qu'un vrai prestataire (vérification serveur, webhook signé) afin de tester
 * tout le parcours. Numéros de test : terminaison « 00 » = refus, « 99 » = jamais validé, autre = accepté.
 */
export const SANDBOX_APPROVAL_DELAY_MS = 6_000;

type Ref = { p: string; a: number; t: number; o: "ok" | "ko" | "wait" };

export class SandboxProvider implements PaymentProvider {
  readonly id = "sandbox";
  readonly label = "Simulateur (aucun débit réel)";
  readonly mode = "simulation" as const;
  readonly checkout = "phone" as const;
  readonly testNotice = "Simulation : un numéro finissant par 00 est refusé, par 99 reste sans réponse. Tout autre numéro est accepté.";
  readonly testNumbers = null;
  readonly supportedOperators: OperatorCode[] = ["MTN", "MOOV", "CELTIIS"];

  constructor(private readonly secret: string, private readonly now: () => number = Date.now, private readonly delayMs = SANDBOX_APPROVAL_DELAY_MS) {}

  isConfigured() { return true; }

  private sign(data: string) { return createHmac("sha256", this.secret).update(data).digest("base64url"); }

  private encode(ref: Ref) {
    const body = Buffer.from(JSON.stringify(ref)).toString("base64url");
    return `sim_${body}.${this.sign(body)}`;
  }

  private decode(providerRef: string): Ref {
    const [body, sig] = providerRef.replace(/^sim_/, "").split(".");
    if (!body || !sig) throw new PaymentProviderError("Référence de simulation invalide");
    const a = Buffer.from(sig), b = Buffer.from(this.sign(body));
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new PaymentProviderError("Référence de simulation falsifiée");
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Ref;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    if (!input.phone) throw new PaymentProviderError("Le simulateur a besoin d'un numéro", "Saisissez votre numéro Mobile Money.", undefined, "invalid");
    const ending = input.phone.national.slice(-2);
    const outcome: Ref["o"] = ending === "00" ? "ko" : ending === "99" ? "wait" : "ok";
    return { providerRef: this.encode({ p: input.paymentId, a: input.amount, t: this.now(), o: outcome }), status: "PENDING", providerStatus: "pending" };
  }

  async verify(providerRef: string): Promise<VerifyResult> {
    const ref = this.decode(providerRef);
    const elapsed = this.now() - ref.t;
    const base = { providerRef, amount: ref.a, merchantReference: ref.p };
    if (ref.o === "wait" || elapsed < this.delayMs) return { ...base, status: "PENDING", providerStatus: "pending" };
    if (ref.o === "ko") return { ...base, status: "FAILED", providerStatus: "declined", failureReason: "Paiement refusé (simulation : numéro se terminant par 00)." };
    return { ...base, status: "SUCCEEDED", providerStatus: "approved" };
  }

  signWebhook(rawBody: string) { return this.sign(rawBody); }

  parseWebhook(rawBody: string, headers: Headers): WebhookEvent {
    const given = Buffer.from(headers.get("x-sandbox-signature") ?? "");
    const expected = Buffer.from(this.sign(rawBody));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new WebhookSignatureError("Signature de simulation invalide");
    const payload: unknown = JSON.parse(rawBody);
    if (!isRecord(payload)) throw new WebhookSignatureError("Corps inattendu");
    return { eventKey: String(payload.id ?? this.sign(rawBody)), type: String(payload.type ?? "payment.updated"), providerRef: this.refFromPayload(payload), payload };
  }

  refFromPayload(payload: unknown): string | null {
    return isRecord(payload) && typeof payload.providerRef === "string" ? payload.providerRef : null;
  }
}
