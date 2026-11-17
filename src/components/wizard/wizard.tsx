"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, ImagePlus, LoaderCircle, Palette, RefreshCw, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { AdPreview } from "@/components/app/ad-preview";
import { AssetThumb, Uploader } from "@/components/app/uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { AdCopy, EditorData, LinkedAsset, StrategyState } from "@/lib/campaigns/editor-data";
import { getObjective } from "@/lib/catalog/objectives";
import { defaultSplit, platformLabel, type PlatformCode } from "@/lib/catalog/platforms";
import { AGE_BOUNDS, CITIES_BY_COUNTRY, CUSTOMER_CATEGORIES, GENDERS, INTEREST_GROUPS, LANGUAGES, SECTORS, TARGET_COUNTRIES, type Targeting } from "@/lib/catalog/targeting";
import { cn, formatFcfa } from "@/lib/utils";
import {
  attachAssetAction, detachAssetAction, generateStrategyAction, placeOrderAction, saveCampaignAction, suggestTargetingAction, type CampaignPatch,
} from "@/server/actions/campaigns";
import { BudgetFields, Chip, LevelPicker, ObjectivePicker, PlatformPicker, QuotePanel, useQuote } from "./parts";

const STEPS = [
  { title: "Plateforme", lead: "Où souhaitez-vous diffuser votre publicité ?" },
  { title: "Objectif", lead: "Que voulez-vous obtenir avec cette campagne ?" },
  { title: "Votre activité", lead: "Présentez ce que vous souhaitez promouvoir." },
  { title: "Stratégie", lead: "Analyse de votre offre et propositions de textes. Modifiez librement avant de valider." },
  { title: "Visuels", lead: "Créez ou importez les visuels de votre publicité." },
  { title: "Ciblage", lead: "À qui votre publicité doit-elle être montrée ?" },
  { title: "Budget et durée", lead: "Fixez votre budget, puis vérifiez le récapitulatif avant de payer." },
];

type State = EditorData["campaign"] & { business: { id: string | null; name: string; sector: string; city: string } };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function Wizard({ data, initialStep }: { data: EditorData; initialStep: number }) {
  const router = useRouter();
  const c0 = data.campaign;
  const b0 = data.businesses.find((b) => b.id === c0.businessId) ?? data.businesses[0] ?? null;
  const objective0 = getObjective(c0.objective);
  const [s, setS] = React.useState<State>({
    ...c0, business: b0 ? { ...b0 } : { id: null, name: "", sector: "", city: "Cotonou" },
    adBudget: c0.adBudget || (objective0 ? objective0.config.recommendedDailyBudget * objective0.config.recommendedDays : 0),
    durationDays: c0.durationDays ?? objective0?.config.recommendedDays ?? 7,
  });
  const [step, setStep] = React.useState(Math.min(7, Math.max(1, initialStep)));
  const [links, setLinks] = React.useState<LinkedAsset[]>(data.links);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [promo, setPromo] = React.useState(data.promoCode ?? "");
  const top = React.useRef<HTMLDivElement>(null);
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  const objective = getObjective(s.objective);

  function patchFor(n: number): CampaignPatch | string {
    switch (n) {
      case 1: return s.platforms.length ? { platforms: s.platforms } : "Choisissez une plateforme pour continuer.";
      case 2: return s.objective ? { objective: s.objective } : "Choisissez un objectif pour continuer.";
      case 3: return {
        name: s.name, business: s.business, productName: s.productName, productDescription: s.productDescription, productPrice: s.productPrice,
        audienceNote: s.audienceNote, destinationWhatsapp: s.destinationWhatsapp, destinationUrl: s.destinationUrl,
      };
      case 4: return s.strategy && s.adCopy ? { strategy: s.strategy, adCopy: s.adCopy } : {};
      case 5: return {};
      case 6: return { targeting: s.targeting };
      default: return { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, serviceCode: s.serviceCode };
    }
  }

  async function saveStep(n: number, nextStep: number) {
    const patch = patchFor(n);
    if (typeof patch === "string") { setError(patch); return false; }
    setBusy(true);
    setError(null);
    const res = await saveCampaignAction(s.id, { ...patch, wizardStep: Math.min(7, nextStep) });
    setBusy(false);
    if (!res.ok) { setError(res.error); return false; }
    setWarnings((res.data.warnings as string[] | undefined) ?? []);
    return true;
  }

  async function go(next: number) {
    if (next > step && !(await saveStep(step, next))) return;
    if (next === 2 && s.objective && objective && !objective.platforms.some((p) => s.platforms.includes(p))) set({ objective: null, strategy: null, adCopy: null });
    if (step === 1) set({ budgetSplit: Object.keys(s.budgetSplit).sort().join() === [...s.platforms].sort().join() ? s.budgetSplit : defaultSplit(s.platforms) });
    setStep(next);
    setError(null);
    top.current?.scrollIntoView({ block: "start" });
  }

  async function order() {
    if (!(await saveStep(7, 7))) return;
    setBusy(true);
    const res = await placeOrderAction(s.id, promo || null);
    if (!res.ok) { setBusy(false); setError(res.error); return; }
    router.push(`/app/paiements/${res.data.orderId as string}`);
  }

  const reached = Math.max(c0.wizardStep, step);
  const meta = STEPS[step - 1]!;

  return (
    <div ref={top} className="mx-auto max-w-5xl scroll-mt-20">
      {/* Progression */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
          <Link href="/app/campagnes?etat=attente" className="hover:text-ink">← Enregistrer et quitter</Link>
          <span className="tnum">Étape {step} sur 7</span>
        </div>
        <ol className="mt-3 flex gap-1.5" aria-label="Étapes">
          {STEPS.map((st, i) => {
            const n = i + 1;
            const clickable = n <= reached && n !== step && !busy;
            return (
              <li key={st.title} className="min-w-0 flex-1">
                <button type="button" disabled={!clickable} onClick={() => go(n)} aria-current={n === step ? "step" : undefined} className="group block w-full text-left disabled:cursor-default">
                  <span className={cn("block h-1.5 rounded-full transition-colors", n < step ? "bg-green" : n === step ? "bg-marigold" : "bg-line")} />
                  <span className={cn("mt-1.5 hidden truncate text-xs md:block", n === step ? "font-medium text-ink" : "text-muted", clickable && "group-hover:text-ink")}>{n}. {st.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <header className="mb-6">
        <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">{meta.title}</h1>
        <p className="mt-1.5 text-muted">{meta.lead}</p>
      </header>

      {step === 1 && <PlatformPicker value={s.platforms} onChange={(platforms) => set({ platforms })} />}
      {step === 2 && <ObjectivePicker value={s.objective} platforms={s.platforms} baseFees={data.baseFees} onChange={(code) => { const o = getObjective(code); set({ objective: code, ...(code !== s.objective ? { strategy: null, adCopy: null, adBudget: o ? o.config.recommendedDailyBudget * o.config.recommendedDays : s.adBudget, durationDays: o?.config.recommendedDays ?? s.durationDays } : {}) }); }} />}
      {step === 3 && <BusinessStep s={s} set={set} data={data} links={links} setLinks={setLinks} />}
      {step === 4 && <StrategyStep s={s} set={set} aiProvider={data.ai.text} />}
      {step === 5 && <CreativeStep s={s} data={data} links={links} setLinks={setLinks} />}
      {step === 6 && <TargetingStep s={s} set={set} />}
      {step === 7 && <BudgetStep s={s} set={set} data={data} links={links} promo={promo} setPromo={setPromo} />}

      {warnings.length > 0 && <Notice tone="warn" className="mt-6" title="À vérifier avant le lancement">{warnings.map((w) => <p key={w}>{w}</p>)}</Notice>}
      {error && <Notice tone="danger" className="mt-6">{error}</Notice>}

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-lg sm:px-0">
        <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => go(step - 1)}><ArrowLeft />Retour</Button>
        {step < 7 ? (
          <Button type="button" size="lg" disabled={busy} onClick={() => go(step + 1)}>{busy && <LoaderCircle className="animate-spin" />}Continuer<ArrowRight /></Button>
        ) : (
          <Button type="button" size="lg" variant="accent" disabled={busy} onClick={order}>{busy && <LoaderCircle className="animate-spin" />}Passer au paiement<ArrowRight /></Button>
        )}
      </div>
    </div>
  );
}

type StepProps = { s: State; set: (patch: Partial<State>) => void };

// ─────────────────────────── Étape 3 ───────────────────────────

function BusinessStep({ s, set, data, links, setLinks }: StepProps & { data: EditorData; links: LinkedAsset[]; setLinks: React.Dispatch<React.SetStateAction<LinkedAsset[]>> }) {
  const objective = getObjective(s.objective);
  const needs = objective?.config.requires ?? [];
  const media = links.filter((l) => l.role === "PRODUCT_MEDIA");
  const setB = (patch: Partial<State["business"]>) => set({ business: { ...s.business, ...patch } });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="eyebrow">Votre entreprise</h2>
        {data.businesses.length > 0 && (
          <Field label="Entreprise" htmlFor="businessId">
            <Select id="businessId" value={s.business.id ?? ""} onChange={(e) => { const b = data.businesses.find((x) => x.id === e.target.value); set({ business: b ? { ...b } : { id: null, name: "", sector: "", city: "" } }); }}>
              {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="">+ Nouvelle entreprise</option>
            </Select>
          </Field>
        )}
        <Field label="Nom de l'entreprise ou de la marque" htmlFor="bname"><Input id="bname" value={s.business.name} maxLength={80} onChange={(e) => setB({ name: e.target.value })} placeholder="Boutique Afi" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Secteur" htmlFor="sector">
            <Select id="sector" value={s.business.sector} onChange={(e) => setB({ sector: e.target.value })}><option value="" disabled>Choisir…</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</Select>
          </Field>
          <Field label="Ville" htmlFor="city"><Input id="city" value={s.business.city} maxLength={60} onChange={(e) => setB({ city: e.target.value })} placeholder="Cotonou" /></Field>
        </div>
        <Field label={`Lien WhatsApp ou numéro${needs.includes("whatsapp") ? "" : ""}`} htmlFor="wa" optional={!needs.includes("whatsapp")} hint="Les clients intéressés vous écriront ici.">
          <Input id="wa" value={s.destinationWhatsapp} maxLength={40} inputMode="tel" onChange={(e) => set({ destinationWhatsapp: e.target.value })} placeholder="01 97 00 00 00" />
        </Field>
        <Field label="Lien de votre page" htmlFor="url" optional={!needs.includes("page")} hint="Page Facebook, compte Instagram ou TikTok concerné par la publicité.">
          <Input id="url" type="url" value={s.destinationUrl} maxLength={300} onChange={(e) => set({ destinationUrl: e.target.value })} placeholder="https://facebook.com/votrepage" />
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="eyebrow">Ce que vous promouvez</h2>
        <Field label="Nom du produit ou du service" htmlFor="pname" optional><Input id="pname" value={s.productName} maxLength={120} onChange={(e) => set({ productName: e.target.value })} placeholder="Robes en pagne sur mesure" /></Field>
        <Field label="Description" htmlFor="pdesc" hint={`${s.productDescription.trim().length} / 1 500 — ce qui le rend intéressant, pour qui, comment commander.`}>
          <Textarea id="pdesc" rows={5} value={s.productDescription} maxLength={1500} onChange={(e) => set({ productDescription: e.target.value })} placeholder="Robes cousues main en wax, tailles 36 à 52, livraison à Cotonou et Calavi en 48 h…" />
        </Field>
        <Field label="Prix" htmlFor="price" optional>
          <div className="relative">
            <Input id="price" inputMode="numeric" className="tnum pr-16" value={s.productPrice ? String(s.productPrice) : ""} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); set({ productPrice: n ? Math.min(n, 1_000_000_000) : null }); }} placeholder="15000" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">FCFA</span>
          </div>
        </Field>
        <Field label="Public visé" htmlFor="aud" optional hint="Dites-le avec vos mots ; le ciblage précis se règle à l'étape 6."><Textarea id="aud" rows={2} value={s.audienceNote} maxLength={600} onChange={(e) => set({ audienceNote: e.target.value })} placeholder="Femmes de 20 à 40 ans à Cotonou qui aiment la mode africaine" /></Field>
        <Field label="Nom de la campagne" htmlFor="cname" hint="Pour la retrouver dans votre espace."><Input id="cname" value={s.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} /></Field>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5 lg:col-span-2">
        <h2 className="eyebrow">Photos et vidéos de votre produit</h2>
        <p className="mt-1 text-sm text-muted">Elles servent à créer vos visuels{needs.includes("video") ? " — une vidéo est recommandée pour cet objectif" : ""}. Vous pourrez en ajouter d&apos;autres plus tard.</p>
        <MediaGrid campaignId={s.id} role="PRODUCT_MEDIA" items={media} setLinks={setLinks} library={data.library} />
      </section>
    </div>
  );
}

export function MediaGrid({ campaignId, role, items, setLinks, library, accept = "media" }: {
  campaignId: string; role: "PRODUCT_MEDIA" | "CREATIVE" | "BRIEF_FILE"; items: LinkedAsset[]; setLinks: React.Dispatch<React.SetStateAction<LinkedAsset[]>>; library: EditorData["library"]; accept?: "media" | "any" | "image";
}) {
  const [open, setOpen] = React.useState(false);
  async function attach(asset: { id: string; name: string; kind: string; format: string | null }) {
    const res = await attachAssetAction(campaignId, asset.id, role);
    if (!res.ok) { toast.error(res.error); return; }
    setLinks((l) => (l.some((x) => x.assetId === asset.id && x.role === role) ? l : [...l, { linkId: res.data.linkId as string, assetId: asset.id, role, name: asset.name, kind: asset.kind, format: asset.format, approval: "NOT_REQUIRED" }]));
  }
  async function detach(link: LinkedAsset) {
    const res = await detachAssetAction(campaignId, link.linkId);
    if (!res.ok) { toast.error(res.error); return; }
    setLinks((l) => l.filter((x) => x !== link));
  }
  const candidates = library.filter((a) => (role === "CREATIVE" ? a.kind !== "DOCUMENT" : true) && !items.some((i) => i.assetId === a.id));
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((m) => (
        <div key={`${m.assetId}-${m.role}`} className="group relative aspect-square overflow-hidden rounded-md border border-line bg-sand">
          <AssetThumb id={m.assetId} kind={m.kind} name={m.name} />
          {m.linkId && <button type="button" onClick={() => detach(m)} className="absolute right-1 top-1 rounded bg-forest/80 p-1 text-white opacity-100 transition-opacity hover:bg-clay sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Retirer ${m.name}`}><Trash2 className="size-3.5" /></button>}
        </div>
      ))}
      <Uploader accept={accept} compact onUploaded={attach} className="aspect-square" label="Importer" hint="" />
      {candidates.length > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-paper px-2 text-center text-sm font-medium text-ink hover:border-green hover:bg-green-soft/40">
            <ImagePlus className="size-5 text-muted" />Bibliothèque
          </DialogTrigger>
          <DialogContent title="Ma bibliothèque" description="Sélectionnez un fichier déjà importé ou créé dans le studio." side="bottom">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {candidates.map((a) => (
                <button key={a.id} type="button" onClick={() => { void attach(a); setOpen(false); }} className="aspect-square overflow-hidden rounded-md border border-line hover:border-forest">
                  <AssetThumb id={a.id} kind={a.kind} name={a.name} />
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─────────────────────────── Étape 4 ───────────────────────────

function EditableList({ label, items, onChange, rows = 1 }: { label: string; items: string[]; onChange: (items: string[]) => void; rows?: number }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-ink-soft">{label}</h3>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex gap-2">
            <Textarea rows={rows} value={v} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className="min-h-0 py-2 text-[13.5px]" aria-label={`${label} ${i + 1}`} />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="shrink-0 rounded-md px-2 text-muted hover:bg-sand hover:text-clay" aria-label="Supprimer"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyStep({ s, set, aiProvider }: StepProps & { aiProvider: string | null }) {
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const st = s.strategy;
  const setSt = (patch: Partial<StrategyState>) => set({ strategy: { ...(st as StrategyState), ...patch } });

  async function generate() {
    if (st && !window.confirm("Générer de nouvelles propositions remplacera vos modifications. Continuer ?")) return;
    setLoading(true);
    const res = await generateStrategyAction(s.id);
    setLoading(false);
    if (!res.ok) { toast.error(res.error); return; }
    setNotice((res.data.notice as string | null) ?? null);
    set({ strategy: res.data.strategy as StrategyState, adCopy: (res.data.adCopy as AdCopy | null) ?? s.adCopy });
  }

  if (!st) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-lg bg-green-soft text-green"><Sparkles className="size-5" /></span>
        <h2 className="mt-4 text-xl font-semibold">Analyser mon offre</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">À partir de votre description, nous proposons des arguments commerciaux, des audiences, des accroches, des textes publicitaires, des idées de vidéos et de visuels. Vous gardez la main sur chaque élément.</p>
        <p className="mt-3 text-[13px] text-muted">{aiProvider ? `Moteur : modèle d'intelligence artificielle (${aiProvider}).` : "Aucun modèle d'IA n'est configuré sur la plateforme : les propositions proviennent de modèles rédigés par notre équipe et adaptés à vos informations."}</p>
        <Button type="button" className="mt-5" disabled={loading} onClick={generate}>{loading ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}{loading ? "Analyse en cours…" : "Lancer l'analyse"}</Button>
        <p className="mt-4 text-xs text-muted">Vous pouvez aussi passer cette étape : notre équipe rédigera les textes si vous choisissez une formule avec création.</p>
      </div>
    );
  }

  const copy = s.adCopy ?? { headline: "", body: "", cta: "" };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone={st.engine === "ai" ? "ok" : "neutral"}>{st.engine === "ai" ? "Généré par intelligence artificielle" : "Suggestions guidées (sans IA)"}</Badge>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={generate}>{loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}Régénérer</Button>
      </div>
      {notice && <Notice tone="info">{notice}</Notice>}

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="eyebrow mb-2">Analyse de votre offre</h2>
        <Textarea rows={5} value={st.analysis} onChange={(e) => setSt({ analysis: e.target.value })} aria-label="Analyse" />
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <EditableList label="Arguments commerciaux" items={st.sellingPoints} onChange={(sellingPoints) => setSt({ sellingPoints })} rows={2} />
          <EditableList label="Accroches" items={st.hooks} onChange={(hooks) => setSt({ hooks })} />
        </div>
      </section>

      <section className="rounded-lg border border-forest bg-surface p-5 ring-1 ring-forest">
        <div className="flex items-center justify-between gap-3"><h2 className="eyebrow">Texte publicitaire retenu</h2><Badge tone="accent">Utilisé pour l&apos;annonce</Badge></div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_12rem]">
          <Field label="Titre" htmlFor="copy-h"><Input id="copy-h" value={copy.headline} maxLength={90} onChange={(e) => set({ adCopy: { ...copy, headline: e.target.value } })} /></Field>
          <Field label="Bouton d'action" htmlFor="copy-c">
            <Input id="copy-c" value={copy.cta} maxLength={40} list="cta-list" onChange={(e) => set({ adCopy: { ...copy, cta: e.target.value } })} />
            <datalist id="cta-list">{st.ctas.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </div>
        <Field label="Texte principal" htmlFor="copy-b" className="mt-3" hint={`${copy.body.length} / 900`}><Textarea id="copy-b" rows={5} value={copy.body} maxLength={900} onChange={(e) => set({ adCopy: { ...copy, body: e.target.value } })} /></Field>
      </section>

      <section>
        <h2 className="eyebrow mb-3">Autres textes et variantes de campagne</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {[...st.texts.map((t) => ({ tag: "Texte", name: t.headline, angle: "", ...t })), ...st.variants.map((v) => ({ tag: `Variante ${v.name}`, ...v }))].map((t, i) => {
            const active = copy.headline === t.headline && copy.body === t.body;
            return (
              <article key={i} className={cn("flex flex-col rounded-lg border bg-surface p-4", active ? "border-forest" : "border-line")}>
                <p className="text-xs font-medium text-muted">{t.tag}</p>
                <p className="mt-1 font-medium text-ink">{t.headline}</p>
                {"audience" in t && t.angle && <p className="mt-1 text-xs text-muted">Angle : {t.angle}{"audience" in t && t.audience ? ` · Cible : ${String(t.audience)}` : ""}</p>}
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-[13.5px] text-ink-soft">{t.body}</p>
                <Button type="button" size="sm" variant={active ? "ghost" : "outline"} className="mt-3 self-start" disabled={active} onClick={() => set({ adCopy: { headline: t.headline, body: t.body, cta: t.cta } })}>{active ? <><Check />Retenu</> : "Utiliser ce texte"}</Button>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow mb-3">Audiences proposées</h2>
          <ul className="space-y-3">{st.audiences.map((a, i) => <li key={i}><p className="text-sm font-medium text-ink">{a.name}</p><p className="text-[13.5px] text-muted">{a.description}</p>{a.interests.length > 0 && <p className="mt-1 text-xs text-muted">Centres d&apos;intérêt : {a.interests.join(", ")}</p>}</li>)}</ul>
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow mb-3">Formats recommandés</h2>
          <ul className="space-y-3">{st.formats.map((f, i) => <li key={i}><p className="text-sm font-medium text-ink">{f.format}</p><p className="text-[13.5px] text-muted">{f.reason}</p></li>)}</ul>
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow mb-3">Idées de vidéos</h2>
          <ul className="space-y-3">{st.videoIdeas.map((v, i) => <li key={i}><p className="text-sm font-medium text-ink">{v.title}</p><p className="whitespace-pre-line text-[13.5px] text-muted">{v.script}</p></li>)}</ul>
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow mb-3">Concepts de visuels</h2>
          <ul className="space-y-3">{st.visualConcepts.map((v, i) => <li key={i}><p className="text-sm font-medium text-ink">{v.title}</p><p className="text-[13.5px] text-muted">{v.description}</p></li>)}</ul>
        </section>
      </div>
      <p className="flex items-center gap-2 text-[13px] text-muted"><CircleCheck className="size-4 text-green" />Vos modifications sont enregistrées lorsque vous cliquez sur « Continuer ».</p>
    </div>
  );
}

// ─────────────────────────── Étape 5 ───────────────────────────

function CreativeStep({ s, data, links, setLinks }: { s: State; data: EditorData; links: LinkedAsset[]; setLinks: React.Dispatch<React.SetStateAction<LinkedAsset[]>> }) {
  const creatives = links.filter((l) => l.role === "CREATIVE");
  const firstImage = creatives.find((c) => c.kind === "IMAGE") ?? links.find((l) => l.role === "PRODUCT_MEDIA" && l.kind === "IMAGE");
  const [platform, setPlatform] = React.useState<PlatformCode>(s.platforms[0] ?? "FACEBOOK");
  const pack = data.levels.find((l) => l.kind === "PACK");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="eyebrow">Visuels de l&apos;annonce</h2>
              <p className="mt-1 text-sm text-muted">{creatives.length ? `${creatives.length} visuel${creatives.length > 1 ? "s" : ""} prêt${creatives.length > 1 ? "s" : ""} pour cette campagne.` : "Aucun visuel pour l'instant."}</p>
            </div>
            <Button asChild><Link href={`/app/studio/editeur?campagne=${s.id}${firstImage && firstImage.role === "PRODUCT_MEDIA" ? `&image=${firstImage.assetId}` : ""}`}><Palette />Créer dans le studio</Link></Button>
          </div>
          <MediaGrid campaignId={s.id} role="CREATIVE" items={creatives} setLinks={setLinks} library={data.library} />
          <p className="mt-3 text-xs text-muted">Formats acceptés : carré 1:1, vertical 4:5, story et Reel 9:16, bannière 1,91:1, vidéo MP4 ou MOV. Le studio adapte automatiquement un même visuel à chaque format.</p>
        </section>
        {!creatives.length && pack && (
          <Notice tone="info" title="Pas de visuel ? Notre équipe peut les créer">
            À l&apos;étape 7, choisissez la formule « {pack.name} » ({formatFcfa(pack.fee)}) : un designer réalise vos visuels et vous les soumet pour validation avant le lancement.
          </Notice>
        )}
        <Notice tone="warn" title="Règles des plateformes">Évitez les visuels avant/après, les promesses de gains, les contenus choquants et l&apos;usage de marques qui ne vous appartiennent pas : Meta et TikTok refusent ces annonces. Chaque visuel est vérifié par notre équipe avant diffusion.</Notice>
      </div>
      <aside>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="eyebrow">Aperçu de l&apos;annonce</h2>
          {s.platforms.length > 1 && (
            <div className="flex gap-1">{s.platforms.map((p) => <Chip key={p} active={platform === p} onClick={() => setPlatform(p)}>{platformLabel([p])}</Chip>)}</div>
          )}
        </div>
        <AdPreview platform={platform} pageName={s.business.name || "Votre page"} copy={s.adCopy} imageId={firstImage?.assetId ?? null} />
        <p className="mt-2 text-xs text-muted">Aperçu indicatif : le rendu final dépend de l&apos;emplacement et de l&apos;appareil.</p>
      </aside>
    </div>
  );
}

// ─────────────────────────── Étape 6 ───────────────────────────

function TargetingStep({ s, set }: StepProps) {
  const t = s.targeting;
  const setT = (patch: Partial<Targeting>) => set({ targeting: { ...t, ...patch } });
  const [loading, setLoading] = React.useState(false);
  const [rationale, setRationale] = React.useState<{ text: string; engine: string } | null>(null);
  const cities = t.countries.flatMap((c) => (CITIES_BY_COUNTRY[c] ?? []).map((city) => ({ city, country: c })));
  const known = new Set(INTEREST_GROUPS.flatMap((g) => g.items));

  async function suggest() {
    setLoading(true);
    const res = await suggestTargetingAction(s.id);
    setLoading(false);
    if (!res.ok) { toast.error(res.error); return; }
    const a = res.data.advice as { cities: string[]; ageMin: number; ageMax: number; gender: Targeting["gender"]; interests: string[]; categories: string[]; rationale: string };
    const allowedCities = new Set(cities.map((c) => c.city));
    const snap = (v: number) => AGE_BOUNDS.reduce((best, b) => (Math.abs(b - v) < Math.abs(best - v) ? b : best), AGE_BOUNDS[0] as number);
    setT({
      cities: a.cities.filter((c) => allowedCities.has(c)), ageMin: Math.min(snap(a.ageMin), snap(a.ageMax)), ageMax: Math.max(snap(a.ageMin), snap(a.ageMax)), gender: a.gender,
      interests: a.interests.filter((i) => known.has(i)), categories: a.categories.filter((c) => CUSTOMER_CATEGORIES.includes(c)),
    });
    setRationale({ text: a.rationale, engine: res.data.engine as string });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">Besoin d&apos;aide ? Nous proposons un ciblage adapté à votre activité, que vous pouvez ensuite ajuster.</p>
        <Button type="button" variant="outline" disabled={loading} onClick={suggest}>{loading ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}Proposer un ciblage</Button>
      </div>
      {rationale && <Notice tone="info" title={rationale.engine === "ai" ? "Proposition de l'IA" : "Proposition guidée (sans IA)"}>{rationale.text}</Notice>}

      <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="eyebrow">Zone géographique</h2>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Pays</p>
          <div className="flex flex-wrap gap-1.5">{TARGET_COUNTRIES.map((c) => <Chip key={c.code} active={t.countries.includes(c.code)} onClick={() => { const countries = toggle(t.countries, c.code); const ok = new Set(countries.flatMap((x) => CITIES_BY_COUNTRY[x] ?? [])); setT({ countries, cities: t.cities.filter((x) => ok.has(x)) }); }}>{c.name}</Chip>)}</div>
        </div>
        {cities.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">Villes <span className="font-normal text-muted">— aucune sélection = tout le pays</span></p>
            <div className="flex flex-wrap gap-1.5">{cities.map(({ city }) => <Chip key={city} active={t.cities.includes(city)} onClick={() => setT({ cities: toggle(t.cities, city) })}>{city}</Chip>)}</div>
          </div>
        )}
        <Field label="Précision sur la zone" htmlFor="zone" optional hint="Quartiers, rayon autour de votre boutique…"><Input id="zone" value={t.zoneNote} maxLength={300} onChange={(e) => setT({ zoneNote: e.target.value })} placeholder="5 km autour de Fidjrossè" /></Field>
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="eyebrow">Profil</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Âge minimum" htmlFor="ageMin"><Select id="ageMin" value={t.ageMin} onChange={(e) => { const v = Number(e.target.value); setT({ ageMin: v, ageMax: Math.max(v, t.ageMax) }); }}>{AGE_BOUNDS.map((a) => <option key={a} value={a}>{a} ans</option>)}</Select></Field>
          <Field label="Âge maximum" htmlFor="ageMax"><Select id="ageMax" value={t.ageMax} onChange={(e) => { const v = Number(e.target.value); setT({ ageMax: v, ageMin: Math.min(v, t.ageMin) }); }}>{AGE_BOUNDS.map((a) => <option key={a} value={a}>{a === 65 ? "65 ans et plus" : `${a} ans`}</option>)}</Select></Field>
          <Field label="Langue" htmlFor="lang"><Select id="lang" value={t.languages[0] ?? "fr"} onChange={(e) => setT({ languages: [e.target.value] })}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
        </div>
        <p className="text-xs text-muted">Nos campagnes s&apos;adressent aux adultes (18 ans et plus). Certaines catégories d&apos;annonces imposent des restrictions supplémentaires sur les plateformes.</p>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Genre</p>
          <div className="flex flex-wrap gap-1.5">{GENDERS.map((g) => <Chip key={g.id} active={t.gender === g.id} onClick={() => setT({ gender: g.id })}>{g.label}</Chip>)}</div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Catégories de clients</p>
          <div className="flex flex-wrap gap-1.5">{CUSTOMER_CATEGORIES.map((c) => <Chip key={c} active={t.categories.includes(c)} onClick={() => setT({ categories: toggle(t.categories, c) })}>{c}</Chip>)}</div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between"><h2 className="eyebrow">Centres d&apos;intérêt</h2><span className="tnum text-xs text-muted">{t.interests.length} sélectionné{t.interests.length > 1 ? "s" : ""}</span></div>
        {INTEREST_GROUPS.map((g) => (
          <div key={g.group}>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">{g.group}</p>
            <div className="flex flex-wrap gap-1.5">{g.items.map((i) => <Chip key={i} active={t.interests.includes(i)} disabled={!t.interests.includes(i) && t.interests.length >= 25} onClick={() => setT({ interests: toggle(t.interests, i) })}>{i}</Chip>)}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4" checked={t.customAudience.requested} onChange={(e) => setT({ customAudience: { ...t.customAudience, requested: e.target.checked } })} />
          <span><span className="block text-sm font-medium text-ink">Utiliser une audience personnalisée</span><span className="block text-[13px] text-muted">Reciblage des personnes ayant interagi avec votre page, ou audience similaire à vos clients. Notre équipe vérifie la faisabilité avec vous.</span></span>
        </label>
        {t.customAudience.requested && <Textarea className="mt-3" rows={2} maxLength={500} value={t.customAudience.note} onChange={(e) => setT({ customAudience: { ...t.customAudience, note: e.target.value } })} placeholder="Ex. : personnes ayant déjà écrit à ma page ces 90 derniers jours" aria-label="Précision sur l'audience personnalisée" />}
      </section>
    </div>
  );
}

// ─────────────────────────── Étape 7 ───────────────────────────

function BudgetStep({ s, set, data, links, promo, setPromo }: StepProps & { data: EditorData; links: LinkedAsset[]; promo: string; setPromo: (v: string) => void }) {
  const objective = getObjective(s.objective);
  const quote = useQuote(s.id, { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, serviceCode: s.serviceCode, platforms: s.platforms, promoCode: promo });
  const baseFee = objective ? data.baseFees[objective.serviceCode] ?? data.limits.minServiceFee : data.limits.minServiceFee;
  const t = s.targeting;
  const creatives = links.filter((l) => l.role === "CREATIVE").length;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-surface p-5">
          <BudgetFields data={data} value={{ adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, platforms: s.platforms }} onChange={set}
            recommended={objective ? { daily: objective.config.recommendedDailyBudget, days: objective.config.recommendedDays } : null} />
        </section>
        <section>
          <h2 className="eyebrow mb-3">Niveau d&apos;accompagnement</h2>
          <LevelPicker levels={data.levels} value={s.serviceCode} onChange={(serviceCode) => set({ serviceCode })} baseLabel={objective?.label ?? "Campagne"} baseFee={baseFee} />
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow mb-3">Récapitulatif</h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Campagne</dt><dd className="text-ink">{s.name}</dd></div>
            <div><dt className="text-muted">Plateformes</dt><dd className="text-ink">{platformLabel(s.platforms)}</dd></div>
            <div><dt className="text-muted">Objectif</dt><dd className="text-ink">{objective?.label ?? "—"}</dd></div>
            <div><dt className="text-muted">Entreprise</dt><dd className="text-ink">{s.business.name || "—"}</dd></div>
            <div><dt className="text-muted">Zone</dt><dd className="text-ink">{t.cities.length ? t.cities.slice(0, 4).join(", ") + (t.cities.length > 4 ? "…" : "") : t.countries.map((c) => TARGET_COUNTRIES.find((x) => x.code === c)?.name).join(", ")}</dd></div>
            <div><dt className="text-muted">Audience</dt><dd className="text-ink">{t.ageMin}–{t.ageMax === 65 ? "65+" : t.ageMax} ans · {GENDERS.find((g) => g.id === t.gender)?.label}</dd></div>
            <div><dt className="text-muted">Texte</dt><dd className="text-ink">{s.adCopy?.headline || "Rédigé par notre équipe"}</dd></div>
            <div><dt className="text-muted">Visuels</dt><dd className="text-ink">{creatives ? `${creatives} fourni${creatives > 1 ? "s" : ""}` : "À créer"}</dd></div>
          </dl>
        </section>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <QuotePanel state={quote} promo={promo} onPromo={setPromo} />
        <p className="text-xs leading-relaxed text-muted">Le paiement se fait à l&apos;étape suivante par Mobile Money. Les résultats d&apos;une campagne dépendent de nombreux facteurs et ne peuvent pas être garantis.</p>
      </aside>
    </div>
  );
}
