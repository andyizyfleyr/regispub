import { can } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProviderById } from "@/lib/payments/registry";
import { PAYMENT_COUNTRIES, maskPhone } from "@/lib/phone";
import type { QuoteLine } from "@/lib/pricing/quote";
import { renderReceiptPdf } from "@/lib/receipt";
import { loadSettings } from "@/lib/settings";
import { isRecord } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { orderId } = await params;
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: true, campaign: { select: { name: true } }, payments: { where: { status: "SUCCEEDED", duplicate: false }, orderBy: { verifiedAt: "asc" }, take: 1 }, refunds: { where: { status: "PROCESSED" } } },
  });
  if (!order || (order.userId !== user.id && !can(user.role, "order.view"))) return new Response("Introuvable", { status: 404 });
  const payment = order.payments[0];
  // Un reçu n'existe que pour une commande dont le paiement a été vérifié.
  if (!order.invoiceNumber || !order.paidAt || !payment) return new Response("Aucun reçu : cette commande n'est pas payée.", { status: 409 });
  const quote = isRecord(order.quote) && Array.isArray(order.quote.lines) ? (order.quote.lines as QuoteLine[]) : [];
  const provider = getProviderById(payment.provider);
  const operator = PAYMENT_COUNTRIES[0]!.operators.find((o) => o.code === payment.operator)?.label ?? payment.operator;
  const pdf = await renderReceiptPdf({
    invoiceNumber: order.invoiceNumber, orderReference: order.reference, paidAt: order.paidAt,
    customer: { name: order.user.name, email: order.user.email, phone: order.user.phone },
    campaignName: order.campaign?.name ?? order.serviceLabel, lines: quote, total: order.total,
    payment: { operator, phone: maskPhone(payment.phone), providerLabel: provider?.label ?? payment.provider, providerRef: payment.providerRef, simulated: payment.provider === "sandbox" },
    refunds: order.refunds.map((r) => ({ amount: r.amount, processedAt: r.processedAt, reference: r.reference })),
  }, await loadSettings());
  return new Response(pdf as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="recu-${order.invoiceNumber}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
