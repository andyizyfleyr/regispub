import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { List } from "@/components/ui/list";
import { EmptyState, Notice, PageHeader, TabsNav } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, PENDING_STATUSES, type CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Mes campagnes" };

const FILTERS: Record<string, { label: string; statuses: CampaignStatusName[] | null }> = {
  toutes: { label: "Toutes", statuses: null },
  actives: { label: "En cours", statuses: ACTIVE_STATUSES },
  attente: { label: "En attente", statuses: PENDING_STATUSES },
  terminees: { label: "Terminées", statuses: ["COMPLETED"] },
  annulees: { label: "Annulées", statuses: ["CANCELLED"] },
};

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ etat?: string; limite?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const current = sp.etat && FILTERS[sp.etat] ? sp.etat : "toutes";
  const [campaigns, counts] = await Promise.all([
    db.campaign.findMany({ where: { userId: user.id, ...(FILTERS[current]!.statuses ? { status: { in: FILTERS[current]!.statuses! } } : {}) }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.campaign.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
  ]);
  const countFor = (statuses: CampaignStatusName[] | null) => counts.filter((c) => !statuses || statuses.includes(c.status as CampaignStatusName)).reduce((a, c) => a + c._count, 0);
  // Seuls les filtres utiles sont proposés : un filtre vide n'apporte rien.
  const tabs = Object.entries(FILTERS).filter(([id, f]) => id === "toutes" || id === current || countFor(f.statuses) > 0).map(([id, f]) => ({ id, label: f.label, href: `/app/campagnes?etat=${id}` }));
  return (
    <>
      <PageHeader title="Mes campagnes" actions={<Button asChild variant="accent" className="max-lg:hidden"><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer</Link></Button>} />
      {sp.limite && <Notice tone="warn" className="mb-4">Trop de brouillons. Terminez-en un ou supprimez-le.</Notice>}
      {tabs.length > 2 && <TabsNav current={current} tabs={tabs} className="mb-4" />}
      {campaigns.length ? (
        <List>{campaigns.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
      ) : (
        <EmptyState art="megaphone" title={current === "toutes" ? "Aucune campagne" : "Rien ici"} action={<Button asChild><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer</Link></Button>} />
      )}
    </>
  );
}
