import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { TicketPanel } from "@/components/staff/admin-panels";
import { FilterChips } from "@/components/staff/common";
import { StateBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Réclamations" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ id?: string; vue?: string }> }) {
  await requirePermission("ticket.manage");
  const sp = await searchParams;
  const view = sp.vue === "closes" ? "closes" : "ouvertes";
  const tickets = await db.ticket.findMany({
    where: { status: { in: view === "closes" ? ["RESOLVED", "CLOSED"] : ["OPEN", "IN_PROGRESS"] } }, orderBy: view === "closes" ? { updatedAt: "desc" } : { createdAt: "asc" }, take: 80,
    include: { user: { select: { name: true } } },
  });
  const selectedId = sp.id ?? tickets[0]?.id;
  const selected = selectedId ? await db.ticket.findUnique({ where: { id: selectedId }, include: { user: { select: { name: true, email: true, phone: true } }, campaign: { select: { id: true, name: true } }, order: { select: { reference: true } }, assignee: { select: { name: true } } } }) : null;
  const base = "/gestion/reclamations";
  return (
    <>
      <PageHeader title="Réclamations" />
      <div className="mb-4"><FilterChips current={view} items={[{ id: "ouvertes", label: "À traiter", href: base }, { id: "closes", label: "Résolues", href: `${base}?vue=closes` }]} /></div>
      {tickets.length || selected ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="self-start">
            <ul className="divide-y divide-line">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`${base}?${view === "closes" ? "vue=closes&" : ""}id=${t.id}`} scroll={false} className={cn("block px-4 py-3 text-sm hover:bg-paper", t.id === selected?.id && "bg-green-soft/60")}>
                    <span className="flex items-start justify-between gap-2"><span className="min-w-0 truncate font-medium text-ink">{t.subject}</span><StateBadge kind="ticket" value={t.status} /></span>
                    <span className="mt-0.5 block text-xs text-muted">{t.user.name} · {t.category} · {formatDateTime(t.createdAt)}</span>
                  </Link>
                </li>
              ))}
              {!tickets.length && <li className="px-4 py-6 text-sm text-muted">Aucune réclamation dans cette vue.</li>}
            </ul>
          </Card>
          {selected && (
            <Card>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-lg font-semibold">{selected.subject}</h2><p className="text-xs text-muted"><span className="font-mono">{selected.reference}</span> · {selected.category} · {formatDateTime(selected.createdAt)}{selected.assignee ? ` · suivie par ${selected.assignee.name}` : ""}</p></div>
                  <StateBadge kind="ticket" value={selected.status} />
                </div>
                <p className="whitespace-pre-wrap rounded-md bg-paper p-4 text-sm text-ink-soft">{selected.body}</p>
                <div className="text-sm">
                  <p className="font-medium text-ink">{selected.user.name}</p>
                  <p className="text-ink-soft"><a className="text-green hover:underline" href={`mailto:${selected.user.email}`}>{selected.user.email}</a>{selected.user.phone ? <span className="tnum"> · {formatPhone(selected.user.phone)}</span> : null}</p>
                  {selected.campaign && <p className="mt-1">Campagne : <Link className="text-green hover:underline" href={`/gestion/campagnes/${selected.campaign.id}`}>{selected.campaign.name}</Link></p>}
                  {selected.order && <p className="mt-1">Commande : <Link className="font-mono text-[13px] text-green hover:underline" href={`/gestion/commandes?q=${selected.order.reference}`}>{selected.order.reference}</Link></p>}
                </div>
                <TicketPanel key={selected.id} ticketId={selected.id} status={selected.status} resolution={selected.resolution} />
              </CardBody>
            </Card>
          )}
        </div>
      ) : <Card><EmptyState icon={<LifeBuoy />} title="Aucune réclamation" /></Card>}
    </>
  );
}
