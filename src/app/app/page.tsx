import type { Metadata } from "next";
import Link from "next/link";
import { Headset, ImageIcon, Megaphone, MessageSquareText, Plus, Wallet } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { Banner, Tile } from "@/components/ui/tile";
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
export default async function DashboardPage() {
  const user = await requireUser();
  const [active, campaigns, todo] = await Promise.all([
    db.campaign.count({ where: { userId: user.id, status: { in: ACTIVE_STATUSES } } }),
    db.campaign.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.campaign.findMany({ where: { userId: user.id, status: { in: ["AWAITING_INFO", "CLIENT_REVIEW", "PENDING_PAYMENT"] } }, orderBy: { updatedAt: "desc" }, take: 5, include: { orders: { where: { status: "PENDING" }, take: 1, select: { id: true } } } }),
  ]);
  const hasCampaigns = campaigns.length > 0;
  const firstName = user.name.split(" ")[0];
  const lead = !hasCampaigns
    ? "Choisissez la façon de faire qui vous convient."
    : todo.length
      ? `${todo.length} action${todo.length > 1 ? "s" : ""} vous attend${todo.length > 1 ? "ent" : ""}.`
      : active
        ? `${active} campagne${active > 1 ? "s" : ""} en cours. Rien à faire pour le moment.`
        : "Aucune campagne en cours.";

  return (
    <div className="animate-rise space-y-8">
      <Banner decoration={<Megaphone />}>
        <p className="text-sm text-white/70">Bonjour {firstName}</p>
        <h1 className="mt-1 max-w-md text-[26px] font-semibold leading-tight text-white sm:text-[32px]">{hasCampaigns ? "Prêt pour votre prochaine publicité ?" : "Lancez votre première publicité"}</h1>
        <p className="mt-2 text-[15px] text-white/75">{lead}</p>
        {hasCampaigns && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild variant="accent" size="lg"><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer une publicité</Link></Button>
            <Button asChild variant="outline" size="lg" className="border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"><Link href="/app/expert"><Headset />Confier à un expert</Link></Button>
          </div>
        )}
      </Banner>

      {!hasCampaigns && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile href="/app/creer" icon={<Plus strokeWidth={2.4} />} tone="marigold" title="Je crée ma publicité" text="Quatre étapes, quelques minutes. Nous proposons le texte et l'audience." />
          <Tile href="/app/expert" icon={<Headset />} tone="green" title="Je confie ma publicité à un expert" text="Vous décrivez votre besoin, un gestionnaire prépare tout." />
        </div>
      )}

      {todo.length > 0 && (
        <section aria-labelledby="a-faire">
          <SectionTitle id="a-faire">À faire</SectionTitle>
          <List className="border-marigold/50 bg-marigold-soft/40 divide-marigold/25">
            {todo.map((c) => {
              const status = c.status as CampaignStatusName;
              const meta = TODO_META[status]!;
              const href = status === "PENDING_PAYMENT" && c.orders[0] ? `/app/paiements/${c.orders[0].id}` : status === "CLIENT_REVIEW" ? `/app/campagnes/${c.id}?onglet=creations` : `/app/campagnes/${c.id}?onglet=messages`;
              return <ListRow key={c.id} href={href} icon={<meta.icon />} tone="marigold" title={c.name} subtitle={STATUS_META[status].clientHint} className="hover:bg-marigold-soft/70"
                trailing={<span className="rounded-full bg-forest px-3 py-1.5 text-[13px] font-medium text-white">{meta.cta}</span>} chevron={false} />;
            })}
          </List>
        </section>
      )}

      {hasCampaigns && (
        <section aria-labelledby="campagnes">
          <SectionTitle id="campagnes" action={<Link href="/app/campagnes">Tout voir</Link>}>Vos campagnes</SectionTitle>
          <List className="shadow-card">{campaigns.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}
    </div>
  );
}
