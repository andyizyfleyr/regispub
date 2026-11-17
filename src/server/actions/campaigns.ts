"use server";

import { ACCOUNT_FIELDS, normalizeAccount } from "@/lib/catalog/accounts";
import { redirect } from "next/navigation";
import { z } from "zod";
import { policyWarnings, strategySchema, type BusinessContext, type Strategy, type TargetingAdvice } from "@/lib/ai/schemas";
import { runAiTask } from "@/lib/ai/service";
import { audit } from "@/lib/audit";
import { can, canViewCampaign } from "@/lib/auth/permissions";
import { assertUser } from "@/lib/auth/session";
import { campaignMissing, quoteCampaign, upsertCampaignOrder } from "@/lib/campaigns/service";
import { clientCanCancel, clientCanEdit, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective, unsupportedPlatforms } from "@/lib/catalog/objectives";
import { normalizeSplit, PLATFORM_CODES, platformLabel, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { CITIES_BY_COUNTRY, MAX_AGE, MIN_AGE, SECTORS, TARGET_COUNTRIES } from "@/lib/catalog/targeting";
import { db } from "@/lib/db";
import { notify, notifyStaff } from "@/lib/notifications/service";
import { resolvePromo } from "@/lib/payments/service";
import { toWhatsappLink } from "@/lib/phone";
import { QuoteError } from "@/lib/pricing/quote";
import { rateLimit } from "@/lib/rate-limit";
import { addDays, makeReference, parseIsoDate, todayUtc, truncate } from "@/lib/utils";
import { safeAction, UserError } from "@/server/action";

const platformEnum = z.enum(PLATFORM_CODES as [PlatformCode, ...PlatformCode[]]);
const text = (max: number) => z.string().trim().max(max);

async function ownedEditable(campaignId: string, userId: string) {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId } });
  if (!campaign) throw new UserError("Campagne introuvable.");
  if (!clientCanEdit(campaign.status as CampaignStatusName)) throw new UserError("Cette campagne a déjà été commandée : elle ne peut plus être modifiée ici. Écrivez à votre gestionnaire pour toute modification.");
  return campaign;
}

export async function createCampaignAction(mode: "SELF_SERVICE" | "EXPERT", objective?: string) {
  const user = await assertUser();
  if (user.role !== "CLIENT") redirect("/gestion");
  const drafts = await db.campaign.count({ where: { userId: user.id, status: "DRAFT" } });
  if (drafts >= 20) redirect("/app/campagnes?etat=brouillons&limite=1");
  const business = await db.business.findFirst({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" } });
  const obj = getObjective(objective);
  const campaign = await db.campaign.create({
    data: {
      reference: makeReference("CMP"), userId: user.id, mode: mode === "EXPERT" ? "EXPERT" : "SELF_SERVICE", name: mode === "EXPERT" ? "Campagne confiée à un expert" : "Nouvelle campagne",
      businessId: business?.id ?? null, destinationWhatsapp: business?.whatsapp ?? null, objective: obj?.code ?? null,
      // Présélection : les plateformes de l'objectif, sinon Facebook et Instagram (une seule famille, sans supplément).
      platforms: mode === "EXPERT" ? [] : obj && obj.platforms.length < 3 ? obj.platforms : ["FACEBOOK", "INSTAGRAM"],
      serviceCode: mode === "EXPERT" ? "full_management" : null, startDate: addDays(todayUtc(), 2),
    },
  });
  redirect(mode === "EXPERT" ? `/app/expert/${campaign.id}` : `/app/creer/${campaign.id}`);
}

const targetingSchema = z.object({
  countries: z.array(z.string()).min(1, "Choisissez au moins un pays.").max(6).refine((l) => l.every((c) => TARGET_COUNTRIES.some((t) => t.code === c)), "Pays non proposé."),
  cities: z.array(text(60)).max(25),
  zoneNote: text(300),
  ageMin: z.number().int().min(MIN_AGE).max(MAX_AGE),
  ageMax: z.number().int().min(MIN_AGE).max(MAX_AGE),
  gender: z.enum(["ALL", "FEMALE", "MALE"]),
  interests: z.array(text(60)).max(25),
  categories: z.array(text(60)).max(10),
  languages: z.array(text(10)).max(3),
  customAudience: z.object({ requested: z.boolean(), note: text(500) }),
}).refine((t) => t.ageMin <= t.ageMax, "L'âge minimum doit être inférieur à l'âge maximum.");

const patchSchema = z.object({
  wizardStep: z.number().int().min(1).max(7),
  name: text(80).min(2, "Donnez un nom à votre campagne."),
  platforms: z.array(platformEnum).min(1, "Choisissez au moins une plateforme.").max(3),
  objective: z.string().max(40),
  business: z.object({ id: z.string().nullable(), name: text(80).min(2, "Indiquez le nom de votre entreprise."), sector: z.string().refine((s) => SECTORS.includes(s), "Choisissez un secteur."), city: text(60),
    accounts: z.object({ FACEBOOK: text(300).optional(), INSTAGRAM: text(300).optional(), TIKTOK: text(300).optional() }).optional() }),
  productName: text(120),
  productDescription: text(1500).min(20, "Décrivez votre produit ou service en quelques phrases (20 caractères minimum)."),
  productPrice: z.number().int().min(0).max(1_000_000_000).nullable(),
  audienceNote: text(600),
  destinationWhatsapp: text(40),
  destinationUrl: text(300),
  brief: text(3000).min(30, "Décrivez votre besoin en quelques phrases (30 caractères minimum)."),
  strategy: strategySchema,
  adCopy: z.object({ headline: text(90), body: text(900), cta: text(40) }),
  targeting: targetingSchema,
  adBudget: z.number().int().min(0),
  durationDays: z.number().int().min(1).max(365),
  startDate: z.string(),
  budgetSplit: z.record(z.string(), z.number()),
  serviceCode: z.string().max(40).nullable(),
}).partial();

export type CampaignPatch = z.input<typeof patchSchema>;

/** Enregistre une étape de l'assistant. Chaque champ est revalidé côté serveur ; rien n'est déduit du navigateur. */
export async function saveCampaignAction(campaignId: string, input: CampaignPatch) {
  return safeAction(async () => {
    const user = await assertUser();
    const campaign = await ownedEditable(campaignId, user.id);
    const parsed = patchSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Informations invalides.");
    const p = parsed.data;
    const data: Record<string, unknown> = {};
    const platforms = (p.platforms ?? campaign.platforms) as PlatformCode[];

    if (p.platforms) {
      data.platforms = p.platforms;
      data.budgetSplit = normalizeSplit(p.platforms, campaign.budgetSplit);
      const current = getObjective(campaign.objective);
      if (current && unsupportedPlatforms(current, p.platforms).length === p.platforms.length) data.objective = null;
    }
    if (p.objective !== undefined) {
      const objective = getObjective(p.objective);
      if (!objective) throw new UserError("Objectif publicitaire inconnu.");
      const bad = unsupportedPlatforms(objective, platforms);
      if (platforms.length && bad.length === platforms.length) throw new UserError(`« ${objective.label} » n'est pas disponible sur ${platformLabel(bad)}.`);
      data.objective = objective.code;
      if (objective.code !== campaign.objective) { data.strategy = null; data.adCopy = null; }
      if (campaign.name === "Nouvelle campagne" || campaign.name === "Campagne confiée à un expert") data.name = truncate(objective.label, 80);
    }
    if (p.business) {
      const b = p.business;
      // Comptes du client sur les réseaux : un champ absent garde sa valeur enregistrée.
      const accounts: Partial<Record<"facebookUrl" | "instagramUrl" | "tiktokUrl", string | null>> = {};
      for (const code of PLATFORM_CODES) {
        const raw = b.accounts?.[code];
        if (raw === undefined) continue;
        const url = normalizeAccount(code, raw);
        if (url === null) throw new UserError(`Compte ${PLATFORMS[code].label} : collez le lien ou le @nom de votre compte.`);
        accounts[ACCOUNT_FIELDS[code].column] = url || null;
      }
      if (b.id) {
        const updated = await db.business.updateMany({ where: { id: b.id, ownerId: user.id }, data: { name: b.name, sector: b.sector, city: b.city || null, ...accounts } });
        if (!updated.count) throw new UserError("Entreprise introuvable.");
        data.businessId = b.id;
      } else {
        if ((await db.business.count({ where: { ownerId: user.id } })) >= 20) throw new UserError("Nombre maximal d'entreprises atteint.");
        data.businessId = (await db.business.create({ data: { ownerId: user.id, name: b.name, sector: b.sector, city: b.city || null, ...accounts } })).id;
      }
    }
    if (p.name !== undefined) data.name = p.name;
    if (p.productName !== undefined) data.productName = p.productName || null;
    if (p.productDescription !== undefined) data.productDescription = p.productDescription;
    if (p.productPrice !== undefined) data.productPrice = p.productPrice;
    if (p.audienceNote !== undefined) data.audienceNote = p.audienceNote || null;
    if (p.brief !== undefined) data.brief = p.brief;
    if (p.destinationWhatsapp !== undefined) {
      if (p.destinationWhatsapp && !toWhatsappLink(p.destinationWhatsapp)) throw new UserError("Numéro ou lien WhatsApp invalide. Exemple : 01 97 00 00 00 ou https://wa.me/22901970000.");
      data.destinationWhatsapp = p.destinationWhatsapp || null;
    }
    if (p.destinationUrl !== undefined) {
      if (p.destinationUrl && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(p.destinationUrl)) throw new UserError("Le lien de votre page doit commencer par https://");
      data.destinationUrl = p.destinationUrl || null;
    }
    if (p.strategy) data.strategy = { ...(campaign.strategy as object | null ?? {}), ...p.strategy, edited: true };
    if (p.adCopy) data.adCopy = p.adCopy;
    if (p.targeting) {
      const allowed = new Set(p.targeting.countries.flatMap((c) => CITIES_BY_COUNTRY[c] ?? []));
      data.targeting = { ...p.targeting, cities: p.targeting.cities.filter((c) => allowed.has(c)) };
    }
    if (p.adBudget !== undefined) data.adBudget = p.adBudget;
    if (p.durationDays !== undefined) data.durationDays = p.durationDays;
    if (p.startDate !== undefined) {
      const date = parseIsoDate(p.startDate);
      if (!date) throw new UserError("Date de début invalide.");
      if (date < todayUtc()) throw new UserError("La date de début ne peut pas être dans le passé.");
      if (date > addDays(todayUtc(), 180)) throw new UserError("La date de début est trop éloignée (6 mois maximum).");
      data.startDate = date;
    }
    const start = (data.startDate as Date | undefined) ?? campaign.startDate;
    const days = (data.durationDays as number | undefined) ?? campaign.durationDays;
    if (start && days) data.endDate = addDays(start, days - 1);
    if (p.budgetSplit) data.budgetSplit = normalizeSplit(platforms, p.budgetSplit);
    if (p.serviceCode !== undefined) {
      if (p.serviceCode) {
        const level = await db.service.findFirst({ where: { code: p.serviceCode, active: true, kind: { in: ["PACK", "MANAGEMENT"] } } });
        if (!level) throw new UserError("Niveau d'accompagnement indisponible.");
      } else if (campaign.mode === "EXPERT") throw new UserError("Choisissez une formule d'accompagnement.");
      data.serviceCode = p.serviceCode;
    }
    if (p.wizardStep) data.wizardStep = Math.max(campaign.wizardStep, p.wizardStep);

    await db.campaign.update({ where: { id: campaign.id }, data });
    const warnings = policyWarnings([p.productDescription, p.productName, p.brief, p.adCopy?.headline, p.adCopy?.body].filter(Boolean).join(" "));
    return { warnings };
  });
}

async function contextFor(campaignId: string, userId: string): Promise<{ ctx: BusinessContext; campaign: Awaited<ReturnType<typeof ownedEditable>> }> {
  const campaign = await ownedEditable(campaignId, userId);
  const business = campaign.businessId ? await db.business.findUnique({ where: { id: campaign.businessId } }) : null;
  const objective = getObjective(campaign.objective);
  const targeting = campaign.targeting as { countries?: string[] } | null;
  return {
    campaign,
    ctx: {
      businessName: business?.name ?? campaign.name, sector: business?.sector ?? "", description: business?.description ?? undefined,
      productName: campaign.productName ?? undefined, productDescription: campaign.productDescription ?? campaign.brief ?? undefined, productPrice: campaign.productPrice,
      city: business?.city ?? undefined, country: TARGET_COUNTRIES.find((c) => c.code === (targeting?.countries?.[0] ?? business?.country ?? "BJ"))?.name,
      audienceNote: campaign.audienceNote ?? undefined, objectiveLabel: objective?.label, objectiveCode: objective?.code, platforms: campaign.platforms,
    } as BusinessContext,
  };
}

/** Étape 4 : analyse et propositions. Le résultat indique toujours s'il vient d'un modèle d'IA ou de suggestions guidées. */
export async function generateStrategyAction(campaignId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const { ctx, campaign } = await contextFor(campaignId, user.id);
    if (!campaign.objective || !campaign.productDescription) throw new UserError("Renseignez d'abord votre objectif et la description de votre offre.");
    const res = await runAiTask<Strategy>("strategy", ctx, user, campaign.id);
    if (!res.ok) throw new UserError(res.error);
    const strategy = { ...res.data, engine: res.engine, generatedAt: new Date().toISOString() };
    const first = res.data.texts[0];
    await db.campaign.update({ where: { id: campaign.id }, data: { strategy, adCopy: first ? { headline: first.headline, body: first.body, cta: first.cta } : undefined } });
    return { strategy, engine: res.engine, notice: res.notice ?? null, adCopy: first ?? null };
  });
}

export async function suggestTargetingAction(campaignId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const { ctx, campaign } = await contextFor(campaignId, user.id);
    const res = await runAiTask<TargetingAdvice>("targeting", ctx, user, campaign.id);
    if (!res.ok) throw new UserError(res.error);
    return { advice: res.data, engine: res.engine };
  });
}

const CLIENT_ROLES = ["PRODUCT_MEDIA", "CREATIVE", "BRIEF_FILE"] as const;

export async function attachAssetAction(campaignId: string, assetId: string, role: (typeof CLIENT_ROLES)[number]) {
  return safeAction(async () => {
    const user = await assertUser();
    if (!CLIENT_ROLES.includes(role)) throw new UserError("Usage non autorisé.");
    const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId: user.id }, select: { id: true, status: true, name: true, managerId: true } });
    if (!campaign) throw new UserError("Campagne introuvable.");
    if (["COMPLETED", "CANCELLED"].includes(campaign.status)) throw new UserError("Cette campagne est clôturée.");
    const asset = await db.asset.findFirst({ where: { id: assetId, ownerId: user.id }, select: { id: true, kind: true } });
    if (!asset) throw new UserError("Fichier introuvable.");
    if (role === "CREATIVE" && asset.kind === "DOCUMENT") throw new UserError("Une création doit être une image ou une vidéo.");
    if ((await db.campaignAsset.count({ where: { campaignId } })) >= 40) throw new UserError("Nombre maximal de fichiers atteint pour cette campagne.");
    const link = await db.campaignAsset.upsert({
      where: { campaignId_assetId_role: { campaignId, assetId, role } },
      create: { campaignId, assetId, role, addedById: user.id }, update: {},
    });
    if (!clientCanEdit(campaign.status as CampaignStatusName)) {
      await notifyStaff("campaign.manage_creatives", { type: "campaign.file_added", title: `Nouveau fichier client : ${campaign.name}`, body: "Le client a ajouté un fichier à sa campagne.", link: `/gestion/campagnes/${campaign.id}` });
    }
    return { linkId: link.id };
  });
}

export async function detachAssetAction(campaignId: string, linkId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    await ownedEditable(campaignId, user.id);
    await db.campaignAsset.deleteMany({ where: { id: linkId, campaignId, addedById: user.id } });
  });
}

/** Devis affiché à l'étape 7. Calculé uniquement côté serveur à partir du catalogue et des paramètres. */
export async function previewQuoteAction(campaignId: string, input: { adBudget: number; durationDays: number; serviceCode: string | null; platforms?: PlatformCode[]; promoCode?: string }) {
  return safeAction(async () => {
    const user = await assertUser();
    const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId: user.id } });
    if (!campaign) throw new UserError("Campagne introuvable.");
    let promo = null;
    let promoError: string | null = null;
    if (input.promoCode?.trim()) {
      if (!(await rateLimit(`promo:${user.id}`, 20, 600))) throw new UserError("Trop d'essais de codes. Réessayez dans quelques minutes.");
      const resolved = await resolvePromo(input.promoCode, user.id);
      if ("error" in resolved) promoError = resolved.error; else promo = resolved.promo;
    }
    try {
      const quote = await quoteCampaign({
        ...campaign, platforms: (input.platforms ?? campaign.platforms) as PlatformCode[], adBudget: Math.round(Number(input.adBudget) || 0),
        durationDays: Math.round(Number(input.durationDays) || 0), serviceCode: input.serviceCode,
      }, promo);
      return { quote, promoError, error: null as string | null };
    } catch (error) {
      if (error instanceof QuoteError) return { quote: null, promoError, error: error.message };
      throw error;
    }
  });
}

export async function placeOrderAction(campaignId: string, promoCode: string | null) {
  return safeAction(async () => {
    const user = await assertUser();
    const res = await upsertCampaignOrder(user.id, campaignId, promoCode);
    if (!res.ok) throw new UserError(res.error);
    await audit({ actorId: user.id, action: "order.created", entity: "Order", entityId: res.orderId, meta: { campaignId } });
    return { orderId: res.orderId };
  });
}

export async function campaignChecklistAction(campaignId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId: user.id } });
    if (!campaign) throw new UserError("Campagne introuvable.");
    return { missing: campaignMissing(campaign) };
  });
}

export async function cancelCampaignAction(campaignId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    await db.$transaction(async (tx) => {
      const campaign = await tx.campaign.findFirst({ where: { id: campaignId, userId: user.id } });
      if (!campaign) throw new UserError("Campagne introuvable.");
      const from = campaign.status as CampaignStatusName;
      if (!clientCanCancel(from)) throw new UserError("Cette campagne est déjà payée : contactez le support pour une annulation.");
      const open = await tx.payment.count({ where: { order: { campaignId }, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: new Date() } } });
      if (open) throw new UserError("Un paiement est en cours pour cette campagne. Attendez sa confirmation ou son expiration.");
      const res = await tx.campaign.updateMany({ where: { id: campaignId, status: from }, data: { status: "CANCELLED" } });
      if (!res.count) throw new UserError("Le statut a changé entre-temps. Rechargez la page.");
      await tx.order.updateMany({ where: { campaignId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.campaignStatusEvent.create({ data: { campaignId, fromStatus: from, toStatus: "CANCELLED", actorId: user.id, note: "Annulée par le client." } });
    });
    await audit({ actorId: user.id, action: "campaign.cancelled_by_client", entity: "Campaign", entityId: campaignId });
  });
}

export async function deleteDraftAction(campaignId: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const res = await db.campaign.deleteMany({ where: { id: campaignId, userId: user.id, status: "DRAFT", orders: { none: {} } } });
    if (!res.count) throw new UserError("Seul un brouillon sans commande peut être supprimé.");
  });
}

export async function duplicateCampaignAction(campaignId: string) {
  const user = await assertUser();
  const c = await db.campaign.findFirst({ where: { id: campaignId, userId: user.id }, include: { assets: { where: { role: { in: ["PRODUCT_MEDIA", "CREATIVE", "BRIEF_FILE"] }, addedById: user.id } } } });
  if (!c) redirect("/app/campagnes");
  const copy = await db.campaign.create({
    data: {
      reference: makeReference("CMP"), userId: user.id, businessId: c.businessId, mode: c.mode, name: truncate(`${c.name} (copie)`, 80), platforms: c.platforms, objective: c.objective, serviceCode: c.serviceCode,
      productName: c.productName, productDescription: c.productDescription, productPrice: c.productPrice, audienceNote: c.audienceNote, destinationWhatsapp: c.destinationWhatsapp,
      destinationUrl: c.destinationUrl, brief: c.brief, targeting: c.targeting ?? undefined, strategy: c.strategy ?? undefined, adCopy: c.adCopy ?? undefined, adBudget: c.adBudget,
      budgetSplit: c.budgetSplit ?? undefined, durationDays: c.durationDays, startDate: addDays(todayUtc(), 2), endDate: c.durationDays ? addDays(todayUtc(), 1 + c.durationDays) : null, wizardStep: c.wizardStep,
      assets: { create: c.assets.map((a) => ({ assetId: a.assetId, role: a.role, addedById: user.id })) },
    },
  });
  redirect(c.mode === "EXPERT" ? `/app/expert/${copy.id}` : `/app/creer/${copy.id}`);
}

// ─────────────────────────── Échanges client ↔ équipe ───────────────────────────

async function viewableCampaign(campaignId: string) {
  const user = await assertUser();
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true, userId: true, managerId: true, designerId: true, status: true } });
  if (!campaign || !canViewCampaign(user, campaign)) throw new UserError("Campagne introuvable.");
  return { user, campaign };
}

export async function postMessageAction(campaignId: string, body: string, internal = false) {
  return safeAction(async () => {
    const { user, campaign } = await viewableCampaign(campaignId);
    const content = body.trim();
    if (content.length < 1 || content.length > 2000) throw new UserError("Votre message doit contenir entre 1 et 2 000 caractères.");
    const isClient = user.role === "CLIENT";
    if (!isClient && !can(user.role, "campaign.message")) throw new UserError("Vous n'avez pas le droit d'écrire au client.");
    if (isClient && campaign.status === "DRAFT") throw new UserError("La messagerie s'ouvre une fois la commande passée.");
    if (!(await rateLimit(`msg:${user.id}`, 60, 600))) throw new UserError("Trop de messages en peu de temps.");
    const isInternal = !isClient && internal;
    await db.message.create({ data: { campaignId, senderId: user.id, body: content, internal: isInternal } });
    await db.campaignRead.upsert({ where: { userId_campaignId: { userId: user.id, campaignId } }, create: { userId: user.id, campaignId }, update: { lastReadAt: new Date() } });
    if (isInternal) return;
    const excerpt = truncate(content, 160);
    if (isClient) {
      const targets = [campaign.managerId, campaign.designerId].filter((v): v is string => Boolean(v));
      if (targets.length) for (const id of targets) await notify({ userId: id, type: "message.client", title: `Message client : ${campaign.name}`, body: excerpt, link: `/gestion/campagnes/${campaign.id}?onglet=messages` });
      else await notifyStaff("campaign.assign", { type: "message.client", title: `Message client (campagne non attribuée) : ${campaign.name}`, body: excerpt, link: `/gestion/campagnes/${campaign.id}?onglet=messages` });
    } else {
      await notify({ userId: campaign.userId, type: "message.staff", title: `Nouveau message : ${campaign.name}`, body: excerpt, link: `/app/campagnes/${campaign.id}?onglet=messages`, email: true, whatsapp: true });
    }
  });
}

export async function markCampaignReadAction(campaignId: string) {
  const { user } = await viewableCampaign(campaignId);
  await db.campaignRead.upsert({ where: { userId_campaignId: { userId: user.id, campaignId } }, create: { userId: user.id, campaignId }, update: { lastReadAt: new Date() } });
}

/** Validation ou refus d'une création par le client. */
export async function decideCreativeAction(linkId: string, decision: "APPROVED" | "CHANGES_REQUESTED", feedback?: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const link = await db.campaignAsset.findFirst({ where: { id: linkId, role: "CREATIVE", campaign: { userId: user.id } }, include: { campaign: { select: { id: true, name: true, managerId: true, designerId: true } } } });
    if (!link) throw new UserError("Création introuvable.");
    if (link.approval !== "PENDING") throw new UserError("Cette création a déjà reçu une réponse.");
    const note = feedback?.trim() ?? "";
    if (decision === "CHANGES_REQUESTED" && note.length < 5) throw new UserError("Précisez les modifications souhaitées.");
    const res = await db.campaignAsset.updateMany({ where: { id: linkId, approval: "PENDING" }, data: { approval: decision, feedback: note ? note.slice(0, 1000) : null, decidedAt: new Date() } });
    if (!res.count) throw new UserError("Cette création a déjà reçu une réponse.");
    const pending = await db.campaignAsset.count({ where: { campaignId: link.campaignId, role: "CREATIVE", approval: "PENDING" } });
    const title = decision === "APPROVED" ? `Création validée : ${link.campaign.name}` : `Modification demandée : ${link.campaign.name}`;
    const body = decision === "APPROVED" ? (pending ? `Il reste ${pending} création(s) en attente de validation.` : "Toutes les créations soumises ont reçu une réponse. Vous pouvez faire avancer la campagne.") : truncate(note, 200);
    const targets = [link.campaign.managerId, link.campaign.designerId].filter((v): v is string => Boolean(v));
    for (const id of targets) await notify({ userId: id, type: "creative.decision", title, body, link: `/gestion/campagnes/${link.campaignId}?onglet=creations` });
    if (!targets.length) await notifyStaff("campaign.assign", { type: "creative.decision", title, body, link: `/gestion/campagnes/${link.campaignId}?onglet=creations` });
    await audit({ actorId: user.id, action: `creative.${decision.toLowerCase()}`, entity: "CampaignAsset", entityId: linkId });
  });
}

export async function requestRevisionAction(campaignId: string, description: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId: user.id }, select: { id: true, name: true, status: true, managerId: true } });
    if (!campaign) throw new UserError("Campagne introuvable.");
    if (["DRAFT", "PENDING_PAYMENT", "COMPLETED", "CANCELLED"].includes(campaign.status)) throw new UserError("Une demande de modification n'est possible que pour une campagne payée et non clôturée.");
    const content = description.trim();
    if (content.length < 10 || content.length > 1500) throw new UserError("Décrivez la modification souhaitée (10 à 1 500 caractères).");
    if ((await db.revisionRequest.count({ where: { campaignId, status: { in: ["OPEN", "IN_PROGRESS"] } } })) >= 5) throw new UserError("Plusieurs demandes sont déjà en cours de traitement pour cette campagne.");
    await db.revisionRequest.create({ data: { campaignId, requesterId: user.id, description: content } });
    const payload = { type: "revision.requested", title: `Demande de modification : ${campaign.name}`, body: truncate(content, 200), link: `/gestion/campagnes/${campaign.id}?onglet=modifications` };
    if (campaign.managerId) await notify({ userId: campaign.managerId, ...payload }); else await notifyStaff("revision.manage", payload);
  });
}
