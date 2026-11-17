"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleCheck, Eye, Heart, ImageIcon, ImagePlus, Lightbulb, ListChecks, LoaderCircle, MapPin, Megaphone, Pencil, Share2, SlidersHorizontal, Sparkles, Store, Tag, Target, Trash2, Type, Users, Wallet, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AdPreview } from "@/components/app/ad-preview";
import { AssetThumb, Uploader } from "@/components/app/uploader";
import { PlatformIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch, Tip, ToggleRow } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { AdCopy, EditorData, LinkedAsset, StrategyState } from "@/lib/campaigns/editor-data";
import { getObjective, objectiveShort } from "@/lib/catalog/objectives";
import { defaultSplit, PLATFORMS, platformLabel, type PlatformCode } from "@/lib/catalog/platforms";
import { AGE_BOUNDS, CITIES_BY_COUNTRY, CUSTOMER_CATEGORIES, GENDERS, INTEREST_GROUPS, SECTORS, TARGET_COUNTRIES, type Targeting } from "@/lib/catalog/targeting";
import { cn, formatFcfa } from "@/lib/utils";
import {
  attachAssetAction, detachAssetAction, generateStrategyAction, placeOrderAction, saveCampaignAction, suggestTargetingAction, type CampaignPatch,
} from "@/server/actions/campaigns";
import { AccountFields, BudgetFields, Chip, LevelPicker, ObjectivePicker, PlatformPicker, QuotePanel, Section, Stepper, useQuote } from "./parts";
import { accountDisplay, missingAccountMessage, missingAccounts, type Accounts } from "@/lib/catalog/accounts";

export const WIZARD_STEPS = [
  { title: "Objectif", heading: "Que voulez-vous obtenir ?", icon: <Target /> },
  { title: "Annonce", heading: "Votre annonce", icon: <ImageIcon /> },
  { title: "Audience", heading: "À qui la montrer ?", icon: <Users /> },
  { title: "Budget", heading: "Votre budget", icon: <Wallet /> },
];
const LAST = WIZARD_STEPS.length;
const DEFAULT_NAMES = ["Nouvelle campagne", "Campagne confiée à un expert"];

type State = EditorData["campaign"] & { business: { id: string | null; name: string; sector: string; city: string; accounts?: Accounts } };
type SetLinks = React.Dispatch<React.SetStateAction<LinkedAsset[]>>;

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const emptyCopy: AdCopy = { headline: "", body: "", cta: "" };

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
  const [step, setStep] = React.useState(Math.min(LAST, Math.max(1, initialStep)));
  const [links, setLinks] = React.useState<LinkedAsset[]>(data.links);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [promo, setPromo] = React.useState(data.promoCode ?? "");
  const [total, setTotal] = React.useState<number | null>(null);
  const top = React.useRef<HTMLDivElement>(null);
  const set = React.useCallback((patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch })), []);
  const objective = getObjective(s.objective);

  /** Nom donné automatiquement tant que le client ne l'a pas personnalisé. */
  function autoName() {
    const auto = [objective ? objectiveShort(objective) : "", s.business.name.trim()].filter(Boolean).join(" — ");
    const isDefault = !s.name.trim() || DEFAULT_NAMES.includes(s.name) || s.name === objective?.label || (s.business.name.trim().length > 0 && s.name.endsWith(` — ${s.business.name.trim()}`));
    const name = (isDefault ? s.productName.trim() || auto || s.name : s.name).slice(0, 80);
    return name.trim().length >= 2 ? name : "Ma campagne";
  }

  function patchFor(n: number): CampaignPatch | string {
    switch (n) {
      case 1:
        if (!s.platforms.length) return "Choisissez au moins une plateforme pour continuer.";
        if (!s.objective) return "Choisissez un objectif pour continuer.";
        return { platforms: s.platforms, objective: s.objective };
      case 2: {
        const noAccount = missingAccounts(s.platforms, s.business.accounts);
        if (noAccount.length) return missingAccountMessage(noAccount[0]!);
        const copy = s.adCopy;
        const hasCopy = Boolean(copy && (copy.headline.trim() || copy.body.trim()));
        return {
          name: autoName(), business: s.business, productName: s.productName, productDescription: s.productDescription, productPrice: s.productPrice,
          destinationWhatsapp: s.destinationWhatsapp, destinationUrl: s.destinationUrl, ...(hasCopy ? { adCopy: copy! } : {}),
        };
      }
      case 3: return { targeting: s.targeting, audienceNote: s.audienceNote };
      default: return { name: s.name.trim() || autoName(), adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, serviceCode: s.serviceCode };
    }
  }

  async function saveStep(n: number, nextStep: number, quiet = false) {
    const patch = patchFor(n);
    if (typeof patch === "string") { if (!quiet) setError(patch); return false; }
    setBusy(true);
    if (!quiet) setError(null);
    const res = await saveCampaignAction(s.id, { ...patch, wizardStep: Math.min(LAST, nextStep) });
    setBusy(false);
    if (!res.ok) { if (!quiet) setError(res.error); return false; }
    if (patch.name) set({ name: patch.name });
    setWarnings((res.data.warnings as string[] | undefined) ?? []);
    setSaved(true);
    return true;
  }

  React.useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2600);
    return () => clearTimeout(t);
  }, [saved]);

  async function go(next: number) {
    if (next > step && !(await saveStep(step, next))) return;
    setStep(next);
    setError(null);
    top.current?.scrollIntoView({ block: "start" });
  }

  async function quit() {
    await saveStep(step, step, true);
    router.push("/app/campagnes?etat=attente");
  }

  async function order() {
    if (!(await saveStep(LAST, LAST))) return;
    setBusy(true);
    const res = await placeOrderAction(s.id, promo || null);
    if (!res.ok) { setBusy(false); setError(res.error); return; }
    router.push(`/app/paiements/${res.data.orderId as string}`);
  }

  function setPlatforms(platforms: PlatformCode[]) {
    const o = getObjective(s.objective);
    const lost = o && platforms.length > 0 && !o.platforms.some((p) => platforms.includes(p));
    set({ platforms, budgetSplit: defaultSplit(platforms), ...(lost ? { objective: null, strategy: null, adCopy: null } : {}) });
  }

  function setObjective(code: string) {
    const o = getObjective(code);
    set({ objective: code, ...(code !== s.objective ? { strategy: null, adCopy: null, adBudget: o ? o.config.recommendedDailyBudget * o.config.recommendedDays : s.adBudget, durationDays: o?.config.recommendedDays ?? s.durationDays } : {}) });
  }

  const reached = Math.min(LAST, Math.max(c0.wizardStep, step));
  const meta = WIZARD_STEPS[step - 1]!;

  return (
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-24">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button type="button" onClick={quit} disabled={busy} title="Enregistrer et quitter" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60">
          <X className="size-3.5" />Quitter
        </button>
        <span className={cn("flex items-center gap-1.5 text-[13px] text-green transition-opacity duration-300", saved ? "opacity-100" : "opacity-0")} aria-live="polite"><CircleCheck className="size-4" />Enregistré</span>
      </div>

      <div className="mb-7"><Stepper steps={WIZARD_STEPS} current={step} reached={reached} onSelect={go} disabled={busy} /></div>

      <header key={step} className="mb-6 animate-rise">
        <h1 className="text-[24px] font-semibold leading-tight sm:text-[28px]">{meta.heading}</h1>
      </header>

      <div key={`step-${step}`} className="animate-rise">
        {step === 1 && (
          <div className="space-y-7">
            <Section icon={<Share2 />} tone="sky" title="Où diffuser ?">
              <PlatformPicker value={s.platforms} onChange={setPlatforms} extraFee={data.limits.extraPlatformFee} />
            </Section>
            <Section icon={<Target />} tone="marigold" title="Votre objectif">
              <ObjectivePicker value={s.objective} platforms={s.platforms} baseFees={data.baseFees} onChange={setObjective} />
            </Section>
          </div>
        )}
        {step === 2 && <AdStep s={s} set={set} data={data} links={links} setLinks={setLinks} save={() => saveStep(2, 2)} />}
        {step === 3 && <AudienceStep s={s} set={set} />}
        {step === 4 && <BudgetStep s={s} set={set} data={data} links={links} promo={promo} setPromo={setPromo} onTotal={setTotal} onEdit={go} />}
      </div>

      {warnings.length > 0 && <Notice tone="warn" className="mt-6" title="À vérifier">{warnings.map((w) => <p key={w}>{w}</p>)}</Notice>}
      {error && <Notice tone="danger" className="mt-6">{error}</Notice>}

      <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => go(step - 1)}><ArrowLeft />Retour</Button>
        {step < LAST ? (
          <Button type="button" size="lg" disabled={busy} onClick={() => go(step + 1)}>{busy && <LoaderCircle className="animate-spin" />}Continuer<ArrowRight /></Button>
        ) : (
          <Button type="button" size="lg" variant="accent" disabled={busy} onClick={order}>
            {busy && <LoaderCircle className="animate-spin" />}Payer{total ? <span className="tnum hidden sm:inline"> · {formatFcfa(total)}</span> : null}<ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

type StepProps = { s: State; set: (patch: Partial<State>) => void };

// ─────────────────────────── Fichiers ───────────────────────────

export function MediaGrid({ campaignId, role, items, setLinks, library, accept = "media" }: {
  campaignId: string; role: "PRODUCT_MEDIA" | "CREATIVE" | "BRIEF_FILE"; items: LinkedAsset[]; setLinks: SetLinks; library: EditorData["library"]; accept?: "media" | "any" | "image";
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
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {items.map((m) => (
        <div key={`${m.assetId}-${m.role}`} className="group relative aspect-square animate-pop overflow-hidden rounded-md border border-line bg-sand">
          <AssetThumb id={m.assetId} kind={m.kind} name={m.name} />
          {m.linkId && <button type="button" onClick={() => detach(m)} className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-forest/80 text-white opacity-100 backdrop-blur-sm transition-[opacity,background-color] hover:bg-clay sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Retirer ${m.name}`}><Trash2 className="size-3.5" /></button>}
        </div>
      ))}
      <Uploader accept={accept} compact onUploaded={attach} className="aspect-square" label="Importer" hint="" />
      {candidates.length > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-paper px-2 text-center text-sm font-medium text-ink transition-colors hover:border-green hover:bg-green-soft/40">
            <ImagePlus className="size-5 text-muted" />Mes fichiers
          </DialogTrigger>
          <DialogContent title="Mes fichiers" side="bottom">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {candidates.map((a) => (
                <button key={a.id} type="button" onClick={() => { void attach(a); setOpen(false); }} className="aspect-square overflow-hidden rounded-md border border-line transition-colors hover:border-green">
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

// ─────────────────────────── Étape 2 : l'annonce ───────────────────────────

function PhonePreview({ s, links }: { s: State; links: LinkedAsset[] }) {
  const [platform, setPlatform] = React.useState<PlatformCode>(s.platforms[0] ?? "FACEBOOK");
  const current = s.platforms.includes(platform) ? platform : s.platforms[0] ?? "FACEBOOK";
  const image = links.find((l) => l.role === "CREATIVE" && l.kind === "IMAGE") ?? links.find((l) => l.role === "PRODUCT_MEDIA" && l.kind === "IMAGE");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13.5px] font-semibold text-ink">Aperçu</p>
        {s.platforms.length > 1 && (
          <div className="inline-flex gap-1 rounded-full bg-sand p-1">
            {s.platforms.map((p) => (
              <button key={p} type="button" aria-pressed={current === p} aria-label={PLATFORMS[p].label} onClick={() => setPlatform(p)}
                className={cn("flex size-8 items-center justify-center rounded-full transition-colors", current === p ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
                <PlatformIcon platform={p} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-[19rem] rounded-[2.25rem] bg-forest p-2 shadow-pop">
        <div className="overflow-hidden rounded-[1.75rem] bg-surface">
          <div className="flex items-center justify-center bg-surface py-2"><span className="h-1.5 w-16 rounded-full bg-line-strong" /></div>
          <div key={current} className="animate-fade">
            <AdPreview platform={current} pageName={s.business.name || "Votre page"} copy={s.adCopy} imageId={image?.assetId ?? null} />
          </div>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-[19rem] text-center text-xs text-muted">Aperçu indicatif · {PLATFORMS[current].label}</p>
    </div>
  );
}

function AdStep({ s, set, data, links, setLinks, save }: StepProps & { data: EditorData; links: LinkedAsset[]; setLinks: SetLinks; save: () => Promise<boolean> }) {
  const objective = getObjective(s.objective);
  const needs = objective?.config.requires ?? [];
  const media = links.filter((l) => l.role === "CREATIVE" || l.role === "PRODUCT_MEDIA");
  const setB = (patch: Partial<State["business"]>) => set({ business: { ...s.business, ...patch } });
  const copy = s.adCopy ?? emptyCopy;
  const setCopy = (patch: Partial<AdCopy>) => set({ adCopy: { ...copy, ...patch } });
  const st = s.strategy;
  const [writing, setWriting] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  // Une activité déjà connue est résumée sur une ligne : inutile de reposer les mêmes questions.
  const [editBusiness, setEditBusiness] = React.useState(!(s.business.id && s.business.name && s.business.sector && s.business.city));
  const [showWa] = React.useState(Boolean(s.destinationWhatsapp) || needs.includes("whatsapp"));
  const [showLink] = React.useState(Boolean(s.destinationUrl));
  // Comptes déjà connus : rien à ressaisir. Sinon un champ par réseau choisi.
  const [askAccounts] = React.useState(missingAccounts(s.platforms, s.business.accounts).length > 0);
  const knownAccounts = s.platforms.map((p) => s.business.accounts?.[p]).filter((v): v is string => Boolean(v)).map(accountDisplay);
  const [showText, setShowText] = React.useState(Boolean(s.adCopy?.headline || s.adCopy?.body));
  const pack = data.levels.find((l) => l.kind === "PACK");
  const alternatives = st ? [...st.texts, ...st.variants].filter((t) => !(t.headline === copy.headline && t.body === copy.body)).slice(0, 4) : [];

  async function write() {
    if ((copy.headline.trim() || copy.body.trim()) && !window.confirm("Remplacer votre texte actuel par une nouvelle proposition ?")) return;
    // La proposition s'appuie sur les informations enregistrées : on enregistre d'abord.
    if (!(await save())) return;
    setWriting(true);
    const res = await generateStrategyAction(s.id);
    setWriting(false);
    if (!res.ok) { toast.error(res.error); return; }
    setNotice((res.data.notice as string | null) ?? null);
    set({ strategy: res.data.strategy as StrategyState, adCopy: (res.data.adCopy as AdCopy | null) ?? s.adCopy });
    toast.success("Texte proposé.");
  }

  const textOpen = showText || Boolean(copy.headline || copy.body);
  const summary = "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink sm:px-5";

  return (
    <div className="space-y-7">
      <Section icon={<Store />} title="Votre activité">
        <div className="space-y-4">
          {!editBusiness ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 sm:px-5">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{s.business.name}</span>
                <span className="block truncate text-[13.5px] text-muted">{[s.business.sector, s.business.city].filter(Boolean).join(" · ")}</span>
                {!askAccounts && knownAccounts.length > 0 && <span className="mt-0.5 block truncate text-[13px] text-green">{knownAccounts.join(" · ")}</span>}
              </span>
              <button type="button" onClick={() => setEditBusiness(true)} className="shrink-0 rounded-full px-2.5 py-1 text-[13.5px] font-medium text-green hover:bg-green-soft">Modifier</button>
            </div>
          ) : (
            <>
              {data.businesses.length > 1 && (
                <Field label="Entreprise" htmlFor="businessId">
                  <Select id="businessId" value={s.business.id ?? ""} onChange={(e) => { const b = data.businesses.find((x) => x.id === e.target.value); set({ business: b ? { ...b } : { id: null, name: "", sector: "", city: "" } }); }}>
                    {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    <option value="">+ Nouvelle entreprise</option>
                  </Select>
                </Field>
              )}
              <Field label="Nom de l'entreprise" htmlFor="bname"><Input id="bname" value={s.business.name} maxLength={80} onChange={(e) => setB({ name: e.target.value })} placeholder="Boutique Afi" /></Field>
              <Field label="Secteur" htmlFor="sector">
                <Select id="sector" value={s.business.sector} onChange={(e) => setB({ sector: e.target.value })}><option value="" disabled>Choisir…</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</Select>
              </Field>
              <Field label="Ville" htmlFor="city"><Input id="city" value={s.business.city} maxLength={60} onChange={(e) => setB({ city: e.target.value })} placeholder="Cotonou" /></Field>
            </>
          )}
          {(askAccounts || editBusiness) && <AccountFields platforms={s.platforms} value={s.business.accounts} onChange={(accounts) => setB({ accounts })} />}
          {showWa && (
            <Field label="Numéro WhatsApp" htmlFor="wa">
              <Input id="wa" value={s.destinationWhatsapp} maxLength={40} inputMode="tel" onChange={(e) => set({ destinationWhatsapp: e.target.value })} placeholder="01 97 00 00 00" />
            </Field>
          )}
          {showLink && (
            <Field label="Lien de votre page" htmlFor="url">
              <Input id="url" type="url" value={s.destinationUrl} maxLength={300} onChange={(e) => set({ destinationUrl: e.target.value })} placeholder="https://facebook.com/votrepage" />
            </Field>
          )}
        </div>
      </Section>

      <Section icon={<Tag />} tone="marigold" title="Votre offre">
        <div className="space-y-4">
          <Field label="Que vendez-vous ?" htmlFor="pdesc" hint={<span className="tnum block text-right">{s.productDescription.trim().length} / 1 500</span>}>
            <Textarea id="pdesc" rows={4} value={s.productDescription} maxLength={1500} onChange={(e) => set({ productDescription: e.target.value })} placeholder="Robes en wax cousues main, 15 000 F, livraison à Cotonou en 48 h…" />
          </Field>
        </div>
      </Section>

      <Section icon={<ImageIcon />} tone="sky" title="Photo ou vidéo" description={needs.includes("video") ? "Vidéo recommandée." : undefined}>
        <MediaGrid campaignId={s.id} role="CREATIVE" items={media} setLinks={setLinks} library={data.library} />
        {media.length === 0 && pack && <p className="mt-3 text-[13.5px] text-muted">Pas de visuel ? Choisissez « {pack.name} » à l&apos;étape 4.</p>}
      </Section>

      <Section icon={<Type />} tone="violet" title="Texte"
        action={<Button type="button" variant="soft" size="sm" disabled={writing} onClick={write}>{writing ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}{writing ? "Rédaction…" : st ? "Autre proposition" : "Rédiger pour moi"}</Button>}>
        <div className="space-y-4">
          {notice && <Notice tone="info">{notice}</Notice>}
          {textOpen ? (
            <>
              <Field label="Texte" htmlFor="copy-b" hint={<span className="tnum block text-right">{copy.body.length} / 900</span>}>
                <Textarea id="copy-b" rows={4} value={copy.body} maxLength={900} onChange={(e) => setCopy({ body: e.target.value })} placeholder="Offrez-vous une robe unique, cousue à vos mesures…" />
              </Field>
              <Field label="Titre" htmlFor="copy-h"><Input id="copy-h" value={copy.headline} maxLength={90} onChange={(e) => setCopy({ headline: e.target.value })} placeholder="Votre robe sur mesure en 48 h" /></Field>
            </>
          ) : (
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-4 py-3 text-[13.5px] text-muted">
              Notre équipe peut l&apos;écrire pour vous.
              <button type="button" onClick={() => setShowText(true)} className="font-medium text-green hover:underline">Écrire moi-même</button>
            </p>
          )}

          {alternatives.length > 0 && (
            <details className="group">
              <summary className={summary}><span className="flex items-center gap-2.5"><Sparkles className="size-4 text-violet" />{alternatives.length} autre{alternatives.length > 1 ? "s" : ""} texte{alternatives.length > 1 ? "s" : ""}</span><ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
              <div className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {alternatives.map((t, i) => (
                  <button key={i} type="button" onClick={() => set({ adCopy: { headline: t.headline, body: t.body, cta: t.cta } })} className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-paper sm:px-5">
                    <span className="block text-sm font-medium leading-snug text-ink">{t.headline}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-snug text-muted">{t.body}</span>
                    <span className="mt-1.5 block text-[13px] font-medium text-green">Utiliser</span>
                  </button>
                ))}
              </div>
            </details>
          )}

          {st && (st.hooks.length > 0 || st.visualConcepts.length > 0) && (
            <details className="group">
              <summary className={summary}><span className="flex items-center gap-2.5"><Lightbulb className="size-4 text-[#9a6400]" />Idées</span><ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
              <div className="mt-2 space-y-4 rounded-lg border border-line bg-surface px-4 py-4 text-[13.5px] sm:px-5">
                {st.hooks.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-medium text-ink">Accroches</p>
                    <ul className="space-y-1 text-ink-soft">{st.hooks.slice(0, 4).map((h, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-green" />{h}</li>)}</ul>
                  </div>
                )}
                {st.visualConcepts.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-medium text-ink">Visuels</p>
                    <ul className="space-y-1.5 text-ink-soft">{st.visualConcepts.slice(0, 3).map((v, i) => <li key={i}><span className="text-ink">{v.title}</span><span className="block text-[13px] text-muted">{v.description}</span></li>)}</ul>
                  </div>
                )}
              </div>
            </details>
          )}

          <details className="group">
            <summary className={summary}><span className="flex items-center gap-2.5"><Eye className="size-4 text-green" />Aperçu</span><ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
            <div className="mt-3"><PhonePreview s={s} links={links} /></div>
          </details>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────── Étape 3 : l'audience ───────────────────────────

function AudienceStep({ s, set }: StepProps) {
  const t = s.targeting;
  const latest = React.useRef(t);
  latest.current = t;
  const setT = (patch: Partial<Targeting>) => set({ targeting: { ...latest.current, ...patch } });
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [rationale, setRationale] = React.useState<{ text: string; engine: string } | null>(null);
  const cities = t.countries.flatMap((c) => (CITIES_BY_COUNTRY[c] ?? []).map((city) => ({ city, country: c })));
  const pristine = !t.interests.length && !t.cities.length && !t.categories.length;

  const suggest = React.useCallback(async (silent = false) => {
    setLoading(true);
    const res = await suggestTargetingAction(s.id);
    setLoading(false);
    if (!res.ok) { if (!silent) toast.error(res.error); return; }
    const a = res.data.advice as { cities: string[]; ageMin: number; ageMax: number; gender: Targeting["gender"]; interests: string[]; categories: string[]; rationale: string };
    const now = latest.current;
    const allowedCities = new Set(now.countries.flatMap((c) => CITIES_BY_COUNTRY[c] ?? []));
    const known = new Set(INTEREST_GROUPS.flatMap((g) => g.items));
    const snap = (v: number) => AGE_BOUNDS.reduce((best, b) => (Math.abs(b - v) < Math.abs(best - v) ? b : best), AGE_BOUNDS[0] as number);
    set({
      targeting: {
        ...now, cities: a.cities.filter((c) => allowedCities.has(c)), ageMin: Math.min(snap(a.ageMin), snap(a.ageMax)), ageMax: Math.max(snap(a.ageMin), snap(a.ageMax)), gender: a.gender,
        interests: a.interests.filter((i) => known.has(i)), categories: a.categories.filter((c) => CUSTOMER_CATEGORIES.includes(c)),
      },
    });
    setRationale({ text: a.rationale, engine: res.data.engine as string });
  }, [s.id, set]);

  // Première visite : l'audience est proposée d'office, le client n'a rien à régler.
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (asked.current || !pristine) return;
    asked.current = true;
    void suggest(true);
  }, [pristine, suggest]);

  const zone = t.cities.length ? t.cities.slice(0, 3).join(", ") + (t.cities.length > 3 ? ` +${t.cities.length - 3}` : "") : t.countries.map((c) => TARGET_COUNTRIES.find((x) => x.code === c)?.name ?? c).join(", ");
  const gender = GENDERS.find((g) => g.id === t.gender)?.label ?? "Tout le monde";
  const interests = [...t.interests, ...t.categories];

  return (
    <div className="space-y-6">
      <section aria-labelledby="audience">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 id="audience" className="text-[15px] font-semibold tracking-normal [font-family:var(--font-sans)]">{loading ? "Analyse…" : "Audience proposée"}</h2>
          <button type="button" disabled={loading} onClick={() => suggest()} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-green hover:underline disabled:opacity-60">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}Reproposer
          </button>
        </div>
        <ul className={cn("grid gap-2.5 transition-opacity sm:grid-cols-3", loading && "opacity-50")}>
          {[
            { icon: <MapPin />, tone: "bg-green-soft text-green", label: "Zone", value: zone || "À définir" },
            { icon: <Users />, tone: "bg-sky-soft text-sky", label: "Profil", value: `${gender}, ${t.ageMin}–${t.ageMax >= 65 ? "65+" : t.ageMax} ans` },
            { icon: <Heart />, tone: "bg-rose-soft text-rose", label: "Intérêts", value: interests.length ? `${interests.length} choisi${interests.length > 1 ? "s" : ""}` : "Audience large" },
          ].map((x) => (
            <li key={x.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card sm:flex-col sm:items-start sm:p-4">
              <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", x.tone)}>{x.icon}</span>
              <span className="min-w-0"><span className="block text-[12.5px] text-muted">{x.label}</span><span className="block text-[15px] font-semibold leading-snug text-ink">{x.value}</span></span>
            </li>
          ))}
        </ul>
        {rationale && (
          <details className="group mt-2.5 text-[13.5px] text-muted">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-medium text-ink-soft [&::-webkit-details-marker]:hidden"><Lightbulb className="size-4 text-[#9a6400]" />Pourquoi ?<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></summary>
            <p className="mt-1.5 leading-relaxed">{rationale.text}</p>
          </details>
        )}
      </section>


      <div className="rounded-lg border border-line bg-surface">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5">
          <span className="flex items-center gap-2.5 font-medium text-ink"><SlidersHorizontal className="size-4 text-green" />Personnaliser</span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="animate-rise space-y-7 border-t border-line px-4 py-5 sm:px-5">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold [font-family:var(--font-sans)]"><MapPin className="size-4 text-green" />Zone</h3>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-soft">Pays</p>
                <div className="flex flex-wrap gap-1.5">{TARGET_COUNTRIES.map((c) => <Chip key={c.code} active={t.countries.includes(c.code)} onClick={() => { const countries = toggle(t.countries, c.code); const ok = new Set(countries.flatMap((x) => CITIES_BY_COUNTRY[x] ?? [])); setT({ countries: countries.length ? countries : t.countries, cities: t.cities.filter((x) => ok.has(x)) }); }}>{c.name}</Chip>)}</div>
              </div>
              {cities.length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink-soft">Villes <span className="font-normal text-muted">— aucune = tout le pays</span></p>
                  <div className="flex flex-wrap gap-1.5">{cities.map(({ city }) => <Chip key={city} active={t.cities.includes(city)} onClick={() => setT({ cities: toggle(t.cities, city) })}>{city}</Chip>)}</div>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t border-line pt-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold [font-family:var(--font-sans)]"><Users className="size-4 text-sky" />Profil</h3>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-soft">Genre</p>
                <div className="inline-flex gap-1 rounded-full bg-sand p-1">
                  {GENDERS.map((g) => <button key={g.id} type="button" aria-pressed={t.gender === g.id} onClick={() => setT({ gender: g.id as Targeting["gender"] })} className={cn("rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors", t.gender === g.id ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>{g.label}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Âge minimum" htmlFor="ageMin"><Select id="ageMin" value={t.ageMin} onChange={(e) => { const v = Number(e.target.value); setT({ ageMin: v, ageMax: Math.max(v, t.ageMax) }); }}>{AGE_BOUNDS.map((a) => <option key={a} value={a}>{a} ans</option>)}</Select></Field>
                <Field label="Âge maximum" htmlFor="ageMax"><Select id="ageMax" value={t.ageMax} onChange={(e) => { const v = Number(e.target.value); setT({ ageMax: v, ageMin: Math.min(v, t.ageMin) }); }}>{AGE_BOUNDS.map((a) => <option key={a} value={a}>{a === 65 ? "65 ans et plus" : `${a} ans`}</option>)}</Select></Field>
              </div>
              <p className="text-xs text-muted">18 ans et plus uniquement.</p>
            </div>

            <div className="space-y-3 border-t border-line pt-6">
              <div className="flex items-baseline justify-between"><h3 className="flex items-center gap-2 text-[15px] font-semibold [font-family:var(--font-sans)]"><Heart className="size-4 text-rose" />Centres d&apos;intérêt</h3><span className="tnum text-xs text-muted">{t.interests.length} sélectionné{t.interests.length > 1 ? "s" : ""}</span></div>
              {INTEREST_GROUPS.map((g) => {
                const picked = g.items.filter((i) => t.interests.includes(i)).length;
                return (
                  <details key={g.group} className="group rounded-md bg-paper" open={picked > 0 || undefined}>
                    <summary className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px] font-medium text-ink">
                      {g.group}
                      <span className="flex items-center gap-2">{picked > 0 && <span className="tnum rounded-full bg-forest px-2 py-px text-[11px] font-semibold text-white">{picked}</span>}<ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></span>
                    </summary>
                    <div className="flex flex-wrap gap-1.5 px-4 pb-4">{g.items.map((i) => <Chip key={i} active={t.interests.includes(i)} disabled={!t.interests.includes(i) && t.interests.length >= 25} onClick={() => setT({ interests: toggle(t.interests, i) })}>{i}</Chip>)}</div>
                  </details>
                );
              })}
            </div>

            <div className="border-t border-line pt-6">
              <ToggleRow icon={<Users />} label="Recibler mes clients" htmlFor="custom-aud">
                <Switch id="custom-aud" checked={t.customAudience.requested} onCheckedChange={(v) => setT({ customAudience: { ...t.customAudience, requested: v } })} />
              </ToggleRow>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Étape 4 : budget et récapitulatif ───────────────────────────

function BudgetStep({ s, set, data, links, promo, setPromo, onTotal, onEdit }: StepProps & { data: EditorData; links: LinkedAsset[]; promo: string; setPromo: (v: string) => void; onTotal: (total: number | null) => void; onEdit: (step: number) => void }) {
  const objective = getObjective(s.objective);
  const quote = useQuote(s.id, { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, serviceCode: s.serviceCode, platforms: s.platforms, promoCode: promo });
  const baseFee = objective ? data.baseFees[objective.serviceCode] ?? data.limits.minServiceFee : data.limits.minServiceFee;
  const t = s.targeting;
  const visuals = links.filter((l) => l.role === "CREATIVE" || l.role === "PRODUCT_MEDIA").length;
  const total = quote.quote?.total ?? null;
  React.useEffect(() => { onTotal(total); }, [total, onTotal]);

  const rows: { label: string; icon: React.ReactNode; value: string; step: number }[] = [
    { label: "Objectif", icon: <Megaphone />, value: `${objective ? objectiveShort(objective) : "—"} · ${platformLabel(s.platforms)}`, step: 1 },
    { label: "Annonce", icon: <ImageIcon />, value: `${s.business.name || "—"} · ${s.adCopy?.headline || "texte par notre équipe"} · ${visuals ? `${visuals} visuel${visuals > 1 ? "s" : ""}` : "visuels à créer"}`, step: 2 },
    { label: "Audience", icon: <Users />, value: `${t.cities.length ? t.cities.slice(0, 3).join(", ") + (t.cities.length > 3 ? "…" : "") : t.countries.map((c) => TARGET_COUNTRIES.find((x) => x.code === c)?.name).join(", ")} · ${t.ageMin}–${t.ageMax === 65 ? "65+" : t.ageMax} ans · ${GENDERS.find((g) => g.id === t.gender)?.label}`, step: 3 },
  ];

  return (
    <div className="space-y-7">
        <Section icon={<Wallet />} title="Budget et durée">
          <BudgetFields data={data} value={{ adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, platforms: s.platforms }} onChange={set}
            recommended={objective ? { daily: objective.config.recommendedDailyBudget, days: objective.config.recommendedDays } : null} />
        </Section>

        <Section icon={<Sparkles />} tone="violet" title="Formule">
          <LevelPicker levels={data.levels} value={s.serviceCode} onChange={(serviceCode) => set({ serviceCode })} baseFee={baseFee} />
        </Section>

        <Section icon={<ListChecks />} tone="sky" title="Récapitulatif">
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-3 px-4 py-3">
                <span title={r.label} className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sand text-ink-soft [&_svg]:size-4">{r.icon}<span className="sr-only">{r.label}</span></span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.value}</span>
                <Tip label="Modifier"><button type="button" onClick={() => onEdit(r.step)} aria-label={`Modifier : ${r.label}`} className="flex size-9 shrink-0 items-center justify-center rounded-full text-green hover:bg-green-soft"><Pencil className="size-4" /></button></Tip>
              </li>
            ))}
          </ul>
        </Section>

        <section data-quote className="space-y-2.5">
          <QuotePanel state={quote} promo={promo} onPromo={setPromo} />
          <p className="text-[13px] leading-relaxed text-muted">Les résultats ne sont pas garantis.</p>
        </section>
    </div>
  );
}
