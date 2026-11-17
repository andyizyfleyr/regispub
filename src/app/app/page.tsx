import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, MessageSquareText, Plus, Wallet } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Onboarding } from "@/components/app/onboarding";
import { Button } from "@/components/ui/button";
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

/** Accueil : ce qu'il y a à faire, puis les campagnes. Rien d'autre. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ guide?: string }> }) {
  const [user, { guide }] = await Promise.all([requireUser(), searchParams]);
  const [active, totalCount, campaigns, todo] = await Promise.all([
    db.campaign.count({ where: { userId: user.id, status: { in: ACTIVE_STATUSES } } }),
    db.campaign.count({ where: { userId: user.id, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    db.campaign.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.campaign.findMany({ where: { userId: user.id, status: { in: ["AWAITING_INFO", "CLIENT_REVIEW", "PENDING_PAYMENT"] } }, orderBy: { updatedAt: "desc" }, take: 5, include: { orders: { where: { status: "PENDING" }, take: 1, select: { id: true } } } }),
  ]);
  const hasCampaigns = campaigns.length > 0;
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
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-[1.25rem] font-semibold leading-tight text-white sm:text-[1.875rem]"><span className="font-normal text-white/70">Bonjour,</span> {firstName}</h1>
            <Button asChild variant="accent" size="sm" className="max-sm:hidden"><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer une publicité</Link></Button>
          </div>
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
          <Button asChild variant="accent" className="mt-3 w-full sm:hidden"><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer une publicité</Link></Button>
        </div>
      </section>

      {todo.length > 0 && (
        <section aria-labelledby="a-faire">
          <SectionTitle id="a-faire">À faire</SectionTitle>
          <List className="divide-marigold/25 border-marigold/40 bg-[#fff8e8]">
            {todo.map((c) => {
              const status = c.status as CampaignStatusName;
              const meta = TODO_META[status]!;
              const href = status === "PENDING_PAYMENT" && c.orders[0] ? `/app/paiements/${c.orders[0].id}` : status === "CLIENT_REVIEW" ? `/app/campagnes/${c.id}?onglet=creations` : `/app/campagnes/${c.id}?onglet=messages`;
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
