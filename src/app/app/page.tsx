import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CirclePlus, Headset, Megaphone, ReceiptText } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice, Stat } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, PENDING_STATUSES, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";
import { formatDateTime, formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Accueil" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [byStatus, paid, metrics, campaigns, orders, notifications, toReview] = await Promise.all([
    db.campaign.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    db.order.aggregate({ where: { userId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true, adBudget: true, serviceFee: true, discount: true, paymentFee: true }, _count: true }),
    // Seules les statistiques validées (API officielles ou rapports contrôlés) sont agrégées.
    db.metricSnapshot.aggregate({ where: { validated: true, campaign: { userId: user.id } }, _sum: { leads: true, conversions: true, impressions: true, clicks: true, engagements: true, videoViews: true } }),
    db.campaign.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { campaign: { select: { name: true } } } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.campaign.findMany({ where: { userId: user.id, status: { in: ["AWAITING_INFO", "CLIENT_REVIEW", "PENDING_PAYMENT"] } }, orderBy: { updatedAt: "desc" }, take: 4, include: { orders: { where: { status: "PENDING" }, take: 1, select: { id: true } } } }),
  ]);
  const count = (list: CampaignStatusName[]) => byStatus.filter((s) => list.includes(s.status as CampaignStatusName)).reduce((a, s) => a + s._count, 0);
  const active = count(ACTIVE_STATUSES);
  const pending = count(PENDING_STATUSES);
  const done = count(["COMPLETED"]);
  const netFees = (paid._sum.serviceFee ?? 0) - (paid._sum.discount ?? 0);
  const results = (metrics._sum.conversions ?? 0);
  const hasMetrics = (metrics._sum.impressions ?? 0) > 0;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Tableau de bord</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[32px]">Bonjour {firstName}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/app/expert"><Headset /> Parler à un expert</Link></Button>
          <Button asChild variant="accent"><Link href="/app/creer"><CirclePlus /> Créer ma publicité</Link></Button>
        </div>
      </div>

      {toReview.length > 0 && (
        <div className="mb-6 space-y-2">
          {toReview.map((c) => (
            <Notice key={c.id} tone="warn" title={`${c.name} — ${STATUS_META[c.status as CampaignStatusName].label}`}>
              {STATUS_META[c.status as CampaignStatusName].clientHint}{" "}
              <Link href={c.status === "PENDING_PAYMENT" && c.orders[0] ? `/app/paiements/${c.orders[0].id}` : `/app/campagnes/${c.id}`} className="font-medium text-ink underline underline-offset-2">
                {c.status === "PENDING_PAYMENT" ? "Payer maintenant" : c.status === "CLIENT_REVIEW" ? "Voir les créations" : "Répondre"}
              </Link>
            </Notice>
          ))}
        </div>
      )}

      <section aria-label="Campagnes" className="grid grid-cols-3 gap-3">
        <Stat label="Campagnes actives" value={active} hint={<Link href="/app/campagnes?etat=actives" className="hover:underline">Voir</Link>} />
        <Stat label="En attente" value={pending} hint={<Link href="/app/campagnes?etat=attente" className="hover:underline">Brouillons et paiements</Link>} />
        <Stat label="Terminées" value={done} hint={<Link href="/app/campagnes?etat=terminees" className="hover:underline">Voir les bilans</Link>} />
      </section>

      <section aria-label="Montants" className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Montant total payé" value={formatFcfa(paid._sum.total ?? 0)} hint={`${paid._count} commande${paid._count > 1 ? "s" : ""} réglée${paid._count > 1 ? "s" : ""}`} />
        <Stat label="Dont budget publicitaire" value={formatFcfa(paid._sum.adBudget ?? 0)} hint="Reversé aux plateformes" />
        <Stat label="Dont frais de prestation" value={formatFcfa(netFees)} hint={(paid._sum.paymentFee ?? 0) > 0 ? `+ ${formatFcfa(paid._sum.paymentFee ?? 0)} de frais de paiement` : "Remises déduites"} />
      </section>

      <section aria-label="Résultats" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Prospects obtenus" value={hasMetrics ? formatNumber(metrics._sum.leads ?? 0) : "—"} />
        <Stat label="Conversions" value={hasMetrics ? formatNumber(results) : "—"} />
        <Stat label="Clics" value={hasMetrics ? formatNumber(metrics._sum.clicks ?? 0) : "—"} />
        <Stat label="Impressions" value={hasMetrics ? formatNumber(metrics._sum.impressions ?? 0) : "—"} />
      </section>
      <p className="mt-2 text-xs text-muted">{hasMetrics ? "Résultats cumulés de toutes vos campagnes, issus des plateformes publicitaires ou de rapports validés par notre équipe." : "Les résultats s'affichent dès que des statistiques officielles sont disponibles pour vos campagnes."}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Campagnes récentes" action={<Link href="/app/campagnes" className="text-[13px] font-medium text-green hover:underline">Tout voir</Link>} />
          {campaigns.length ? <div className="divide-y divide-line">{campaigns.map((c) => <CampaignRow key={c.id} c={c} />)}</div> : (
            <div className="p-5"><EmptyState icon={<Megaphone />} title="Aucune campagne pour l'instant" description="Lancez votre première publicité en quelques minutes, ou confiez-la à notre équipe." action={<Button asChild variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>} /></div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Notifications" action={<Link href="/app/notifications" className="text-[13px] font-medium text-green hover:underline">Tout voir</Link>} />
            {notifications.length ? (
              <ul className="divide-y divide-line">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link href={n.link ?? "/app/notifications"} className="flex gap-3 px-5 py-3 hover:bg-paper">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-line-strong" : "bg-marigold"}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{n.title}</span>
                        <span className="block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 p-5 text-sm text-muted"><Bell className="size-4" />Aucune notification.</p>}
          </Card>

          <Card>
            <CardHeader title="Dernières commandes" action={<Link href="/app/paiements" className="text-[13px] font-medium text-green hover:underline">Historique</Link>} />
            {orders.length ? (
              <ul className="divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/app/paiements/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{o.campaign?.name ?? o.serviceLabel}</span>
                        <span className="block font-mono text-xs text-muted">{o.reference}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="tnum text-[13.5px] font-medium">{formatFcfa(o.total)}</span>
                        <StateBadge kind="order" value={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 p-5 text-sm text-muted"><ReceiptText className="size-4" />Aucune commande.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
