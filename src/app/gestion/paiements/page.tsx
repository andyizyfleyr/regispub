import type { Metadata } from "next";
import { CreditCard, Undo2 } from "lucide-react";
import { OperatorChip } from "@/components/icons";
import { RefundDialog, ResolveRefund } from "@/components/staff/admin-panels";
import { FilterChips, hrefWith, PAGE_SIZE, pageOf, Pagination, SearchForm } from "@/components/staff/common";
import { ActionButton } from "@/components/ui/action-form";
import { StateIcon } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader, Table, TabsNav } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { paymentModeInfo } from "@/lib/payments/service";
import { formatPhone, groupDigits, maskPhone, type OperatorCode } from "@/lib/phone";
import { formatDateTime, formatFcfa } from "@/lib/utils";
import { recheckPaymentAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Paiements" };

const STATUSES = [["SUCCEEDED", "Confirmés"], ["PENDING", "En attente"], ["FAILED", "Échoués"], ["EXPIRED", "Expirés"], ["CANCELLED", "Annulés"]] as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ vue?: string; statut?: string; q?: string; page?: string }> }) {
  const user = await requirePermission("payment.view");
  const sp = await searchParams;
  const refundsView = sp.vue === "remboursements";
  const canRefund = can(user.role, "payment.refund");
  const pendingRefunds = await db.refund.count({ where: { status: "REQUESTED" } });
  const mode = await paymentModeInfo();
  const base = "/gestion/paiements";

  return (
    <>
      <PageHeader title="Paiements" />
      {mode.mode === "test" && <Notice tone="warn" title={`${mode.providerLabel ?? "Paiement"} en mode test`} className="mb-5">Aucun argent réel n&apos;est encaissé{mode.testNumbers ? <> et seuls les numéros d&apos;essai {mode.testNumbers.map(groupDigits).join(" et ")} sont acceptés : tout autre numéro est refusé</> : null}. Pour encaisser, passez en mode « Réel » dans Paramètres, « Clés et connexions ».</Notice>}
      {mode.mode === "simulation" && <Notice tone="warn" title="Mode simulation" className="mb-5">Le simulateur de paiement est actif : ces transactions ne correspondent à aucun encaissement réel.</Notice>}
      <TabsNav current={refundsView ? "remboursements" : "paiements"} tabs={[{ id: "paiements", label: "Transactions", href: base }, { id: "remboursements", label: "Remboursements", href: `${base}?vue=remboursements`, count: pendingRefunds || undefined }]} />
      {refundsView ? <Refunds canRefund={canRefund} /> : <Transactions sp={sp} canRefund={canRefund} canVerify={can(user.role, "payment.verify")} showFullPhone={canRefund} />}
    </>
  );
}

async function Transactions({ sp, canRefund, canVerify, showFullPhone }: { sp: { statut?: string; q?: string; page?: string }; canRefund: boolean; canVerify: boolean; showFullPhone: boolean }) {
  const status = STATUSES.find(([id]) => id === sp.statut)?.[0];
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = pageOf(sp.page);
  const where = {
    ...(status ? { status: status === "PENDING" ? { in: ["PENDING" as const, "INITIATED" as const] } : status } : {}),
    ...(q ? { OR: [{ providerRef: { contains: q } }, { order: { reference: { contains: q.toUpperCase() } } }, { phone: { contains: q.replace(/\D/g, "") || "__" } }, { user: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } }, order: { select: { reference: true, status: true } }, refunds: { where: { status: { not: "REJECTED" } }, select: { amount: true } } } }),
    db.payment.count({ where }),
  ]);
  const params = { statut: status, q };
  const base = "/gestion/paiements";
  return (
    <>
      <div className="mb-4 space-y-3">
        <SearchForm action={base} q={q} placeholder="Référence, téléphone, client…" hidden={{ statut: status }} />
        <FilterChips current={status ?? "tous"} items={[{ id: "tous", label: "Tous", href: hrefWith(base, params, { statut: undefined, page: undefined }) }, ...STATUSES.map(([id, label]) => ({ id, label, href: hrefWith(base, params, { statut: id, page: undefined }) }))]} />
      </div>
      <Card>
        {rows.length ? (
          <>
            <Table head={["Transaction", "Client", "Numéro", "Montant", "Statut", ""]} mobileCorner={5}>
              {rows.map((p) => {
                const refundable = p.status === "SUCCEEDED" ? p.amount - p.refunds.reduce((s, r) => s + r.amount, 0) : 0;
                const open = p.status === "PENDING" || p.status === "INITIATED";
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="block font-mono text-[0.8125rem] text-ink">{p.order.reference}</span>
                      <span className="block text-xs text-muted">{formatDateTime(p.createdAt)} · {p.provider}{p.providerRef ? ` · ${p.providerRef}` : ""}{p.providerStatus ? ` · ${p.providerStatus}` : ""}</span>
                      {p.duplicate && <span className="block text-xs font-medium text-clay">Doublon : à rembourser</span>}
                      {p.failureReason && <span className="block max-w-64 truncate text-xs text-clay" title={p.failureReason}>{p.failureReason}</span>}
                    </td>
                    <td>{p.user.name}</td>
                    <td><span className="flex items-center gap-2"><OperatorChip operator={p.operator as OperatorCode} /><span className="tnum whitespace-nowrap text-[0.8125rem]">{showFullPhone ? formatPhone(p.phone) : maskPhone(p.phone)}</span></span></td>
                    <td className="tnum whitespace-nowrap font-medium">{formatFcfa(p.amount)}</td>
                    <td><StateIcon kind="payment" value={p.status} /></td>
                    <td className="text-right">
                      <span className="flex justify-end gap-2">
                        {canVerify && (open || p.status === "EXPIRED" || p.status === "FAILED" || p.status === "CANCELLED") && p.providerRef && <ActionButton variant="outline" size="sm" action={recheckPaymentAction.bind(null, p.id)} successMessage="Vérification effectuée auprès du prestataire.">Revérifier</ActionButton>}
                        {canRefund && refundable > 0 && <RefundDialog paymentId={p.id} max={refundable} label={`${p.order.reference} · ${p.user.name} · ${formatPhone(p.phone)}`} />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pagination page={page} total={total} base={base} params={params} />
          </>
        ) : <EmptyState icon={<CreditCard />} title="Aucun paiement" />}
      </Card>
    </>
  );
}

async function Refunds({ canRefund }: { canRefund: boolean }) {
  const rows = await db.refund.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { payment: { select: { phone: true, operator: true, duplicate: true } }, order: { select: { reference: true, user: { select: { name: true } } } } } });
  const staff = await db.user.findMany({ where: { id: { in: Array.from(new Set(rows.flatMap((r) => [r.requestedById, r.processedById]).filter((v): v is string => Boolean(v)))) } }, select: { id: true, name: true } });
  const names = new Map(staff.map((s) => [s.id, s.name]));
  return (
    <>
      <Notice tone="info" className="mb-5" title="Remboursement manuel">Le prestataire de paiement ne propose pas de remboursement automatique des paiements Mobile Money. Effectuez le transfert vers le numéro indiqué depuis votre compte marchand, puis saisissez sa référence pour clôturer le remboursement.</Notice>
      <Card>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="px-4 sm:px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink"><span className="tnum font-medium">{formatFcfa(r.amount)}</span> · {r.order.user.name} · <span className="font-mono text-[0.8125rem]">{r.order.reference}</span></p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-soft"><OperatorChip operator={r.payment.operator as OperatorCode} /><span className="tnum">{canRefund ? formatPhone(r.payment.phone) : maskPhone(r.payment.phone)}</span>{r.payment.duplicate && <span className="font-medium text-clay">paiement en double</span>}</p>
                    <p className="mt-1 text-ink-soft">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted">Créé le {formatDateTime(r.createdAt)} par {names.get(r.requestedById) ?? "le système"}{r.processedAt ? ` · traité le ${formatDateTime(r.processedAt)}${r.processedById ? ` par ${names.get(r.processedById) ?? "—"}` : ""}` : ""}{r.reference ? ` · réf. ${r.reference}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                  </div>
                  <StateIcon kind="refund" value={r.status} />
                </div>
                {r.status === "REQUESTED" && canRefund && <ResolveRefund refundId={r.id} />}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={<Undo2 />} title="Aucun remboursement" />}
      </Card>
    </>
  );
}
