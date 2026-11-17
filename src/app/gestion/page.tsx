import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { StateIcon } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list";
import { EmptyState, Notice, PageHeader, Stat } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { campaignScope } from "@/lib/auth/staff-nav";
import { db } from "@/lib/db";
import { integrationsStatus } from "@/lib/integrations";
import { formatDateTime, formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function StaffHome({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const user = await requireStaff();
  const { refus } = await searchParams;
  const scope = campaignScope(user);
  const seeMoney = can(user.role, "payment.view");
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [toAssign, preparing, review, running, mine, todo, month, openTickets, refunds, pendingMetrics, lastPayments] = await Promise.all([
    db.campaign.count({ where: { ...scope, status: "PAID", managerId: null } }),
    db.campaign.count({ where: { ...scope, status: { in: ["PAID", "AWAITING_INFO", "IN_PREPARATION", "READY_TO_LAUNCH"] } } }),
    db.campaign.count({ where: { ...scope, status: "CLIENT_REVIEW" } }),
    db.campaign.count({ where: { ...scope, status: "RUNNING" } }),
    db.campaign.count({ where: { OR: [{ managerId: user.id }, { designerId: user.id }], status: { notIn: ["COMPLETED", "CANCELLED", "DRAFT"] } } }),
    db.campaign.findMany({ where: { ...scope, status: { in: ["PAID", "AWAITING_INFO", "IN_PREPARATION", "READY_TO_LAUNCH", "CLIENT_REVIEW"] } }, orderBy: { updatedAt: "asc" }, take: 8, include: { user: { select: { name: true } }, manager: { select: { name: true } } } }),
    seeMoney ? db.order.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: monthStart } }, _sum: { total: true, serviceFee: true, discount: true, adBudget: true }, _count: true }) : null,
    can(user.role, "ticket.manage") ? db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }) : null,
    can(user.role, "payment.refund") ? db.refund.count({ where: { status: "REQUESTED" } }) : null,
    can(user.role, "metrics.validate") ? db.campaign.count({ where: { ...scope, metrics: { some: { validated: false } } } }) : null,
    seeMoney ? db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { order: { select: { reference: true, id: true } }, user: { select: { name: true } } } }) : [],
  ]);
  const integrations = can(user.role, "integration.view") ? integrationsStatus() : [];
  const simulation = integrations.filter((i) => i.state === "simulation");
  // Sans prestataire actif ni simulateur, les clients ne peuvent pas payer : c'est l'alerte prioritaire.
  const issues = simulation.length ? simulation : integrations.filter((i) => i.state === "needs_config" && i.name === "Paiement en ligne");

  return (
    <>
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]}`} />
      {refus && <Notice tone="danger" title="Accès refusé" className="mb-5">Votre rôle ne donne pas accès à cette page.</Notice>}
      {issues.map((i) => <Notice key={i.name} tone="warn" title={i.name} className="mb-5">{i.detail} <Link href="/gestion/integrations" className="font-medium underline">Voir les intégrations</Link></Notice>)}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="À attribuer" value={formatNumber(toAssign)} hint="Payées, sans gestionnaire" />
        <Stat label="En préparation" value={formatNumber(preparing)} />
        <Stat label="En validation client" value={formatNumber(review)} />
        <Stat label="En diffusion" value={formatNumber(running)} hint={`${mine} suivie${mine > 1 ? "s" : ""} par vous`} />
      </div>
      {month && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Encaissé ce mois" value={formatFcfa(month._sum.total ?? 0)} hint={`${month._count} commande${month._count > 1 ? "s" : ""}`} />
          <Stat label="Frais de prestation" value={formatFcfa((month._sum.serviceFee ?? 0) - (month._sum.discount ?? 0))} hint="Chiffre d'affaires du mois" />
          <Stat label="Budgets publicitaires" value={formatFcfa(month._sum.adBudget ?? 0)} hint="À reverser aux plateformes" />
          <Stat label="À traiter" value={formatNumber((openTickets ?? 0) + (refunds ?? 0) + (pendingMetrics ?? 0))} hint={[openTickets !== null ? `${openTickets} récl.` : null, refunds !== null ? `${refunds} remb.` : null, pendingMetrics !== null ? `${pendingMetrics} stat.` : null].filter(Boolean).join(" · ")} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader title="Campagnes à faire avancer" action={<Link href="/gestion/campagnes" className="flex items-center gap-1 text-[0.8125rem] font-medium text-green hover:underline">Tout voir <ArrowRight className="size-3.5" /></Link>} />
          {todo.length ? (
            <div className="divide-y divide-line">
              {todo.map((c) => <CampaignRow key={c.id} c={c} base="/gestion" extra={<span className="text-xs text-muted">{c.user.name} · {c.manager ? c.manager.name : "non attribuée"}</span>} />)}
            </div>
          ) : <EmptyState icon={<CircleCheck />} title="Rien en attente" />}
        </Card>
        {seeMoney && (
          <Card className="self-start">
            <CardHeader title="Derniers paiements" action={<Link href="/gestion/paiements" className="text-[0.8125rem] font-medium text-green hover:underline">Tous</Link>} />
            {lastPayments.length ? (
              <ul className="divide-y divide-line">
                {lastPayments.map((p) => (
                  <ListRow key={p.id} title={p.user.name} subtitle={formatDateTime(p.createdAt)}
                    value={<span className="tnum font-semibold text-ink">{formatFcfa(p.amount)}</span>} meta={<StateIcon kind="payment" value={p.status} />} />
                ))}
              </ul>
            ) : <p className="px-4 sm:px-5 py-6 text-sm text-muted">Aucun paiement.</p>}
          </Card>
        )}
      </div>
    </>
  );
}
