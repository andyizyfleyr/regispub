import { BarChart3 } from "lucide-react";
import { PlatformBadge } from "@/components/icons";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Stat, Table } from "@/components/ui/misc";
import type { CampaignReport } from "@/lib/ads/report";
import { METRIC_LABELS, type MetricKey } from "@/lib/catalog/objectives";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { formatFcfa, formatNumber, formatPercent, formatPureDate } from "@/lib/utils";
import { MetricsChart, type ChartSeries } from "./metrics-chart";

const HINTS: Partial<Record<MetricKey, string>> = {
  impressions: "Nombre d'affichages", reach: "Personnes touchées", ctr: "Clics ÷ impressions", cpc: "Dépenses ÷ clics", cpm: "Coût pour 1 000 affichages",
  roi: "(Revenus − dépenses) ÷ dépenses",
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
        <EmptyState icon={<BarChart3 />} title="Pas encore de statistiques" description={staff
          ? "Importez un export CSV du gestionnaire de publicités ou synchronisez la campagne. Les chiffres ne sont visibles du client qu'après validation."
          : "Les résultats apparaissent ici dès que votre gestionnaire a validé les premiers chiffres de diffusion. Aucun chiffre n'est estimé."} />
      </Card>
    );
  }
  // Les indicateurs clés de l'objectif d'abord, puis le reste.
  const ordered = [...kpis.filter((k) => ALL.includes(k)), ...ALL.filter((k) => !kpis.includes(k))];
  const primary = ordered.slice(0, 4);
  const secondary = ordered.slice(4);
  const series: ChartSeries[] = [...kpis.filter((k) => CHARTABLE.includes(k)), ...CHARTABLE.filter((k) => !kpis.includes(k))].filter((k) => report.daily.some((d) => Number(d[k as keyof typeof d]) > 0)).map((k) => ({ key: k, label: METRIC_LABELS[k], money: k === "spend" }));
  const spentShare = adBudget > 0 ? Math.min(1, report.totals.spend / adBudget) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primary.map((k) => <Stat key={k} label={METRIC_LABELS[k]} value={metricValue(k, report)} hint={HINTS[k]} />)}
      </div>

      {series.length > 0 && report.daily.length > 1 && (
        <Card>
          <CardHeader title="Évolution quotidienne" description={`Du ${formatPureDate(report.firstDate!)} au ${formatPureDate(report.lastDate!)} · ${report.totals.days} jour${report.totals.days > 1 ? "s" : ""} de données`} />
          <CardBody><MetricsChart data={report.daily.map((d) => ({ ...d }))} series={series} /></CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Tous les indicateurs" />
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {secondary.map((k) => (
              <div key={k} className="bg-surface px-5 py-4">
                <dt className="text-[12.5px] text-muted">{METRIC_LABELS[k]}</dt>
                <dd className="tnum mt-1 text-lg font-medium">{metricValue(k, report)}</dd>
              </div>
            ))}
          </dl>
          {report.derived.roi === null && <p className="border-t border-line px-5 py-3 text-xs text-muted">Le retour sur investissement n&apos;est calculé que si le chiffre d&apos;affaires généré a été communiqué à votre gestionnaire.</p>}
        </Card>
        <Card>
          <CardHeader title="Budget publicitaire" />
          <CardBody>
            <p className="tnum font-display text-2xl font-semibold">{formatFcfa(report.totals.spend)}</p>
            <p className="text-[13px] text-muted">dépensés sur <span className="tnum">{formatFcfa(adBudget)}</span></p>
            {spentShare !== null && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={Math.round(spentShare * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Part du budget dépensée">
                <div className="h-full rounded-full bg-green" style={{ width: `${spentShare * 100}%` }} />
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Dépenses constatées sur les plateformes, hors frais de prestation.</p>
          </CardBody>
        </Card>
      </div>

      {report.platforms.length > 0 && (
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
