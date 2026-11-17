import { NextResponse } from "next/server";
import { z } from "zod";
import { beginDirectUpload, completeDirectUpload } from "@/lib/assets/service";
import { isStaff } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const log = createLogger("files");
export const runtime = "nodejs";

const beginSchema = z.object({
  step: z.literal("begin"), name: z.string().min(1).max(200), mime: z.string().min(3).max(80), size: z.number().int().positive(),
  source: z.string().max(20).optional(), format: z.string().max(30).nullish(),
});
const completeSchema = z.object({ step: z.literal("complete"), ticket: z.string().min(20).max(2000), design: z.string().max(20_000).optional() });

/**
 * Envoi direct d'un fichier volumineux vers le stockage, en deux temps :
 * « begin » renvoie une URL signée, « complete » relit l'objet envoyé et crée la fiche.
 * Répond 409 si le stockage ne permet pas l'envoi direct (le navigateur utilise alors POST /api/files).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  const json: unknown = await request.json().catch(() => null);
  try {
    const begin = beginSchema.safeParse(json);
    if (begin.success) {
      if (!(await rateLimit(`upload:${user.id}`, 80, 3600))) return NextResponse.json({ error: "Trop d'envois en peu de temps. Réessayez plus tard." }, { status: 429 });
      const source = begin.data.source === "STUDIO" ? "STUDIO" : isStaff(user.role) ? "STAFF" : "UPLOAD";
      const started = await beginDirectUpload({ owner: user, mime: begin.data.mime, size: begin.data.size, name: begin.data.name, source, format: begin.data.format ?? null });
      if (!started) return NextResponse.json({ error: "direct_unavailable" }, { status: 409 });
      return NextResponse.json(started);
    }
    const complete = completeSchema.safeParse(json);
    if (complete.success) {
      let design: unknown;
      if (complete.data.design) { try { design = JSON.parse(complete.data.design); } catch { /* ignoré */ } }
      const asset = await completeDirectUpload(user, complete.data.ticket, design);
      return NextResponse.json({ asset: { id: asset.id, name: asset.name, kind: asset.kind, mime: asset.mime, width: asset.width, height: asset.height, format: asset.format } });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 400 });
    log.error("envoi direct en échec", { error });
    return NextResponse.json({ error: "L'envoi a échoué. Réessayez." }, { status: 500 });
  }
}
