import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Table } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const where = q ? { OR: [{ action: { contains: q.toLowerCase() } }, { entity: { contains: q, mode: "insensitive" as const } }, { entityId: q }] } : {};
  const [rows, total] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }), db.auditLog.count({ where })]);
  const actors = await db.user.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.actorId).filter((v): v is string => Boolean(v)))) } }, select: { id: true, name: true } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return (
    <>
      <PageHeader title="Journal" />
      <div className="mb-4"><SearchForm action="/gestion/journal" q={q} placeholder="Action (ex. payment, refund) ou identifiant…" /></div>
      <Card>
        {rows.length ? (
          <>
            <Table head={["Date", "Auteur", "Action", "Objet", "Détails"]}>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="whitespace-nowrap">{r.actorId ? names.get(r.actorId) ?? "Compte supprimé" : "Système"}</td>
                  <td className="font-mono text-[0.8125rem] text-ink">{r.action}</td>
                  <td className="text-[0.8125rem] text-ink-soft">{r.entity}{r.entityId ? <span className="block font-mono text-xs text-muted">{r.entityId}</span> : null}</td>
                  <td className="max-w-80 break-words font-mono text-xs text-muted" data-empty={r.meta ? undefined : ""}>{r.meta ? JSON.stringify(r.meta).slice(0, 220) : "—"}</td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={total} base="/gestion/journal" params={{ q }} />
          </>
        ) : <EmptyState icon={<ScrollText />} title="Aucune entrée" />}
      </Card>
    </>
  );
}
