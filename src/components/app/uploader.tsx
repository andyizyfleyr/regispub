"use client";

import * as React from "react";
import { FileText, Film, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UploadedAsset = { id: string; name: string; kind: string; mime: string; width: number | null; height: number | null; format: string | null };

const ACCEPT = { media: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm", image: "image/jpeg,image/png,image/webp", any: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf", csv: "text/csv,.csv" };
const MAX = { image: 8, video: 60, other: 10 };

export async function uploadFile(file: File | Blob, extra: Record<string, string> = {}): Promise<UploadedAsset> {
  const body = new FormData();
  body.set("file", file, extra.name ?? (file instanceof File ? file.name : "fichier"));
  for (const [k, v] of Object.entries(extra)) body.set(k, v);
  let res: Response;
  try { res = await fetch("/api/files", { method: "POST", body }); } catch { throw new Error("Connexion interrompue pendant l'envoi. Vérifiez votre réseau et réessayez."); }
  const json = (await res.json().catch(() => null)) as { asset?: UploadedAsset; error?: string } | null;
  if (!res.ok || !json?.asset) throw new Error(json?.error ?? "L'envoi a échoué. Réessayez.");
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
      <span className="text-xs text-muted">{hint ?? "Images JPG, PNG ou WebP (8 Mo) · Vidéos MP4 ou MOV (60 Mo)"}</span>
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
