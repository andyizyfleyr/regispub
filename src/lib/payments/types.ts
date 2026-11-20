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
  providerStatus?: string;
  /**
   * Page de paiement hébergée par le prestataire pour CETTE transaction. Solution de secours quand la demande
   * n'arrive pas sur le téléphone : comme il s'agit de la même transaction, elle ne peut pas être payée deux fois.
   */
  redirectUrl?: string;
  /** false : la demande n'a pas pu être envoyée sur le téléphone, le client doit passer par redirectUrl. */
  pushed?: boolean;
  /** Réponse du prestataire quand l'envoi sur le téléphone a échoué (pour l'équipe, jamais affichée au client). */
  pushError?: string;
};

export type VerifyResult = {
  providerRef: string;
  status: ProviderPaymentStatus;
  amount: number | null;
  /** Statut tel que le prestataire l'exprime, complété du dernier code d'erreur s'il y en a un. */
  providerStatus: string;
  merchantReference?: string | null;
  /** Explication en clair, destinée au client. */
  failureReason?: string;
};

export type WebhookEvent = {
  eventKey: string; // identifiant unique de la notification (idempotence)
  type: string;
  providerRef: string | null;
  payload: unknown;
};

export class WebhookSignatureError extends Error {}
/**
 * Nature d'un refus du prestataire :
 * auth = clé refusée (rien ne marchera tant qu'elle n'est pas corrigée), invalid = demande refusée (numéro, montant…),
 * unavailable = prestataire injoignable ou en panne, config = prestataire non configuré de notre côté.
 */
export type PaymentErrorKind = "auth" | "invalid" | "not_found" | "unavailable" | "config" | "unknown";

export class PaymentProviderError extends Error {
  constructor(message: string, readonly userMessage?: string, readonly details?: unknown, readonly kind: PaymentErrorKind = "unknown") { super(message); }
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
  /** Hors mode réel : phrase affichée au client pour dire qu'aucun argent ne circule et quels numéros essayer. */
  readonly testNotice: string | null;
  /** En mode test, les seuls numéros (8 chiffres) qui donnent un paiement accepté. null : pas de liste imposée. */
  readonly testNumbers: readonly string[] | null;
  isConfigured(): boolean;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Interroge le prestataire, de serveur à serveur. Seule source de vérité pour confirmer un paiement. */
  verify(providerRef: string): Promise<VerifyResult>;
  /** Vérifie la signature et décode la notification. Lève WebhookSignatureError si elle est invalide. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent;
  /** Retrouve la transaction concernée dans une notification déjà enregistrée (reprise d'un traitement interrompu). */
  refFromPayload(payload: unknown): string | null;
}
