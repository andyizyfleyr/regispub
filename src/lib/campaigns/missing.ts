import { getObjective, unsupportedPlatforms } from "@/lib/catalog/objectives";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { todayUtc } from "@/lib/utils";

/** Longueurs minimales du titre et du texte d'une annonce écrite par le client. */
export const MIN_HEADLINE = 3;
export const MIN_BODY = 20;

export const ONE_NETWORK = "Choisissez un seul réseau : une publicité se lance sur un réseau à la fois.";

/** Ce qui manque au titre ou au texte de l'annonce, ou `null` si les deux sont écrits. */
export function adCopyIssue(raw: unknown): string | null {
  const copy = raw && typeof raw === "object" ? (raw as { headline?: unknown; body?: unknown }) : {};
  const headline = typeof copy.headline === "string" ? copy.headline.trim() : "";
  const body = typeof copy.body === "string" ? copy.body.trim() : "";
  if (headline.length < MIN_HEADLINE) return "Écrivez le titre de votre annonce.";
  if (body.length < MIN_BODY) return `Écrivez le texte de votre annonce (${MIN_BODY} caractères au minimum).`;
  return null;
}

export type QuotableCampaign = {
  name: string; platforms: PlatformCode[]; objective: string | null; serviceCode: string | null; adBudget: number;
  durationDays: number | null; startDate: Date | null; mode: "SELF_SERVICE" | "EXPERT"; adCopy: unknown; brief: string | null;
};

/** Éléments manquants avant de pouvoir passer commande (liste vide = campagne complète). */
export function campaignMissing(c: QuotableCampaign): string[] {
  const missing: string[] = [];
  if (!c.platforms.length) missing.push("Choisissez le réseau de votre publicité.");
  else if (c.platforms.length > 1) missing.push(ONE_NETWORK);
  const objective = getObjective(c.objective);
  if (!objective) missing.push("Choisissez un objectif publicitaire.");
  else {
    const bad = unsupportedPlatforms(objective, c.platforms);
    if (c.platforms.length && bad.length === c.platforms.length) missing.push(`L'objectif « ${objective.label} » n'est pas disponible sur ${bad.map((p) => PLATFORMS[p].label).join(", ")}.`);
  }
  // Le client écrit lui-même son annonce ; en mode expert, il décrit son besoin et l'équipe écrit.
  if (c.mode === "EXPERT") { if (!c.brief?.trim()) missing.push("Décrivez votre besoin."); }
  else { const issue = adCopyIssue(c.adCopy); if (issue) missing.push(issue); }
  if (!c.adBudget) missing.push("Définissez votre budget publicitaire.");
  if (!c.durationDays) missing.push("Définissez la durée de la campagne.");
  if (!c.startDate) missing.push("Choisissez une date de début.");
  else if (c.startDate < todayUtc()) missing.push("La date de début est passée : choisissez une nouvelle date.");
  return missing;
}
