import { canReadAsset } from "@/lib/assets/service";
import { getSessionUser } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  const asset = await canReadAsset(user, id);
  if (!asset) return new Response("Introuvable", { status: 404 });
  const bytes = await getStorage().get(asset.storageKey);
  if (!bytes) return new Response("Fichier indisponible", { status: 404 });
  const download = new URL(request.url).searchParams.has("telecharger");
  const inline = asset.kind !== "DOCUMENT" || asset.mime === "application/pdf";
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download || !inline ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
