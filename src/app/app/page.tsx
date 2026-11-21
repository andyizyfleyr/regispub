import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageIcon, MessageSquareText, Wallet } from "lucide-react";
import { Onboarding } from "@/components/app/onboarding";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Accueil" };

const TODO_META: Partial<Record<CampaignStatusName, { cta: string; icon: typeof Wallet }>> = {
  PENDING_PAYMENT: { cta: "Payer", icon: Wallet },
  CLIENT_REVIEW: { cta: "Valider", icon: ImageIcon },
  AWAITING_INFO: { cta: "Répondre", icon: MessageSquareText },
};

/** Les deux choses que l'on vient faire ici. Les campagnes ont leur page (« Campagnes », dans le menu). */
const CHOICES = [
  { href: "/app/creer", title: "Faire une publicité", text: "Trouvez de nouveaux clients sur les réseaux.", img: "megaphone", tone: "bg-green-soft" },
  { href: "/app/booster", title: "Acheter", text: "Abonnés, J'aime, commentaires, vues.", img: "phone", tone: "bg-marigold-soft" },
] as const;

/** Accueil : bonjour, les deux choix, puis ce qu'il y a à faire. Rien d'autre. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ guide?: string }> }) {
  const [user, { guide }] = await Promise.all([requireUser(), searchParams]);
  const [active, totalCount, anyCount, todo] = await Promise.all([
    db.campaign.count({ where: { userId: user.id, status: { in: ACTIVE_STATUSES } } }),
    db.campaign.count({ where: { userId: user.id, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    db.campaign.count({ where: { userId: user.id, status: { not: "CANCELLED" } } }),
    db.campaign.findMany({ where: { userId: user.id, status: { in: ["AWAITING_INFO", "CLIENT_REVIEW", "PENDING_PAYMENT"] } }, orderBy: { updatedAt: "desc" }, take: 5, include: { orders: { where: { status: "PENDING" }, take: 1, select: { id: true } } } }),
  ]);
  const hasCampaigns = anyCount > 0;
  const firstName = user.name.split(" ")[0];
  const lead = !hasCampaigns
    ? "Lancez votre première publicité."
    : todo.length
      ? `${todo.length} action${todo.length > 1 ? "s" : ""} à faire`
      : active
        ? `${active} campagne${active > 1 ? "s" : ""} en cours`
        : "Aucune campagne en cours";

  const stats = [
    { label: "En cours", value: active },
    { label: "À faire", value: todo.length },
    { label: "Campagnes", value: totalCount },
  ];

  return (
    <div className="animate-rise space-y-5 sm:space-y-7">
      <Onboarding userId={user.id} auto={!hasCampaigns} force={guide === "1"} />
      <section className="bg-brand relative overflow-hidden rounded-[22px] px-4 py-4 text-white shadow-lift sm:rounded-[28px] sm:px-8 sm:py-7">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-mint/20 blur-2xl" />
        <div className="relative">
          <h1 className="truncate text-[1.25rem] font-semibold leading-tight text-white sm:text-[1.875rem]"><span className="font-normal text-white/70">Bonjour,</span> {firstName}</h1>
          {hasCampaigns ? (
            <dl className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-2.5">
              {stats.map((st) => (
                <div key={st.label} className="flex items-baseline gap-1.5 rounded-xl bg-white/10 px-2.5 py-2 ring-1 ring-inset ring-white/10 sm:block sm:rounded-2xl sm:px-3.5 sm:py-3">
                  <dd className="tnum font-display text-[1.125rem] font-semibold leading-none sm:text-[1.625rem]">{st.value}</dd>
                  <dt className="min-w-0 truncate text-[0.75rem] text-white/70 sm:mt-1.5 sm:text-[0.8125rem]">{st.label}</dt>
                </div>
              ))}
            </dl>
          ) : <p className="mt-1.5 text-[0.875rem] text-white/75">{lead}</p>}
        </div>
      </section>

      {/* Deux cartes côte à côte, d'un bord à l'autre : sur téléphone et tablette, elles annulent la marge de la page. */}
      <nav aria-label="Que voulez-vous faire ?" className="-mx-4 grid grid-cols-2 gap-2 sm:-mx-6 sm:gap-3 lg:mx-0 lg:gap-4">
        {CHOICES.map((c, i) => (
          <Link key={c.href} href={c.href}
            className={`group flex flex-col px-4 pb-4 pt-1 transition-[transform,box-shadow] active:scale-[0.98] sm:px-6 sm:pb-6 lg:rounded-[28px] lg:hover:-translate-y-0.5 lg:hover:shadow-lift ${c.tone} ${i === 0 ? "rounded-r-[22px] sm:rounded-r-[28px]" : "rounded-l-[22px] sm:rounded-l-[28px]"}`}>
            <Image src={`/img/3d/${c.img}.webp`} alt="" width={280} height={280} unoptimized priority className="mx-auto size-28 mix-blend-multiply sm:size-40" />
            <span className="flex items-center justify-between gap-2 font-display text-[1.0625rem] font-semibold leading-tight text-ink sm:text-[1.375rem]">
              {c.title}<ArrowRight aria-hidden className="size-4 shrink-0 text-ink/45 transition-transform group-hover:translate-x-0.5 sm:size-5" />
            </span>
            <span className="mt-1 block text-[0.8125rem] leading-snug text-ink-soft sm:text-[0.9375rem]">{c.text}</span>
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
    </div>
  );
}
