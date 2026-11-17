import { accountsOf, missingAccountMessage, missingAccounts } from "@/lib/catalog/accounts";
import { DomainError } from "@/lib/errors";
import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getObjective, unsupportedPlatforms } from "@/lib/catalog/objectives";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { loadSettings } from "@/lib/settings";
import { notify } from "@/lib/notifications/service";
import { resolvePromo } from "@/lib/payments/service";
import { computeCampaignQuote, computeServiceQuote, QuoteError, type PromoInput, type Quote, type ServicePrice } from "@/lib/pricing/quote";
import { makeReference, todayUtc } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import { canTransition, STATUS_META, type CampaignStatusName } from "./status";

export async function loadServicePrices(): Promise<ServicePrice[]> {
  return db.service.findMany({ select: { code: true, name: true, kind: true, fee: true, active: true } });
}

type QuotableCampaign = {
  name: string; platforms: PlatformCode[]; objective: string | null; serviceCode: string | null; adBudget: number;
  durationDays: number | null; startDate: Date | null; mode: "SELF_SERVICE" | "EXPERT"; productDescription: string | null; brief: string | null;
};

/** Éléments manquants avant de pouvoir passer commande (liste vide = campagne complète). */
export function campaignMissing(c: QuotableCampaign): string[] {
  const missing: string[] = [];
  if (!c.platforms.length) missing.push("Choisissez au moins une plateforme.");
  const objective = getObjective(c.objective);
  if (!objective) missing.push("Choisissez un objectif publicitaire.");
  else {
    const bad = unsupportedPlatforms(objective, c.platforms);
    if (bad.length === c.platforms.length) missing.push(`L'objectif « ${objective.label} » n'est pas disponible sur ${bad.map((p) => PLATFORMS[p].label).join(", ")}.`);
  }
  if (c.mode === "EXPERT" ? !c.brief?.trim() : !c.productDescription?.trim()) missing.push(c.mode === "EXPERT" ? "Décrivez votre besoin." : "Décrivez votre produit ou service.");
  if (!c.adBudget) missing.push("Définissez votre budget publicitaire.");
  if (!c.durationDays) missing.push("Définissez la durée de la campagne.");
  if (!c.startDate) missing.push("Choisissez une date de début.");
  else if (c.startDate < todayUtc()) missing.push("La date de début est passée : choisissez une nouvelle date.");
  return missing;
}

export async function quoteCampaign(c: QuotableCampaign, promo?: PromoInput | null): Promise<Quote> {
  const [services, settings] = await Promise.all([loadServicePrices(), loadSettings()]);
  return computeCampaignQuote(
    { objectiveCode: c.objective ?? "", levelCode: c.serviceCode, platforms: c.platforms, adBudget: c.adBudget, durationDays: c.durationDays ?? 0, promo },
    services, settings,
  );
}

export type OrderResult = { ok: true; orderId: string; notes: string[] } | { ok: false; error: string };

/** Crée (ou met à jour tant qu'aucun paiement n'est en cours) la commande d'une campagne. Les prix sont recalculés côté serveur. */
export async function upsertCampaignOrder(userId: string, campaignId: string, promoCode: string | null): Promise<OrderResult> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId } });
  if (!campaign) return { ok: false, error: "Campagne introuvable." };
  if (campaign.status !== "DRAFT" && campaign.status !== "PENDING_PAYMENT") return { ok: false, error: "Cette campagne a déjà été commandée." };
  const missing = campaignMissing(campaign);
  if (missing.length) return { ok: false, error: missing[0]! };
  // L'équipe lance la publicité sur les comptes du client : il en faut un par réseau choisi.
  const business = campaign.businessId ? await db.business.findUnique({ where: { id: campaign.businessId }, select: { facebookUrl: true, instagramUrl: true, tiktokUrl: true } }) : null;
  const noAccount = missingAccounts(campaign.platforms as PlatformCode[], accountsOf(business));
  if (noAccount.length) return { ok: false, error: missingAccountMessage(noAccount[0]!) };

  let promo: PromoInput | null = null;
  if (promoCode?.trim()) {
    const resolved = await resolvePromo(promoCode, userId);
    if ("error" in resolved) return { ok: false, error: resolved.error };
    promo = resolved.promo;
  }
  let quote: Quote;
  try {
    quote = await quoteCampaign(campaign, promo);
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    throw error;
  }

  const data = {
    serviceCode: quote.serviceCode, serviceLabel: quote.serviceLabel, adBudget: quote.adBudget, serviceFee: quote.serviceFee, discount: quote.discount,
    paymentFee: quote.paymentFee, total: quote.total, promoCodeId: quote.promoCodeId, quote: quote as never,
  };
  const orderId = await db.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({ where: { campaignId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    let id: string;
    if (existing) {
      const busy = await tx.payment.count({ where: { orderId: existing.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: new Date() } } });
      if (!busy) await tx.order.update({ where: { id: existing.id }, data });
      id = existing.id;
    } else {
      id = (await tx.order.create({ data: { ...data, reference: makeReference("CMD"), userId, campaignId } })).id;
    }
    if (campaign.status === "DRAFT") {
      await tx.campaign.update({ where: { id: campaignId }, data: { status: "PENDING_PAYMENT" } });
      await tx.campaignStatusEvent.create({ data: { campaignId, fromStatus: "DRAFT", toStatus: "PENDING_PAYMENT", actorId: userId, note: "Commande créée." } });
    }
    return id;
  });
  return { ok: true, orderId, notes: quote.notes };
}

export async function createSubscriptionOrder(userId: string, serviceCode: string, businessId: string | null, promoCode: string | null): Promise<OrderResult> {
  const service = await db.service.findUnique({ where: { code: serviceCode } });
  if (!service || !service.active || service.kind !== "SUBSCRIPTION") return { ok: false, error: "Cette formule n'est pas disponible." };
  if (businessId && !(await db.business.count({ where: { id: businessId, ownerId: userId } }))) return { ok: false, error: "Entreprise introuvable." };
  let promo: PromoInput | null = null;
  if (promoCode?.trim()) {
    const resolved = await resolvePromo(promoCode, userId);
    if ("error" in resolved) return { ok: false, error: resolved.error };
    promo = resolved.promo;
  }
  const quote = computeServiceQuote(service, await loadSettings(), promo);
  const data = {
    serviceCode: quote.serviceCode, serviceLabel: quote.serviceLabel, adBudget: 0, serviceFee: quote.serviceFee, discount: quote.discount,
    paymentFee: quote.paymentFee, total: quote.total, promoCodeId: quote.promoCodeId, quote: quote as never,
  };
  const orderId = await db.$transaction(async (tx) => {
    // Renouvellement : on rattache la commande à l'abonnement existant pour prolonger sa période.
    let sub = await tx.subscription.findFirst({ where: { userId, serviceCode, businessId, status: { in: ["ACTIVE", "PENDING", "EXPIRED"] } }, orderBy: { createdAt: "desc" } });
    if (!sub) sub = await tx.subscription.create({ data: { userId, serviceCode, businessId } });
    const existing = await tx.order.findFirst({ where: { subscriptionId: sub.id, status: "PENDING" } });
    if (existing) {
      const busy = await tx.payment.count({ where: { orderId: existing.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: new Date() } } });
      if (!busy) await tx.order.update({ where: { id: existing.id }, data });
      return existing.id;
    }
    return (await tx.order.create({ data: { ...data, reference: makeReference("CMD"), userId, subscriptionId: sub.id } })).id;
  });
  return { ok: true, orderId, notes: quote.notes };
}

/** Changement de statut manuel par l'équipe, avec contrôle des transitions, historique et notification du client. */
export async function changeCampaignStatus(args: { campaignId: string; to: CampaignStatusName; actor: SessionUser; note?: string }) {
  const campaign = await db.campaign.findUnique({ where: { id: args.campaignId } });
  if (!campaign) throw new DomainError("Campagne introuvable.");
  const from = campaign.status as CampaignStatusName;
  if (!canTransition(from, args.to, args.actor.role)) throw new DomainError(`Transition non autorisée : ${STATUS_META[from].label} → ${STATUS_META[args.to].label}.`);
  if (args.to === "AWAITING_INFO" && !args.note?.trim()) throw new DomainError("Précisez l'information attendue du client.");
  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const res = await tx.campaign.updateMany({
      where: { id: campaign.id, status: from },
      data: {
        status: args.to,
        ...(args.to === "RUNNING" && !campaign.launchedAt ? { launchedAt: now } : {}),
        ...(args.to === "COMPLETED" ? { completedAt: now } : {}),
      },
    });
    if (res.count === 0) throw new DomainError("Le statut a été modifié entre-temps. Rechargez la page.");
    await tx.campaignStatusEvent.create({ data: { campaignId: campaign.id, fromStatus: from, toStatus: args.to, actorId: args.actor.id, note: args.note?.trim() || null } });
    if (args.to === "CANCELLED") await tx.order.updateMany({ where: { campaignId: campaign.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    return res.count;
  });
  await audit({ actorId: args.actor.id, action: "campaign.status_changed", entity: "Campaign", entityId: campaign.id, meta: { from, to: args.to } });
  const important = ["AWAITING_INFO", "CLIENT_REVIEW", "RUNNING", "COMPLETED", "CANCELLED", "PAUSED"].includes(args.to);
  await notify({
    userId: campaign.userId, type: `campaign.${args.to.toLowerCase()}`, title: `${campaign.name} : ${STATUS_META[args.to].label.toLowerCase()}`,
    body: `${STATUS_META[args.to].clientHint}${args.note?.trim() ? `\n${args.note.trim()}` : ""}`,
    link: `/app/campagnes/${campaign.id}`, email: important, whatsapp: important,
  });
  return updated;
}
