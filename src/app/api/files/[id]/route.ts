import { canReadAsset } from "@/lib/assets/service";
import { getSessionUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { DIRECT_THRESHOLD_BYTES, getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  const asset = await canReadAsset(user, id);
  if (!asset) return new Response("Introuvable", { status: 404 });
  const download = new URL(request.url).searchParams.has("telecharger");
  const inline = asset.kind !== "DOCUMENT" || asset.mime === "application/pdf";
  const disposition = `${download || !inline ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.name)}`;
  let storage;
  try { storage = getStorage(); } catch (error) {
    if (error instanceof DomainError) return new Response("Fichier indisponible", { status: 503 });
    throw error;
  }
  // Fichiers volumineux (vidéos) : lecture directe depuis le stockage par une URL signée de courte durée,
  // après le contrôle d'accès ci-dessus. Permet aussi la lecture par plages (avance rapide d'une vidéo).
  if (storage.direct && asset.size > DIRECT_THRESHOLD_BYTES) {
    const url = await storage.direct.presignGet(asset.storageKey, 300, { contentType: asset.mime, disposition });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  }
  const bytes = await storage.get(asset.storageKey);
  if (!bytes) return new Response("Fichier indisponible", { status: 404 });
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
