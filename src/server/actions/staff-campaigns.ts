"use server";

import { parseMetricsCsv, type ImportedRow } from "@/lib/ads/csv";
import { readExternalRefs, syncCampaignMetrics } from "@/lib/ads/sync";
import { audit } from "@/lib/audit";
import { can, canViewCampaign, type Permission } from "@/lib/auth/permissions";
import { assertPermission } from "@/lib/auth/session";
import { changeCampaignStatus } from "@/lib/campaigns/service";
import { ALL_STATUSES, type CampaignStatusName } from "@/lib/campaigns/status";
import { inviteNeedsCode } from "@/lib/catalog/access";
import { PLATFORM_CODES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/service";
import { parseIsoDate, todayUtc, truncate } from "@/lib/utils";
import { unseal } from "@/lib/vault";
import { safeAction, UserError } from "@/server/action";

/** Vérifie la permission puis le droit de voir cette campagne (un designer n'accède qu'à celles qui lui sont attribuées). */
async function staffCampaign(campaignId: string, permission: Permission) {
  const actor = await assertPermission(permission);
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status === "DRAFT" || !canViewCampaign(actor, campaign)) throw new UserError("Campagne introuvable.");
  return { actor, campaign };
}

export async function staffChangeStatusAction(campaignId: string, to: string, note: string) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "campaign.update_status");
    if (!ALL_STATUSES.includes(to as CampaignStatusName)) throw new UserError("Statut inconnu.");
    if (to === "CLIENT_REVIEW" && !(await db.campaignAsset.count({ where: { campaignId, role: "CREATIVE", approval: "PENDING" } }))) throw new UserError("Soumettez au moins une création à valider avant de demander la validation du client.");
    if (to === "RUNNING") {
      if (await db.campaignAsset.count({ where: { campaignId, role: "CREATIVE", approval: { in: ["PENDING", "CHANGES_REQUESTED"] } } })) throw new UserError("Des créations attendent encore la validation du client.");
      if (!Object.keys(readExternalRefs(campaign.externalRefs)).length) throw new UserError("Renseignez l'identifiant de la campagne créée sur Meta ou TikTok avant de la déclarer en cours.");
    }
    await changeCampaignStatus({ campaignId, to: to as CampaignStatusName, actor, note: truncate(note ?? "", 600) });
    // La publicité tourne : les accès encore « à vérifier » ont donc fonctionné.
    if (to === "RUNNING" && campaign.businessId) {
      await db.accountAccess.updateMany({ where: { businessId: campaign.businessId, platform: { in: campaign.platforms }, status: "SENT" }, data: { status: "VERIFIED", verifiedAt: new Date() } });
    }
  });
}

export async function assignCampaignAction(campaignId: string, managerId: string | null, designerId: string | null) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "campaign.assign");
    const check = async (id: string | null, permission: Permission, label: string) => {
      if (!id) return null;
      const u = await db.user.findFirst({ where: { id, status: "ACTIVE" }, select: { id: true, role: true } });
      if (!u || !can(u.role, permission)) throw new UserError(`${label} : ce collaborateur n'a pas le rôle requis.`);
      return u.id;
    };
    const manager = await check(managerId, "campaign.update_status", "Gestionnaire");
    const designer = await check(designerId, "campaign.manage_creatives", "Designer");
    await db.campaign.update({ where: { id: campaignId }, data: { managerId: manager, designerId: designer } });
    await audit({ actorId: actor.id, action: "campaign.assigned", entity: "Campaign", entityId: campaignId, meta: { managerId: manager, designerId: designer } });
    const link = `/gestion/campagnes/${campaignId}`;
    for (const id of [manager !== campaign.managerId ? manager : null, designer !== campaign.designerId ? designer : null]) {
      if (id && id !== actor.id) await notify({ userId: id, type: "campaign.assigned", title: `Campagne attribuée : ${campaign.name}`, body: `La campagne ${campaign.reference} vous a été confiée.`, link });
    }
  });
}

export async function saveExternalRefsAction(campaignId: string, refs: Record<string, string>) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "campaign.update_status");
    const clean: Record<string, string> = {};
    for (const p of PLATFORM_CODES) {
      const v = String(refs[p] ?? "").trim();
      if (!v) continue;
      if (!campaign.platforms.includes(p)) throw new UserError("Cette plateforme ne fait pas partie de la campagne.");
      if (!/^[A-Za-z0-9_-]{5,40}$/.test(v)) throw new UserError("Identifiant invalide : copiez l'identifiant numérique de la campagne depuis le gestionnaire de publicités.");
      clean[p] = v;
    }
    await db.campaign.update({ where: { id: campaignId }, data: { externalRefs: clean } });
    await audit({ actorId: actor.id, action: "campaign.external_refs", entity: "Campaign", entityId: campaignId, meta: clean });
  });
}

// ─────────────────────────── Créations ───────────────────────────

async function notifyReview(campaign: { id: string; userId: string; name: string }) {
  await notify({ userId: campaign.userId, type: "creative.submitted", title: `Création à valider : ${campaign.name}`, body: "Notre équipe vous soumet une création. Validez-la ou demandez une modification.", link: `/app/campagnes/${campaign.id}?onglet=creations`, email: true, whatsapp: true });
}

/** Rattache à la campagne un fichier envoyé par le collaborateur ; `submit` le soumet à la validation du client. */
export async function staffAttachCreativeAction(campaignId: string, assetId: string, submit: boolean) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "campaign.manage_creatives");
    if (["COMPLETED", "CANCELLED"].includes(campaign.status)) throw new UserError("Cette campagne est clôturée.");
    const asset = await db.asset.findFirst({ where: { id: assetId, ownerId: actor.id }, select: { id: true, kind: true } });
    if (!asset) throw new UserError("Fichier introuvable.");
    if (asset.kind === "DOCUMENT") throw new UserError("Une création doit être une image ou une vidéo.");
    await db.campaignAsset.upsert({
      where: { campaignId_assetId_role: { campaignId, assetId, role: "CREATIVE" } },
      create: { campaignId, assetId, role: "CREATIVE", approval: submit ? "PENDING" : "NOT_REQUIRED", addedById: actor.id },
      update: {},
    });
    await audit({ actorId: actor.id, action: "creative.added", entity: "Campaign", entityId: campaignId, meta: { assetId, submit } });
    if (submit) await notifyReview(campaign);
  });
}

export async function staffSubmitCreativeAction(linkId: string) {
  return safeAction(async () => {
    const link = await db.campaignAsset.findFirst({ where: { id: linkId, role: "CREATIVE" } });
    if (!link) throw new UserError("Création introuvable.");
    const { actor, campaign } = await staffCampaign(link.campaignId, "campaign.manage_creatives");
    if (link.approval === "PENDING") throw new UserError("Cette création est déjà en attente de validation.");
    await db.campaignAsset.update({ where: { id: linkId }, data: { approval: "PENDING", feedback: null, decidedAt: null } });
    await audit({ actorId: actor.id, action: "creative.submitted", entity: "CampaignAsset", entityId: linkId });
    await notifyReview(campaign);
  });
}

export async function staffRemoveCreativeAction(linkId: string) {
  return safeAction(async () => {
    const link = await db.campaignAsset.findFirst({ where: { id: linkId, role: "CREATIVE" } });
    if (!link) throw new UserError("Création introuvable.");
    const { actor, campaign } = await staffCampaign(link.campaignId, "campaign.manage_creatives");
    if (link.addedById === campaign.userId) throw new UserError("Ce fichier a été fourni par le client : il ne peut pas être retiré par l'équipe.");
    if (link.approval === "APPROVED") throw new UserError("Cette création a été validée par le client.");
    await db.campaignAsset.delete({ where: { id: linkId } });
    await audit({ actorId: actor.id, action: "creative.removed", entity: "CampaignAsset", entityId: linkId });
  });
}

// ─────────────────────────── Demandes de modification ───────────────────────────

export async function handleRevisionAction(revisionId: string, status: "IN_PROGRESS" | "DONE" | "REJECTED", response: string) {
  return safeAction(async () => {
    const revision = await db.revisionRequest.findUnique({ where: { id: revisionId } });
    if (!revision) throw new UserError("Demande introuvable.");
    const { actor, campaign } = await staffCampaign(revision.campaignId, "revision.manage");
    if (!["IN_PROGRESS", "DONE", "REJECTED"].includes(status)) throw new UserError("Statut inconnu.");
    if (["DONE", "REJECTED"].includes(revision.status)) throw new UserError("Cette demande est déjà clôturée.");
    const text = (response ?? "").trim().slice(0, 1000);
    if (status === "REJECTED" && text.length < 5) throw new UserError("Expliquez au client pourquoi la demande ne peut pas être appliquée.");
    await db.revisionRequest.update({ where: { id: revisionId }, data: { status, response: text || revision.response, handledById: actor.id } });
    await audit({ actorId: actor.id, action: `revision.${status.toLowerCase()}`, entity: "RevisionRequest", entityId: revisionId });
    if (status !== "IN_PROGRESS") {
      await notify({ userId: campaign.userId, type: "revision.answered", title: status === "DONE" ? `Modification appliquée : ${campaign.name}` : `Modification refusée : ${campaign.name}`, body: text || "Votre demande a été traitée.", link: `/app/campagnes/${campaign.id}?onglet=details`, email: true });
    }
  });
}

// ─────────────────────────── Statistiques ───────────────────────────

const NUM_KEYS = ["impressions", "reach", "clicks", "engagements", "videoViews", "conversions", "leads", "spend"] as const;

async function storeRows(campaignId: string, rows: ImportedRow[], source: "IMPORT" | "MANUAL", importId: string | null, platforms: string[], start: Date | null) {
  let stored = 0;
  const skipped: string[] = [];
  const today = todayUtc();
  for (const r of rows) {
    const date = parseIsoDate(r.date);
    if (!date || date > today) { skipped.push(`${r.date} : date à venir ou invalide`); continue; }
    if (start && date < new Date(start.getTime() - 3 * 86_400_000)) { skipped.push(`${r.date} : antérieure au début de la campagne`); continue; }
    if (!platforms.includes(r.platform)) { skipped.push(`${r.date} : ${r.platform} ne fait pas partie de la campagne`); continue; }
    if (r.clicks > r.impressions && r.impressions > 0) { skipped.push(`${r.date} : plus de clics que d'impressions`); continue; }
    const existing = await db.metricSnapshot.findUnique({ where: { campaignId_platform_date: { campaignId, platform: r.platform, date } } });
    // Une donnée issue de l'API officielle n'est jamais écrasée par une saisie.
    if (existing?.source === "API") { skipped.push(`${r.date} : déjà synchronisée depuis l'API`); continue; }
    const data = { ...Object.fromEntries(NUM_KEYS.map((k) => [k, r[k]])), revenue: r.revenue, source, importId, validated: false, validatedById: null, validatedAt: null } as const;
    await db.metricSnapshot.upsert({ where: { campaignId_platform_date: { campaignId, platform: r.platform, date } }, create: { campaignId, platform: r.platform, date, ...data }, update: data });
    stored++;
  }
  return { stored, skipped };
}

/** Import d'un export CSV du gestionnaire de publicités. Les lignes restent invisibles du client jusqu'à validation. */
export async function importMetricsAction(campaignId: string, csv: string, fileName: string, defaultPlatform: string | null) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "metrics.import");
    if (!campaign.launchedAt) throw new UserError("La campagne n'a pas encore été lancée.");
    if (typeof csv !== "string" || csv.length > 400_000) throw new UserError("Fichier trop volumineux (400 Ko maximum).");
    const platform = PLATFORM_CODES.includes(defaultPlatform as PlatformCode) ? (defaultPlatform as PlatformCode) : null;
    const parsed = parseMetricsCsv(csv, platform);
    if (!parsed.rows.length) throw new UserError(parsed.errors[0] ?? "Aucune ligne exploitable dans ce fichier.");
    const imp = await db.metricImport.create({ data: { campaignId, uploadedById: actor.id, fileName: truncate(fileName || "import.csv", 120), rowCount: 0 } });
    const { stored, skipped } = await storeRows(campaignId, parsed.rows, "IMPORT", imp.id, campaign.platforms, campaign.startDate);
    if (!stored) { await db.metricImport.delete({ where: { id: imp.id } }); throw new UserError(skipped[0] ?? "Aucune ligne n'a pu être enregistrée."); }
    await db.metricImport.update({ where: { id: imp.id }, data: { rowCount: stored, note: [...parsed.errors, ...skipped].slice(0, 8).join(" · ") || null } });
    await audit({ actorId: actor.id, action: "metrics.imported", entity: "Campaign", entityId: campaignId, meta: { importId: imp.id, rows: stored } });
    return { stored, issues: [...parsed.errors, ...skipped].slice(0, 12) };
  });
}

export async function saveMetricRowAction(campaignId: string, row: Record<string, string>) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "metrics.import");
    if (!campaign.launchedAt) throw new UserError("La campagne n'a pas encore été lancée.");
    const num = (k: string) => { const n = Number(String(row[k] ?? "0").replace(/\s/g, "") || 0); if (!Number.isInteger(n) || n < 0 || n > 2_000_000_000) throw new UserError("Les valeurs doivent être des nombres entiers positifs."); return n; };
    if (!PLATFORM_CODES.includes(row.platform as PlatformCode)) throw new UserError("Choisissez une plateforme.");
    const revenue = String(row.revenue ?? "").trim() === "" ? null : num("revenue");
    const data: ImportedRow = { date: String(row.date ?? ""), platform: row.platform as PlatformCode, impressions: num("impressions"), reach: num("reach"), clicks: num("clicks"), engagements: num("engagements"), videoViews: num("videoViews"), conversions: num("conversions"), leads: num("leads"), spend: num("spend"), revenue };
    const { stored, skipped } = await storeRows(campaignId, [data], "MANUAL", null, campaign.platforms, campaign.startDate);
    if (!stored) throw new UserError(skipped[0] ?? "Ligne refusée.");
    await audit({ actorId: actor.id, action: "metrics.manual_row", entity: "Campaign", entityId: campaignId, meta: { date: data.date, platform: data.platform } });
  });
}

/** Publie les statistiques en attente : elles deviennent visibles du client. */
export async function validateMetricsAction(campaignId: string) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "metrics.validate");
    const res = await db.metricSnapshot.updateMany({ where: { campaignId, validated: false }, data: { validated: true, validatedById: actor.id, validatedAt: new Date() } });
    if (!res.count) throw new UserError("Aucune statistique en attente de validation.");
    await db.metricImport.updateMany({ where: { campaignId, status: "PENDING" }, data: { status: "VALIDATED" } });
    await audit({ actorId: actor.id, action: "metrics.validated", entity: "Campaign", entityId: campaignId, meta: { rows: res.count } });
    await notify({ userId: campaign.userId, type: "metrics.updated", title: `Nouveaux résultats : ${campaign.name}`, body: "Les statistiques de votre campagne ont été mises à jour.", link: `/app/campagnes/${campaign.id}` });
    return { count: res.count };
  });
}

/** Supprime les lignes non validées (import ou saisie erronés). Les données déjà publiées ne sont pas touchées. */
export async function discardPendingMetricsAction(campaignId: string) {
  return safeAction(async () => {
    const { actor } = await staffCampaign(campaignId, "metrics.import");
    const res = await db.metricSnapshot.deleteMany({ where: { campaignId, validated: false, source: { not: "API" } } });
    await db.metricImport.updateMany({ where: { campaignId, status: "PENDING" }, data: { status: "REJECTED" } });
    await audit({ actorId: actor.id, action: "metrics.discarded", entity: "Campaign", entityId: campaignId, meta: { rows: res.count } });
    return { count: res.count };
  });
}

export async function syncMetricsAction(campaignId: string) {
  return safeAction(async () => {
    const { actor } = await staffCampaign(campaignId, "metrics.import");
    const res = await syncCampaignMetrics(campaignId);
    await audit({ actorId: actor.id, action: "metrics.synced", entity: "Campaign", entityId: campaignId, meta: { synced: res.synced } });
    return res;
  });
}

/** Affiche les identifiants confiés par le client. Réservé aux rôles autorisés ; chaque consultation est journalisée. */
export async function revealAccessAction(campaignId: string, platform: string) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "access.reveal");
    if (!campaign.businessId || !PLATFORM_CODES.includes(platform as PlatformCode)) throw new UserError("Accès introuvable.");
    const row = await db.accountAccess.findUnique({ where: { businessId_platform: { businessId: campaign.businessId, platform: platform as PlatformCode } } });
    if (!row || !row.loginEnc) throw new UserError("Le client n'a pas confié d'identifiants pour ce compte.");
    const login = unseal(row.loginEnc);
    const password = row.secretEnc ? unseal(row.secretEnc) : null;
    if (login === null || (row.secretEnc && password === null)) throw new UserError("Identifiants illisibles (clé de chiffrement modifiée). Demandez au client de les renvoyer.");
    await audit({ actorId: actor.id, action: "access.revealed", entity: "Campaign", entityId: campaign.id, meta: { platform, method: row.method } });
    return { login, password };
  });
}

/** L'équipe confirme que l'accès fonctionne, ou signale un problème au client. */
export async function reviewAccessAction(campaignId: string, platform: string, ok: boolean, note: string) {
  return safeAction(async () => {
    const { actor, campaign } = await staffCampaign(campaignId, "campaign.update_status");
    if (!campaign.businessId || !PLATFORM_CODES.includes(platform as PlatformCode)) throw new UserError("Accès introuvable.");
    const message = truncate((note ?? "").trim(), 300);
    if (!ok && message.length < 5) throw new UserError("Expliquez au client ce qui ne fonctionne pas.");
    const p = platform as PlatformCode;
    const where = { businessId_platform: { businessId: campaign.businessId, platform: p } };
    const row = await db.accountAccess.findUnique({ where, select: { method: true, campaignId: true } });
    // Code de vidéo TikTok d'une autre campagne : il ne compte pas pour celle-ci.
    const usable = row && !(row.method === "INVITE" && inviteNeedsCode(p) && row.campaignId !== campaign.id);
    if (!ok) {
      if (!usable) throw new UserError("Le client n'a pas encore donné cet accès.");
      await db.accountAccess.update({ where, data: { status: "PROBLEM", verifiedAt: null, note: message } });
    } else if (usable) {
      await db.accountAccess.update({ where, data: { status: "VERIFIED", verifiedAt: new Date(), note: null } });
    } else {
      // Accès obtenu hors de la plateforme (le client vous a ajouté sans cliquer sur « C'est fait », ou par WhatsApp).
      const data = { method: "INVITE", status: "VERIFIED", verifiedAt: new Date(), note: null, loginEnc: null, secretEnc: null, campaignId: inviteNeedsCode(p) ? campaign.id : null };
      await db.accountAccess.upsert({ where, create: { businessId: campaign.businessId, platform: p, ...data }, update: data });
    }
    await audit({ actorId: actor.id, action: ok ? "access.verified" : "access.problem", entity: "Campaign", entityId: campaign.id, meta: { platform } });
    if (!ok) {
      await notify({
        userId: campaign.userId, type: "access.problem", title: `Accès ${PLATFORMS[platform as PlatformCode].label} à refaire`,
        body: message, link: `/app/campagnes/${campaign.id}`, email: true, whatsapp: true,
      });
    }
  });
}
