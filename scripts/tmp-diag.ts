// Essai temporaire, mode test FedaPay uniquement : quels numéros d'essai la sandbox accepte-t-elle vraiment ?
// Crée trois collectes de test de 100 F (aucun argent réel) et lit leur état. Ne s'exécute jamais en mode réel.
import "dotenv/config";
import { getConfig } from "../src/lib/config";

const BASE = "https://sandbox-api.fedapay.com/v1";
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const out = (s: string) => console.log(`[essai] ${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return;
  const c = await getConfig();
  if (c.fedapayEnv !== "sandbox" || !c.fedapaySecretKey.startsWith("sk_sandbox_")) { out("mode réel ou clé non test : essai annulé"); return; }
  const call = async (method: "GET" | "POST", path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${c.fedapaySecretKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const json = (await res.json().catch(() => null)) as unknown;
    return { status: res.status, json: isRecord(json) ? json : {} };
  };
  const tx = (json: Record<string, unknown>) => (isRecord(json["v1/transaction"]) ? json["v1/transaction"] : isRecord(json.transaction) ? json.transaction : json) as Record<string, unknown>;

  for (const number of ["64000001", "0164000001", "0166000001", "66000001"]) {
    try {
      const created = await call("POST", "/transactions", {
        description: "RegisPub — essai technique du mode test", amount: 100, currency: { iso: "XOF" },
        merchant_reference: `essai-${Date.now()}-${number}`,
        customer: { firstname: "Essai", lastname: "Technique", email: "essai-technique@regispub.vercel.app" },
      });
      const id = tx(created.json).id;
      if (created.status >= 300 || id === undefined) { out(`${number} : création HTTP ${created.status} ${JSON.stringify(created.json).slice(0, 200)}`); continue; }
      const token = await call("POST", `/transactions/${String(id)}/token`);
      const paid = await call("POST", "/momo_test", { token: token.json.token, phone_number: { number, country: "bj" } });
      let status = "?", mode = "?", code: unknown = null;
      for (let i = 0; i < 6; i++) {
        await sleep(2000);
        const t = tx((await call("GET", `/transactions/${String(id)}`)).json);
        status = String(t.status); mode = String(t.mode); code = t.last_error_code;
        if (status !== "pending") break;
      }
      out(`numero=${number} transaction=${String(id)} paiement_http=${paid.status} statut_final=${status} mode=${mode} last_error_code=${JSON.stringify(code)}${paid.status >= 300 ? ` reponse=${JSON.stringify(paid.json).slice(0, 200)}` : ""}`);
    } catch (error) { out(`${number} : ${(error as Error).message}`); }
  }
}

main().catch((error) => out(`échec : ${(error as Error).message}`)).finally(() => process.exit(0));
