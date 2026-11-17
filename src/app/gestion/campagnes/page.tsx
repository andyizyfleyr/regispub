import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { FilterChips, hrefWith, PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { campaignScope } from "@/lib/auth/staff-nav";
import { can } from "@/lib/auth/permissions";
import type { CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Campagnes" };

const VIEWS: Record<string, { label: string; statuses: CampaignStatusName[] }> = {
  atraiter: { label: "À traiter", statuses: ["PAID", "AWAITING_INFO", "IN_PREPARATION", "READY_TO_LAUNCH"] },
  validation: { label: "Validation client", statuses: ["CLIENT_REVIEW"] },
  diffusion: { label: "En diffusion", statuses: ["RUNNING", "PAUSED"] },
  attente: { label: "Paiement en attente", statuses: ["PENDING_PAYMENT"] },
  terminees: { label: "Terminées", statuses: ["COMPLETED"] },
  annulees: { label: "Annulées", statuses: ["CANCELLED"] },
};

export default async function StaffCampaigns({ searchParams }: { searchParams: Promise<{ vue?: string; q?: string; page?: string; moi?: string }> }) {
  const user = await requireStaff();
  if (!can(user.role, "campaign.view_all") && !can(user.role, "campaign.view_assigned")) redirect("/gestion?refus=1");
  const sp = await searchParams;
  const view = sp.vue && VIEWS[sp.vue] ? sp.vue : sp.vue === "toutes" ? "toutes" : "atraiter";
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const scope = campaignScope(user);
  const mine = sp.moi === "1" ? { AND: [{ OR: [{ managerId: user.id }, { designerId: user.id }] }] } : {};
  // Les brouillons appartiennent au client : ils ne sont jamais visibles de l'équipe.
  const baseWhere = { ...scope, ...mine, status: { not: "DRAFT" as const } };
  const search = q ? { AND: [...(mine.AND ?? []), { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { reference: { contains: q.toUpperCase() } }, { user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q.toLowerCase() } } }] }] } : {};
  const where = { ...baseWhere, ...search, ...(view !== "toutes" ? { status: { in: VIEWS[view]!.statuses } } : {}) };
  const [rows, total, counts] = await Promise.all([
    db.campaign.findMany({ where, orderBy: view === "atraiter" || view === "validation" ? { updatedAt: "asc" } : { updatedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } }, manager: { select: { name: true } } } }),
    db.campaign.count({ where }),
    db.campaign.groupBy({ by: ["status"], where: baseWhere, _count: true }),
  ]);
  const countOf = (statuses: string[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);
  const params = { vue: view === "atraiter" ? undefined : view, q, moi: sp.moi === "1" ? "1" : undefined };
  const base = "/gestion/campagnes";

  return (
    <>
      <PageHeader title="Campagnes" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchForm action={base} q={q} placeholder="Nom, référence, client…" hidden={{ vue: params.vue, moi: params.moi }} />
        <FilterChips current={sp.moi === "1" ? "moi" : "tous"} items={[{ id: "tous", label: "Toutes les campagnes", href: hrefWith(base, params, { moi: undefined, page: undefined }) }, { id: "moi", label: "Les miennes", href: hrefWith(base, params, { moi: "1", page: undefined }) }]} />
      </div>
      <div className="mb-4">
        <FilterChips current={view} items={[
          ...Object.entries(VIEWS).map(([id, v]) => ({ id, label: v.label, count: countOf(v.statuses), href: hrefWith(base, params, { vue: id === "atraiter" ? undefined : id, page: undefined }) })),
          { id: "toutes", label: "Toutes", count: counts.reduce((s, c) => s + c._count, 0), href: hrefWith(base, params, { vue: "toutes", page: undefined }) },
        ]} />
      </div>
      <Card>
        {rows.length ? (
          <>
            <div className="divide-y divide-line">
              {rows.map((c) => <CampaignRow key={c.id} c={c} base="/gestion" extra={<span className="text-xs text-muted"><span className="font-mono">{c.reference}</span> · {c.user.name} · {c.manager ? `suivie par ${c.manager.name}` : "non attribuée"}</span>} />)}
            </div>
            <Pagination page={page} total={total} base={base} params={params} />
          </>
        ) : <EmptyState icon={<FolderKanban />} title="Aucune campagne" description={q ? "Aucun résultat pour cette recherche." : "Aucune campagne dans cette vue."} />}
      </Card>
    </>
  );
}
