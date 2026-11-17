import "server-only";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/utils";
import { byDay, byPlatform, derive, totalize, type MetricRow } from "./metrics";

export type CampaignReport = Awaited<ReturnType<typeof loadCampaignReport>>;

/**
 * Charge les statistiques d'une campagne. Côté client (`validatedOnly`), seules les lignes
 * validées par un gestionnaire sont lues : rien n'est estimé ni complété.
 */
export async function loadCampaignReport(campaignId: string, opts: { validatedOnly: boolean }) {
  const snapshots = await db.metricSnapshot.findMany({
    where: { campaignId, ...(opts.validatedOnly ? { validated: true } : {}) },
    orderBy: { date: "asc" },
  });
  const rows: MetricRow[] = snapshots.map((s) => ({
    date: toIsoDate(s.date), platform: s.platform, impressions: s.impressions, reach: s.reach, clicks: s.clicks, engagements: s.engagements,
    videoViews: s.videoViews, conversions: s.conversions, leads: s.leads, spend: s.spend, revenue: s.revenue,
  }));
  const totals = totalize(rows);
  const sources = Array.from(new Set(snapshots.map((s) => s.source)));
  return {
    rows, totals, derived: derive(totals), daily: byDay(rows), platforms: byPlatform(rows), sources,
    firstDate: rows[0]?.date ?? null, lastDate: rows.at(-1)?.date ?? null,
    pending: opts.validatedOnly ? 0 : snapshots.filter((s) => !s.validated).length,
    updatedAt: snapshots.reduce<Date | null>((m, s) => (!m || s.updatedAt > m ? s.updatedAt : m), null),
  };
}
