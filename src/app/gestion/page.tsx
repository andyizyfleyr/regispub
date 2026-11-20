import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartColumn, ChevronDown, CircleCheck, FolderKanban, LifeBuoy, TrendingUp, Undo2, UserPlus } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { StateIcon } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list";
import { Notice, PageHeader, Stat } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { campaignScope } from "@/lib/auth/staff-nav";
import { db } from "@/lib/db";
import { integrationsStatus } from "@/lib/integrations";
import { formatDateTime, formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "À faire" };

export default async function StaffHome({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const user = await requireStaff();
  const { refus } = await searchParams;
  const scope = campaignScope(user);
  const seeMoney = can(user.role, "payment.view");
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [toAssign, preparing, review, running, mine, todo, month, openTickets, refunds, pendingMetrics, lastPayments, boostsToDeliver] = await Promise.all([
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
    can(user.role, "boost.manage") ? db.boostOrder.count({ where: { status: "TO_DELIVER" } }) : 0,
  ]);
  const integrations = can(user.role, "integration.view") ? await integrationsStatus() : [];
  const simulation = integrations.filter((i) => i.state === "simulation");
  // Sans prestataire actif ni simulateur, les clients ne peuvent pas payer : c'est l'alerte prioritaire.
  const issues = simulation.length ? simulation : integrations.filter((i) => i.state === "needs_config" && i.name === "Paiement en ligne");

  // Ce qui attend quelqu'un de l'équipe, du plus pressé au moins pressé. Une ligne = un clic vers la bonne liste.
  const tasks = [
    { n: toAssign, label: "Campagnes payées à confier à quelqu'un", action: "Attribuer", href: "/gestion/campagnes?vue=atraiter", icon: <UserPlus /> },
    { n: Math.max(0, preparing - toAssign), label: "Campagnes à préparer", action: "Ouvrir", href: "/gestion/campagnes?vue=atraiter", icon: <FolderKanban /> },
    { n: boostsToDeliver, label: "Commandes d'abonnés ou de J'aime à livrer", action: "Livrer", href: "/gestion/boosts", icon: <TrendingUp /> },
    { n: openTickets ?? 0, label: "Réclamations sans réponse", action: "Répondre", href: "/gestion/reclamations", icon: <LifeBuoy /> },
    { n: refunds ?? 0, label: "Remboursements à faire", action: "Rembourser", href: "/gestion/paiements?vue=remboursements", icon: <Undo2 /> },
    { n: pendingMetrics ?? 0, label: "Campagnes avec des chiffres à valider", action: "Valider", href: "/gestion/campagnes?vue=diffusion", icon: <ChartColumn /> },
  ].filter((t) => t.n > 0);

  return (
    <>
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]}`} />
      {refus && <Notice tone="danger" title="Accès refusé" className="mb-5">Votre rôle ne donne pas accès à cette page.</Notice>}
      {issues.map((i) => <Notice key={i.name} tone="warn" title={i.name} className="mb-5">{i.detail} <Link href="/gestion/integrations" className="font-medium underline">Voir les intégrations</Link></Notice>)}

      <section aria-labelledby="a-faire">
        <h2 id="a-faire" className="mb-2 px-1 text-[1.0625rem] font-semibold">À faire maintenant</h2>
        {tasks.length ? (
          <ul className="overflow-hidden rounded-[22px] border border-line/70 bg-surface shadow-card">
            {tasks.map((t) => (
              <li key={t.label} className="border-t border-line first:border-0">
                <Link href={t.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper sm:px-5">
                  <span aria-hidden className="tnum flex size-10 shrink-0 items-center justify-center rounded-full bg-marigold text-[1rem] font-semibold text-forest">{formatNumber(t.n)}</span>
                  <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug text-ink"><span className="sr-only">{formatNumber(t.n)} </span>{t.label}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[0.84375rem] font-semibold text-green">{t.action}<ArrowRight className="size-4" /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-[22px] border border-green/25 bg-green-soft px-4 py-4 sm:px-5">
            <CircleCheck className="size-6 shrink-0 text-green" />
            <p className="text-[0.9375rem] font-medium text-ink">Tout est à jour. Rien ne vous attend.</p>
          </div>
        )}
      </section>

      {todo.length > 0 && (
        <section aria-labelledby="a-avancer" className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 id="a-avancer" className="text-[1.0625rem] font-semibold">Campagnes en cours de préparation</h2>
            <Link href="/gestion/campagnes" className="flex shrink-0 items-center gap-1 text-[0.8125rem] font-medium text-green hover:underline">Tout voir <ArrowRight className="size-3.5" /></Link>
          </div>
          <Card>
            <div className="divide-y divide-line">
              {todo.map((c) => <CampaignRow key={c.id} c={c} base="/gestion" extra={<span className="text-xs text-muted">{c.user.name} · {c.manager ? c.manager.name : "non attribuée"}</span>} />)}
            </div>
          </Card>
        </section>
      )}

      <details className="group mt-6 rounded-[22px] border border-line/70 bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[0.9375rem] font-medium text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
          <span>Chiffres{month ? <span className="tnum font-normal text-muted"> · {formatFcfa(month._sum.total ?? 0)} encaissés ce mois</span> : <span className="tnum font-normal text-muted"> · {formatNumber(running)} en diffusion</span>}</span>
          <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-line p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="En préparation" value={formatNumber(preparing)} />
            <Stat label="Attendent le client" value={formatNumber(review)} />
            <Stat label="En diffusion" value={formatNumber(running)} />
            <Stat label="Suivies par vous" value={formatNumber(mine)} />
          </div>
          {month && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Encaissé ce mois" value={formatFcfa(month._sum.total ?? 0)} hint={`${month._count} commande${month._count > 1 ? "s" : ""}`} className="col-span-2 lg:col-span-1" />
              <Stat label="Pour nous" value={formatFcfa((month._sum.serviceFee ?? 0) - (month._sum.discount ?? 0))} hint="Nos frais de prestation" />
              <Stat label="Pour les réseaux" value={formatFcfa(month._sum.adBudget ?? 0)} hint="Budgets publicitaires" />
            </div>
          )}
          {seeMoney && lastPayments.length > 0 && (
            <div>
              <div className="mb-1 mt-2 flex items-center justify-between gap-3">
                <h3 className="text-[0.875rem] font-semibold">Derniers paiements</h3>
                <Link href="/gestion/paiements" className="text-[0.8125rem] font-medium text-green hover:underline">Tous</Link>
              </div>
              <ul className="divide-y divide-line">
                {lastPayments.map((p) => (
                  <ListRow key={p.id} title={p.user.name} subtitle={formatDateTime(p.createdAt)}
                    value={<span className="tnum font-semibold text-ink">{formatFcfa(p.amount)}</span>} meta={<StateIcon kind="payment" value={p.status} />} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </>
  );
}
