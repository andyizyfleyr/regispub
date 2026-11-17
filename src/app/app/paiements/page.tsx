import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { StateBadge } from "@/components/ui/badge";
import { List, ListRow } from "@/components/ui/list";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements" };

export default async function PaymentsPage() {
  const user = await requireUser();
  const [orders, paid] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { campaign: { select: { name: true } } } }),
    db.order.aggregate({ where: { userId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true, adBudget: true } }),
  ]);
  const total = paid._sum.total ?? 0;
  return (
    <>
      <PageHeader title="Paiements" description={total > 0
        ? <>Total payé : <span className="tnum font-medium text-ink">{formatFcfa(total)}</span>, dont <span className="tnum">{formatFcfa(paid._sum.adBudget ?? 0)}</span> de budget publicitaire.</>
        : "Vos commandes et vos reçus."} />
      {orders.length ? (
        <List>
          {orders.map((o) => (
            <ListRow key={o.id} href={`/app/paiements/${o.id}`} title={o.campaign?.name ?? o.serviceLabel}
              subtitle={<>{formatDate(o.createdAt)} · <span className="font-mono text-[12.5px]">{o.reference}</span></>}
              below={<span className="mt-1.5 block"><StateBadge kind="order" value={o.status} /></span>}
              trailing={<span className="tnum font-semibold text-ink">{formatFcfa(o.total)}</span>} />
          ))}
        </List>
      ) : <EmptyState icon={<ReceiptText />} title="Aucune commande" description="Vos commandes et reçus apparaîtront ici après votre première campagne." />}
    </>
  );
}
