import { after, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { processPaymentEvent, receivePaymentWebhook } from "@/lib/payments/service";

const log = createLogger("webhook");
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Notifications des prestataires de paiement. Comme le demande FedaPay : la signature est contrôlée, la notification
 * enregistrée, la réponse 2xx envoyée aussitôt ; le traitement (relecture de la transaction, encaissement) vient après.
 * S'il échoue, la notification reste « à traiter » et la tâche planifiée la reprend.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  // Le corps brut est nécessaire à la vérification de signature : ne jamais le re-sérialiser.
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const receipt = await receivePaymentWebhook(provider, raw, request.headers);
  const pending = receipt.pending;
  if (pending) {
    after(async () => {
      try {
        await processPaymentEvent(pending.providerId, pending.eventKey);
      } catch (error) {
        log.error("traitement d'une notification de paiement en échec, reprise par la tâche planifiée", { error, ...pending });
      }
    });
  }
  return NextResponse.json(receipt.body, { status: receipt.status });
}
