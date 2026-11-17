import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleCheck, Download } from "lucide-react";
import { Checkout } from "@/components/app/checkout";
import { QuoteLines } from "@/components/app/quote-box";
import { OperatorChip } from "@/components/icons";
import { StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { paymentModeInfo, refreshPayment } from "@/lib/payments/service";
import { formatPhone, maskPhone, type OperatorCode } from "@/lib/phone";
import type { QuoteLine } from "@/lib/pricing/quote";
import { formatDateTime, formatFcfa, isRecord } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiement" };

async function load(orderId: string, userId: string) {
  return db.order.findFirst({
    where: { id: orderId, userId },
    include: { campaign: { select: { id: true, name: true, mode: true, status: true } }, subscription: true, promoCode: { select: { code: true } }, payments: { orderBy: { createdAt: "desc" } }, refunds: { orderBy: { createdAt: "desc" } } },
  });
}

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  let order = await load(orderId, user.id);
  if (!order) notFound();

  // Retour depuis une page de paiement hébergée : on revérifie auprès du prestataire avant d'afficher quoi que ce soit.
  const stale = order.payments.find((p) => p.status === "INITIATED" || p.status === "PENDING");
  if (stale) {
    await refreshPayment(stale.id).catch(() => undefined);
    order = (await load(orderId, user.id))!;
  }

  const mode = paymentModeInfo();
  const lines = isRecord(order.quote) && Array.isArray(order.quote.lines) ? (order.quote.lines as QuoteLine[]) : [];
  const open = order.payments.find((p) => (p.status === "INITIATED" || p.status === "PENDING") && p.expiresAt > new Date()) ?? null;
  const paidPayment = order.payments.find((p) => p.status === "SUCCEEDED" && !p.duplicate);
  const last = order.payments[0];
  const lastFailure = last && ["FAILED", "CANCELLED", "EXPIRED"].includes(last.status)
    ? last.failureReason ?? (last.status === "EXPIRED" ? "La demande a expiré sans validation sur votre téléphone." : last.status === "CANCELLED" ? "La demande a été annulée." : "Le paiement a été refusé par l'opérateur.")
    : null;
  const isPaid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED" || order.status === "REFUNDED";
  const title = order.campaign?.name ?? order.serviceLabel;

  return (
    <>
      <PageHeader title={isPaid ? "Paiement confirmé" : order.status === "PENDING" ? "Paiement" : "Commande"} back={{ href: "/app/paiements", label: "Paiements" }}
        eyebrow={<span className="font-mono normal-case tracking-normal">{order.reference}</span>} actions={<StateBadge kind="order" value={order.status} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="order-2 space-y-6 lg:order-1">
          {isPaid && (
            <div className="rounded-lg border border-green/25 bg-green-soft p-6">
              <CircleCheck className="size-8 text-green" />
              <h2 className="mt-3 text-xl font-semibold">Merci, votre paiement est confirmé</h2>
              <p className="mt-1.5 text-sm text-ink-soft">
                {formatFcfa(order.total)} reçus le {order.paidAt ? formatDateTime(order.paidAt) : ""}{paidPayment ? ` depuis le ${maskPhone(paidPayment.phone)}` : ""}.
                {order.campaign ? " Un gestionnaire prend votre campagne en charge ; vous serez prévenu à chaque étape." : " Votre accompagnement est actif."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild><a href={`/api/receipts/${order.id}`} target="_blank" rel="noreferrer"><Download />Télécharger le reçu</a></Button>
                {order.campaign && <Button asChild variant="outline"><Link href={`/app/campagnes/${order.campaign.id}`}>Suivre ma campagne <ArrowRight /></Link></Button>}
              </div>
            </div>
          )}

          {order.status === "PENDING" && (
            mode.available ? (
              <Checkout orderId={order.id} total={order.total} operators={mode.operators} defaultPhone={user.phone?.startsWith("+229") ? formatPhone(user.phone).replace(/^\+229\s?/, "") : ""}
                simulation={mode.mode === "simulation"} promoCode={order.promoCode?.code ?? null} canCancel={!open} lastFailure={lastFailure}
                open={open ? { id: open.id, operator: open.operator as OperatorCode, phone: open.phone, expiresAt: open.expiresAt.toISOString(), redirectUrl: open.redirectUrl } : null} />
            ) : <Notice tone="danger" title="Paiement indisponible">Le paiement Mobile Money n&apos;est pas encore activé sur cette plateforme. Votre commande est conservée ; contactez le support pour la régler.</Notice>
          )}

          {(order.status === "CANCELLED" || order.status === "EXPIRED") && (
            <Notice tone="info" title="Cette commande n'est plus payable">
              {order.campaign && order.campaign.status === "DRAFT" ? <>Vous pouvez reprendre la campagne et repasser commande. <Link className="font-medium underline" href={order.campaign.mode === "EXPERT" ? `/app/expert/${order.campaign.id}` : `/app/creer/${order.campaign.id}`}>Reprendre</Link></> : "Créez une nouvelle campagne pour passer une nouvelle commande."}
            </Notice>
          )}

          {order.refunds.length > 0 && (
            <Card>
              <CardHeader title="Remboursements" />
              <ul className="divide-y divide-line">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span><span className="tnum font-medium">{formatFcfa(r.amount)}</span><span className="block text-[13px] text-muted">{r.reason}{r.reference ? ` · réf. ${r.reference}` : ""}</span></span>
                    <StateBadge kind="refund" value={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {order.payments.length > 0 && (
            <Card>
              <CardHeader title="Tentatives de paiement" description="Chaque tentative est vérifiée auprès du prestataire de paiement." />
              <ul className="divide-y divide-line">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <OperatorChip operator={p.operator as OperatorCode} />
                    <span className="min-w-0 flex-1">
                      <span className="tnum block text-ink">{maskPhone(p.phone)} · {formatFcfa(p.amount)}</span>
                      <span className="block truncate text-xs text-muted">{formatDateTime(p.createdAt)}{p.providerRef ? ` · réf. ${p.providerRef}` : ""}{p.duplicate ? " · doublon, remboursement en cours" : ""}</span>
                    </span>
                    <StateBadge kind="payment" value={p.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="order-1 lg:order-2">
          <Card>
            <CardHeader title={title} description={order.serviceLabel} />
            <CardBody>
              <QuoteLines lines={lines} total={order.total} totalLabel={isPaid ? "Total payé" : "Total à payer"} />
              {order.invoiceNumber && <p className="mt-4 text-xs text-muted">Reçu n° <span className="font-mono">{order.invoiceNumber}</span></p>}
            </CardBody>
          </Card>
          {order.status === "PENDING" && order.campaign && <p className="mt-3 text-[13px] text-muted">Une erreur ? <Link href={order.campaign.mode === "EXPERT" ? `/app/expert/${order.campaign.id}` : `/app/creer/${order.campaign.id}?etape=7`} className="font-medium text-green hover:underline">Modifier la campagne</Link></p>}
        </aside>
      </div>
    </>
  );
}
