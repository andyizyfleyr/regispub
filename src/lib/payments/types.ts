import type { NormalizedPhone, OperatorCode } from "@/lib/phone";

export type ProviderPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type InitiateInput = {
  paymentId: string;
  orderReference: string;
  amount: number;
  currency: "XOF";
  /** Renseignés seulement quand le numéro est saisi chez nous (parcours « phone »). */
  operator?: OperatorCode | null;
  phone?: NormalizedPhone | null;
  customer: { name: string; email: string };
  description: string;
  /** Adresse où le prestataire renvoie le client après le paiement. */
  callbackUrl: string;
};

export type InitiateResult = {
  providerRef: string;
  status: ProviderPaymentStatus;
  providerStatus?: string;
  /** Page de paiement du prestataire pour CETTE transaction. Obligatoire quand le parcours est « hosted ». */
  redirectUrl?: string;
};

export type VerifyResult = {
  providerRef: string;
  status: ProviderPaymentStatus;
  amount: number | null;
  /** Statut tel que le prestataire l'exprime, complété du dernier code d'erreur s'il y en a un. */
  providerStatus: string;
  merchantReference?: string | null;
  /** Opérateur utilisé par le client, quand le prestataire l'indique. */
  operator?: OperatorCode | null;
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
  /**
   * Où le client paie. « hosted » : sur la page du prestataire, qui demande elle-même le moyen de paiement et le numéro ;
   * nous ne faisons qu'y envoyer le client. « phone » : le numéro et l'opérateur sont saisis chez nous.
   */
  readonly checkout: "hosted" | "phone";
  readonly supportedOperators: OperatorCode[];
  /** Parcours « phone » hors mode réel : phrase affichée au client pour dire qu'aucun argent ne circule et quels numéros essayer. */
  readonly testNotice: string | null;
  /** En mode test, les seuls numéros (8 chiffres) qui donnent un paiement accepté. Rappelés à l'équipe, pas au client. */
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
