import type { Metadata } from "next";
import Link from "next/link";
import { Download, ReceiptText } from "lucide-react";
import { StateBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat, Table } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements" };

export default async function PaymentsPage() {
  const user = await requireUser();
  const [orders, paid, refunded] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { campaign: { select: { name: true } }, payments: { where: { status: "SUCCEEDED" }, take: 1, select: { providerRef: true, operator: true } } } }),
    db.order.aggregate({ where: { userId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true, adBudget: true, serviceFee: true, discount: true } }),
    db.refund.aggregate({ where: { order: { userId: user.id }, status: "PROCESSED" }, _sum: { amount: true } }),
  ]);
  return (
    <>
      <PageHeader title="Paiements" description="Historique de vos commandes, références de transaction et reçus." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total payé" value={formatFcfa(paid._sum.total ?? 0)} />
        <Stat label="Budget publicitaire" value={formatFcfa(paid._sum.adBudget ?? 0)} />
        <Stat label="Frais de prestation" value={formatFcfa((paid._sum.serviceFee ?? 0) - (paid._sum.discount ?? 0))} />
        <Stat label="Remboursé" value={formatFcfa(refunded._sum.amount ?? 0)} />
      </div>
      {orders.length ? (
        <Card>
          <Table head={["Commande", "Date", "Budget pub.", "Prestation", "Total", "Statut", ""]}>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-4 py-3">
                  <Link href={`/app/paiements/${o.id}`} className="font-medium text-ink hover:underline">{o.campaign?.name ?? o.serviceLabel}</Link>
                  <span className="block font-mono text-xs text-muted">{o.reference}{o.payments[0]?.providerRef ? ` · ${o.payments[0].providerRef}` : ""}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(o.createdAt)}</td>
                <td className="tnum whitespace-nowrap px-4 py-3">{formatFcfa(o.adBudget)}</td>
                <td className="tnum whitespace-nowrap px-4 py-3">{formatFcfa(o.serviceFee - o.discount)}</td>
                <td className="tnum whitespace-nowrap px-4 py-3 font-medium">{formatFcfa(o.total)}</td>
                <td className="px-4 py-3"><StateBadge kind="order" value={o.status} /></td>
                <td className="px-4 py-3 text-right">
                  {o.invoiceNumber ? <a href={`/api/receipts/${o.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green hover:underline"><Download className="size-3.5" />Reçu</a>
                    : o.status === "PENDING" ? <Link href={`/app/paiements/${o.id}`} className="text-[13px] font-medium text-green hover:underline">Payer</Link> : null}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : <EmptyState icon={<ReceiptText />} title="Aucune commande" description="Vos commandes et reçus apparaîtront ici après votre première campagne." />}
    </>
  );
}
