"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, LoaderCircle, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AssetThumb, Uploader, uploadFile } from "@/components/app/uploader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { AD_FORMATS, formatById, PLATFORMS } from "@/lib/catalog/platforms";
import { drawDesign, LAYOUTS, PALETTES, sanitizeDesign, type Design, type Sources } from "@/lib/studio/render";
import { cn } from "@/lib/utils";
import { generateImageAction } from "@/server/actions/assistant";
import { attachAssetAction } from "@/server/actions/campaigns";

export type StudioTemplate = { id: string; name: string; category: string; design: Design };
type LibraryImage = { id: string; name: string };

function useImage(id: string | null) {
  const [state, setState] = React.useState<{ el: HTMLImageElement | null; failed: boolean }>({ el: null, failed: false });
  React.useEffect(() => {
    if (!id) { setState({ el: null, failed: false }); return; }
    let cancelled = false;
    const img = new Image();
    // Une image lourde est servie par redirection vers le stockage : sans ce mode, le canevas ne pourrait plus être exporté.
    img.crossOrigin = "anonymous";
    img.onload = () => { if (!cancelled) setState({ el: img, failed: false }); };
    img.onerror = () => { if (!cancelled) setState({ el: null, failed: true }); };
    img.src = `/api/files/${id}`;
    return () => { cancelled = true; };
  }, [id]);
  return state;
}

function render(design: Design, formatId: string, sources: Sources, scale = 1) {
  const f = formatById(formatId);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(f.width * scale);
  canvas.height = Math.round(f.height * scale);
  drawDesign(canvas.getContext("2d")!, design, canvas.width, canvas.height, sources);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, photo: boolean) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export impossible sur cet appareil."))), photo ? "image/jpeg" : "image/png", 0.92));

export function StudioEditor({ initial, initialFormat, initialName, templates, library, campaign, imageAi, suggestedTexts }: {
  initial: Design; initialFormat: string; initialName: string; templates: StudioTemplate[]; library: LibraryImage[];
  campaign: { id: string; name: string; backHref: string; platforms: string[] } | null; imageAi: boolean; suggestedTexts?: { headline: string; cta: string }[];
}) {
  const router = useRouter();
  const [design, setDesign] = React.useState<Design>(initial);
  const [format, setFormat] = React.useState(initialFormat);
  const [name, setName] = React.useState(initialName);
  const [exportFormats, setExportFormats] = React.useState<string[]>([initialFormat]);
  const [images, setImages] = React.useState(library);
  const [saving, setSaving] = React.useState(false);
  const [fontsReady, setFontsReady] = React.useState(false);
  const [picker, setPicker] = React.useState<null | "image" | "logo">(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const image = useImage(design.imageId);
  const logo = useImage(design.logoId);
  const set = (patch: Partial<Design>) => setDesign((d) => ({ ...d, ...patch }));

  const sources = React.useMemo<Sources>(() => ({
    image: image.el, imageW: image.el?.naturalWidth ?? 0, imageH: image.el?.naturalHeight ?? 0,
    logo: logo.el, logoW: logo.el?.naturalWidth ?? 0, logoH: logo.el?.naturalHeight ?? 0,
  }), [image.el, logo.el]);

  React.useEffect(() => {
    // Les polices doivent être chargées avant le premier rendu, sinon le canvas utilise une police de secours.
    Promise.all([document.fonts.load('700 40px "Bricolage Grotesque Variable"'), document.fonts.load('500 40px "Instrument Sans Variable"'), document.fonts.load('700 40px "Instrument Sans Variable"')])
      .catch(() => undefined).then(() => setFontsReady(true));
  }, []);

  const f = formatById(format);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, 900 / Math.max(f.width, f.height));
    canvas.width = Math.round(f.width * scale);
    canvas.height = Math.round(f.height * scale);
    drawDesign(canvas.getContext("2d")!, design, canvas.width, canvas.height, sources);
  }, [design, f.width, f.height, sources, fontsReady]);

  const needsImage = LAYOUTS.find((l) => l.id === design.layout)?.needsImage ?? false;
  const formats = exportFormats.length ? exportFormats : [format];

  async function save() {
    if (!name.trim()) { toast.error("Donnez un nom à votre création."); return; }
    if (needsImage && !design.imageId) { toast.error("Ajoutez une photo, ou choisissez la mise en page « Texte seul »."); return; }
    setSaving(true);
    try {
      const ids: string[] = [];
      for (const id of formats) {
        const fmt = formatById(id);
        const blob = await toBlob(render(design, id, sources), Boolean(design.imageId));
        const asset = await uploadFile(blob, { name: `${name.trim()} — ${fmt.label}`, source: "STUDIO", format: id, design: JSON.stringify(design) });
        ids.push(asset.id);
        if (campaign) {
          const res = await attachAssetAction(campaign.id, asset.id, "CREATIVE");
          if (!res.ok) throw new Error(res.error);
        }
      }
      toast.success(ids.length > 1 ? `${ids.length} formats enregistrés.` : "Création enregistrée.");
      router.push(campaign ? campaign.backHref : "/app/studio");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function download() {
    try {
      for (const id of formats) {
        const blob = await toBlob(render(design, id, sources), Boolean(design.imageId));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(name.trim() || "creation").replace(/[^\p{L}\p{N}]+/gu, "-")}-${id}.${design.imageId ? "jpg" : "png"}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch (e) { toast.error((e as Error).message); }
  }

  async function generate() {
    setAiBusy(true);
    const res = await generateImageAction(aiPrompt, f.width > f.height ? "landscape" : f.height > f.width ? "portrait" : "square");
    setAiBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    const id = res.data.assetId as string;
    setImages((l) => [{ id, name: "Image IA" }, ...l]);
    set({ imageId: id, zoom: 1, offsetX: 0, offsetY: 0 });
    toast.success("Image générée et ajoutée à votre bibliothèque.");
  }

  const shown = campaign ? AD_FORMATS.filter((x) => x.platforms.some((p) => campaign.platforms.includes(p))) : AD_FORMATS;
  const formatList = shown.length ? shown : AD_FORMATS;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
      {/* Aperçu */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="scrollbar-none -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {formatList.map((x) => (
            <button key={x.id} type="button" onClick={() => setFormat(x.id)} title={x.usage}
              className={cn("shrink-0 rounded-md border px-3 py-1.5 text-left text-[13px] transition-colors", format === x.id ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong")}>
              <span className="block font-medium">{x.label}</span>
              <span className={cn("tnum block text-[11px]", format === x.id ? "text-white/70" : "text-muted")}>{x.ratio} · {x.width}×{x.height}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center rounded-xl border border-line bg-sand/60 p-4 sm:p-6">
          <canvas ref={canvasRef} className="h-auto max-h-[62dvh] w-auto max-w-full rounded-md shadow-pop" style={{ aspectRatio: `${f.width} / ${f.height}` }} aria-label={`Aperçu de la création au format ${f.label}`} />
        </div>
        <p className="mt-2 text-xs text-muted">{f.usage} — {f.platforms.map((p) => PLATFORMS[p].label).join(", ")}. Le même visuel est adapté automatiquement à chaque format.</p>
        {image.failed && <Notice tone="danger" className="mt-3">La photo n&apos;a pas pu être chargée. Choisissez-en une autre.</Notice>}
      </div>

      {/* Réglages */}
      <div className="space-y-6">
        <section>
          <h2 className="eyebrow mb-2">Modèle</h2>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => setDesign((d) => ({ ...t.design, imageId: d.imageId, logoId: d.logoId, zoom: d.zoom, offsetX: d.offsetX, offsetY: d.offsetY, templateId: t.id }))}
                className={cn("flex items-center gap-2.5 rounded-md border p-2 text-left text-[13px] transition-colors", design.templateId === t.id ? "border-forest bg-green-soft/50" : "border-line bg-surface hover:border-line-strong")}>
                <span className="flex size-8 shrink-0 overflow-hidden rounded border border-line"><span className="w-2/3" style={{ background: t.design.palette.background }} /><span className="w-1/3" style={{ background: t.design.palette.accent }} /></span>
                <span className="min-w-0"><span className="block truncate font-medium text-ink">{t.name}</span><span className="block text-[11px] text-muted">{t.category}</span></span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" onClick={() => set({ layout: l.id, templateId: null })} className={cn("rounded-full border px-3 py-1 text-[12.5px]", design.layout === l.id ? "border-forest bg-forest text-white" : "border-line text-ink-soft hover:border-line-strong")}>{l.label}</button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="eyebrow">Textes</h2>
          <Field label="Titre" htmlFor="st-headline"><Input id="st-headline" value={design.headline} maxLength={90} onChange={(e) => set({ headline: e.target.value })} /></Field>
          {suggestedTexts && suggestedTexts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestedTexts.slice(0, 4).map((s, i) => <button key={i} type="button" onClick={() => set({ headline: s.headline.slice(0, 90), cta: s.cta || design.cta })} className="max-w-full truncate rounded-full bg-sand px-2.5 py-1 text-xs text-ink-soft hover:bg-line">{s.headline}</button>)}
            </div>
          )}
          <Field label="Sous-titre" htmlFor="st-subline" optional><Textarea id="st-subline" rows={2} value={design.subline} maxLength={140} onChange={(e) => set({ subline: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bouton" htmlFor="st-cta" optional><Input id="st-cta" value={design.cta} maxLength={40} onChange={(e) => set({ cta: e.target.value })} /></Field>
            <Field label="Pastille" htmlFor="st-badge" optional hint="Prix, remise…"><Input id="st-badge" value={design.badge} maxLength={24} onChange={(e) => set({ badge: e.target.value })} /></Field>
          </div>
        </section>

        <section>
          <h2 className="eyebrow mb-2">Couleurs</h2>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((p, i) => (
              <button key={i} type="button" onClick={() => set({ palette: p })} aria-label={`Palette ${i + 1}`}
                className={cn("flex size-9 overflow-hidden rounded-full border-2", design.palette.background === p.background && design.palette.accent === p.accent ? "border-forest" : "border-line")}>
                <span className="w-1/2" style={{ background: p.background }} /><span className="w-1/2" style={{ background: p.accent }} />
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
            {(["background", "accent", "text"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5">
                <input type="color" value={design.palette[k]} onChange={(e) => set({ palette: { ...design.palette, [k]: e.target.value } })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                {k === "background" ? "Fond" : k === "accent" ? "Accent" : "Texte"}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="eyebrow">Photo et logo</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["image", "logo"] as const).map((kind) => {
              const current = kind === "image" ? design.imageId : design.logoId;
              return (
                <div key={kind} className="rounded-md border border-line bg-surface p-2">
                  <div className="mb-2 aspect-[4/3] overflow-hidden rounded bg-sand">
                    {current ? <AssetThumb id={current} kind="IMAGE" name={kind} className={kind === "logo" ? "object-contain p-2" : ""} /> : <span className="flex size-full items-center justify-center text-xs text-muted">{kind === "image" ? "Aucune photo" : "Aucun logo"}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setPicker(kind)}><ImagePlus />{kind === "image" ? "Photo" : "Logo"}</Button>
                    {current && <Button type="button" size="sm" variant="ghost" className="px-2" aria-label="Retirer" onClick={() => set(kind === "image" ? { imageId: null } : { logoId: null })}><Trash2 /></Button>}
                  </div>
                </div>
              );
            })}
          </div>
          {design.imageId && needsImage && (
            <div className="space-y-2 rounded-md border border-line bg-surface p-3 text-xs text-muted">
              {([["zoom", "Zoom", 1, 3], ["offsetX", "Horizontal", -1, 1], ["offsetY", "Vertical", -1, 1]] as const).map(([k, label, min, max]) => (
                <label key={k} className="grid grid-cols-[5rem_1fr] items-center gap-2">{label}
                  <input type="range" min={min} max={max} step={0.01} value={design[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="accent-[var(--color-green)]" />
                </label>
              ))}
            </div>
          )}
          <div className="rounded-md border border-line bg-surface p-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink"><Sparkles className="size-4 text-green" />Générer une photo par IA</p>
            {imageAi ? (
              <>
                <Textarea rows={2} className="mt-2" placeholder="Ex. : sac en cuir marron posé sur une table en bois, lumière naturelle" value={aiPrompt} maxLength={800} onChange={(e) => setAiPrompt(e.target.value)} />
                <Button type="button" size="sm" className="mt-2" disabled={aiBusy || aiPrompt.trim().length < 10} onClick={generate}>{aiBusy && <LoaderCircle className="animate-spin" />}{aiBusy ? "Génération…" : "Générer"}</Button>
                <p className="mt-2 text-xs text-muted">Une image générée ne doit pas représenter un produit différent de celui que vous vendez réellement.</p>
              </>
            ) : <p className="mt-1 text-xs text-muted">La génération d&apos;images n&apos;est pas encore activée sur la plateforme. Importez vos propres photos : elles donnent de meilleurs résultats.</p>}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="eyebrow">Enregistrer</h2>
          <Field label="Nom de la création" htmlFor="st-name"><Input id="st-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">Formats à exporter</legend>
            <div className="space-y-1.5">
              {formatList.map((x) => (
                <label key={x.id} className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <input type="checkbox" className="size-4" checked={exportFormats.includes(x.id)} onChange={(e) => setExportFormats((l) => (e.target.checked ? [...l, x.id] : l.filter((v) => v !== x.id)))} />
                  {x.label} <span className="tnum text-xs text-muted">{x.width}×{x.height}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {campaign && <p className="text-xs text-muted">Les formats enregistrés seront ajoutés à la campagne « {campaign.name} ».</p>}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={saving} onClick={save}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}{saving ? "Enregistrement…" : campaign ? "Ajouter à la campagne" : "Enregistrer"}</Button>
            <Button type="button" variant="outline" onClick={download} aria-label="Télécharger"><Download /></Button>
          </div>
          <Button asChild variant="ghost" size="sm" className="w-full"><Link href={campaign ? campaign.backHref : "/app/studio"}>Annuler</Link></Button>
        </section>
      </div>

      <Dialog open={picker !== null} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogTrigger className="hidden" />
        <DialogContent title={picker === "logo" ? "Choisir un logo" : "Choisir une photo"} description="Importez un fichier ou sélectionnez une image de votre bibliothèque." side="bottom">
          <Uploader accept="image" multiple={false} compact label="Importer une image" hint="JPG, PNG ou WebP — 8 Mo maximum"
            onUploaded={(a) => { setImages((l) => [{ id: a.id, name: a.name }, ...l]); set(picker === "logo" ? { logoId: a.id } : { imageId: a.id, zoom: 1, offsetX: 0, offsetY: 0 }); setPicker(null); }} />
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <button key={img.id} type="button" className="aspect-square overflow-hidden rounded-md border border-line hover:border-forest focus-visible:border-forest"
                  onClick={() => { set(picker === "logo" ? { logoId: img.id } : { imageId: img.id, zoom: 1, offsetX: 0, offsetY: 0 }); setPicker(null); }}>
                  <AssetThumb id={img.id} kind="IMAGE" name={img.name} />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

