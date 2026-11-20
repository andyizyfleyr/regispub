import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleCheck, CreditCard, Download } from "lucide-react";
import { BoostDelivery } from "@/components/app/boost-delivery";
import { Checkout } from "@/components/app/checkout";
import { QuoteLines } from "@/components/app/quote-box";
import { OperatorChip } from "@/components/icons";
import { StateIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { paymentModeInfo, refreshOrderPayments } from "@/lib/payments/service";
import { formatPhone, maskPhone, type OperatorCode } from "@/lib/phone";
import type { QuoteLine } from "@/lib/pricing/quote";
import { formatDateTime, formatFcfa, isRecord } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiement" };

async function load(orderId: string, userId: string) {
  return db.order.findFirst({
    where: { id: orderId, userId },
    include: { campaign: { select: { id: true, name: true, mode: true, status: true } }, subscription: true, boost: true, promoCode: { select: { code: true } }, payments: { orderBy: { createdAt: "desc" } }, refunds: { orderBy: { createdAt: "desc" } } },
  });
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ id?: string; status?: string }> }) {
  const user = await requireUser();
  const { orderId } = await params;
  let order = await load(orderId, user.id);
  if (!order) notFound();

  // Ouverture de la page, ou retour depuis la page de paiement du prestataire : ce que dit l'adresse de retour
  // (« ?status=approved ») n'est jamais cru, l'état est relu auprès du prestataire avant d'afficher quoi que ce soit.
  // Au retour de la page du prestataire (FedaPay ajoute « ?id=…&status=… »), la relecture est immédiate.
  const back = await searchParams;
  const returning = Boolean(back.id || back.status);
  if ((order.status === "PENDING" || order.status === "EXPIRED") && (await refreshOrderPayments(order.id, { force: returning }))) order = (await load(orderId, user.id))!;

  const mode = await paymentModeInfo();
  const lines = isRecord(order.quote) && Array.isArray(order.quote.lines) ? (order.quote.lines as QuoteLine[]) : [];
  const open = order.payments.find((p) => (p.status === "INITIATED" || p.status === "PENDING") && p.expiresAt > new Date()) ?? null;
  const paidPayment = order.payments.find((p) => p.status === "SUCCEEDED" && !p.duplicate);
  const last = order.payments[0];
  const lastFailure = last && ["FAILED", "CANCELLED", "EXPIRED"].includes(last.status)
    ? last.failureReason ?? (last.status === "EXPIRED" ? "Demande expirée sans validation." : last.status === "CANCELLED" ? "La demande a été annulée." : "Paiement refusé par l'opérateur.")
    : null;
  const isPaid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED" || order.status === "REFUNDED";
  const title = order.campaign?.name ?? order.serviceLabel;

  return (
    <>
      <PageHeader title={isPaid ? "Paiement confirmé" : order.status === "PENDING" ? "Paiement" : "Commande"} back={{ href: "/app/paiements", label: "Paiements" }}
        eyebrow={<span className="font-mono normal-case tracking-normal">{order.reference}</span>} status={<StateIcon kind="order" value={order.status} />} />

      <div className="space-y-6">
          {isPaid && (
            <div className="rounded-lg border border-green/25 bg-green-soft p-6">
              <CircleCheck className="size-8 text-green" />
              <h2 className="mt-3 text-xl font-semibold">Merci !</h2>
              <p className="tnum mt-1.5 text-sm text-ink-soft">
                {formatFcfa(order.total)} reçus{order.paidAt ? ` le ${formatDateTime(order.paidAt)}` : ""}{paidPayment?.phone ? ` · ${maskPhone(paidPayment.phone)}` : ""}.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild><a href={`/api/receipts/${order.id}`} target="_blank" rel="noreferrer"><Download />Reçu</a></Button>
                {order.campaign && <Button asChild variant="outline"><Link href={`/app/campagnes/${order.campaign.id}`}>Ma campagne <ArrowRight /></Link></Button>}
              </div>
            </div>
          )}

        {order.boost && <BoostDelivery boost={order.boost} orderStatus={order.status} refundPending={order.refunds.some((r) => r.status === "REQUESTED")} />}

        {order.status === "PENDING" && mode.available ? (
          <Checkout orderId={order.id} total={order.total} operators={mode.operators} hosted={mode.checkout === "hosted"} defaultPhone={user.phone?.startsWith("+229") ? formatPhone(user.phone).replace(/^\+229\s?/, "") : ""}
            testNotice={mode.testNotice} providerLabel={mode.providerLabel ?? "notre prestataire"} promoCode={order.promoCode?.code ?? null} allowPromo={!order.boost} canCancel={!open} lastFailure={lastFailure}
            open={open ? { id: open.id, operator: open.operator as OperatorCode | null, phone: open.phone, expiresAt: open.expiresAt.toISOString(), redirectUrl: open.redirectUrl } : null}>
            <details className="group rounded-lg border border-line bg-surface">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink-soft">
                <span className="min-w-0 truncate">Détail : {title}</span><span className="shrink-0 text-[0.8125rem] font-normal text-green group-open:hidden">Voir</span>
              </summary>
              <div className="border-t border-line px-4 py-3">
                <QuoteLines lines={lines} total={order.total} />
                {order.campaign && <p className="mt-3 text-[0.8125rem]"><Link href={order.campaign.mode === "EXPERT" ? `/app/expert/${order.campaign.id}` : `/app/creer/${order.campaign.id}`} className="font-medium text-green hover:underline">Modifier la campagne</Link></p>}
              </div>
            </details>
          </Checkout>
        ) : (
          <section aria-label="Détail de la commande">
            <Card>
              <CardHeader title={order.boost ? "Détail du prix" : title} description={order.boost || order.serviceLabel === title ? undefined : order.serviceLabel} />
              <CardBody>
                <QuoteLines lines={lines} total={order.total} totalLabel={isPaid ? "Total payé" : "Total à payer"} />
                {order.invoiceNumber && <p className="mt-4 text-xs text-muted">Reçu n° <span className="font-mono">{order.invoiceNumber}</span></p>}
              </CardBody>
            </Card>
          </section>
        )}

        {order.status === "PENDING" && !mode.available && <Notice tone="danger" title="Paiement indisponible">Votre commande est conservée. Contactez le support.</Notice>}

          {(order.status === "CANCELLED" || order.status === "EXPIRED") && (
            <Notice tone="info" title={order.status === "CANCELLED" ? "Commande annulée" : "Commande expirée"}>
              {order.boost ? <Link className="font-medium underline" href="/app/booster">Passer une nouvelle commande</Link>
                : order.campaign && order.campaign.status === "DRAFT" ? <><Link className="font-medium underline" href={order.campaign.mode === "EXPERT" ? `/app/expert/${order.campaign.id}` : `/app/creer/${order.campaign.id}`}>Reprendre la campagne</Link></> : "Créez une nouvelle campagne."}
            </Notice>
          )}

          {order.refunds.length > 0 && (
            <Card>
              <CardHeader title="Remboursements" />
              <ul className="divide-y divide-line">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-sm">
                    <span><span className="tnum font-medium">{formatFcfa(r.amount)}</span><span className="block text-[0.8125rem] text-muted">{r.reason}{r.reference ? ` · réf. ${r.reference}` : ""}</span></span>
                    <StateIcon kind="refund" value={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {order.payments.length > 0 && (
            <details className="group rounded-lg border border-line bg-surface">
              <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-ink sm:px-5">
                Tentatives<span className="tnum text-[0.8125rem] font-normal text-muted">{order.payments.length}</span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                    {p.operator ? <OperatorChip operator={p.operator as OperatorCode} /> : <span className="flex h-7 min-w-12 items-center justify-center rounded-md bg-sand text-ink-soft"><CreditCard className="size-4" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="tnum block text-ink">{p.phone ? `${maskPhone(p.phone)} · ` : ""}{formatFcfa(p.amount)}</span>
                      <span className="block truncate text-xs text-muted">{formatDateTime(p.createdAt)}{p.providerRef ? ` · réf. ${p.providerRef}` : ""}{p.duplicate ? " · doublon, remboursement en cours" : ""}</span>
                    </span>
                    <StateIcon kind="payment" value={p.status} />
                  </li>
                ))}
              </ul>
            </details>
          )}
      </div>
    </>
  );
}
