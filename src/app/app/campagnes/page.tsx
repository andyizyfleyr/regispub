import type { Metadata } from "next";
import Link from "next/link";
import { CirclePlus, Megaphone } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader, TabsNav } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_STATUSES, PENDING_STATUSES, type CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Mes campagnes" };

const FILTERS: Record<string, { label: string; statuses: CampaignStatusName[] | null }> = {
  toutes: { label: "Toutes", statuses: null },
  actives: { label: "Actives", statuses: ACTIVE_STATUSES },
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
  return (
    <>
      <PageHeader title="Mes campagnes" description="Suivez l'avancement, les créations et les résultats de chacune de vos publicités." actions={<Button asChild variant="accent"><Link href="/app/creer"><CirclePlus /> Nouvelle campagne</Link></Button>} />
      {sp.limite && <Notice tone="warn" className="mb-4">Vous avez atteint le nombre maximal de brouillons. Terminez ou supprimez un brouillon avant d&apos;en créer un nouveau.</Notice>}
      <TabsNav current={current} tabs={Object.entries(FILTERS).map(([id, f]) => ({ id, label: f.label, href: `/app/campagnes?etat=${id}`, count: countFor(f.statuses) }))} className="mb-4" />
      {campaigns.length ? (
        <Card><div className="divide-y divide-line">{campaigns.map((c) => <CampaignRow key={c.id} c={c} />)}</div></Card>
      ) : (
        <EmptyState icon={<Megaphone />} title="Aucune campagne dans cette catégorie" description="Créez une publicité vous-même ou confiez-la à un expert." action={<Button asChild><Link href="/app/creer">Créer ma publicité</Link></Button>} />
      )}
    </>
  );
}
