import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Le corps brut est nécessaire à la vérification de signature : ne jamais le re-sérialiser.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const outcome = await handlePaymentWebhook(provider, raw, request.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
