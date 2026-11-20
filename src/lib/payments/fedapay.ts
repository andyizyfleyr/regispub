import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { groupDigits, type OperatorCode } from "@/lib/phone";
import { isRecord } from "@/lib/utils";
import {
  PaymentProviderError, WebhookSignatureError,
  type InitiateInput, type InitiateResult, type PaymentErrorKind, type PaymentProvider, type ProviderPaymentStatus, type VerifyResult, type WebhookEvent,
} from "./types";

/**
 * Agrégateur FedaPay (Bénin). Écrit d'après la documentation officielle (https://docs.fedapay.com) et les
 * bibliothèques fedapay-node / fedapay-php, sans dépendance : deux appels suffisent.
 *
 * Le client paie sur la page de paiement de FedaPay :
 *   1. POST /transactions                créer la collecte (montant, client, notre référence, adresse de retour)
 *   2. POST /transactions/{id}/token     obtenir le lien de la page de paiement FedaPay de cette collecte
 * Nous envoyons le client sur ce lien. C'est FedaPay qui lui demande son moyen de paiement et son numéro, puis qui le
 * renvoie chez nous. Le résultat n'est jamais déduit de l'adresse de retour : il est relu avec GET /transactions/{id}.
 */

const BASE_URLS = { live: "https://api.fedapay.com/v1", sandbox: "https://sandbox-api.fedapay.com/v1" } as const;

/**
 * Seuls numéros acceptés par FedaPay en mode test : tout autre numéro y simule un paiement échoué.
 * Ils s'écrivent à 10 chiffres, avec le « 01 » devant. La documentation FedaPay donne encore l'ancienne écriture à
 * 8 chiffres (64000001, 66000001), que la sandbox refuse : constaté sur le compte de test le 20/11/2026.
 */
export const FEDAPAY_TEST_NUMBERS = ["0164000001", "0166000001"] as const;

/** Une notification plus ancienne est refusée (protection contre le rejeu), comme dans les bibliothèques FedaPay. */
const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Statuts pour lesquels l'argent a bien été encaissé (liste « PAID_STATUS » des bibliothèques FedaPay, hors remboursement total). */
const PAID_STATUSES = new Set(["approved", "transferred", "approved_partially_refunded", "transferred_partially_refunded"]);

export type FedapayEnvironment = "sandbox" | "live";
export type FedapayConfig = {
  secretKey: string; webhookSecret: string; environment: FedapayEnvironment; fetchImpl?: typeof fetch;
  /** Autre adresse de l'API (comme « setApiBase » des bibliothèques FedaPay). Réservé aux essais hors production. */
  apiBase?: string;
};

/** Opérateur d'après le champ « mode » d'une transaction FedaPay (mtn_open, moov, sbin…). null si ce n'est pas l'un des nôtres. */
export function operatorFromFedapayMode(mode: unknown): OperatorCode | null {
  if (typeof mode !== "string") return null;
  if (/^mtn/i.test(mode)) return "MTN";
  if (/^moov/i.test(mode)) return "MOOV";
  if (/^(sbin|celtiis)/i.test(mode)) return "CELTIIS";
  return null;
}

/**
 * Traduit un statut FedaPay. « declined » et « canceled » ne sont pas définitifs chez FedaPay (la même collecte peut
 * être retentée) : ils closent notre tentative, mais une approbation tardive reste prise en compte par le service.
 */
export function mapFedapayStatus(status: string): { status: ProviderPaymentStatus; reason?: string } {
  if (PAID_STATUSES.has(status)) return { status: "SUCCEEDED" };
  switch (status) {
    case "declined": // interruption volontaire ou accidentelle par le client
      return { status: "CANCELLED", reason: "Le paiement n'a pas été validé (demande refusée, fermée ou délai dépassé)." };
    case "canceled": // solde insuffisant ou autre problème de paiement
      return { status: "FAILED", reason: "L'opérateur n'a pas accepté le paiement. Vérifiez le solde de votre compte Mobile Money." };
    case "expired":
      return { status: "FAILED", reason: "La demande de paiement a expiré sans être validée." };
    case "refunded": // encaissé puis entièrement rendu au client : la commande ne doit pas être honorée
      return { status: "FAILED", reason: "Ce paiement a été remboursé." };
    default: // « pending » et tout statut inconnu : on attend
      return { status: "PENDING" };
  }
}

// ─────────────────────────── Signature des notifications ───────────────────────────

export function signFedapayPayload(rawBody: string, secret: string, timestamp: number) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

/** En-tête X-FEDAPAY-SIGNATURE : « t=<secondes>,s=<HMAC-SHA256 hexadécimal de "t.corps"> ». */
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
  if (timestamp < nowSeconds - WEBHOOK_TOLERANCE_SECONDS) throw new WebhookSignatureError("Horodatage hors tolérance");
}

// ─────────────────────────── Appels à l'API ───────────────────────────

/** Rassemble « message » et « errors » d'une réponse d'erreur FedaPay en une phrase lisible par l'équipe. */
function describeError(json: unknown, status: number) {
  if (!isRecord(json)) return `HTTP ${status}`;
  const parts: string[] = [];
  if (typeof json.message === "string" && json.message) parts.push(json.message);
  if (isRecord(json.errors)) {
    for (const [field, value] of Object.entries(json.errors)) {
      const text = Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : JSON.stringify(value);
      if (text) parts.push(`${field} : ${text}`);
    }
  } else if (typeof json.errors === "string" && json.errors) parts.push(json.errors);
  return parts.length ? `${parts.join(" — ")} (HTTP ${status})` : `HTTP ${status}`;
}

function errorKind(status: number): PaymentErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status >= 500) return "unavailable";
  return "invalid";
}

const USER_MESSAGES: Record<PaymentErrorKind, string | undefined> = {
  auth: "Le paiement en ligne est momentanément indisponible. Notre équipe est prévenue.",
  config: "Le paiement en ligne n'est pas encore activé.",
  unavailable: "Le service de paiement ne répond pas. Réessayez dans un instant.",
  invalid: undefined,
  not_found: undefined,
  unknown: undefined,
};

/** Les réponses FedaPay enveloppent l'objet sous une clé « v1/<nom> ». */
function unwrap(json: Record<string, unknown>, name: string): unknown {
  return json[`v1/${name}`] ?? json[name] ?? json;
}

export type FedapayDiagnosis = {
  /** La clé secrète est acceptée par FedaPay dans le mode choisi. */
  keyAccepted: true;
  /** État, chez FedaPay, du webhook qui pointe vers ce site. « unknown » : la liste n'a pas pu être lue. */
  webhook: "active" | "disabled" | "missing" | "unknown";
};

export class FedapayProvider implements PaymentProvider {
  readonly id = "fedapay";
  readonly label = "FedaPay";
  readonly checkout = "hosted" as const;
  readonly supportedOperators: OperatorCode[] = ["MTN", "MOOV", "CELTIIS"];
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: FedapayConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get mode() { return this.config.environment === "live" ? "live" as const : "test" as const; }
  /**
   * En mode test, la page FedaPay n'accepte que ses deux numéros d'essai et répond « Transaction échouée » à tout autre
   * numéro, sans dire pourquoi : on prévient donc le client avant de l'y envoyer.
   */
  get testNotice() {
    if (this.config.environment === "live") return null;
    return `Mode test : aucun argent n'est débité. Sur la page de paiement, saisissez le numéro d'essai ${FEDAPAY_TEST_NUMBERS.map(groupDigits).join(" ou ")}, avec le 01 devant. Tout autre numéro, même un vrai, est refusé.`;
  }
  get testNumbers() { return this.config.environment === "live" ? null : FEDAPAY_TEST_NUMBERS; }
  isConfigured() { return Boolean(this.config.secretKey); }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) throw new PaymentProviderError("FedaPay non configuré", USER_MESSAGES.config, undefined, "config");
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.apiBase ?? BASE_URLS[this.config.environment]}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.config.secretKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new PaymentProviderError(`FedaPay ${method} ${path} : injoignable (${(error as Error).message})`, USER_MESSAGES.unavailable, undefined, "unavailable");
    }
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* réponse non JSON */ }
    if (!res.ok) {
      const kind = errorKind(res.status);
      throw new PaymentProviderError(`FedaPay ${method} ${path} : ${describeError(json, res.status)}`, USER_MESSAGES[kind], { status: res.status, body: json }, kind);
    }
    return isRecord(json) ? json : Array.isArray(json) ? { list: json } : {};
  }

  private static transaction(json: Record<string, unknown>): Record<string, unknown> {
    const t = unwrap(json, "transaction");
    if (!isRecord(t) || t.id === undefined || t.id === null) throw new PaymentProviderError("Réponse FedaPay inattendue (transaction absente)", undefined, json);
    return t;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const [firstname, ...rest] = input.customer.name.trim().split(/\s+/);
    // 1. La collecte. FedaPay retrouve le client par son e-mail ; le numéro à débiter est demandé sur sa page de paiement.
    //    merchant_reference doit être unique : c'est l'identifiant de notre tentative de paiement.
    const created = FedapayProvider.transaction(
      await this.request("POST", "/transactions", {
        description: input.description,
        amount: input.amount,
        currency: { iso: input.currency },
        callback_url: input.callbackUrl,
        merchant_reference: input.paymentId,
        custom_metadata: { payment_id: input.paymentId, order_reference: input.orderReference },
        customer: { firstname: firstname || "Client", lastname: rest.join(" ") || firstname || "Client", email: input.customer.email },
      }),
    );
    const providerRef = String(created.id);

    // 2. Le lien de la page de paiement FedaPay pour cette collecte.
    const token = await this.request("POST", `/transactions/${encodeURIComponent(providerRef)}/token`);
    const redirectUrl = typeof token.url === "string" && /^https?:\/\//.test(token.url) ? token.url : null;
    if (!redirectUrl) throw new PaymentProviderError("Lien de la page de paiement FedaPay absent", undefined, token);
    return { providerRef, status: "PENDING", providerStatus: "pending", redirectUrl };
  }

  async verify(providerRef: string): Promise<VerifyResult> {
    const t = FedapayProvider.transaction(await this.request("GET", `/transactions/${encodeURIComponent(providerRef)}`));
    const fedapayStatus = String(t.status ?? "pending");
    const mapped = mapFedapayStatus(fedapayStatus);
    const amount = Number(t.amount);
    const errorCode = typeof t.last_error_code === "string" && t.last_error_code && t.last_error_code !== "NO_ERROR" ? t.last_error_code : null;
    return {
      providerRef: String(t.id), status: mapped.status,
      providerStatus: errorCode && mapped.status !== "SUCCEEDED" ? `${fedapayStatus} (${errorCode})` : fedapayStatus,
      amount: Number.isFinite(amount) ? amount : null,
      merchantReference: typeof t.merchant_reference === "string" ? t.merchant_reference : null,
      operator: operatorFromFedapayMode(t.mode),
      failureReason: mapped.reason,
    };
  }

  parseWebhook(rawBody: string, headers: Headers): WebhookEvent {
    verifyFedapaySignature(rawBody, headers.get("x-fedapay-signature"), this.config.webhookSecret);
    let payload: unknown;
    try { payload = JSON.parse(rawBody); } catch { throw new WebhookSignatureError("Corps JSON invalide"); }
    if (!isRecord(payload)) throw new WebhookSignatureError("Corps inattendu");
    const type = typeof payload.name === "string" ? payload.name : typeof payload.type === "string" ? payload.type : "unknown";
    // Une nouvelle tentative d'envoi porte le même corps (seuls l'horodatage et la signature changent) : l'empreinte suffit à la reconnaître.
    const eventId = payload.id !== undefined && payload.id !== null ? String(payload.id) : createHash("sha256").update(rawBody).digest("hex");
    return { eventKey: `${type}:${eventId}`, type, providerRef: this.refFromPayload(payload), payload };
  }

  refFromPayload(payload: unknown): string | null {
    if (!isRecord(payload)) return null;
    const type = typeof payload.name === "string" ? payload.name : typeof payload.type === "string" ? payload.type : "";
    if (!type.startsWith("transaction.")) return null;
    const id = (isRecord(payload.entity) ? payload.entity.id : undefined) ?? payload.object_id;
    return typeof id === "number" || (typeof id === "string" && id) ? String(id) : null;
  }

  /**
   * Contrôle réel de la configuration, lancé depuis l'administration : la clé est-elle acceptée, et FedaPay
   * connaît-il un webhook actif vers ce site ? Lève PaymentProviderError (kind « auth ») si la clé est refusée.
   */
  async diagnose(webhookUrl: string): Promise<FedapayDiagnosis> {
    const same = (a: string) => a.replace(/\/+$/, "").toLowerCase() === webhookUrl.replace(/\/+$/, "").toLowerCase();
    let json: Record<string, unknown>;
    try {
      json = await this.request("GET", "/webhooks");
    } catch (error) {
      if (!(error instanceof PaymentProviderError) || error.kind === "auth" || error.kind === "unavailable" || error.kind === "config") throw error;
      await this.request("GET", "/balances"); // la liste des webhooks est illisible : on juge au moins la clé
      return { keyAccepted: true, webhook: "unknown" };
    }
    const list = Object.values(json).find(Array.isArray) as unknown[] | undefined;
    if (!list) return { keyAccepted: true, webhook: "unknown" };
    const mine = list.filter((w): w is Record<string, unknown> => isRecord(w) && typeof w.url === "string" && same(w.url));
    if (!mine.length) return { keyAccepted: true, webhook: "missing" };
    return { keyAccepted: true, webhook: mine.some((w) => w.enabled !== false) ? "active" : "disabled" };
  }
}
