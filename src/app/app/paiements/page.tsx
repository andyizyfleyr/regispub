import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock3, Megaphone, Plus, Undo2, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/ui/badge";
import { List, ListRow } from "@/components/ui/list";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements" };

const ORDER_ICON: Record<string, { icon: typeof Wallet; tone: "green" | "marigold" | "sky" | "neutral" }> = {
  PAID: { icon: Check, tone: "green" }, PENDING: { icon: Clock3, tone: "marigold" }, PARTIALLY_REFUNDED: { icon: Undo2, tone: "sky" }, REFUNDED: { icon: Undo2, tone: "sky" },
  CANCELLED: { icon: X, tone: "neutral" }, EXPIRED: { icon: X, tone: "neutral" },
};

export default async function PaymentsPage() {
  const user = await requireUser();
  const [orders, paid] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { campaign: { select: { name: true } } } }),
    db.order.aggregate({ where: { userId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true, adBudget: true } }),
  ]);
  const total = paid._sum.total ?? 0;
  return (
    <>
      <PageHeader title="Paiements" />
      {total > 0 && (
        <section className="bg-brand relative mb-6 overflow-hidden rounded-[28px] px-5 py-5 text-white shadow-lift sm:px-7 sm:py-6">
          <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
          <div className="relative flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] text-white/70">Total payé</p>
              <p className="tnum mt-1 truncate font-display text-[32px] font-semibold leading-none sm:text-[38px]">{formatFcfa(total)}</p>
            </div>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-marigold"><Wallet className="size-6" /></span>
          </div>
          <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[13px] text-white/90"><Megaphone className="size-4 text-marigold" />dont <span className="tnum font-semibold">{formatFcfa(paid._sum.adBudget ?? 0)}</span> de publicité</p>
        </section>
      )}
      {orders.length ? (
        <List>
          {orders.map((o) => {
            const st = ORDER_ICON[o.status] ?? ORDER_ICON.PENDING!;
            return (
              <ListRow key={o.id} href={`/app/paiements/${o.id}`} icon={<st.icon />} tone={st.tone} title={o.campaign?.name ?? o.serviceLabel}
                subtitle={formatDate(o.createdAt)}
                value={<span className="tnum font-semibold text-ink">{formatFcfa(o.total)}</span>}
                meta={<StateBadge kind="order" value={o.status} />} />
            );
          })}
        </List>
      ) : <EmptyState art="phone" title="Aucune commande" action={<Button asChild><Link href="/app/creer"><Plus strokeWidth={2.4} />Créer</Link></Button>} />}
    </>
  );
}
