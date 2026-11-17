"use server";

import { audit } from "@/lib/audit";
import { assertUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, type CampaignStatusName } from "@/lib/campaigns/status";
import { inviteNeedsCode, METHOD_LABELS, type AccessMethod } from "@/lib/catalog/access";
import { PLATFORM_CODES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { notifyStaff } from "@/lib/notifications/service";
import { rateLimit } from "@/lib/rate-limit";
import { seal } from "@/lib/vault";
import { safeAction, UserError } from "@/server/action";

async function ownedActiveCampaign(campaignId: string, userId: string, platform: string) {
  if (!PLATFORM_CODES.includes(platform as PlatformCode)) throw new UserError("Réseau inconnu.");
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId }, select: { id: true, name: true, status: true, platforms: true, businessId: true } });
  if (!campaign || !campaign.businessId) throw new UserError("Campagne introuvable.");
  if (!ACTIVE_STATUSES.includes(campaign.status as CampaignStatusName)) throw new UserError("L'accès se donne une fois la campagne payée.");
  if (!(campaign.platforms as string[]).includes(platform)) throw new UserError("Ce réseau ne fait pas partie de la campagne.");
  return { ...campaign, businessId: campaign.businessId, platform: platform as PlatformCode };
}

/**
 * Le client donne l'accès à l'un de ses comptes.
 * INVITE : il déclare avoir ajouté l'agence (ou fournit le code de sa vidéo TikTok). LOGIN : identifiant et mot de passe, chiffrés.
 */
export async function giveAccessAction(campaignId: string, platform: string, input: { method: AccessMethod; login?: string; password?: string; code?: string }) {
  return safeAction(async () => {
    const user = await assertUser();
    if (!(await rateLimit(`access:${user.id}`, 20, 3600))) throw new UserError("Trop d'essais. Réessayez dans une heure.");
    const c = await ownedActiveCampaign(campaignId, user.id, platform);
    const method: AccessMethod = input.method === "LOGIN" ? "LOGIN" : "INVITE";
    let loginEnc: string | null = null;
    let secretEnc: string | null = null;
    let scope: string | null = null;

    if (method === "LOGIN") {
      const login = (input.login ?? "").trim();
      const password = input.password ?? "";
      if (login.length < 3 || login.length > 120) throw new UserError("Indiquez votre identifiant : e-mail, téléphone ou nom d'utilisateur.");
      if (password.length < 4 || password.length > 200) throw new UserError("Indiquez votre mot de passe.");
      loginEnc = seal(login);
      secretEnc = seal(password);
    } else if (inviteNeedsCode(c.platform)) {
      const code = (input.code ?? "").trim();
      if (code.length < 6 || code.length > 300 || /\s/.test(code)) throw new UserError("Collez le code de votre vidéo, sans espace.");
      loginEnc = seal(code);
      scope = c.id; // un code de vidéo ne vaut que pour cette campagne
    }

    const data = { method, status: "SENT", loginEnc, secretEnc, campaignId: scope, note: null, verifiedAt: null };
    await db.accountAccess.upsert({ where: { businessId_platform: { businessId: c.businessId, platform: c.platform } }, create: { businessId: c.businessId, platform: c.platform, ...data }, update: data });
    // Le journal garde la trace de l'action, jamais des identifiants.
    await audit({ actorId: user.id, action: "access.given", entity: "Campaign", entityId: c.id, meta: { platform: c.platform, method } });
    await notifyStaff("campaign.update_status", {
      type: "access.given", title: `Accès reçu : ${c.name}`,
      body: `${PLATFORMS[c.platform].label} — ${METHOD_LABELS[method].staff.toLowerCase()}. À vérifier avant de lancer.`, link: `/gestion/campagnes/${c.id}`,
    });
    return { method };
  });
}

/** Le client retire l'accès qu'il avait donné (ses identifiants sont effacés aussitôt). */
export async function removeAccessAction(campaignId: string, platform: string) {
  return safeAction(async () => {
    const user = await assertUser();
    if (!PLATFORM_CODES.includes(platform as PlatformCode)) throw new UserError("Réseau inconnu.");
    const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId: user.id }, select: { id: true, name: true, businessId: true } });
    if (!campaign?.businessId) throw new UserError("Campagne introuvable.");
    const res = await db.accountAccess.deleteMany({ where: { businessId: campaign.businessId, platform: platform as PlatformCode } });
    if (!res.count) return;
    await audit({ actorId: user.id, action: "access.removed", entity: "Campaign", entityId: campaign.id, meta: { platform } });
    await notifyStaff("campaign.update_status", { type: "access.removed", title: `Accès retiré : ${campaign.name}`, body: `Le client a retiré l'accès à son compte ${PLATFORMS[platform as PlatformCode].label}.`, link: `/gestion/campagnes/${campaign.id}` });
  });
}
