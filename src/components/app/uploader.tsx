"use client";

import * as React from "react";
import { FileText, Film, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UploadedAsset = { id: string; name: string; kind: string; mime: string; width: number | null; height: number | null; format: string | null };

const ACCEPT = { media: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm", image: "image/jpeg,image/png,image/webp", any: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf", csv: "text/csv,.csv" };
// Les photos sont réduites avant l'envoi : on accepte donc des originaux plus lourds que la limite du serveur (8 Mo).
const MAX = { image: 25, video: 60, other: 10 };

/** Au-delà de cette taille, le fichier part directement vers le stockage (les fonctions serverless refusent les corps de plus de 4,5 Mo). */
const DIRECT_THRESHOLD = 4 * 1024 * 1024;
const SHRINK_ABOVE = 1.5 * 1024 * 1024;
const MAX_SIDE = 2560;

/**
 * Réduit une photo lourde avant l'envoi (2 560 px au plus, JPEG) : l'envoi est plus rapide sur une connexion mobile
 * et les plateformes publicitaires n'exploitent pas une définition supérieure. Les PNG légers gardent leur transparence.
 */
async function shrinkImage(file: File | Blob, name: string): Promise<{ file: File | Blob; name: string }> {
  const keep = { file, name };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SHRINK_ABOVE || typeof createImageBitmap !== "function") return keep;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return keep;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return keep;
    return { file: blob, name: name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg" };
  } catch { return keep; }
}

type UploadResponse = { asset?: UploadedAsset; error?: string; code?: string } | null;
/** Message d'échec : celui du serveur avec sa référence, sinon le code de réponse (page d'erreur de l'hébergeur, coupure…). */
const failure = (res: Response, json: UploadResponse) =>
  json?.error ? (json.code ? `${json.error} (réf. ${json.code})` : json.error) : `L'envoi a échoué (réponse ${res.status} du serveur). Réessayez.`;
const NETWORK_ERROR = "Connexion interrompue pendant l'envoi. Vérifiez votre réseau et réessayez.";

async function postJson(body: unknown) {
  let res: Response;
  try { res = await fetch("/api/files/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch { throw new Error(NETWORK_ERROR); }
  return { res, json: (await res.json().catch(() => null)) as (UploadResponse & { url?: string; ticket?: string }) };
}

/** Envoi direct au stockage. Renvoie null si le serveur ne le propose pas (stockage local en développement). */
async function uploadDirect(file: File | Blob, name: string, extra: Record<string, string>): Promise<UploadedAsset | null> {
  const begin = await postJson({ step: "begin", name, mime: file.type, size: file.size, source: extra.source, format: extra.format ?? null });
  if (begin.res.status === 409) return null;
  if (!begin.res.ok || !begin.json?.url || !begin.json.ticket) throw new Error(failure(begin.res, begin.json));
  let put: Response;
  try { put = await fetch(begin.json.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } }); } catch { throw new Error(NETWORK_ERROR); }
  if (!put.ok) throw new Error(`Le stockage a refusé le fichier (réponse ${put.status}). Réessayez dans un instant.`);
  const done = await postJson({ step: "complete", ticket: begin.json.ticket, design: extra.design });
  if (!done.res.ok || !done.json?.asset) throw new Error(failure(done.res, done.json));
  return done.json.asset;
}

export async function uploadFile(input: File | Blob, extra: Record<string, string> = {}): Promise<UploadedAsset> {
  const { file, name } = await shrinkImage(input, extra.name ?? (input instanceof File ? input.name : "fichier"));
  if (file.size > DIRECT_THRESHOLD) {
    const asset = await uploadDirect(file, name, extra);
    if (asset) return asset;
  }
  const body = new FormData();
  body.set("file", file, name);
  for (const [k, v] of Object.entries(extra)) body.set(k, v);
  body.set("name", name);
  let res: Response;
  try { res = await fetch("/api/files", { method: "POST", body }); } catch { throw new Error(NETWORK_ERROR); }
  if (res.status === 413) throw new Error("Fichier trop volumineux pour être envoyé pour le moment.");
  const json = (await res.json().catch(() => null)) as UploadResponse;
  if (!res.ok || !json?.asset) throw new Error(failure(res, json));
  return json.asset;
}

/** Zone d'import : contrôle le type et le poids avant l'envoi (le serveur revérifie tout). */
export function Uploader({ accept = "media", multiple = true, onUploaded, label, hint, className, compact }: {
  accept?: keyof typeof ACCEPT; multiple?: boolean; onUploaded: (asset: UploadedAsset) => void | Promise<void>; label?: string; hint?: string; className?: string; compact?: boolean;
}) {
  const [busy, setBusy] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, 10)) {
      const limit = file.type.startsWith("image/") ? MAX.image : file.type.startsWith("video/") ? MAX.video : MAX.other;
      if (file.size > limit * 1024 * 1024) { toast.error(`${file.name} dépasse ${limit} Mo.`); continue; }
      setBusy((n) => n + 1);
      try { await onUploaded(await uploadFile(file)); }
      catch (e) { toast.error((e as Error).message); }
      finally { setBusy((n) => n - 1); }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <label
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void handle(e.dataTransfer.files); }}
      className={cn("flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper text-center transition-colors hover:border-green hover:bg-green-soft/40 focus-within:border-green", compact ? "gap-1 px-3 py-4" : "gap-1.5 px-4 py-7", className)}
    >
      <input ref={input} type="file" className="sr-only" accept={ACCEPT[accept]} multiple={multiple} onChange={(e) => void handle(e.target.files)} disabled={busy > 0} />
      {busy > 0 ? <LoaderCircle className="size-5 animate-spin text-green" /> : <Upload className="size-5 text-muted" />}
      <span className="text-sm font-medium text-ink">{busy > 0 ? "Envoi en cours…" : label ?? "Importer des fichiers"}</span>
      <span className="text-xs text-muted">{hint ?? "Images JPG, PNG ou WebP · Vidéos MP4 ou MOV (60 Mo)"}</span>
    </label>
  );
}

export function AssetThumb({ id, kind, name, className }: { id: string; kind: string; name: string; className?: string }) {
  if (kind === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${id}`} alt={name} loading="lazy" className={cn("size-full object-cover", className)} />;
  }
  return (
    <span className={cn("flex size-full flex-col items-center justify-center gap-1 bg-sand p-2 text-center text-muted", className)}>
      {kind === "VIDEO" ? <Film className="size-5" /> : <FileText className="size-5" />}
      <span className="line-clamp-2 text-[11px] leading-tight">{name}</span>
    </span>
  );
}
