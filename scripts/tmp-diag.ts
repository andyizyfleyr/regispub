// Diagnostic temporaire (lecture seule) : webhooks FedaPay et détail des dernières collectes, écrit dans le journal de build.
// Aucun nom, e-mail, numéro complet ni clé n'est affiché.
import "dotenv/config";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";
import { getConfig } from "../src/lib/config";

const BASES = { live: "https://api.fedapay.com/v1", sandbox: "https://sandbox-api.fedapay.com/v1" } as const;
const TEST = ["64000001", "66000001"];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Remplace tout ce qui ressemble à un numéro par sa longueur, son préfixe et « numéro d'essai ou non ». */
function mask(v: unknown, key = ""): unknown {
  if (typeof v === "string" || typeof v === "number") {
    const s = String(v);
    const digits = s.replace(/\D/g, "");
    if (/phone|msisdn|tel|number/i.test(key) || /^\+?[\d\s]{8,}$/.test(s)) return `<${digits.length} chiffres, prefixe=${digits.length > 8 ? digits.slice(0, digits.length - 8) : "-"}, numero_essai=${TEST.some((t) => digits.endsWith(t))}>`;
    if (/mail|name|token|key|url|secret/i.test(key)) return "<masque>";
    return s.slice(0, 80);
  }
  if (Array.isArray(v)) return v.map((x) => mask(x, key));
  if (isRecord(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x, k)]));
  return v;
}

async function main() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return;
  const c = await getConfig();
  if (!c.fedapaySecretKey) { console.log("[diag2] pas de clé FedaPay"); return; }
  const get = async (path: string) => {
    const res = await fetch(`${BASES[c.fedapayEnv]}${path}`, { headers: { Authorization: `Bearer ${c.fedapaySecretKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    return { status: res.status, json: (await res.json().catch(() => null)) as unknown };
  };

  const mine = `${env.appUrl}/api/webhooks/payments/fedapay`;
  console.log(`[diag2] adresse attendue du webhook : ${mine}`);
  try {
    const { status, json } = await get("/webhooks");
    const list = isRecord(json) ? (Object.values(json).find(Array.isArray) as unknown[] | undefined) : Array.isArray(json) ? json : undefined;
    console.log(`[diag2] GET /webhooks HTTP ${status} : ${list ? `${list.length} webhook(s)` : JSON.stringify(json).slice(0, 300)}`);
    for (const w of list ?? []) {
      if (!isRecord(w)) continue;
      console.log(`[diag2]    url=${String(w.url)} actif=${String(w.enabled)} identique=${String(w.url).replace(/\/+$/, "").toLowerCase() === mine.replace(/\/+$/, "").toLowerCase()} evenements=${JSON.stringify(w.entities ?? w.events ?? w.event_types ?? null).slice(0, 300)} champs=${Object.keys(w).join(",")}`);
    }
  } catch (error) { console.log(`[diag2] webhooks illisibles : ${(error as Error).message}`); }

  const payments = await db.payment.findMany({ where: { provider: "fedapay", providerRef: { not: null } }, orderBy: { createdAt: "desc" }, take: 4, select: { providerRef: true, status: true, createdAt: true, order: { select: { reference: true } } } });
  for (const p of payments) {
    try {
      const { status, json } = await get(`/transactions/${encodeURIComponent(p.providerRef!)}`);
      const t = (isRecord(json) ? json["v1/transaction"] ?? json.transaction ?? json : null) as Record<string, unknown> | null;
      if (status !== 200 || !isRecord(t)) { console.log(`[diag2] ${p.order.reference} ref=${p.providerRef} HTTP ${status}`); continue; }
      console.log(`[diag2] ${p.createdAt.toISOString()} ${p.order.reference} ref=${p.providerRef} chez_nous=${p.status} fedapay=${String(t.status)} mode=${String(t.mode)} last_error_code=${JSON.stringify(t.last_error_code)} payment_method_id=${JSON.stringify(t.payment_method_id)} flags=${JSON.stringify(mask(t.flags)).slice(0, 200)}`);
      console.log(`[diag2]    metadata=${JSON.stringify(mask(t.metadata)).slice(0, 900)}`);
    } catch (error) { console.log(`[diag2] ${p.order.reference} : ${(error as Error).message}`); }
  }
}

main().catch((error) => console.log(`[diag2] échec : ${(error as Error).message}`)).finally(() => process.exit(0));
