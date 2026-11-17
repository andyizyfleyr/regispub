import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { can, canViewCampaign, type RoleName } from "@/lib/auth/permissions";
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
  source?: "UPLOAD" | "STUDIO" | "AI" | "STAFF"; format?: string | null; design?: unknown; businessId?: string | null;
};

/** Valide (type déclaré, signature binaire, taille) puis enregistre un fichier et sa fiche. */
export async function storeAsset(input: StoreInput) {
  const kind = kindForMime(input.mime);
  if (!kind) throw new DomainError("Type de fichier non accepté. Formats autorisés : JPG, PNG, WebP, MP4, MOV, WebM, PDF.");
  const rule = UPLOAD_RULES[kind];
  if (input.bytes.byteLength === 0) throw new DomainError("Le fichier est vide.");
  if (input.bytes.byteLength > rule.maxBytes) throw new DomainError(`Fichier trop volumineux (maximum ${Math.round(rule.maxBytes / 1024 / 1024)} Mo).`);
  if (!sniffMatches(input.mime, input.bytes)) throw new DomainError("Le contenu du fichier ne correspond pas à son type.");
  const ownerId = input.ownerId ?? input.owner.id;
  const count = await db.asset.count({ where: { ownerId } });
  if (count >= 500) throw new DomainError("Bibliothèque pleine (500 fichiers). Supprimez d'anciens fichiers pour continuer.");

  const key = `${ownerId}/${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${extensionFor(input.mime)}`;
  await getStorage().put(key, input.bytes, input.mime);
  const size = kind === "IMAGE" ? imageSize(input.bytes, input.mime) : null;
  return db.asset.create({
    data: {
      ownerId, businessId: input.businessId ?? null, kind, source: input.source ?? "UPLOAD", mime: input.mime, size: input.bytes.byteLength,
      name: input.name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, " ").trim().slice(0, 120) || "Fichier",
      width: size?.width ?? null, height: size?.height ?? null, format: input.format ?? null, storageKey: key, design: (input.design as never) ?? undefined,
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
