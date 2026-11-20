// Diagnostic temporaire (lecture seule) : état des derniers paiements FedaPay, écrit dans le journal de build.
// Aucun nom, e-mail, numéro ni clé n'est affiché.
import "dotenv/config";
import { db } from "../src/lib/db";
import { getConfig } from "../src/lib/config";

const kind = (k: string, p: string) => (!k ? "absente" : k.startsWith(`${p}_live_`) ? "live" : k.startsWith(`${p}_sandbox_`) ? "sandbox" : "autre");
const BASES = { live: "https://api.fedapay.com/v1", sandbox: "https://sandbox-api.fedapay.com/v1" } as const;

async function main() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return;
  const c = await getConfig();
  console.log(`[diag] prestataire=${c.paymentProvider} mode=${c.fedapayEnv} cle_secrete=${kind(c.fedapaySecretKey, "sk")} cle_publique=${kind(c.fedapayPublicKey, "pk")} secret_webhook=${c.fedapayWebhookSecret ? "oui" : "non"} simulation_autorisee=${c.allowSandboxPayments}`);
  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" }, take: 10,
    select: { provider: true, amount: true, status: true, providerRef: true, providerStatus: true, failureReason: true, operator: true, createdAt: true, lastCheckedAt: true, redirectUrl: true, order: { select: { reference: true, status: true } } },
  });
  let asked = 0;
  for (const p of payments) {
    console.log(`[diag] ${p.createdAt.toISOString()} ${p.order.reference} commande=${p.order.status} ${p.provider} ${p.amount}F statut=${p.status} fedapay="${p.providerStatus ?? ""}" operateur=${p.operator ?? "-"} ref=${p.providerRef ?? "-"} relu=${p.lastCheckedAt?.toISOString() ?? "-"} page=${p.redirectUrl ? new URL(p.redirectUrl).host : "-"} motif="${p.failureReason ?? ""}"`);
    if (p.provider !== "fedapay" || !p.providerRef || !c.fedapaySecretKey || asked >= 5) continue;
    asked++;
    try {
      const res = await fetch(`${BASES[c.fedapayEnv]}/transactions/${encodeURIComponent(p.providerRef)}`, { headers: { Authorization: `Bearer ${c.fedapaySecretKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const t = (json?.["v1/transaction"] ?? json?.transaction ?? json) as Record<string, unknown> | null;
      if (!res.ok || !t) { console.log(`[diag]    FedaPay HTTP ${res.status} ${JSON.stringify(json).slice(0, 300)}`); continue; }
      const pick = ["status", "mode", "last_error_code", "amount", "operation", "created_at", "updated_at", "approved_at", "canceled_at", "declined_at", "fees", "fixed_commission", "commission", "amount_debited"];
      console.log(`[diag]    FedaPay ${pick.filter((k) => t[k] !== undefined && t[k] !== null).map((k) => `${k}=${JSON.stringify(t[k])}`).join(" ")}`);
      console.log(`[diag]    champs: ${Object.keys(t).join(",")}`);
    } catch (error) {
      console.log(`[diag]    FedaPay injoignable : ${(error as Error).message}`);
    }
  }
  const week = new Date(Date.now() - 7 * 86_400_000);
  const events = await db.paymentEvent.findMany({ where: { provider: "fedapay", receivedAt: { gte: week } }, orderBy: { receivedAt: "desc" }, take: 12, select: { type: true, signatureValid: true, outcome: true, receivedAt: true } });
  console.log(`[diag] notifications FedaPay sur 7 jours : ${events.length}`);
  for (const e of events) console.log(`[diag]    ${e.receivedAt.toISOString()} ${e.type} signature=${e.signatureValid ? "ok" : "refusee"} resultat=${e.outcome ?? "-"}`);
}

main().catch((error) => console.log(`[diag] échec : ${(error as Error).message}`)).finally(() => process.exit(0));
