import type { Metadata } from "next";
import Link from "next/link";
import { Headset, ImageIcon, LifeBuoy, MessageSquareText, Plus, Sparkles, Wallet } from "lucide-react";
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

const SHORTCUTS = [
  { href: "/app/expert", label: "Un expert", icon: Headset, cls: "bg-surface text-green" },
  { href: "/app/assistant", label: "Idées", icon: Sparkles, cls: "bg-surface text-violet" },
  { href: "/app/paiements", label: "Paiements", icon: Wallet, cls: "bg-surface text-sky" },
  { href: "/app/compte?onglet=aide", label: "Aide", icon: LifeBuoy, cls: "bg-surface text-rose" },
];

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
    <div className="animate-rise space-y-7">
      <Onboarding userId={user.id} auto={!hasCampaigns} force={guide === "1"} />
      <section className="bg-brand relative overflow-hidden rounded-[28px] px-5 pb-5 pt-6 text-white shadow-lift sm:px-8 sm:pb-7 sm:pt-8">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-mint/20 blur-2xl" />
        <div className="relative">
          <p className="text-[13.5px] text-white/70">Bonjour,</p>
          <h1 className="mt-0.5 text-[30px] font-semibold leading-[1.05] text-white sm:text-[36px]">{firstName}</h1>
          {hasCampaigns ? (
            <dl className="mt-5 grid grid-cols-3 gap-2.5">
              {stats.map((st) => (
                <div key={st.label} className="rounded-2xl bg-white/10 px-3.5 py-3 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
                  <dd className="tnum font-display text-[26px] font-semibold leading-none">{st.value}</dd>
                  <dt className="mt-1.5 truncate text-[12.5px] text-white/70">{st.label}</dt>
                </div>
              ))}
            </dl>
          ) : <p className="mt-2 text-[15px] text-white/75">{lead}</p>}
          <Button asChild variant="accent" size="lg" className="mt-5 w-full sm:w-auto"><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer une publicité</Link></Button>
        </div>
      </section>

      <nav aria-label="Raccourcis" className="grid grid-cols-4 gap-2 lg:hidden">
        {SHORTCUTS.map((sc) => (
          <Link key={sc.href} href={sc.href} className="group flex flex-col items-center gap-2 text-center">
            <span className={`flex size-14 items-center justify-center rounded-[20px] shadow-card ring-1 ring-line/70 transition-transform group-active:scale-95 ${sc.cls}`}><sc.icon className="size-6" /></span>
            <span className="text-[12.5px] font-medium leading-tight text-ink-soft">{sc.label}</span>
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
              const href = status === "PENDING_PAYMENT" && c.orders[0] ? `/app/paiements/${c.orders[0].id}` : status === "CLIENT_REVIEW" ? `/app/campagnes/${c.id}?onglet=creations` : `/app/campagnes/${c.id}?onglet=messages`;
              return <ListRow key={c.id} href={href} icon={<meta.icon />} tone="forest" title={c.name} subtitle={STATUS_META[status].label} className="hover:bg-marigold-soft"
                trailing={<span className="flex h-9 w-[5.5rem] items-center justify-center rounded-full bg-marigold text-[13px] font-semibold text-forest shadow-glow">{meta.cta}</span>} chevron={false} />;
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
