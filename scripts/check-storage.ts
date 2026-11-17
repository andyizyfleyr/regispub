// Contrôle du stockage de fichiers lors d'un déploiement : écrit, relit et supprime un petit objet témoin,
// puis vérifie les adresses signées et la règle CORS dont le navigateur a besoin pour l'envoi direct.
// Ne bloque jamais le déploiement : le résultat est écrit dans le journal de build.
// À lancer avec : tsx --conditions=react-server scripts/check-storage.ts
import "dotenv/config";
import { env } from "../src/lib/env";
import { getStorage, s3Configured } from "../src/lib/storage";

let failures = 0;
async function step(label: string, run: () => Promise<string | void>) {
  try {
    const detail = await run();
    console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    failures++;
    console.log(`  ✗ ${label} : ${(error as Error).message}`);
  }
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const stage = process.env.VERCEL_ENV;
  if (stage && stage !== "production") return;
  if (env.storageDriver !== "s3") { console.log("Stockage : aucun bucket configuré, l'envoi de fichiers reste désactivé."); return; }
  if (!s3Configured()) { console.log("Stockage : ✗ configuration S3 incomplète (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)."); return; }

  console.log(`Stockage : contrôle du bucket « ${env.s3.bucket} »`);
  const storage = getStorage();
  const direct = storage.direct;
  const key = `verification/${Date.now().toString(36)}.txt`;
  const directKey = `verification/${Date.now().toString(36)}-direct.txt`;
  const text = "regispub";
  const bytes = new TextEncoder().encode(text);

  await step("écriture", () => storage.put(key, bytes, "text/plain"));
  await step("lecture", async () => {
    const read = await storage.get(key);
    assert(read && new TextDecoder().decode(read) === text, "le contenu relu ne correspond pas");
  });
  if (direct) {
    await step("lecture par adresse signée", async () => {
      const url = await direct.presignGet(key, 120, { contentType: "text/plain", disposition: "inline; filename*=UTF-8''t%C3%A9moin.txt" });
      const res = await fetch(url);
      assert(res.ok, `HTTP ${res.status}`);
      assert((await res.text()) === text, "le contenu relu ne correspond pas");
      return `type renvoyé : ${res.headers.get("content-type")}`;
    });
    await step("envoi par adresse signée", async () => {
      const url = await direct.presignPut(directKey, 120);
      const res = await fetch(url, { method: "PUT", body: bytes, headers: { "Content-Type": "text/plain" } });
      assert(res.ok, `HTTP ${res.status}`);
      const found = await direct.head(directKey, 64);
      assert(found && found.size === bytes.byteLength, "l'objet envoyé est introuvable ou de taille différente");
    });
    await step(`règle CORS pour ${env.appUrl}`, async () => {
      // Même requête préalable que celle d'un navigateur avant l'envoi direct d'un gros fichier.
      const url = await direct.presignPut(directKey, 120);
      const res = await fetch(url, { method: "OPTIONS", headers: { Origin: env.appUrl, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
      const allowed = res.headers.get("access-control-allow-origin");
      assert(res.ok && (allowed === env.appUrl || allowed === "*"), `le bucket n'autorise pas cette origine (HTTP ${res.status}) — ajoutez la règle CORS décrite dans docs/07-deploiement.md`);
      const methods = res.headers.get("access-control-allow-methods") ?? "";
      assert(/PUT/i.test(methods), `la méthode PUT n'est pas autorisée (méthodes : ${methods || "aucune"})`);
    });
  }
  await step("suppression", async () => {
    await storage.delete(key);
    await storage.delete(directKey);
    assert((await storage.get(key)) === null, "l'objet témoin existe encore");
  });
  console.log(failures ? `Stockage : ${failures} contrôle(s) en échec — l'envoi de fichiers ne fonctionnera pas correctement.` : "Stockage : opérationnel.");
}

main().catch((error) => { console.log(`Stockage : contrôle impossible : ${(error as Error).message}`); });
