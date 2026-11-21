import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageIcon, MessageSquareText, Wallet } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { HomeChart, type DayPoint } from "@/components/app/home-chart";
import { Onboarding } from "@/components/app/onboarding";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { METRIC_LABELS } from "@/lib/catalog/objectives";
import { db } from "@/lib/db";
import { addDays, toIsoDate, todayUtc } from "@/lib/utils";

export const metadata: Metadata = { title: "Accueil" };

const TODO_META: Partial<Record<CampaignStatusName, { cta: string; icon: typeof Wallet }>> = {
  PENDING_PAYMENT: { cta: "Payer", icon: Wallet },
  CLIENT_REVIEW: { cta: "Valider", icon: ImageIcon },
  AWAITING_INFO: { cta: "Répondre", icon: MessageSquareText },
};

/** Les deux choses que l'on vient faire ici. */
const CHOICES = [
  { href: "/app/creer", title: "Faire une publicité", text: "Trouvez de nouveaux clients sur les réseaux.", img: "megaphone" },
  { href: "/app/booster", title: "Acheter", text: "Abonnés, J'aime, commentaires, vues.", img: "phone" },
] as const;

/** Nombre de campagnes montrées sur l'accueil : les dernières seulement, le reste est derrière « Tout voir ». */
const RECENT = 4;

/** Nombre de jours montrés par le graphique du bandeau. */
const CHART_DAYS = 14;

/** Accueil : bonjour, les deux choix, ce qu'il y a à faire, puis les dernières campagnes. Rien d'autre. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ guide?: string }> }) {
  const [user, { guide }] = await Promise.all([requireUser(), searchParams]);
  const since = addDays(todayUtc(), -(CHART_DAYS - 1));
  const [active, totalCount, campaigns, todo, daily] = await Promise.all([
    db.campaign.count({ where: { userId: user.id, status: { in: ACTIVE_STATUSES } } }),
    db.campaign.count({ where: { userId: user.id, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    db.campaign.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, orderBy: { updatedAt: "desc" }, take: RECENT }),
    db.campaign.findMany({ where: { userId: user.id, status: { in: ["AWAITING_INFO", "CLIENT_REVIEW", "PENDING_PAYMENT"] } }, orderBy: { updatedAt: "desc" }, take: 5, include: { orders: { where: { status: "PENDING" }, take: 1, select: { id: true } } } }),
    // Comme sur « Résultats » : seuls les chiffres validés par l'équipe sont montrés au client.
    db.metricSnapshot.groupBy({ by: ["date"], where: { validated: true, date: { gte: since }, campaign: { userId: user.id } }, _sum: { reach: true, impressions: true } }),
  ]);
  const hasCampaigns = campaigns.length > 0;
  const firstName = user.name.split(" ")[0];
  // Personnes touchées, jour par jour ; à défaut (import sans cette colonne), les affichages.
  const metric = daily.some((d) => (d._sum.reach ?? 0) > 0) || !daily.some((d) => (d._sum.impressions ?? 0) > 0) ? "reach" : "impressions";
  const byDate = new Map(daily.map((d) => [toIsoDate(d.date), d._sum[metric] ?? 0]));
  const points: DayPoint[] = Array.from({ length: CHART_DAYS }, (_, i) => { const date = toIsoDate(addDays(since, i)); return { date, value: byDate.get(date) ?? null }; });

  const stats = [
    { label: "En cours", value: active },
    { label: "À faire", value: todo.length },
    { label: "Campagnes", value: totalCount },
  ];

  return (
    <div className="animate-rise space-y-5 sm:space-y-7">
      <Onboarding userId={user.id} auto={!hasCampaigns} force={guide === "1"} />
      {/* Bandeau vert : le bonjour, le graphique des derniers jours et les trois chiffres.
          Sur téléphone, tout est empilé ; à partir de la tablette, le graphique passe à droite. */}
      <section className="bg-brand relative overflow-hidden rounded-[22px] p-4 text-white shadow-lift sm:rounded-[28px] sm:p-7">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-mint/20 blur-2xl" />
        <div className="relative grid gap-3 sm:grid-cols-2 sm:gap-6">
          <div className="contents sm:flex sm:min-w-0 sm:flex-col sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <h1 className="truncate text-[1.25rem] font-semibold leading-tight text-white sm:text-[1.875rem]"><span className="font-normal text-white/70">Bonjour,</span> {firstName}</h1>
              {!hasCampaigns && <p className="mt-0.5 text-[0.875rem] text-white/75 sm:mt-1.5 sm:text-[0.9375rem]">Lancez votre première publicité.</p>}
            </div>
            {hasCampaigns && (
              <dl className="order-last grid grid-cols-3 gap-2 sm:order-none sm:gap-2.5">
                {stats.map((st) => (
                  <div key={st.label} className="flex items-baseline gap-1.5 rounded-xl bg-white/10 px-2.5 py-2 ring-1 ring-inset ring-white/10 sm:block sm:rounded-2xl sm:px-3 sm:py-2.5">
                    <dd className="tnum font-display text-[1.125rem] font-semibold leading-none sm:text-[1.5rem]">{st.value}</dd>
                    <dt className="min-w-0 truncate text-[0.75rem] text-white/70 sm:mt-1.5 sm:text-[0.8125rem]">{st.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <HomeChart points={points} label={METRIC_LABELS[metric]} />
        </div>
      </section>

      {/* Deux cartes blanches côte à côte, basses : petite illustration, titre, une ligne de description.
          Sur téléphone et tablette, elles ne gardent que la moitié de la marge de la page. */}
      <nav aria-label="Que voulez-vous faire ?" className="-mx-2 grid grid-cols-2 gap-2 sm:-mx-3 sm:gap-3 lg:mx-0 lg:gap-4">
        {CHOICES.map((c) => (
          <Link key={c.href} href={c.href}
            className="group flex flex-col rounded-[22px] border border-line/70 bg-surface p-3.5 shadow-card transition-[transform,box-shadow] active:scale-[0.98] sm:flex-row sm:items-center sm:gap-4 sm:rounded-[28px] sm:p-5 lg:hover:-translate-y-0.5 lg:hover:shadow-lift">
            <span className="flex items-start justify-between sm:contents">
              <Image src={`/img/3d/${c.img}.webp`} alt="" width={160} height={160} unoptimized priority className="-ml-1 -mt-1 size-14 shrink-0 sm:m-0 sm:size-16" />
              <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-ink/40 transition-transform group-hover:translate-x-0.5 sm:order-last sm:mt-0 sm:size-5" />
            </span>
            <span className="mt-1.5 block min-w-0 sm:mt-0 sm:flex-1">
              <span className="block font-display text-[1rem] font-semibold leading-tight text-ink sm:text-[1.25rem]">{c.title}</span>
              <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-soft sm:text-[0.9375rem]">{c.text}</span>
            </span>
          </Link>
        ))}
      </nav>

      {todo.length > 0 && (
        <section aria-labelledby="a-faire">
          <SectionTitle id="a-faire">À faire</SectionTitle>
          <List className="divide-marigold/25 border-marigold/40 bg-[#fff8e8]">
            {todo.map((c) => {
              const status = c.status as CampaignStatusName;
              const meta = TODO_META[status]!;
              const href = status === "PENDING_PAYMENT" && c.orders[0] ? `/app/paiements/${c.orders[0].id}` : `/app/campagnes/${c.id}`;
              return <ListRow key={c.id} href={href} icon={<meta.icon />} tone="forest" title={c.name} subtitle={STATUS_META[status].clientHint} className="hover:bg-marigold-soft"
                trailing={<span className="flex h-8 w-[5.25rem] items-center justify-center rounded-full bg-marigold text-[0.8125rem] font-semibold text-forest shadow-glow sm:h-9">{meta.cta}</span>} chevron={false} />;
            })}
          </List>
        </section>
      )}

      {hasCampaigns && (
        <section aria-labelledby="campagnes">
          <SectionTitle id="campagnes" action={<Link href="/app/campagnes">Tout voir</Link>}>Vos campagnes</SectionTitle>
          <List>{campaigns.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}
    </div>
  );
}
