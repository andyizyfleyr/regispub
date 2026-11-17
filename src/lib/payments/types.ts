import type { NormalizedPhone, OperatorCode } from "@/lib/phone";

export type ProviderPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type InitiateInput = {
  paymentId: string;
  orderReference: string;
  amount: number;
  currency: "XOF";
  operator: OperatorCode;
  phone: NormalizedPhone;
  customer: { name: string; email: string };
  description: string;
  callbackUrl: string;
};

export type InitiateResult = {
  providerRef: string;
  status: ProviderPaymentStatus;
  /** Renseigné lorsque le client doit finaliser le paiement sur la page du prestataire. */
  redirectUrl?: string;
  providerStatus?: string;
  failureReason?: string;
};

export type VerifyResult = {
  providerRef: string;
  status: ProviderPaymentStatus;
  amount: number | null;
  providerStatus: string;
  merchantReference?: string | null;
  failureReason?: string;
};

export type WebhookEvent = {
  eventKey: string; // identifiant unique de la notification (idempotence)
  type: string;
  providerRef: string | null;
  payload: unknown;
};

export class WebhookSignatureError extends Error {}
export class PaymentProviderError extends Error {
  constructor(message: string, readonly userMessage?: string, readonly details?: unknown) { super(message); }
}

/**
 * Contrat d'un agrégateur Mobile Money. Pour en ajouter un (KKiaPay, CinetPay, PayDunya…),
 * implémenter cette interface et l'enregistrer dans registry.ts : le reste de l'application n'en dépend pas.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  readonly mode: "live" | "test" | "simulation";
  readonly supportedOperators: OperatorCode[];
  isConfigured(): boolean;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Interroge le prestataire, de serveur à serveur. Seule source de vérité pour confirmer un paiement. */
  verify(providerRef: string): Promise<VerifyResult>;
  /** Vérifie la signature et décode la notification. Lève WebhookSignatureError si elle est invalide. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent;
}
