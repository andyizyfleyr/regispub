import type { Metadata } from "next";
import { Users } from "lucide-react";
import { FilterChips, hrefWith, PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { ActionButton } from "@/components/ui/action-form";
import { ToneIcon } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Table } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatFcfa } from "@/lib/utils";
import { setUserStatusAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Clients et entreprises" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; etat?: string }> }) {
  const actor = await requirePermission("user.view");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const suspended = sp.etat === "suspendus";
  const where = {
    role: "CLIENT" as const, ...(suspended ? { status: "SUSPENDED" as const } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q.replace(/\D/g, "") || "__" } }, { businesses: { some: { name: { contains: q, mode: "insensitive" as const } } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { businesses: { select: { name: true, sector: true }, take: 3 }, _count: { select: { campaigns: { where: { status: { not: "DRAFT" } } } } } } }),
    db.user.count({ where }),
  ]);
  const spent = await db.order.groupBy({ by: ["userId"], where: { userId: { in: rows.map((r) => r.id) }, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true } });
  const spentOf = new Map(spent.map((s) => [s.userId, s._sum.total ?? 0]));
  const canManage = can(actor.role, "user.manage");
  const params = { q, etat: suspended ? "suspendus" : undefined };
  const base = "/gestion/utilisateurs";
  return (
    <>
      <PageHeader title="Clients et entreprises" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchForm action={base} q={q} placeholder="Nom, e-mail, téléphone, entreprise…" hidden={{ etat: params.etat }} />
        <FilterChips current={suspended ? "suspendus" : "tous"} items={[{ id: "tous", label: "Tous", href: hrefWith(base, params, { etat: undefined, page: undefined }) }, { id: "suspendus", label: "Suspendus", href: hrefWith(base, params, { etat: "suspendus", page: undefined }) }]} />
      </div>
      <Card>
        {rows.length ? (
          <>
            <Table head={["Client", "Contact", "Entreprises", "Campagnes", "Total payé", "Inscription", ""]}>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><span className="block font-medium text-ink">{u.name}</span><span className="text-xs text-muted">{u.accountType === "PROFESSIONAL" ? "Professionnel" : "Particulier"}</span>{u.status === "SUSPENDED" && <ToneIcon tone="danger" label="Suspendu" className="ml-2" />}</td>
                  <td><span className="block text-[0.8125rem]">{u.email}</span>{u.phone && <span className="tnum block text-xs text-muted">{formatPhone(u.phone)}</span>}</td>
                  <td className="text-[0.8125rem] text-ink-soft">{u.businesses.length ? u.businesses.map((b) => <span key={b.name} className="block max-w-48 truncate">{b.name} <span className="text-muted">· {b.sector}</span></span>) : "—"}</td>
                  <td className="tnum">{u._count.campaigns}</td>
                  <td className="tnum whitespace-nowrap">{formatFcfa(spentOf.get(u.id) ?? 0)}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
                  <td className="text-right">
                    {canManage && (u.status === "ACTIVE"
                      ? <ActionButton variant="ghost" size="sm" className="text-clay" action={setUserStatusAction.bind(null, u.id, "SUSPENDED")} confirm={`Suspendre le compte de ${u.name} ? Il sera déconnecté immédiatement.`} successMessage="Compte suspendu.">Suspendre</ActionButton>
                      : <ActionButton variant="outline" size="sm" action={setUserStatusAction.bind(null, u.id, "ACTIVE")} successMessage="Compte réactivé.">Réactiver</ActionButton>)}
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={total} base={base} params={params} />
          </>
        ) : <EmptyState icon={<Users />} title="Aucun client" />}
      </Card>
    </>
  );
}
