import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getStorage, s3Configured } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Clé du contrôle approfondi, dérivée du secret de l'application : jamais le secret lui-même. */
const diagnosticKey = () => createHmac("sha256", env.appSecret).update("health:storage").digest("hex").slice(0, 24);

/** Message d'erreur court, sans adresse signée ni identifiant. */
function describe(error: unknown) {
  const e = error as Error & { code?: string; cause?: { code?: string; message?: string } };
  const cause = e.cause ? ` — cause : ${e.cause.code ?? ""} ${e.cause.message ?? ""}` : "";
  return `${e.name ?? "Erreur"}${e.code ? ` ${e.code}` : ""} : ${e.message ?? String(error)}${cause}`
    .replace(/https?:\/\/\S+/g, "[adresse]").replace(/\s+/g, " ").slice(0, 320);
}

class Rollback extends Error {}

/**
 * Contrôle approfondi : rejoue, depuis le serveur en production, chaque étape d'un envoi de fichier
 * (écriture, relecture, envoi par adresse signée, fiche en base) et indique laquelle échoue.
 */
async function storageReport() {
  const steps: Record<string, string> = {};
  const step = async (label: string, run: () => Promise<string | void>) => {
    const started = Date.now();
    try { steps[label] = `ok${(await run()) ?? ""} (${Date.now() - started} ms)`; }
    catch (error) { steps[label] = `ÉCHEC — ${describe(error)}`; }
  };

  steps.pilote = `${env.storageDriver}${env.storageDriver === "s3" ? (s3Configured() ? ", configuration complète" : ", configuration INCOMPLÈTE") : ""}`;
  const key = `verification/rt-${Date.now().toString(36)}.jpg`;
  const directKey = `verification/rt-${Date.now().toString(36)}-direct.mp4`;
  // Faux JPEG de 300 ko : même ordre de grandeur qu'une photo réduite par le navigateur.
  const bytes = new Uint8Array(300 * 1024);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);

  await step("ecriture", async () => { await getStorage().put(key, bytes, "image/jpeg"); });
  await step("lecture", async () => {
    const read = await getStorage().get(key);
    if (!read || read.byteLength !== bytes.byteLength) throw new Error(`taille relue : ${read?.byteLength ?? "aucune"}`);
  });
  await step("envoi_par_adresse_signee", async () => {
    const direct = getStorage().direct;
    if (!direct) return " (non proposé par ce pilote)";
    const url = await direct.presignPut(directKey, 120);
    const put = await fetch(url, { method: "PUT", body: bytes, headers: { "Content-Type": "video/mp4" } });
    if (!put.ok) throw new Error(`HTTP ${put.status}`);
    const found = await direct.head(directKey, 64 * 1024);
    if (!found || found.size !== bytes.byteLength) throw new Error(`relecture partielle : ${found ? found.size : "introuvable"}`);
  });
  await step("suppression", async () => {
    await getStorage().delete(key);
    await getStorage().delete(directKey);
  });
  await step("base_lecture", async () => {
    const [count] = await Promise.all([db.asset.count(), db.asset.findFirst()]);
    return ` — ${count} fichier(s)`;
  });
  await step("base_ecriture", async () => {
    const owner = await db.user.findFirst({ select: { id: true } });
    if (!owner) return " (aucun compte)";
    // La fiche est créée puis annulée : rien ne reste en base.
    try {
      await db.$transaction(async (tx) => {
        await tx.asset.create({ data: { ownerId: owner.id, kind: "IMAGE", source: "UPLOAD", mime: "image/jpeg", size: bytes.byteLength, name: "Contrôle", width: 1, height: 1, format: null, storageKey: key } });
        throw new Rollback();
      });
    } catch (error) { if (!(error instanceof Rollback)) throw error; }
  });
  await step("limiteur", async () => { await rateLimit("health:probe", 1000, 3600); });
  return steps;
}

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("controle");
  if (asked) {
    const expected = Buffer.from(diagnosticKey());
    const given = Buffer.from(asked);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ status: "forbidden" }, { status: 403 });
    if (!(await rateLimit("health:storage", 30, 3600).catch(() => true))) return NextResponse.json({ status: "rate_limited" }, { status: 429 });
    const stockage = await storageReport();
    const failed = Object.values(stockage).some((v) => v.startsWith("ÉCHEC"));
    return NextResponse.json({ status: failed ? "storage_failing" : "ok", node: process.version, region: process.env.VERCEL_REGION ?? null, stockage }, { status: failed ? 503 : 200 });
  }
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "database_unreachable" }, { status: 503 });
  }
}
