// Agrégation et indicateurs dérivés. Module pur : aucun chiffre n'est estimé ni extrapolé.
import { safeDivide } from "@/lib/utils";

export type MetricRow = {
  date: string; // AAAA-MM-JJ
  platform: string;
  impressions: number; reach: number; clicks: number; engagements: number; videoViews: number;
  conversions: number; leads: number; spend: number; revenue: number | null;
};

export type MetricTotals = Omit<MetricRow, "date" | "platform" | "revenue"> & { revenue: number | null; days: number };

export type Derived = { ctr: number | null; cpc: number | null; cpm: number | null; costPerLead: number | null; costPerConversion: number | null; roi: number | null };

const SUM_KEYS = ["impressions", "reach", "clicks", "engagements", "videoViews", "conversions", "leads", "spend"] as const;

export function totalize(rows: MetricRow[]): MetricTotals {
  const t: MetricTotals = { impressions: 0, reach: 0, clicks: 0, engagements: 0, videoViews: 0, conversions: 0, leads: 0, spend: 0, revenue: null, days: 0 };
  const days = new Set<string>();
  for (const r of rows) {
    for (const k of SUM_KEYS) t[k] += r[k];
    if (r.revenue !== null) t.revenue = (t.revenue ?? 0) + r.revenue;
    days.add(r.date);
  }
  t.days = days.size;
  return t;
}

export function derive(t: Pick<MetricTotals, "impressions" | "clicks" | "spend" | "leads" | "conversions" | "revenue">): Derived {
  const cpm = safeDivide(t.spend, t.impressions);
  return {
    ctr: safeDivide(t.clicks, t.impressions),
    cpc: safeDivide(t.spend, t.clicks),
    cpm: cpm === null ? null : cpm * 1000,
    costPerLead: safeDivide(t.spend, t.leads),
    costPerConversion: safeDivide(t.spend, t.conversions),
    // ROI uniquement lorsque le chiffre d'affaires a été renseigné : (revenus − dépenses) / dépenses.
    roi: t.revenue === null ? null : safeDivide(t.revenue - t.spend, t.spend),
  };
}

/** Variation relative entre deux périodes ; null si la période précédente est vide. */
export function variation(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

export function byDay(rows: MetricRow[]) {
  const map = new Map<string, MetricRow[]>();
  for (const r of rows) map.set(r.date, [...(map.get(r.date) ?? []), r]);
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => {
    const t = totalize(list);
    return { date, ...t, ...derive(t) };
  });
}

export function byPlatform(rows: MetricRow[]) {
  const map = new Map<string, MetricRow[]>();
  for (const r of rows) map.set(r.platform, [...(map.get(r.platform) ?? []), r]);
  return Array.from(map.entries()).map(([platform, list]) => { const t = totalize(list); return { platform, ...t, ...derive(t) }; });
}

/** Sépare une période en deux moitiés consécutives pour la comparaison temporelle. */
export function splitPeriods(rows: MetricRow[], from: string, to: string) {
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const prevTo = new Date(Date.parse(from) - 86_400_000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(from) - span * 86_400_000).toISOString().slice(0, 10);
  return {
    current: rows.filter((r) => r.date >= from && r.date <= to),
    previous: rows.filter((r) => r.date >= prevFrom && r.date <= prevTo),
    previousRange: { from: prevFrom, to: prevTo },
  };
}
