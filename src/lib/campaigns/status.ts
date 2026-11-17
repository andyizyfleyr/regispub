// Cycle de vie d'une campagne. Module pur.
import { can, type Permission, type RoleName } from "@/lib/auth/permissions";

export type CampaignStatusName =
  | "DRAFT" | "PENDING_PAYMENT" | "PAID" | "AWAITING_INFO" | "IN_PREPARATION" | "CLIENT_REVIEW"
  | "READY_TO_LAUNCH" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";

export const STATUS_META: Record<CampaignStatusName, { label: string; tone: "neutral" | "warn" | "info" | "ok" | "danger"; clientHint: string }> = {
  DRAFT: { label: "Brouillon", tone: "neutral", clientHint: "Terminez la configuration pour passer commande." },
  PENDING_PAYMENT: { label: "En attente de paiement", tone: "warn", clientHint: "Réglez votre commande par Mobile Money pour démarrer." },
  PAID: { label: "Payé", tone: "info", clientHint: "Paiement confirmé. Un gestionnaire prend votre campagne en charge." },
  AWAITING_INFO: { label: "En attente d'informations", tone: "warn", clientHint: "Notre équipe a besoin d'une précision de votre part." },
  IN_PREPARATION: { label: "En préparation", tone: "info", clientHint: "Votre campagne est en cours de préparation." },
  CLIENT_REVIEW: { label: "En validation client", tone: "warn", clientHint: "Vérifiez les créations proposées et validez-les." },
  READY_TO_LAUNCH: { label: "Prêt à lancer", tone: "info", clientHint: "Tout est validé. Le lancement est programmé." },
  RUNNING: { label: "En cours", tone: "ok", clientHint: "Votre publicité est diffusée." },
  PAUSED: { label: "En pause", tone: "warn", clientHint: "La diffusion est suspendue temporairement." },
  COMPLETED: { label: "Terminé", tone: "neutral", clientHint: "La campagne est terminée. Consultez le bilan." },
  CANCELLED: { label: "Annulé", tone: "danger", clientHint: "Cette campagne a été annulée." },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as CampaignStatusName[];
export const ACTIVE_STATUSES: CampaignStatusName[] = ["PAID", "AWAITING_INFO", "IN_PREPARATION", "CLIENT_REVIEW", "READY_TO_LAUNCH", "RUNNING", "PAUSED"];
export const PENDING_STATUSES: CampaignStatusName[] = ["DRAFT", "PENDING_PAYMENT"];
/** Étapes affichées au client dans le fil d'avancement. */
export const PROGRESS_STEPS: CampaignStatusName[] = ["PENDING_PAYMENT", "PAID", "IN_PREPARATION", "CLIENT_REVIEW", "READY_TO_LAUNCH", "RUNNING", "COMPLETED"];

// Transitions manuelles autorisées pour l'équipe. Le passage à PAID n'y figure pas :
// il résulte uniquement d'un paiement vérifié côté serveur.
const STAFF_TRANSITIONS: Record<CampaignStatusName, CampaignStatusName[]> = {
  DRAFT: [],
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["AWAITING_INFO", "IN_PREPARATION", "CANCELLED"],
  AWAITING_INFO: ["IN_PREPARATION", "CANCELLED"],
  IN_PREPARATION: ["AWAITING_INFO", "CLIENT_REVIEW", "READY_TO_LAUNCH", "CANCELLED"],
  CLIENT_REVIEW: ["IN_PREPARATION", "READY_TO_LAUNCH", "AWAITING_INFO", "CANCELLED"],
  READY_TO_LAUNCH: ["RUNNING", "IN_PREPARATION", "CANCELLED"],
  RUNNING: ["PAUSED", "COMPLETED"],
  PAUSED: ["RUNNING", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function staffTransitions(from: CampaignStatusName): CampaignStatusName[] {
  return STAFF_TRANSITIONS[from];
}

export function canTransition(from: CampaignStatusName, to: CampaignStatusName, role: RoleName): boolean {
  const permission: Permission = "campaign.update_status";
  return can(role, permission) && STAFF_TRANSITIONS[from].includes(to);
}

/** Le client peut annuler tant qu'aucun paiement n'a été encaissé. */
export function clientCanCancel(status: CampaignStatusName) {
  return status === "DRAFT" || status === "PENDING_PAYMENT";
}

export function clientCanEdit(status: CampaignStatusName) {
  return status === "DRAFT" || status === "PENDING_PAYMENT";
}

export function progressIndex(status: CampaignStatusName) {
  if (status === "AWAITING_INFO") return PROGRESS_STEPS.indexOf("IN_PREPARATION");
  if (status === "PAUSED") return PROGRESS_STEPS.indexOf("RUNNING");
  return PROGRESS_STEPS.indexOf(status);
}
