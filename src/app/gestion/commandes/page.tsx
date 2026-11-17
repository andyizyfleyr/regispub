import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { FilterChips, hrefWith, PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { StateBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Table } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Commandes" };

const STATUSES = [["PENDING", "À régler"], ["PAID", "Payées"], ["PARTIALLY_REFUNDED", "Remboursées en partie"], ["REFUNDED", "Remboursées"], ["CANCELLED", "Annulées"], ["EXPIRED", "Expirées"]] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; page?: string }> }) {
  await requirePermission("order.view");
  const sp = await searchParams;
  const status = STATUSES.find(([id]) => id === sp.statut)?.[0];
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ reference: { contains: q.toUpperCase() } }, { invoiceNumber: { contains: q.toUpperCase() } }, { user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q.toLowerCase() } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true, email: true } }, campaign: { select: { id: true, name: true } }, promoCode: { select: { code: true } } } }),
    db.order.count({ where }),
  ]);
  const params = { statut: status, q };
  const base = "/gestion/commandes";
  return (
    <>
      <PageHeader title="Commandes" />
      <div className="mb-4 space-y-3">
        <SearchForm action={base} q={q} placeholder="Référence, reçu, client…" hidden={{ statut: status }} />
        <FilterChips current={status ?? "toutes"} items={[{ id: "toutes", label: "Toutes", href: hrefWith(base, params, { statut: undefined, page: undefined }) }, ...STATUSES.map(([id, label]) => ({ id, label, href: hrefWith(base, params, { statut: id, page: undefined }) }))]} />
      </div>
      <Card>
        {rows.length ? (
          <>
            <Table head={["Commande", "Client", "Budget pub.", "Prestation", "Remise", "Frais paiement", "Total", "Statut"]}>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="block font-mono text-[13px] text-ink">{o.reference}</span>
                    <span className="block text-xs text-muted">{formatDateTime(o.createdAt)}{o.invoiceNumber ? ` · ${o.invoiceNumber}` : ""}</span>
                    {o.campaign ? <Link href={`/gestion/campagnes/${o.campaign.id}`} className="block max-w-56 truncate text-xs text-green hover:underline">{o.campaign.name}</Link> : <span className="block text-xs text-muted">{o.serviceLabel}</span>}
                  </td>
                  <td><span className="block text-ink">{o.user.name}</span><span className="block text-xs text-muted">{o.user.email}</span></td>
                  <td className="tnum whitespace-nowrap">{formatFcfa(o.adBudget)}</td>
                  <td className="tnum whitespace-nowrap">{formatFcfa(o.serviceFee)}</td>
                  <td className="tnum whitespace-nowrap">{o.discount ? <>−{formatFcfa(o.discount)}<span className="block font-mono text-xs text-muted">{o.promoCode?.code}</span></> : "—"}</td>
                  <td className="tnum whitespace-nowrap">{formatFcfa(o.paymentFee)}</td>
                  <td className="tnum whitespace-nowrap font-medium">{formatFcfa(o.total)}</td>
                  <td><StateBadge kind="order" value={o.status} /></td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={total} base={base} params={params} />
          </>
        ) : <EmptyState icon={<ReceiptText />} title="Aucune commande" />}
      </Card>
    </>
  );
}
