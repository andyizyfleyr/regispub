import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/campaign-client-parts";
import { Figures } from "@/components/ui/list";
import { CampaignSummary } from "@/components/app/campaign-summary";
import { metricValue } from "@/components/app/metrics-view";
import { Logo } from "@/components/icons";
import { PageHeader, Table } from "@/components/ui/misc";
import { loadCampaignReport } from "@/lib/ads/report";
import { requireUser } from "@/lib/auth/session";
import { STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective, METRIC_LABELS, type MetricKey } from "@/lib/catalog/objectives";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatFcfa, formatNumber, formatPercent, formatPureDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Rapport de campagne" };

const KEYS: MetricKey[] = ["impressions", "reach", "clicks", "ctr", "cpc", "cpm", "engagements", "videoViews", "leads", "conversions", "spend", "roi"];

/** Rapport imprimable (PDF via l'impression du navigateur), limité aux chiffres validés. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await db.campaign.findFirst({ where: { id, userId: user.id, status: { notIn: ["DRAFT"] } }, include: { business: { select: { name: true, sector: true } } } });
  if (!c) notFound();
  const [report, settings] = await Promise.all([loadCampaignReport(c.id, { validatedOnly: true }), getSettings()]);
  const objective = getObjective(c.objective);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print"><PageHeader title="Rapport de campagne" back={{ href: `/app/campagnes/${c.id}`, label: c.name }} actions={<PrintButton />} /></div>
      <article className="rounded-lg border border-line bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <Logo />
            <p className="mt-2 text-xs text-muted">{settings.companyName}{settings.supportEmail ? ` · ${settings.supportEmail}` : ""}</p>
          </div>
          <div className="text-right text-[13px] text-muted">
            <p className="font-mono text-ink">{c.reference}</p>
            <p>Édité le {formatDateTime(new Date())}</p>
          </div>
        </header>
        <h1 className="mt-6 text-2xl font-semibold">{c.name}</h1>
        <p className="mt-1 text-sm text-muted">{objective?.label ?? "Campagne"} · {STATUS_META[c.status as CampaignStatusName].label}{report.firstDate ? ` · données du ${formatPureDate(report.firstDate)} au ${formatPureDate(report.lastDate!)}` : ""}</p>

        <h2 className="mt-8 text-base font-semibold">Résultats</h2>
        {report.totals.days ? (
          <>
            <Figures className="mt-3" items={KEYS.map((k) => ({ label: METRIC_LABELS[k], value: metricValue(k, report) }))} />
            <h2 className="mt-8 text-base font-semibold">Détail quotidien</h2>
            <div className="mt-3 overflow-hidden rounded-md border border-line">
              <Table head={["Date", "Affichages", "Personnes touchées", "Clics", "Taux de clic", "Dépenses"]}>
                {report.daily.map((d) => (
                  <tr key={d.date} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{formatPureDate(d.date)}</td>
                    <td className="tnum px-4 py-2">{formatNumber(d.impressions)}</td>
                    <td className="tnum px-4 py-2">{formatNumber(d.reach)}</td>
                    <td className="tnum px-4 py-2">{formatNumber(d.clicks)}</td>
                    <td className="tnum px-4 py-2">{d.ctr === null ? "—" : formatPercent(d.ctr)}</td>
                    <td className="tnum px-4 py-2">{formatFcfa(d.spend)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        ) : <p className="mt-3 text-sm text-muted">Aucune statistique validée n&apos;est encore disponible pour cette campagne.</p>}

        <h2 className="mt-8 text-base font-semibold">Configuration</h2>
        <div className="mt-3"><CampaignSummary c={c} compact /></div>
        <p className="mt-8 border-t border-line pt-4 text-xs text-muted">Chiffres issus des plateformes publicitaires (Meta, TikTok), validés par un gestionnaire. Les indicateurs non mesurés sont indiqués par « — » : aucune valeur n&apos;est estimée.</p>
      </article>
    </div>
  );
}
