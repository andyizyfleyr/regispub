import type { Metadata } from "next";
import { MetricsChart } from "@/components/app/metrics-chart";
import { FilterChips } from "@/components/staff/common";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Stat, Table } from "@/components/ui/misc";
import { derive, totalize, type MetricRow } from "@/lib/ads/metrics";
import { requirePermission } from "@/lib/auth/session";
import { STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective } from "@/lib/catalog/objectives";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { addDays, formatFcfa, formatNumber, formatPercent, todayUtc, toIsoDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Rapports" };

const PERIODS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requirePermission("report.view");
  const { periode } = await searchParams;
  const days = PERIODS[periode ?? ""] ?? 30;
  const since = addDays(todayUtc(), -(days - 1));

  const [orders, byStatus, byObjective, snapshots, newClients, refunds] = await Promise.all([
    db.order.findMany({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] }, paidAt: { gte: since } }, select: { paidAt: true, total: true, adBudget: true, serviceFee: true, discount: true, paymentFee: true } }),
    db.campaign.groupBy({ by: ["status"], where: { status: { not: "DRAFT" } }, _count: true }),
    db.campaign.groupBy({ by: ["objective"], where: { status: { notIn: ["DRAFT", "PENDING_PAYMENT", "CANCELLED"] }, createdAt: { gte: since } }, _count: true, _sum: { adBudget: true } }),
    db.metricSnapshot.findMany({ where: { validated: true, date: { gte: since } }, select: { date: true, platform: true, impressions: true, reach: true, clicks: true, engagements: true, videoViews: true, conversions: true, leads: true, spend: true, revenue: true } }),
    db.user.count({ where: { role: "CLIENT", createdAt: { gte: since } } }),
    db.refund.aggregate({ where: { status: "PROCESSED", processedAt: { gte: since } }, _sum: { amount: true } }),
  ]);

  const sum = (f: (o: (typeof orders)[number]) => number) => orders.reduce((s, o) => s + f(o), 0);
  const fees = sum((o) => o.serviceFee - o.discount);
  const daily = new Map<string, { date: string; encaisse: number; prestation: number; commandes: number }>();
  for (let i = 0; i < days; i++) { const d = toIsoDate(addDays(since, i)); daily.set(d, { date: d, encaisse: 0, prestation: 0, commandes: 0 }); }
  for (const o of orders) { const row = daily.get(toIsoDate(o.paidAt!)); if (row) { row.encaisse += o.total; row.prestation += o.serviceFee - o.discount; row.commandes += 1; } }

  const rows: MetricRow[] = snapshots.map((s) => ({ ...s, date: toIsoDate(s.date) }));
  const totals = totalize(rows);
  const d = derive(totals);
  const platforms = (["FACEBOOK", "INSTAGRAM", "TIKTOK"] as PlatformCode[]).map((p) => { const t = totalize(rows.filter((r) => r.platform === p)); return { platform: p, ...t, ...derive(t) }; }).filter((p) => p.days > 0);

  return (
    <>
      <PageHeader title="Rapports" />
      <div className="mb-5"><FilterChips current={String(days)} items={Object.keys(PERIODS).map((p) => ({ id: p, label: `${p} derniers jours`, href: p === "30" ? "/gestion/rapports" : `/gestion/rapports?periode=${p}` }))} /></div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Encaissé" value={formatFcfa(sum((o) => o.total))} hint={`${orders.length} commande${orders.length > 1 ? "s" : ""} payée${orders.length > 1 ? "s" : ""}`} />
        <Stat label="Frais de prestation" value={formatFcfa(fees)} hint="Chiffre d'affaires, remises déduites" />
        <Stat label="Budgets publicitaires" value={formatFcfa(sum((o) => o.adBudget))} hint="Reversés aux plateformes" />
        <Stat label="Panier moyen" value={orders.length ? formatFcfa(Math.round(sum((o) => o.total) / orders.length)) : "—"} hint={`${newClients} nouveau${newClients > 1 ? "x" : ""} client${newClients > 1 ? "s" : ""}`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Frais Mobile Money" value={formatFcfa(sum((o) => o.paymentFee))} hint="Refacturés aux clients" />
        <Stat label="Remises accordées" value={formatFcfa(sum((o) => o.discount))} />
        <Stat label="Remboursé" value={formatFcfa(refunds._sum.amount ?? 0)} />
        <Stat label="Dépenses publicitaires" value={totals.days ? formatFcfa(totals.spend) : "—"} hint="Constatées et validées" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Encaissements par jour" />
        <CardBody><MetricsChart data={Array.from(daily.values())} series={[{ key: "encaisse", label: "Encaissé", money: true }, { key: "prestation", label: "Frais de prestation", money: true }, { key: "commandes", label: "Commandes" }]} /></CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Campagnes par statut" />
          <ul className="divide-y divide-line">
            {(Object.keys(STATUS_META) as CampaignStatusName[]).filter((s) => s !== "DRAFT").map((s) => {
              const n = byStatus.find((b) => b.status === s)?._count ?? 0;
              const max = Math.max(1, ...byStatus.map((b) => b._count));
              return (
                <li key={s} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 text-sm">
                  <span className="w-44 shrink-0 text-ink-soft">{STATUS_META[s].label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-green" style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="tnum w-8 text-right font-medium">{n}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Objectifs commandés" description={`Campagnes payées créées sur ${days} jours.`} />
          {byObjective.length ? (
            <Table head={["Objectif", "Campagnes", "Budget publicitaire"]} className="[&_table]:min-w-0">
              {byObjective.sort((a, b) => b._count - a._count).map((o) => (
                <tr key={o.objective ?? "none"}><td>{getObjective(o.objective)?.label ?? "Confiée à un expert"}</td><td className="tnum">{o._count}</td><td className="tnum">{formatFcfa(o._sum.adBudget ?? 0)}</td></tr>
              ))}
            </Table>
          ) : <p className="px-4 sm:px-5 py-6 text-sm text-muted">Aucune campagne sur la période.</p>}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Résultats publicitaires" />
        {totals.days ? (
          <Table head={["Plateforme", "Impressions", "Portée", "Clics", "CTR", "CPC", "CPM", "Dépenses"]}>
            {[...platforms, { platform: "TOTAL" as const, ...totals, ...d }].map((p) => (
              <tr key={p.platform} className={p.platform === "TOTAL" ? "font-medium" : undefined}>
                <td>{p.platform === "TOTAL" ? "Total" : PLATFORMS[p.platform].label}</td>
                <td className="tnum">{formatNumber(p.impressions)}</td><td className="tnum">{formatNumber(p.reach)}</td><td className="tnum">{formatNumber(p.clicks)}</td>
                <td className="tnum">{p.ctr === null ? "—" : formatPercent(p.ctr)}</td><td className="tnum">{p.cpc === null ? "—" : formatFcfa(Math.round(p.cpc))}</td><td className="tnum">{p.cpm === null ? "—" : formatFcfa(Math.round(p.cpm))}</td>
                <td className="tnum">{formatFcfa(p.spend)}</td>
              </tr>
            ))}
          </Table>
        ) : <p className="px-4 sm:px-5 py-6 text-sm text-muted">Aucune statistique validée sur la période.</p>}
      </Card>
    </>
  );
}
