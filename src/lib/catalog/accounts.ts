import { PLATFORMS, type PlatformCode } from "./platforms";

/**
 * Comptes du client sur chaque réseau : c'est sur ces comptes que l'équipe lance la campagne.
 * Ils sont enregistrés sur l'entreprise (demandés une seule fois, repris pour les campagnes suivantes).
 */
export const ACCOUNT_FIELDS: Record<PlatformCode, { column: "facebookUrl" | "instagramUrl" | "tiktokUrl"; label: string; placeholder: string }> = {
  FACEBOOK: { column: "facebookUrl", label: "Votre page Facebook", placeholder: "facebook.com/votrepage" },
  INSTAGRAM: { column: "instagramUrl", label: "Votre compte Instagram", placeholder: "@votrecompte" },
  TIKTOK: { column: "tiktokUrl", label: "Votre compte TikTok", placeholder: "@votrecompte" },
};

export type Accounts = Partial<Record<PlatformCode, string>>;

const HOST: Record<PlatformCode, string> = { FACEBOOK: "www.facebook.com", INSTAGRAM: "www.instagram.com", TIKTOK: "www.tiktok.com" };

/** Accepte un lien, « facebook.com/page » ou « @compte ». Renvoie un lien complet, "" si vide, null si illisible. */
export function normalizeAccount(platform: PlatformCode, raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (v.length > 300 || /\s/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v) ? v : null;
  if (/^([a-z0-9-]+\.)*(facebook|fb|instagram|tiktok)\.[a-z]{2,5}\/./i.test(v)) return `https://${v}`;
  const handle = v.replace(/^@/, "");
  if (!/^[\w.-]{2,60}$/.test(handle)) return null;
  return platform === "TIKTOK" ? `https://${HOST.TIKTOK}/@${handle}` : `https://${HOST[platform]}/${handle}`;
}

/** Version courte pour l'affichage : « facebook.com/atelierawa ». */
export function accountDisplay(url: string): string {
  return url.replace(/^https?:\/\/(www\.|m\.)?/i, "").replace(/\/$/, "");
}

export function accountsOf(b: { facebookUrl: string | null; instagramUrl: string | null; tiktokUrl: string | null } | null | undefined): Accounts {
  return { FACEBOOK: b?.facebookUrl ?? "", INSTAGRAM: b?.instagramUrl ?? "", TIKTOK: b?.tiktokUrl ?? "" };
}

/** Réseaux choisis pour lesquels le client n'a pas encore indiqué son compte. */
export function missingAccounts(platforms: PlatformCode[], accounts: Accounts | null | undefined): PlatformCode[] {
  return platforms.filter((p) => !accounts?.[p]?.trim());
}

export const missingAccountMessage = (p: PlatformCode) => `Indiquez votre ${p === "FACEBOOK" ? "page" : "compte"} ${PLATFORMS[p].label} : nous y lançons votre publicité.`;
