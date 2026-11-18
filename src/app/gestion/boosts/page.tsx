import type { Metadata } from "next";
import Link from "next/link";
import { Tags, TrendingUp } from "lucide-react";
import { PlatformBadge } from "@/components/icons";
import { BoostManageDialog } from "@/components/staff/boost-panels";
import { FilterChips, hrefWith, PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { StateIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Table } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { boostLabel, type BoostKindCode, type BoostStatusName } from "@/lib/boost/catalog";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { formatDateTime, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Abonnés et J'aime" };

const VIEWS = [
  { id: "a-traiter", label: "À traiter", statuses: ["TO_DELIVER", "IN_PROGRESS"] },
  { id: "TO_DELIVER", label: "À livrer", statuses: ["TO_DELIVER"] },
  { id: "IN_PROGRESS", label: "En cours", statuses: ["IN_PROGRESS"] },
  { id: "DELIVERED", label: "Livrées", statuses: ["DELIVERED"] },
  { id: "CANCELLED", label: "Annulées", statuses: ["CANCELLED"] },
  { id: "AWAITING_PAYMENT", label: "Non payées", statuses: ["AWAITING_PAYMENT"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly BoostStatusName[] }[];

export default async function BoostsPage({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; page?: string }> }) {
  const user = await requirePermission("boost.manage");
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === sp.statut) ?? VIEWS[0];
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const search = q ? { OR: [{ order: { reference: { contains: q.toUpperCase() } } }, { link: { contains: q, mode: "insensitive" as const } }, { user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q.toLowerCase() } } }] } : {};
  const where = { status: { in: [...view.statuses] }, ...search };
  const waiting = view.id === "a-traiter" || view.id === "TO_DELIVER" || view.id === "IN_PROGRESS";
  const [rows, total, counts] = await Promise.all([
    // Les commandes à traiter se lisent de la plus ancienne à la plus récente : la première payée est la première livrée.
    db.boostOrder.findMany({ where, orderBy: { createdAt: waiting ? "asc" : "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { order: { select: { reference: true, total: true, status: true, paidAt: true } }, user: { select: { name: true, email: true, phone: true } } } }),
    db.boostOrder.count({ where }),
    db.boostOrder.groupBy({ by: ["status"], _count: { _all: true }, where: { status: { in: ["TO_DELIVER", "IN_PROGRESS"] } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  // Un compteur à zéro n'apporte rien : on ne l'affiche pas.
  const badge: Record<string, number | undefined> = { "a-traiter": (count("TO_DELIVER") + count("IN_PROGRESS")) || undefined, TO_DELIVER: count("TO_DELIVER") || undefined, IN_PROGRESS: count("IN_PROGRESS") || undefined };
  const params = { statut: view.id === VIEWS[0].id ? undefined : view.id, q };
  const base = "/gestion/boosts";
  return (
    <>
      <PageHeader title="Abonnés et J'aime" description="Commandes payées à passer chez votre fournisseur, puis à marquer « Livrée »."
        actions={can(user.role, "pricing.manage") ? <Button asChild variant="outline" size="sm"><Link href="/gestion/services#abonnes"><Tags />Tarifs</Link></Button> : undefined} />
      <div className="mb-4 space-y-3">
        <SearchForm action={base} q={q} placeholder="Référence, lien, client…" hidden={{ statut: params.statut }} />
        <FilterChips current={view.id} items={VIEWS.map((v) => ({ id: v.id, label: v.label, count: badge[v.id], href: hrefWith(base, params, { statut: v.id === VIEWS[0].id ? undefined : v.id, page: undefined }) }))} />
      </div>
      <Card>
        {rows.length ? (
          <>
            <Table head={["Commande", "Client", "Lien", "Montant", "État", ""]} mobileCorner={5}>
              {rows.map((b) => {
                const platform = b.platform as PlatformCode;
                const label = boostLabel(platform, b.kind as BoostKindCode, b.quantity);
                // Remboursée ou annulée côté paiement : on le signale à côté de l'état de livraison.
                const orderNote = ["REFUNDED", "PARTIALLY_REFUNDED", "EXPIRED"].includes(b.order.status);
                return (
                  <tr key={b.id}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <PlatformBadge platform={platform} size="md" />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{label}</span>
                          <span className="block text-xs text-muted"><span className="font-mono">{b.order.reference}</span> · {formatDateTime(b.order.paidAt ?? b.createdAt)}</span>
                        </span>
                      </span>
                    </td>
                    <td><span className="block text-ink">{b.user.name}</span><span className="block text-xs text-muted">{b.user.email}</span></td>
                    <td><a href={b.link} target="_blank" rel="noreferrer noopener" className="block max-w-56 truncate text-[0.8125rem] text-green hover:underline">{b.link.replace(/^https?:\/\/(www\.)?/, "")}</a>{b.comments.length > 0 && <span className="tnum block text-xs text-muted">{b.comments.length} texte{b.comments.length > 1 ? "s" : ""} fourni{b.comments.length > 1 ? "s" : ""}</span>}</td>
                    <td className="tnum whitespace-nowrap font-medium">{formatFcfa(b.order.total)}</td>
                    <td><span className="flex items-center gap-1.5"><StateIcon kind="boost" value={b.status} />{orderNote && <StateIcon kind="order" value={b.order.status} />}</span></td>
                    <td className="text-right">
                      <BoostManageDialog row={{
                        id: b.id, reference: b.order.reference, label, quantity: b.quantity, link: b.link, comments: b.comments, status: b.status as BoostStatusName, staffNote: b.staffNote,
                        cancelReason: b.cancelReason, client: b.user, total: formatFcfa(b.order.total),
                      }} />
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pagination page={page} total={total} base={base} params={params} />
          </>
        ) : <EmptyState icon={<TrendingUp />} title={waiting ? "Rien à livrer" : "Aucune commande"} description={waiting ? "Les commandes payées apparaissent ici." : undefined} />}
      </Card>
    </>
  );
}
