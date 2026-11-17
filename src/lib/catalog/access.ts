// Accès aux comptes du client : sans lui, l'équipe ne peut pas lancer la publicité sur sa page.
// Module pur (interface et serveur). Les libellés des menus Facebook, Instagram et TikTok changent parfois : ils se corrigent ici.
import { PLATFORMS, type PlatformCode } from "./platforms";

/** INVITE : le client ajoute l'agence à sa page (ou donne le code de sa vidéo TikTok). LOGIN : il confie identifiant et mot de passe. */
export type AccessMethod = "INVITE" | "LOGIN";
export type AccessStatus = "SENT" | "VERIFIED" | "PROBLEM";
/** État vu par le client et l'équipe. TODO = rien n'a encore été donné. */
export type AccessState = "TODO" | AccessStatus;

export const ACCESS_STATE_META: Record<AccessState, { label: string; staffLabel: string; tone: "neutral" | "warn" | "info" | "ok" | "danger" }> = {
  TODO: { label: "À faire", staffLabel: "Pas encore d'accès", tone: "warn" },
  SENT: { label: "Envoyé", staffLabel: "À vérifier", tone: "info" },
  VERIFIED: { label: "Vérifié", staffLabel: "Accès vérifié", tone: "ok" },
  PROBLEM: { label: "À refaire", staffLabel: "Problème signalé", tone: "danger" },
};

export const METHOD_LABELS: Record<AccessMethod, { title: string; hint: string; staff: string }> = {
  INVITE: { title: "Je vous ajoute", hint: "Vous gardez votre mot de passe.", staff: "Ajout par le client" },
  LOGIN: { title: "Je donne mes identifiants", hint: "Plus rapide.", staff: "Identifiants confiés" },
};

/** Titre de l'option sans mot de passe, selon le réseau. */
export const inviteTitle = (platform: PlatformCode) => (platform === "TIKTOK" ? "Je donne le code de ma vidéo" : METHOD_LABELS.INVITE.title);

/** Sur TikTok, l'option « Je vous ajoute » passe par le code d'une vidéo : il ne vaut que pour la campagne concernée. */
export const inviteNeedsCode = (platform: PlatformCode) => platform === "TIKTOK";

export type AccessRow = { platform: PlatformCode; method: string; status: string; campaignId: string | null };

/** État de l'accès à un compte pour une campagne donnée. */
export function accessState(rows: AccessRow[], platform: PlatformCode, campaignId: string): AccessState {
  const row = rows.find((r) => r.platform === platform);
  if (!row) return "TODO";
  if (row.method === "INVITE" && inviteNeedsCode(platform) && row.campaignId !== campaignId) return "TODO";
  return row.status === "VERIFIED" || row.status === "PROBLEM" ? row.status : "SENT";
}

/** Réseaux pour lesquels le client doit encore agir. */
export function accessToGive(rows: AccessRow[], platforms: PlatformCode[], campaignId: string): PlatformCode[] {
  return platforms.filter((p) => { const s = accessState(rows, p, campaignId); return s === "TODO" || s === "PROBLEM"; });
}

export const accountNoun = (platform: PlatformCode) => `${platform === "FACEBOOK" ? "page" : "compte"} ${PLATFORMS[platform].label}`;

/** Étapes de l'option « Je vous ajoute ». `agency` : nom du profil Facebook de l'agence, que le client recherche. */
export function inviteSteps(platform: PlatformCode, agency: string): string[] {
  const add = `Touchez « Ajouter », cherchez « ${agency} », cochez « Publicités », puis validez.`;
  return rawInviteSteps(platform, add).map(glue);
}

/** Espaces insécables dans les guillemets : un « » ne se retrouve jamais seul en fin de ligne. */
const glue = (text: string) => text.replace(/« /g, "«\u00a0").replace(/ »/g, "\u00a0»");

function rawInviteSteps(platform: PlatformCode, add: string): string[] {
  if (platform === "FACEBOOK") return [
    "Ouvrez votre page Facebook, puis « Paramètres ».",
    "Touchez « Accès à la Page ».",
    add,
  ];
  if (platform === "INSTAGRAM") return [
    "Dans Instagram : « Paramètres », « Type de compte », puis « Compte professionnel ».",
    "Sur votre page Facebook : « Paramètres », « Comptes liés », « Instagram », puis « Connecter ».",
    `Toujours sur la page Facebook : « Accès à la Page ». ${add}`,
  ];
  return [
    "Dans TikTok : « Paramètres », « Outils de créateur », « Paramètres publicitaires ». Activez « Autorisation publicitaire ».",
    "Ouvrez la vidéo à promouvoir : « … », « Paramètres publicitaires », puis « Générer le code » (30 jours).",
    "Collez ce code ci-dessous.",
  ];
}
