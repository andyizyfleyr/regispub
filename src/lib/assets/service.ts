import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { can, canViewCampaign, type RoleName } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { extensionFor, getStorage, kindForMime, sniffMatches, UPLOAD_RULES } from "@/lib/storage";

type Actor = { id: string; role: RoleName };

/** Dimensions d'une image PNG / JPEG / WebP lues dans l'en-tête (sans dépendance native). */
export function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime === "image/png") return { width: v.getUint32(16), height: v.getUint32(20) };
    if (mime === "image/webp") {
      const tag = String.fromCharCode(...bytes.subarray(12, 16));
      if (tag === "VP8X") return { width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)), height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) };
      if (tag === "VP8 ") return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
      if (tag === "VP8L") { const b = v.getUint32(21, true); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      return null;
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1]!;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
        i += 2 + v.getUint16(i + 2);
      }
    }
  } catch { /* en-tête tronqué */ }
  return null;
}

export type StoreInput = {
  bytes: Uint8Array; mime: string; name: string; owner: Actor; ownerId?: string;
  source?: "UPLOAD" | "STAFF"; format?: string | null; businessId?: string | null;
};

const MAX_ASSETS = 500;
const cleanName = (name: string) => name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, " ").trim().slice(0, 120) || "Fichier";
const newKey = (ownerId: string, mime: string) => `${ownerId}/${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${extensionFor(mime)}`;

function checkDeclared(mime: string, size: number) {
  const kind = kindForMime(mime);
  if (!kind) throw new DomainError("Type de fichier non accepté. Formats autorisés : JPG, PNG, WebP, MP4, MOV, WebM, PDF.");
  const rule = UPLOAD_RULES[kind];
  if (!Number.isInteger(size) || size <= 0) throw new DomainError("Le fichier est vide.");
  if (size > rule.maxBytes) throw new DomainError(`Fichier trop volumineux (maximum ${Math.round(rule.maxBytes / 1024 / 1024)} Mo).`);
  return kind;
}

async function checkQuota(ownerId: string) {
  if ((await db.asset.count({ where: { ownerId } })) >= MAX_ASSETS) throw new DomainError("Bibliothèque pleine (500 fichiers). Supprimez d'anciens fichiers pour continuer.");
}

/** Valide (type déclaré, signature binaire, taille) puis enregistre un fichier et sa fiche. */
export async function storeAsset(input: StoreInput) {
  const kind = checkDeclared(input.mime, input.bytes.byteLength);
  if (!sniffMatches(input.mime, input.bytes)) throw new DomainError("Le contenu du fichier ne correspond pas à son type.");
  const ownerId = input.ownerId ?? input.owner.id;
  await checkQuota(ownerId);

  const key = newKey(ownerId, input.mime);
  await getStorage().put(key, input.bytes, input.mime);
  const size = kind === "IMAGE" ? imageSize(input.bytes, input.mime) : null;
  return db.asset.create({
    data: {
      ownerId, businessId: input.businessId ?? null, kind, source: input.source ?? "UPLOAD", mime: input.mime, size: input.bytes.byteLength,
      name: cleanName(input.name),
      width: size?.width ?? null, height: size?.height ?? null, format: input.format ?? null, storageKey: key,
    },
  });
}

// ─────────────── Envoi direct vers le stockage (fichiers volumineux) ───────────────
// Le navigateur envoie le fichier au stockage avec une URL signée ; le serveur ne crée la fiche
// qu'après avoir relu l'objet (taille réelle, signature binaire). Le « ticket » signé lie les deux étapes.

type Ticket = { k: string; o: string; m: string; s: number; n: string; src: "UPLOAD" | "STAFF"; f: string | null; e: number };
const DIRECT_TTL_SECONDS = 15 * 60;
const signTicket = (body: string) => createHmac("sha256", env.appSecret).update(`upload:${body}`).digest("base64url");

export function directUploadAvailable() {
  try { return Boolean(getStorage().direct); } catch { return false; }
}

export async function beginDirectUpload(input: { owner: Actor; mime: string; size: number; name: string; source: Ticket["src"]; format?: string | null }) {
  const direct = getStorage().direct;
  if (!direct) return null;
  checkDeclared(input.mime, input.size);
  await checkQuota(input.owner.id);
  const key = newKey(input.owner.id, input.mime);
  const ticket: Ticket = { k: key, o: input.owner.id, m: input.mime, s: input.size, n: cleanName(input.name), src: input.source, f: input.format ?? null, e: Math.floor(Date.now() / 1000) + DIRECT_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return { url: await direct.presignPut(key, DIRECT_TTL_SECONDS), ticket: `${body}.${signTicket(body)}` };
}

export async function completeDirectUpload(owner: Actor, rawTicket: string, design?: unknown) {
  const [body, sig] = rawTicket.split(".");
  const expected = body ? Buffer.from(signTicket(body)) : null;
  const given = Buffer.from(sig ?? "");
  if (!body || !expected || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new DomainError("Envoi invalide. Recommencez.");
  const t = JSON.parse(Buffer.from(body, "base64url").toString()) as Ticket;
  if (t.o !== owner.id || t.e < Math.floor(Date.now() / 1000)) throw new DomainError("Envoi expiré. Recommencez.");
  const storage = getStorage();
  if (!storage.direct) throw new DomainError("Envoi direct indisponible.");
  const already = await db.asset.findUnique({ where: { storageKey: t.k } });
  if (already) return already;

  const found = await storage.direct.head(t.k, 256 * 1024);
  if (!found) throw new DomainError("Le fichier n'est pas arrivé. Vérifiez votre connexion et recommencez.");
  const reject = async (message: string) => { await storage.delete(t.k).catch(() => undefined); throw new DomainError(message); };
  // La taille et le contenu sont relus côté stockage : les valeurs annoncées par le navigateur ne font pas foi.
  const kind = kindForMime(t.m)!;
  if (found.size > UPLOAD_RULES[kind].maxBytes) await reject(`Fichier trop volumineux (maximum ${Math.round(UPLOAD_RULES[kind].maxBytes / 1024 / 1024)} Mo).`);
  if (!sniffMatches(t.m, found.head)) await reject("Le contenu du fichier ne correspond pas à son type.");
  await checkQuota(owner.id);
  const dims = kind === "IMAGE" ? imageSize(found.head, t.m) : null;
  return db.asset.create({
    data: {
      ownerId: owner.id, kind, source: t.src, mime: t.m, size: found.size, name: t.n, width: dims?.width ?? null, height: dims?.height ?? null,
      format: t.f, storageKey: t.k, design: (design as never) ?? undefined,
    },
  });
}

/** Un fichier est lisible par son propriétaire et par les collaborateurs ayant accès à une campagne qui l'utilise. */
export async function canReadAsset(actor: Actor, assetId: string) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: { campaignLinks: { select: { campaign: { select: { userId: true, managerId: true, designerId: true } } } } },
  });
  if (!asset) return null;
  if (asset.ownerId === actor.id) return asset;
  if (actor.role === "CLIENT") return asset.campaignLinks.some((l) => l.campaign.userId === actor.id) ? asset : null;
  if (can(actor.role, "campaign.view_all") && (asset.campaignLinks.length > 0 || can(actor.role, "user.view"))) return asset;
  return asset.campaignLinks.some((l) => canViewCampaign(actor, l.campaign)) ? asset : null;
}

export async function deleteAsset(actor: Actor, assetId: string) {
  const asset = await db.asset.findFirst({ where: { id: assetId, ownerId: actor.id }, include: { campaignLinks: { select: { campaign: { select: { status: true } } } } } });
  if (!asset) throw new DomainError("Fichier introuvable.");
  if (asset.campaignLinks.some((l) => !["DRAFT", "CANCELLED"].includes(l.campaign.status))) throw new DomainError("Ce fichier est utilisé par une campagne commandée : il ne peut pas être supprimé.");
  await db.asset.delete({ where: { id: asset.id } });
  await getStorage().delete(asset.storageKey).catch(() => undefined);
}
