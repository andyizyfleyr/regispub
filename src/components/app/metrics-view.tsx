import { BarChart3, ChevronDown, ClipboardList, Coins, Eye, Heart, MousePointerClick, Percent, Play, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { PlatformBadge } from "@/components/icons";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Figures } from "@/components/ui/list";
import { StatTile, toneAt } from "@/components/ui/tile";
import { EmptyState, Table } from "@/components/ui/misc";
import type { CampaignReport } from "@/lib/ads/report";
import { METRIC_LABELS, type MetricKey } from "@/lib/catalog/objectives";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { formatFcfa, formatNumber, formatPercent, formatPureDate } from "@/lib/utils";
import { MetricsChart, type ChartSeries } from "./metrics-chart";

const HINTS: Partial<Record<MetricKey, string>> = {
  impressions: "Nombre de fois où la publicité a été montrée", ctr: "Part des affichages suivis d'un clic", conversions: "Selon l'objectif de la campagne", clicks: "Nombre de clics sur la publicité", cpc: "Dépenses ÷ clics",
  roi: "(Revenus − dépenses) ÷ dépenses",
};

const METRIC_ICONS: Record<MetricKey, typeof Eye> = {
  impressions: Eye, reach: Users, clicks: MousePointerClick, ctr: Percent, cpc: Coins, cpm: Coins,
  engagements: Heart, videoViews: Play, leads: ClipboardList, conversions: Target, spend: Wallet, roi: TrendingUp,
};

/** Valeur affichée : « — » lorsqu'elle n'est pas mesurée. Jamais d'estimation. */
export function metricValue(key: MetricKey, r: Pick<CampaignReport, "totals" | "derived">): string {
  const { totals: t, derived: d } = r;
  if (!t.days) return "—";
  switch (key) {
    case "ctr": return d.ctr === null ? "—" : formatPercent(d.ctr);
    case "cpc": return d.cpc === null ? "—" : formatFcfa(Math.round(d.cpc));
    case "cpm": return d.cpm === null ? "—" : formatFcfa(Math.round(d.cpm));
    case "roi": return d.roi === null ? "—" : formatPercent(d.roi, 0);
    case "spend": return formatFcfa(t.spend);
    default: return formatNumber(t[key]);
  }
}

const ALL: MetricKey[] = ["impressions", "reach", "clicks", "ctr", "cpc", "cpm", "engagements", "videoViews", "leads", "conversions", "spend", "roi"];
const CHARTABLE: MetricKey[] = ["impressions", "reach", "clicks", "engagements", "videoViews", "leads", "conversions", "spend"];

export function MetricsView({ report, kpis, adBudget, staff }: { report: CampaignReport; kpis: MetricKey[]; adBudget: number; staff?: boolean }) {
  if (!report.totals.days) {
    return (
      <Card>
        <EmptyState art="chart" title="Pas encore de résultats" description={staff
          ? "Importez un export CSV du gestionnaire de publicités ou synchronisez la campagne. Les chiffres ne sont visibles du client qu'après validation."
          : "Ils s'affichent dès les premiers chiffres validés."} />
      </Card>
    );
  }
  // Les indicateurs clés de l'objectif d'abord, puis le reste.
  const ordered = [...kpis.filter((k) => ALL.includes(k)), ...ALL.filter((k) => !kpis.includes(k))];
  const primary = ordered.slice(0, 4);
  const secondary = ordered.slice(4);
  const series: ChartSeries[] = [...kpis.filter((k) => CHARTABLE.includes(k)), ...CHARTABLE.filter((k) => !kpis.includes(k))].filter((k) => report.daily.some((d) => Number(d[k as keyof typeof d]) > 0)).map((k) => ({ key: k, label: METRIC_LABELS[k], money: k === "spend" }));
  const spentShare = adBudget > 0 ? Math.min(1, report.totals.spend / adBudget) : null;

  const perPlatform = report.platforms.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primary.map((k, i) => { const Icon = METRIC_ICONS[k]; return <StatTile key={k} label={METRIC_LABELS[k]} value={metricValue(k, report)} info={HINTS[k]} icon={<Icon />} tone={toneAt(i)} />; })}
      </div>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-ink-soft">Budget dépensé</p>
          <p className="tnum text-sm text-muted"><span className="font-display text-lg font-semibold text-ink">{formatFcfa(report.totals.spend)}</span> sur {formatFcfa(adBudget)}</p>
        </div>
        {spentShare !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={Math.round(spentShare * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Part du budget dépensée">
            <div className="h-full rounded-full bg-gradient-to-r from-green to-mint" style={{ width: `${spentShare * 100}%` }} />
          </div>
        )}
      </div>

      {series.length > 0 && report.daily.length > 1 && (
        <Card>
          <CardHeader title="Par jour" description={`Du ${formatPureDate(report.firstDate!)} au ${formatPureDate(report.lastDate!)}`} />
          <CardBody><MetricsChart data={report.daily.map((d) => ({ ...d }))} series={series} /></CardBody>
        </Card>
      )}

      <details className="group rounded-lg border border-line bg-surface" open={staff || undefined}>
        <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-ink sm:px-5">Tous les indicateurs<ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
        <Figures bare className="border-t border-line" items={secondary.filter((k) => k !== "spend").map((k) => ({ label: METRIC_LABELS[k], hint: HINTS[k], value: metricValue(k, report) }))} />
        {report.derived.roi === null && <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">Retour sur investissement : communiquez votre chiffre d&apos;affaires à votre gestionnaire.</p>}
      </details>

      {perPlatform && !staff && (
        <details className="group rounded-lg border border-line bg-surface">
          <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-ink sm:px-5">Par plateforme<ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
          <ul className="divide-y divide-line border-t border-line">
            {report.platforms.map((p) => (
              <li key={p.platform} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <PlatformBadge platform={p.platform as PlatformCode} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{PLATFORMS[p.platform as PlatformCode]?.label ?? p.platform}</span>
                  <span className="tnum block text-[13px] text-muted">{formatNumber(p.impressions)} affichages · {formatNumber(p.clicks)} clics</span>
                </span>
                <span className="tnum shrink-0 text-sm font-medium">{formatFcfa(p.spend)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {perPlatform && staff && (
        <Card>
          <CardHeader title="Par plateforme" />
          <Table head={["Plateforme", "Impressions", "Portée", "Clics", "CTR", "CPC", "Dépenses"]}>
            {report.platforms.map((p) => (
              <tr key={p.platform} className="border-b border-line last:border-0">
                <td className="px-4 py-3"><span className="flex items-center gap-2 font-medium"><PlatformBadge platform={p.platform as PlatformCode} size="sm" />{PLATFORMS[p.platform as PlatformCode]?.label ?? p.platform}</span></td>
                <td className="tnum px-4 py-3">{formatNumber(p.impressions)}</td>
                <td className="tnum px-4 py-3">{formatNumber(p.reach)}</td>
                <td className="tnum px-4 py-3">{formatNumber(p.clicks)}</td>
                <td className="tnum px-4 py-3">{p.ctr === null ? "—" : formatPercent(p.ctr)}</td>
                <td className="tnum px-4 py-3">{p.cpc === null ? "—" : formatFcfa(Math.round(p.cpc))}</td>
                <td className="tnum px-4 py-3 font-medium">{formatFcfa(p.spend)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
