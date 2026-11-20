// Diagnostic temporaire (lecture seule) : réglages, webhooks et derniers paiements FedaPay, écrit dans le journal de build.
// Aucun nom, e-mail, numéro complet ni clé n'est affiché.
import "dotenv/config";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";
import { getConfig } from "../src/lib/config";

const BASES = { live: "https://api.fedapay.com/v1", sandbox: "https://sandbox-api.fedapay.com/v1" } as const;
const TEST = ["64000001", "66000001"];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const kind = (k: string, p: string) => (!k ? "absente" : k.startsWith(`${p}_live_`) ? "live" : k.startsWith(`${p}_sandbox_`) ? "sandbox" : `autre(debut=${k.slice(0, 3)},longueur=${k.length})`);
const out = (s: string) => console.log(`[diag3] ${s}`);

function mask(v: unknown, key = ""): unknown {
  if (typeof v === "string" || typeof v === "number") {
    const s = String(v);
    const digits = s.replace(/\D/g, "");
    if (/phone|msisdn|tel|number/i.test(key) || /^\+?[\d\s]{8,}$/.test(s)) return `<${digits.length} chiffres, debut=${digits.slice(0, Math.max(0, digits.length - 8)) || "-"}, numero_essai=${TEST.some((t) => digits.endsWith(t))}>`;
    if (/mail|name|token|key|url|secret|address|ip/i.test(key)) return "<masque>";
    return s.slice(0, 120);
  }
  if (Array.isArray(v)) return v.slice(0, 5).map((x) => mask(x, key));
  if (isRecord(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x, k)]));
  return v;
}

async function main() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return;
  out(`maintenant=${new Date().toISOString()} site=${env.appUrl}`);
  const c = await getConfig();
  out(`prestataire=${c.paymentProvider} mode=${c.fedapayEnv} cle_secrete=${kind(c.fedapaySecretKey, "sk")} cle_publique=${kind(c.fedapayPublicKey, "pk")} secret_webhook=${c.fedapayWebhookSecret ? `oui(debut=${c.fedapayWebhookSecret.slice(0, 3)},longueur=${c.fedapayWebhookSecret.length},espaces=${/\s/.test(c.fedapayWebhookSecret)})` : "non"} simulation_autorisee=${c.allowSandboxPayments}`);
  out(`espaces_dans_cle_secrete=${/\s/.test(c.fedapaySecretKey)}`);

  const keys = await db.appKey.findMany({ select: { name: true, updatedAt: true }, orderBy: { updatedAt: "desc" } });
  out(`cles enregistrees : ${keys.map((k) => `${k.name}@${k.updatedAt.toISOString()}`).join(" ; ") || "aucune"}`);
  const audits = await db.auditLog.findMany({ where: { action: { startsWith: "keys." } }, orderBy: { createdAt: "desc" }, take: 14, select: { action: true, meta: true, createdAt: true } });
  for (const a of audits) out(`journal ${a.createdAt.toISOString()} ${a.action} ${JSON.stringify(a.meta).slice(0, 260)}`);

  const call = async (mode: "live" | "sandbox", path: string) => {
    const res = await fetch(`${BASES[mode]}${path}`, { headers: { Authorization: `Bearer ${c.fedapaySecretKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    return { status: res.status, json: (await res.json().catch(() => null)) as unknown };
  };
  const listOf = (json: unknown) => (Array.isArray(json) ? json : isRecord(json) ? (Object.values(json).find(Array.isArray) as unknown[] | undefined) : undefined);
  const mine = `${env.appUrl}/api/webhooks/payments/fedapay`;
  out(`adresse attendue du webhook : ${mine}`);

  if (c.fedapaySecretKey) {
    for (const mode of ["live", "sandbox"] as const) {
      try {
        const { status, json } = await call(mode, "/webhooks");
        const list = listOf(json);
        out(`GET /webhooks cote ${mode}${mode === c.fedapayEnv ? " (mode regle)" : ""} : HTTP ${status} ${list ? `${list.length} webhook(s)` : JSON.stringify(mask(json)).slice(0, 200)}`);
        for (const w of list ?? []) if (isRecord(w)) out(`   url=${String(w.url)} actif=${String(w.enabled)} identique=${String(w.url).replace(/\/+$/, "").toLowerCase() === mine.toLowerCase()} desactive_si_erreur=${String(w.disable_on_error)} maj=${String(w.updated_at)}`);
      } catch (error) { out(`GET /webhooks cote ${mode} : ${(error as Error).message}`); }
    }
    for (const path of ["/accounts", "/balances", "/events?per_page=12", "/logs?per_page=12"]) {
      try {
        const { status, json } = await call(c.fedapayEnv, path);
        const list = listOf(json);
        out(`GET ${path} : HTTP ${status} ${list ? `${list.length} element(s)` : JSON.stringify(mask(json)).slice(0, 300)}`);
        for (const item of (list ?? []).slice(0, 12)) out(`   ${JSON.stringify(mask(item)).slice(0, 700)}`);
      } catch (error) { out(`GET ${path} : ${(error as Error).message}`); }
    }
  }

  const week = new Date(Date.now() - 7 * 86_400_000);
  const events = await db.paymentEvent.findMany({ where: { receivedAt: { gte: week } }, orderBy: { receivedAt: "desc" }, take: 25, select: { provider: true, type: true, signatureValid: true, outcome: true, receivedAt: true } });
  out(`notifications recues sur 7 jours : ${events.length}`);
  for (const e of events) out(`   ${e.receivedAt.toISOString()} ${e.provider} ${e.type} signature=${e.signatureValid ? "ok" : "refusee"} resultat=${e.outcome ?? "-"}`);

  const orders = await db.order.findMany({ where: { createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 12, select: { reference: true, status: true, total: true, createdAt: true, _count: { select: { payments: true } } } });
  for (const o of orders) out(`commande ${o.createdAt.toISOString()} ${o.reference} ${o.total}F statut=${o.status} paiements=${o._count.payments}`);

  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" }, take: 12,
    select: { provider: true, amount: true, status: true, providerRef: true, providerStatus: true, failureReason: true, operator: true, createdAt: true, lastCheckedAt: true, redirectUrl: true, order: { select: { reference: true, status: true } } },
  });
  let asked = 0;
  for (const p of payments) {
    out(`paiement ${p.createdAt.toISOString()} ${p.order.reference} commande=${p.order.status} ${p.provider} ${p.amount}F statut=${p.status} fedapay="${p.providerStatus ?? ""}" operateur=${p.operator ?? "-"} ref=${p.providerRef ?? "-"} relu=${p.lastCheckedAt?.toISOString() ?? "-"} page=${p.redirectUrl ? new URL(p.redirectUrl).host : "-"} motif="${p.failureReason ?? ""}"`);
    if (p.provider !== "fedapay" || !p.providerRef || !c.fedapaySecretKey || asked >= 6) continue;
    asked++;
    const mode = p.redirectUrl?.includes("sandbox") ? "sandbox" as const : p.redirectUrl ? "live" as const : c.fedapayEnv;
    try {
      const { status, json } = await call(mode, `/transactions/${encodeURIComponent(p.providerRef)}`);
      const t = (isRecord(json) ? json["v1/transaction"] ?? json.transaction ?? json : null) as Record<string, unknown> | null;
      if (status !== 200 || !isRecord(t)) { out(`   FedaPay(${mode}) HTTP ${status} ${JSON.stringify(mask(json)).slice(0, 200)}`); continue; }
      const pick = ["status", "mode", "last_error_code", "amount", "created_at", "approved_at", "canceled_at", "declined_at", "fees", "amount_debited", "payment_method_id"];
      out(`   FedaPay(${mode}) ${pick.filter((k) => t[k] !== undefined && t[k] !== null).map((k) => `${k}=${JSON.stringify(t[k])}`).join(" ")}`);
      out(`   metadata=${JSON.stringify(mask(t.metadata)).slice(0, 600)}`);
    } catch (error) { out(`   FedaPay injoignable : ${(error as Error).message}`); }
  }
}

main().catch((error) => out(`échec : ${(error as Error).message}`)).finally(() => process.exit(0));
