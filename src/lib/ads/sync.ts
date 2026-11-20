import "server-only";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { isRecord, parseIsoDate, toIsoDate, addDays, todayUtc } from "@/lib/utils";
import { ADS_ADAPTERS, AdsApiError } from "./adapters";

const log = createLogger("ads-sync");

export type ExternalRefs = { FACEBOOK?: string; INSTAGRAM?: string; TIKTOK?: string };

export function readExternalRefs(raw: unknown): ExternalRefs {
  if (!isRecord(raw)) return {};
  const out: ExternalRefs = {};
  for (const k of ["FACEBOOK", "INSTAGRAM", "TIKTOK"] as const) if (typeof raw[k] === "string" && raw[k]) out[k] = raw[k] as string;
  return out;
}

/**
 * Récupère les statistiques quotidiennes d'une campagne auprès des API officielles.
 * Les lignes issues d'une API sont publiées directement (source officielle) ; elles remplacent une saisie manuelle du même jour.
 */
export async function syncCampaignMetrics(campaignId: string): Promise<{ synced: number; messages: string[] }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { externalRefs: true, startDate: true, launchedAt: true, endDate: true } });
  if (!campaign) return { synced: 0, messages: ["Campagne introuvable."] };
  const refs = readExternalRefs(campaign.externalRefs);
  const since = toIsoDate(campaign.launchedAt ?? campaign.startDate ?? addDays(todayUtc(), -30));
  const until = toIsoDate(todayUtc());
  const messages: string[] = [];
  let synced = 0;
  for (const platform of ["FACEBOOK", "INSTAGRAM", "TIKTOK"] as const) {
    const externalId = refs[platform];
    if (!externalId) continue;
    // Une campagne Meta diffusée sur Facebook et Instagram partage le même identifiant : on ne la lit qu'une fois.
    if (platform === "INSTAGRAM" && refs.FACEBOOK === externalId) continue;
    const adapter = ADS_ADAPTERS[platform === "TIKTOK" ? "TIKTOK" : "META"];
    if (!(await adapter.isConfigured())) { messages.push(`${adapter.label} : identifiants non configurés.`); continue; }
    try {
      const rows = await adapter.fetchDaily(externalId, since, until);
      for (const r of rows) {
        const date = parseIsoDate(r.date);
        if (!date) continue;
        const data = { impressions: r.impressions, reach: r.reach, clicks: r.clicks, engagements: r.engagements, videoViews: r.videoViews, conversions: r.conversions, leads: r.leads, spend: r.spend, source: "API" as const, validated: true, validatedAt: new Date() };
        await db.metricSnapshot.upsert({ where: { campaignId_platform_date: { campaignId, platform, date } }, create: { campaignId, platform, date, ...data }, update: data });
        synced++;
      }
      messages.push(`${adapter.label} : ${rows.length} jour(s) synchronisé(s).`);
    } catch (error) {
      log.warn("synchronisation en échec", { error, campaignId, platform });
      messages.push(error instanceof AdsApiError ? error.message : `${adapter.label} : erreur de synchronisation.`);
    }
  }
  if (!Object.keys(refs).length) messages.push("Aucun identifiant de campagne externe n'est renseigné.");
  return { synced, messages };
}
