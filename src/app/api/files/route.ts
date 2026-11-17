import { NextResponse } from "next/server";
import { storeAsset } from "@/lib/assets/service";
import { getSessionUser } from "@/lib/auth/session";
import { DomainError, failureCode } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { isStaff } from "@/lib/auth/permissions";

const log = createLogger("files");
export const runtime = "nodejs";
export const maxDuration = 60;

/** Envoi d'un fichier (multipart). Les droits d'usage sont vérifiés au moment du rattachement à une campagne. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  if (!(await rateLimit(`upload:${user.id}`, 80, 3600))) return NextResponse.json({ error: "Trop d'envois en peu de temps. Réessayez plus tard." }, { status: 429 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Envoi illisible ou trop volumineux." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const source = isStaff(user.role) ? "STAFF" : "UPLOAD";
  try {
    const asset = await storeAsset({
      bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, name: String(form.get("name") || file.name), owner: user, source,
      format: typeof form.get("format") === "string" ? String(form.get("format")).slice(0, 30) : null,
    });
    return NextResponse.json({ asset: { id: asset.id, name: asset.name, kind: asset.kind, mime: asset.mime, width: asset.width, height: asset.height, format: asset.format } });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 400 });
    log.error("envoi de fichier en échec", { error });
    return NextResponse.json({ error: "L'envoi a échoué. Réessayez.", code: failureCode(error) }, { status: 500 });
  }
}
