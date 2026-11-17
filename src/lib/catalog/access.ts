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

/** Une étape affichée au client, avec éventuellement un bouton qui ouvre directement le bon écran du réseau. */
export type InviteStep = { text: string; link?: { href: string; label: string } };

/**
 * Lien direct vers « Accès à la Page » de Facebook (nouvelle expérience des Pages).
 * Il n'ouvre le bon écran que si le client utilise Facebook en tant que sa page : d'où l'étape 1.
 * Facebook change parfois ses adresses : à revérifier si des clients disent que le lien n'ouvre pas le bon écran.
 */
export const FACEBOOK_PAGE_ACCESS_URL = "https://www.facebook.com/settings/?tab=profile_access";
const pageAccessLink = { href: FACEBOOK_PAGE_ACCESS_URL, label: "Ouvrir « Accès à la Page »" };

/** Étapes de l'option « Je vous ajoute ». `agency` : nom du profil Facebook de l'agence, que le client recherche. */
export function inviteSteps(platform: PlatformCode, agency: string): InviteStep[] {
  const add = `Touchez « Ajouter », cherchez « ${agency} », puis donnez l'accès. Facebook demande votre mot de passe.`;
  return rawInviteSteps(platform, add).map((step) => ({ text: glue(step.text), link: step.link && { ...step.link, label: glue(step.link.label) } }));
}

/** Espaces insécables dans les guillemets et avant les deux-points : un « » ou un « : » ne se retrouve jamais seul en début de ligne. */
const glue = (text: string) => text.replace(/« /g, "«\u00a0").replace(/ »/g, "\u00a0»").replace(/ :/g, "\u00a0:");

function rawInviteSteps(platform: PlatformCode, add: string): InviteStep[] {
  const switchToPage = "Sur Facebook, passez sur votre page : touchez votre photo, puis le nom de la page.";
  const openAccess = { text: "Ouvrez « Accès à la Page » avec ce bouton. Sinon : « Paramètres », puis « Accès à la Page ».", link: pageAccessLink };
  if (platform === "FACEBOOK") return [{ text: switchToPage }, openAccess, { text: add }];
  if (platform === "INSTAGRAM") return [
    { text: "Dans Instagram : « Paramètres », « Type de compte », puis « Compte professionnel »." },
    { text: `${switchToPage} Puis « Paramètres », « Comptes liés », « Instagram », « Connecter ».` },
    openAccess,
    { text: add },
  ];
  return [
    { text: "Dans TikTok : « Paramètres », « Outils de créateur », « Paramètres publicitaires ». Activez « Autorisation publicitaire »." },
    { text: "Ouvrez la vidéo à promouvoir : « … », « Paramètres publicitaires », puis « Générer le code » (30 jours)." },
    { text: "Collez ce code ci-dessous." },
  ];
}
