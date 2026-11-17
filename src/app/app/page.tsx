import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CircleAlert, Eye, Headset, ImageIcon, MessageSquareText, MousePointerClick, Plus, Target, UserPlus, Wallet } from "lucide-react";
import { CampaignCard } from "@/components/app/campaign-card";
import { ObjectiveShortcut } from "@/components/app/quick-start";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, PENDING_STATUSES, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";
import { formatDateTime, formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Accueil" };

const TODO_META: Partial<Record<CampaignStatusName, { cta: string; icon: typeof Wallet }>> = {
  PENDING_PAYMENT: { cta: "Payer maintenant", icon: Wallet },
  CLIENT_REVIEW: { cta: "Voir les créations", icon: ImageIcon },
  AWAITING_INFO: { cta: "Répondre", icon: MessageSquareText },
};

export default async function DashboardPage() {
  const user = await requireUser();
  const [byStatus, paid, metrics, campaigns, notifications, todo] = await Promise.all([
    db.campaign.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    db.order.aggregate({ where: { userId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true, adBudget: true, serviceFee: true, discount: true, paymentFee: true }, _count: true }),
    // Seules les statistiques validées (API officielles ou rapports contrôlés) sont agrégées.
    db.metricSnapshot.aggregate({ where: { validated: true, campaign: { userId: user.id } }, _sum: { leads: true, conversions: true, impressions: true, clicks: true } }),
    db.campaign.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, orderBy: { updatedAt: "desc" }, take: 4 }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.campaign.findMany({ where: { userId: user.id, status: { in: ["AWAITING_INFO", "CLIENT_REVIEW", "PENDING_PAYMENT"] } }, orderBy: { updatedAt: "desc" }, take: 4, include: { orders: { where: { status: "PENDING" }, take: 1, select: { id: true } } } }),
  ]);
  const spendRows = campaigns.length
    ? await db.metricSnapshot.groupBy({ by: ["campaignId"], where: { validated: true, campaignId: { in: campaigns.map((c) => c.id) } }, _sum: { spend: true } })
    : [];
  const spendBy = new Map(spendRows.map((r) => [r.campaignId, r._sum.spend ?? 0]));

  const count = (list: CampaignStatusName[]) => byStatus.filter((s) => list.includes(s.status as CampaignStatusName)).reduce((a, s) => a + s._count, 0);
  const active = count(ACTIVE_STATUSES);
  const pending = count(PENDING_STATUSES);
  const done = count(["COMPLETED"]);
  const hasCampaigns = byStatus.length > 0;
  const hasMetrics = (metrics._sum.impressions ?? 0) > 0;
  const firstName = user.name.split(" ")[0];
  const totalPaid = paid._sum.total ?? 0;
  const budgetPaid = paid._sum.adBudget ?? 0;
  const feesPaid = totalPaid - budgetPaid;
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Porto-Novo" }).format(new Date());
  const lead = !hasCampaigns
    ? "Lancez votre première publicité en quelques minutes et payez par Mobile Money."
    : todo.length
      ? `${todo.length} action${todo.length > 1 ? "s" : ""} vous attend${todo.length > 1 ? "ent" : ""} pour faire avancer vos campagnes.`
      : active
        ? `${active} campagne${active > 1 ? "s" : ""} en cours. Tout est à jour.`
        : "Aucune campagne en cours pour le moment.";

  return (
    <div className="space-y-8">
      {/* Bandeau d'accueil */}
      <section className="bg-brand relative animate-rise overflow-hidden rounded-xl text-white">
        <span aria-hidden className="bg-grid absolute inset-0" />
        <div className="relative flex flex-col gap-7 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[13px] font-medium capitalize text-white/60">{today}</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-tight sm:text-[36px]">Bonjour {firstName}</h1>
            <p className="mt-2 text-[15px] text-white/75">{lead}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button asChild variant="accent" size="lg"><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer une publicité</Link></Button>
              <Button asChild variant="outline" size="lg" className="border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10"><Link href="/app/expert"><Headset />Confier à un expert</Link></Button>
            </div>
          </div>
          {hasCampaigns && (
            <dl className="grid grid-cols-3 gap-2.5 lg:w-[22rem]">
              {[
                { label: "En cours", value: active, href: "/app/campagnes?etat=actives" },
                { label: "En attente", value: pending, href: "/app/campagnes?etat=attente" },
                { label: "Terminées", value: done, href: "/app/campagnes?etat=terminees" },
              ].map((s) => (
                <Link key={s.label} href={s.href} className="rounded-lg border border-white/10 bg-white/[0.07] px-3.5 py-3 backdrop-blur-sm transition-colors hover:bg-white/[0.13]">
                  <dd className="tnum font-display text-[26px] font-semibold leading-none">{s.value}</dd>
                  <dt className="mt-1.5 text-xs text-white/65">{s.label}</dt>
                </Link>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* Actions attendues */}
      {todo.length > 0 && (
        <section aria-labelledby="a-faire">
          <h2 id="a-faire" className="mb-3 flex items-center gap-2 text-lg font-semibold"><CircleAlert className="size-[18px] text-marigold-600" />À faire</h2>
          <div className="stagger grid gap-3 md:grid-cols-2">
            {todo.map((c) => {
              const status = c.status as CampaignStatusName;
              const meta = TODO_META[status]!;
              const href = status === "PENDING_PAYMENT" && c.orders[0] ? `/app/paiements/${c.orders[0].id}` : status === "CLIENT_REVIEW" ? `/app/campagnes/${c.id}?onglet=creations` : `/app/campagnes/${c.id}?onglet=messages`;
              return (
                <Link key={c.id} href={href} className="lift group flex items-center gap-4 rounded-lg border border-marigold/40 bg-marigold-soft/50 p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-marigold text-forest"><meta.icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{c.name}</span>
                    <span className="block text-[13px] leading-snug text-ink-soft">{STATUS_META[status].clientHint}</span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-forest px-3.5 py-2 text-[13px] font-medium text-white sm:flex">{meta.cta}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                  <ArrowRight className="size-4 shrink-0 text-ink-soft sm:hidden" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Résultats */}
      {hasCampaigns && (
        <section aria-labelledby="resultats">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="resultats" className="text-lg font-semibold">Vos résultats</h2>
            <p className="text-xs text-muted">Toutes campagnes confondues</p>
          </div>
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Affichages" tone="sky" icon={<Eye />} value={hasMetrics ? formatNumber(metrics._sum.impressions ?? 0) : "—"} hint="Fois où vos publicités ont été vues" />
            <Stat label="Clics" tone="violet" icon={<MousePointerClick />} value={hasMetrics ? formatNumber(metrics._sum.clicks ?? 0) : "—"} hint="Clics sur vos publicités" />
            <Stat label="Résultats" tone="green" icon={<Target />} value={hasMetrics ? formatNumber(metrics._sum.conversions ?? 0) : "—"} hint="Actions obtenues selon vos objectifs" />
            <Stat label="Prospects" tone="marigold" icon={<UserPlus />} value={hasMetrics ? formatNumber(metrics._sum.leads ?? 0) : "—"} hint="Contacts recueillis" />
          </div>
          {!hasMetrics && <p className="mt-2.5 text-[13px] text-muted">Les chiffres apparaissent dès que votre première publicité est diffusée.</p>}
        </section>
      )}

      {/* Campagnes + activité */}
      {hasCampaigns && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section aria-labelledby="campagnes">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="campagnes" className="text-lg font-semibold">Vos campagnes</h2>
              <Link href="/app/campagnes" className="flex items-center gap-1 text-[13px] font-medium text-green hover:underline">Tout voir<ArrowRight className="size-3.5" /></Link>
            </div>
            <div className="stagger grid gap-3 sm:grid-cols-2">
              {campaigns.map((c) => <CampaignCard key={c.id} c={c} spend={spendBy.get(c.id)} />)}
            </div>
          </section>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Activité récente" icon={<Bell />} action={<Link href="/app/notifications" className="text-[13px] font-medium text-green hover:underline">Tout voir</Link>} />
              {notifications.length ? (
                <ul className="divide-y divide-line">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <Link href={n.link ?? "/app/notifications"} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-paper">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-line-strong" : "bg-marigold"}`} />
                        <span className="min-w-0">
                          <span className={`line-clamp-2 block text-[13.5px] leading-snug ${n.readAt ? "text-ink-soft" : "font-medium text-ink"}`}>{n.title}</span>
                          <span className="mt-0.5 block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="p-5 text-sm text-muted">Les confirmations de paiement et les messages de votre gestionnaire s&apos;affichent ici.</p>}
            </Card>

            {totalPaid > 0 && (
              <Card>
                <CardHeader title="Vos dépenses" icon={<Wallet />} action={<Link href="/app/paiements" className="text-[13px] font-medium text-green hover:underline">Détail</Link>} />
                <div className="p-5">
                  <p className="tnum font-display text-[26px] font-semibold leading-none">{formatFcfa(totalPaid)}</p>
                  <p className="mt-1.5 text-[13px] text-muted">{paid._count} commande{paid._count > 1 ? "s" : ""} réglée{paid._count > 1 ? "s" : ""}</p>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-sand">
                    <span className="bg-green" style={{ width: `${(budgetPaid / totalPaid) * 100}%` }} />
                    <span className="bg-marigold" style={{ width: `${(feesPaid / totalPaid) * 100}%` }} />
                  </div>
                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-green" />Budget publicitaire</dt><dd className="tnum font-medium">{formatFcfa(budgetPaid)}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-marigold" />Prestation et frais</dt><dd className="tnum font-medium">{formatFcfa(feesPaid)}</dd></div>
                  </dl>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Démarrage rapide */}
      <section aria-labelledby="demarrer">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="demarrer" className="text-lg font-semibold">{hasCampaigns ? "Lancer une nouvelle publicité" : "Que voulez-vous obtenir ?"}</h2>
          <Link href="/app/creer" className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-green hover:underline">Tous les objectifs<ArrowRight className="size-3.5" /></Link>
        </div>
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {["whatsapp_orders", "sales", "page_awareness", "leads"].map((code) => <ObjectiveShortcut key={code} code={code} />)}
        </div>
      </section>
    </div>
  );
}
