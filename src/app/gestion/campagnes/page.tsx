import type { Metadata } from "next";
import Link from "next/link";
import { Check, FolderKanban } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { FilterChips, hrefWith, PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { campaignScope } from "@/lib/auth/staff-nav";
import { can } from "@/lib/auth/permissions";
import type { CampaignStatusName } from "@/lib/campaigns/status";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Campagnes" };

const VIEWS: Record<string, { label: string; statuses: CampaignStatusName[] }> = {
  atraiter: { label: "À traiter", statuses: ["PAID", "AWAITING_INFO", "IN_PREPARATION", "READY_TO_LAUNCH"] },
  validation: { label: "Attendent le client", statuses: ["CLIENT_REVIEW"] },
  diffusion: { label: "En diffusion", statuses: ["RUNNING", "PAUSED"] },
  attente: { label: "Pas encore payées", statuses: ["PENDING_PAYMENT"] },
  terminees: { label: "Terminées", statuses: ["COMPLETED"] },
  annulees: { label: "Annulées", statuses: ["CANCELLED"] },
};

export default async function StaffCampaigns({ searchParams }: { searchParams: Promise<{ vue?: string; q?: string; page?: string; moi?: string }> }) {
  const user = await requireStaff();
  if (!can(user.role, "campaign.view_all") && !can(user.role, "campaign.view_assigned")) redirect("/gestion?refus=1");
  const sp = await searchParams;
  const asked = sp.vue && VIEWS[sp.vue] ? sp.vue : sp.vue === "toutes" ? "toutes" : null;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const scope = campaignScope(user);
  const mine = sp.moi === "1" ? { AND: [{ OR: [{ managerId: user.id }, { designerId: user.id }] }] } : {};
  // Les brouillons appartiennent au client : ils ne sont jamais visibles de l'équipe.
  const baseWhere = { ...scope, ...mine, status: { not: "DRAFT" as const } };
  const search = q ? { AND: [...(mine.AND ?? []), { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { reference: { contains: q.toUpperCase() } }, { user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q.toLowerCase() } } }] }] } : {};
  const counts = await db.campaign.groupBy({ by: ["status"], where: baseWhere, _count: true });
  const countOf = (statuses: string[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);
  // Sans choix : ce qui est à traiter. S'il n'y a rien à traiter, ou pour une recherche, on montre tout plutôt qu'une page vide.
  const view = asked ?? (q || countOf(VIEWS.atraiter!.statuses) === 0 ? "toutes" : "atraiter");
  const where = { ...baseWhere, ...search, ...(view !== "toutes" ? { status: { in: VIEWS[view]!.statuses } } : {}) };
  const [rows, total] = await Promise.all([
    db.campaign.findMany({ where, orderBy: view === "atraiter" || view === "validation" ? { updatedAt: "asc" } : { updatedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } }, manager: { select: { name: true } } } }),
    db.campaign.count({ where }),
  ]);
  const params = { vue: asked ?? undefined, q, moi: sp.moi === "1" ? "1" : undefined };
  // Une seule rangée de filtres : les vues vides sont masquées.
  const chips = Object.entries(VIEWS).filter(([id, v]) => id === view || countOf(v.statuses) > 0);
  const base = "/gestion/campagnes";

  return (
    <>
      <PageHeader title="Campagnes" />
      <div className="mb-3"><SearchForm action={base} q={q} placeholder="Nom, référence, client…" hidden={{ vue: params.vue, moi: params.moi }} /></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <FilterChips current={view} items={[
          ...chips.map(([id, v]) => ({ id, label: v.label, count: countOf(v.statuses), href: hrefWith(base, params, { vue: id, page: undefined }) })),
          { id: "toutes", label: "Toutes", count: counts.reduce((s, c) => s + c._count, 0), href: hrefWith(base, params, { vue: "toutes", page: undefined }) },
        ]} />
        <Link href={hrefWith(base, params, { moi: sp.moi === "1" ? undefined : "1", page: undefined })} aria-current={sp.moi === "1" ? "true" : undefined}
          className={cn("flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.8125rem] font-medium transition-colors", sp.moi === "1" ? "border-green bg-green-soft text-forest" : "border-line bg-surface text-ink-soft hover:border-line-strong")}>
          <span aria-hidden className={cn("flex size-4 items-center justify-center rounded-[5px] border", sp.moi === "1" ? "border-green bg-green text-white" : "border-line-strong")}>{sp.moi === "1" && <Check className="size-3" strokeWidth={3} />}</span>
          Seulement les miennes
        </Link>
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
