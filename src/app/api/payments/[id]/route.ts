import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { refreshPayment } from "@/lib/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Suivi d'un paiement en cours : déclenche une vérification auprès du prestataire (limitée en fréquence côté service). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const { id } = await params;
  const owned = await db.payment.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  await refreshPayment(id).catch(() => undefined);
  const p = await db.payment.findUniqueOrThrow({ where: { id }, select: { status: true, failureReason: true, expiresAt: true, order: { select: { status: true } } } });
  return NextResponse.json({ status: p.status, failureReason: p.failureReason, orderStatus: p.order.status, expiresAt: p.expiresAt });
}
