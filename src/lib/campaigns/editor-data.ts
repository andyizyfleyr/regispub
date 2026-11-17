import { accountsOf, type Accounts } from "@/lib/catalog/accounts";
import "server-only";
import { normalizeSplit, type PlatformCode } from "@/lib/catalog/platforms";
import { DEFAULT_TARGETING, type Targeting } from "@/lib/catalog/targeting";
import { db } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { isRecord, toIsoDate } from "@/lib/utils";

export type AdCopy = { headline: string; body: string; cta: string };
export type LinkedAsset = { linkId: string; assetId: string; role: string; name: string; kind: string; format: string | null; approval: string };
export type LibraryAsset = { id: string; name: string; kind: string; source: string; format: string | null };

export type EditorData = {
  campaign: {
    id: string; reference: string; mode: "SELF_SERVICE" | "EXPERT"; status: string; name: string; platforms: PlatformCode[]; objective: string | null; serviceCode: string | null;
    businessId: string | null; productName: string; productDescription: string; productPrice: number | null; audienceNote: string; destinationWhatsapp: string; destinationUrl: string; brief: string;
    targeting: Targeting; adCopy: AdCopy | null; adBudget: number; budgetSplit: Record<string, number>; durationDays: number | null; startDate: string | null; wizardStep: number;
  };
  businesses: { id: string; name: string; sector: string; city: string; accounts?: Accounts }[];
  levels: { code: string; name: string; description: string; fee: number; kind: string; features: string[] }[];
  baseFees: Record<string, number>;
  limits: { minAdBudget: number; minDailyBudget: number; maxAdBudget: number; extraPlatformFee: number; minServiceFee: number };
  links: LinkedAsset[];
  library: LibraryAsset[];
  promoCode: string | null;
};

export function readTargeting(raw: unknown): Targeting {
  if (!isRecord(raw)) return DEFAULT_TARGETING;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const ca = isRecord(raw.customAudience) ? raw.customAudience : {};
  return {
    countries: arr(raw.countries).length ? arr(raw.countries) : ["BJ"], cities: arr(raw.cities), zoneNote: typeof raw.zoneNote === "string" ? raw.zoneNote : "",
    ageMin: Number(raw.ageMin) || 18, ageMax: Number(raw.ageMax) || 45, gender: raw.gender === "FEMALE" || raw.gender === "MALE" ? raw.gender : "ALL",
    interests: arr(raw.interests), categories: arr(raw.categories), languages: arr(raw.languages).length ? arr(raw.languages) : ["fr"],
    customAudience: { requested: ca.requested === true, note: typeof ca.note === "string" ? ca.note : "" },
  };
}

export function readAdCopy(raw: unknown): AdCopy | null {
  if (!isRecord(raw)) return null;
  return { headline: String(raw.headline ?? ""), body: String(raw.body ?? ""), cta: String(raw.cta ?? "") };
}

/** Données nécessaires à l'assistant de création et au brief expert, pour une campagne appartenant à l'utilisateur. */
export async function loadEditorData(campaignId: string, userId: string): Promise<EditorData | null> {
  const c = await db.campaign.findFirst({
    where: { id: campaignId, userId },
    include: { assets: { include: { asset: true }, orderBy: { createdAt: "asc" } }, orders: { where: { status: "PENDING" }, take: 1, orderBy: { createdAt: "desc" }, include: { promoCode: { select: { code: true } } } } },
  });
  if (!c) return null;
  const [businesses, services, settings, library] = await Promise.all([
    db.business.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" } }),
    db.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    loadSettings(),
    db.asset.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const platforms = c.platforms as PlatformCode[];
  return {
    campaign: {
      id: c.id, reference: c.reference, mode: c.mode, status: c.status, name: c.name, platforms, objective: c.objective, serviceCode: c.serviceCode, businessId: c.businessId,
      productName: c.productName ?? "", productDescription: c.productDescription ?? "", productPrice: c.productPrice, audienceNote: c.audienceNote ?? "",
      destinationWhatsapp: c.destinationWhatsapp ?? "", destinationUrl: c.destinationUrl ?? "", brief: c.brief ?? "", targeting: readTargeting(c.targeting),
      adCopy: readAdCopy(c.adCopy),
      adBudget: c.adBudget, budgetSplit: normalizeSplit(platforms, c.budgetSplit), durationDays: c.durationDays, startDate: c.startDate ? toIsoDate(c.startDate) : null, wizardStep: c.wizardStep,
    },
    businesses: businesses.map((b) => ({ id: b.id, name: b.name, sector: b.sector, city: b.city ?? "", accounts: accountsOf(b) })),
    levels: services.filter((s) => s.kind === "PACK" || s.kind === "MANAGEMENT").map((s) => ({ code: s.code, name: s.name, description: s.description, fee: s.fee, kind: s.kind, features: s.features })),
    baseFees: Object.fromEntries(services.filter((s) => s.kind === "CAMPAIGN").map((s) => [s.code, Math.max(s.fee, settings.minServiceFee)])),
    limits: { minAdBudget: settings.minAdBudget, minDailyBudget: settings.minDailyBudget, maxAdBudget: settings.maxAdBudget, extraPlatformFee: settings.extraPlatformFee, minServiceFee: settings.minServiceFee },
    links: c.assets.map((l) => ({ linkId: l.id, assetId: l.assetId, role: l.role, name: l.asset.name, kind: l.asset.kind, format: l.asset.format, approval: l.approval })),
    library: library.map((a) => ({ id: a.id, name: a.name, kind: a.kind, source: a.source, format: a.format })),
    promoCode: c.orders[0]?.promoCode?.code ?? null,
  };
}
