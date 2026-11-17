"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Ellipsis, PenLine, Trash2, Wand } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { AssetThumb, Uploader } from "@/components/app/uploader";
import { Badge } from "@/components/ui/badge";
import { deleteAssetAction, duplicateAssetAction, renameAssetAction } from "@/server/actions/assistant";

export type LibraryItem = { id: string; name: string; kind: string; source: string; format: string | null; hasDesign: boolean; createdAt: string; usedIn: number; width: number | null; height: number | null };

const SOURCE: Record<string, string> = { STUDIO: "Studio", UPLOAD: "Import", AI: "Image IA", STAFF: "Équipe" };
const item = "flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-[13.5px] text-ink-soft outline-none data-[highlighted]:bg-sand data-[highlighted]:text-ink";

export function LibraryGrid({ items }: { items: LibraryItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) toast.error(res.error ?? "Action impossible."); else { toast.success(done); router.refresh(); }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Uploader accept="any" onUploaded={() => router.refresh()} className="aspect-square" label="Importer" hint="Images, vidéos ou PDF" />
      {items.map((a) => (
        <figure key={a.id} className={`group relative overflow-hidden rounded-lg border border-line bg-surface ${busy === a.id ? "opacity-50" : ""}`}>
          <a href={`/api/files/${a.id}`} target="_blank" rel="noreferrer" className="block aspect-square bg-sand"><AssetThumb id={a.id} kind={a.kind} name={a.name} /></a>
          <figcaption className="flex items-start justify-between gap-2 p-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink" title={a.name}>{a.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1"><Badge>{SOURCE[a.source] ?? a.source}</Badge>{a.usedIn > 0 && <Badge tone="info">{a.usedIn} campagne{a.usedIn > 1 ? "s" : ""}</Badge>}</p>
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="-mr-1 rounded-md p-1.5 text-muted hover:bg-sand hover:text-ink" aria-label={`Actions pour ${a.name}`}><Ellipsis className="size-4" /></DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-pop">
                  {a.hasDesign && <DropdownMenu.Item asChild><Link href={`/app/studio/editeur?creation=${a.id}`} className={item}><PenLine className="size-4" />Modifier dans le studio</Link></DropdownMenu.Item>}
                  {a.kind === "IMAGE" && !a.hasDesign && <DropdownMenu.Item asChild><Link href={`/app/studio/editeur?image=${a.id}`} className={item}><Wand className="size-4" />Créer un visuel avec cette photo</Link></DropdownMenu.Item>}
                  <DropdownMenu.Item className={item} onSelect={() => run(a.id, () => duplicateAssetAction(a.id), "Copie créée.")}><Copy className="size-4" />Dupliquer</DropdownMenu.Item>
                  <DropdownMenu.Item asChild><a href={`/api/files/${a.id}?telecharger`} className={item}><Download className="size-4" />Exporter</a></DropdownMenu.Item>
                  <DropdownMenu.Item className={item} onSelect={() => { const name = window.prompt("Nouveau nom", a.name); if (name) void run(a.id, () => renameAssetAction(a.id, name), "Nom modifié."); }}><PenLine className="size-4" />Renommer</DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item className={`${item} text-clay data-[highlighted]:text-clay`} onSelect={() => { if (window.confirm(`Supprimer « ${a.name} » ?`)) void run(a.id, () => deleteAssetAction(a.id), "Fichier supprimé."); }}><Trash2 className="size-4" />Supprimer</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
