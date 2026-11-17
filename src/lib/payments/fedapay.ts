import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { OperatorCode } from "@/lib/phone";
import { isRecord } from "@/lib/utils";
import {
  PaymentProviderError, WebhookSignatureError,
  type InitiateInput, type InitiateResult, type PaymentProvider, type ProviderPaymentStatus, type VerifyResult, type WebhookEvent,
} from "./types";

// Agrégateur FedaPay (Bénin). Référence : https://docs.fedapay.com
// Flux « sans redirection » : création de la transaction → jeton → envoi de la demande au téléphone du client.
const MODES: Record<OperatorCode, string> = { MTN: "mtn_open", MOOV: "moov", CELTIIS: "sbin" };
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type FedapayConfig = { secretKey: string; webhookSecret: string; environment: "sandbox" | "live"; fetchImpl?: typeof fetch };

export function mapFedapayStatus(status: string): { status: ProviderPaymentStatus; reason?: string } {
  switch (status) {
    case "approved":
    case "transferred":
      return { status: "SUCCEEDED" };
    case "declined":
      return { status: "FAILED", reason: "Paiement refusé par l'opérateur (solde insuffisant, code erroné ou délai dépassé)." };
    case "canceled":
      return { status: "CANCELLED", reason: "Paiement annulé." };
    case "expired":
      return { status: "FAILED", reason: "La demande de paiement a expiré." };
    case "refunded":
    case "approved_partially_refunded":
    case "transferred_partially_refunded":
      return { status: "FAILED", reason: "Transaction remboursée chez le prestataire." };
    default:
      return { status: "PENDING" };
  }
}

export function signFedapayPayload(rawBody: string, secret: string, timestamp: number) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function verifyFedapaySignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new WebhookSignatureError("Secret de webhook FedaPay non configuré");
  if (!header) throw new WebhookSignatureError("En-tête X-FEDAPAY-SIGNATURE absent");
  let timestamp = -1;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k?.trim() === "t") timestamp = Number.parseInt(v ?? "", 10);
    if (k?.trim() === "s" && v) signatures.push(v.trim());
  }
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !signatures.length) throw new WebhookSignatureError("Signature illisible");
  const expected = Buffer.from(signFedapayPayload(rawBody, secret, timestamp));
  const ok = signatures.some((s) => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected); });
  if (!ok) throw new WebhookSignatureError("Signature invalide");
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) throw new WebhookSignatureError("Horodatage hors tolérance");
}

export class FedapayProvider implements PaymentProvider {
  readonly id = "fedapay";
  readonly label = "FedaPay";
  readonly supportedOperators: OperatorCode[] = ["MTN", "MOOV", "CELTIIS"];
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: FedapayConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get mode() { return this.config.environment === "live" ? "live" as const : "test" as const; }
  private get baseUrl() { return this.config.environment === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1"; }
  isConfigured() { return Boolean(this.config.secretKey); }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) throw new PaymentProviderError("FedaPay non configuré", "Le paiement en ligne n'est pas encore activé.");
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.config.secretKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new PaymentProviderError(`FedaPay injoignable: ${(error as Error).message}`, "Le service de paiement ne répond pas. Réessayez dans un instant.");
    }
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* réponse non JSON */ }
    if (!res.ok) {
      const message = isRecord(json) && typeof json.message === "string" ? json.message : `HTTP ${res.status}`;
      throw new PaymentProviderError(`FedaPay ${method} ${path}: ${message}`, undefined, { status: res.status, body: json });
    }
    return isRecord(json) ? json : {};
  }

  private static transaction(json: Record<string, unknown>): Record<string, unknown> {
    const t = json["v1/transaction"] ?? json.transaction ?? json;
    if (!isRecord(t) || t.id === undefined) throw new PaymentProviderError("Réponse FedaPay inattendue (transaction absente)", undefined, json);
    return t;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const [firstname, ...rest] = input.customer.name.trim().split(/\s+/);
    const created = FedapayProvider.transaction(
      await this.request("POST", "/transactions", {
        description: input.description,
        amount: input.amount,
        currency: { iso: input.currency },
        callback_url: input.callbackUrl,
        merchant_reference: input.paymentId,
        custom_metadata: { payment_id: input.paymentId, order_reference: input.orderReference },
        customer: {
          firstname: firstname || "Client", lastname: rest.join(" ") || firstname || "Client", email: input.customer.email,
          phone_number: { number: input.phone.e164, country: input.phone.country.toLowerCase() },
        },
      }),
    );
    const providerRef = String(created.id);
    const token = await this.request("POST", `/transactions/${providerRef}/token`);
    const tokenValue = typeof token.token === "string" ? token.token : null;
    const hostedUrl = typeof token.url === "string" ? token.url : undefined;
    if (!tokenValue) throw new PaymentProviderError("Jeton de paiement FedaPay absent", undefined, token);

    try {
      await this.request("POST", `/${MODES[input.operator]}`, {
        token: tokenValue,
        phone_number: { number: input.phone.e164, country: input.phone.country.toLowerCase() },
      });
      return { providerRef, status: "PENDING", providerStatus: "pending" };
    } catch (error) {
      // Le mode sans redirection n'est pas activé sur tous les comptes : on bascule sur la page de paiement hébergée.
      if (hostedUrl) return { providerRef, status: "PENDING", providerStatus: "pending", redirectUrl: hostedUrl };
      throw error;
    }
  }

  async verify(providerRef: string): Promise<VerifyResult> {
    const t = FedapayProvider.transaction(await this.request("GET", `/transactions/${encodeURIComponent(providerRef)}`));
    const providerStatus = String(t.status ?? "pending");
    const mapped = mapFedapayStatus(providerStatus);
    const amount = Number(t.amount);
    const lastError = typeof t.last_error_code === "string" && t.last_error_code ? ` (${t.last_error_code})` : "";
    return {
      providerRef: String(t.id), status: mapped.status, providerStatus,
      amount: Number.isFinite(amount) ? amount : null,
      merchantReference: typeof t.merchant_reference === "string" ? t.merchant_reference : null,
      failureReason: mapped.reason ? `${mapped.reason}${lastError}` : undefined,
    };
  }

  parseWebhook(rawBody: string, headers: Headers): WebhookEvent {
    verifyFedapaySignature(rawBody, headers.get("x-fedapay-signature"), this.config.webhookSecret);
    let payload: unknown;
    try { payload = JSON.parse(rawBody); } catch { throw new WebhookSignatureError("Corps JSON invalide"); }
    if (!isRecord(payload)) throw new WebhookSignatureError("Corps inattendu");
    const entity = isRecord(payload.entity) ? payload.entity : null;
    const type = typeof payload.name === "string" ? payload.name : "unknown";
    const eventId = payload.id !== undefined ? String(payload.id) : createHash("sha256").update(rawBody).digest("hex");
    return {
      eventKey: `${type}:${eventId}`,
      type,
      providerRef: type.startsWith("transaction.") && entity?.id !== undefined ? String(entity.id) : null,
      payload,
    };
  }
}
