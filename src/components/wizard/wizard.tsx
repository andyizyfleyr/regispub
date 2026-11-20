"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, Eye, ImageIcon, ImagePlus, LoaderCircle, MapPin, Share2, Sparkles, Store, Target, Trash2, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { AdPreview } from "@/components/app/ad-preview";
import { AssetThumb, Uploader } from "@/components/app/uploader";
import { ObjectiveIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { AdCopy, EditorData, LinkedAsset } from "@/lib/campaigns/editor-data";
import { adCopyIssue } from "@/lib/campaigns/missing";
import { policyWarnings } from "@/lib/campaigns/policy";
import { missingAccountMessage, missingAccounts, type Accounts } from "@/lib/catalog/accounts";
import { getObjective, objectiveShort } from "@/lib/catalog/objectives";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { AGE_BOUNDS, GENDERS, SECTORS, TARGET_COUNTRIES, type Targeting } from "@/lib/catalog/targeting";
import { cn, formatFcfa } from "@/lib/utils";
import { attachAssetAction, detachAssetAction, placeOrderAction, saveCampaignAction, type CampaignPatch } from "@/server/actions/campaigns";
import { AccountFields, BudgetQuick, Chip, LevelPicker, ObjectivePicker, PlatformPicker, QuotePanel, ScheduleFields, Section, Stepper, useQuote } from "./parts";

export const WIZARD_STEPS = [
  { title: "Réseau", heading: "Où lancer votre publicité ?", icon: <Share2 /> },
  { title: "Annonce", heading: "Votre annonce", icon: <ImageIcon /> },
  { title: "Audience", heading: "À qui la montrer ?", icon: <Users /> },
  { title: "Budget", heading: "Votre budget", icon: <Wallet /> },
];
const LAST = WIZARD_STEPS.length;
const DEFAULT_NAMES = ["Nouvelle campagne", "Ma campagne", "Campagne confiée à un expert"];

type State = EditorData["campaign"] & { business: { id: string | null; name: string; sector: string; city: string; accounts?: Accounts } };
type SetLinks = React.Dispatch<React.SetStateAction<LinkedAsset[]>>;
type StepProps = { s: State; set: (patch: Partial<State>) => void };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const emptyCopy: AdCopy = { headline: "", body: "", cta: "" };
const card = "rounded-[22px] border border-line/70 bg-surface p-4 shadow-card sm:rounded-[28px] sm:p-6";

/** Ce qui manque à une étape pour continuer, ou `null`. Le serveur revérifie tout à l'enregistrement. */
function stepIssue(n: number, s: State, limits: EditorData["limits"], levelPicked = true): string | null {
  const objective = getObjective(s.objective);
  switch (n) {
    case 1: {
      if (!objective) return "Choisissez ce que vous voulez obtenir.";
      if (s.platforms.length !== 1) return "Choisissez le réseau de votre publicité.";
      if (!objective.platforms.includes(s.platforms[0]!)) return `« ${objective.label} » n'est pas proposé sur ${PLATFORMS[s.platforms[0]!].label} : choisissez un autre réseau.`;
      if (s.business.name.trim().length < 2) return "Indiquez le nom de votre activité.";
      if (!SECTORS.includes(s.business.sector)) return "Choisissez votre secteur.";
      const noAccount = missingAccounts(s.platforms, s.business.accounts);
      if (noAccount.length) return missingAccountMessage(noAccount[0]!);
      if (objective.config.requires.includes("whatsapp") && !s.destinationWhatsapp.trim()) return "Indiquez votre numéro WhatsApp : c'est là que vos clients vous écriront.";
      return null;
    }
    case 2: return adCopyIssue(s.adCopy);
    case 3: return s.targeting.countries.length ? null : "Choisissez au moins un pays.";
    default: {
      if (!s.adBudget) return "Choisissez le montant de votre budget.";
      if (s.adBudget < limits.minAdBudget) return `Le budget minimum est de ${formatFcfa(limits.minAdBudget)}.`;
      if (!s.durationDays) return "Choisissez une durée.";
      if (Math.floor(s.adBudget / s.durationDays) < limits.minDailyBudget) return `Il faut au moins ${formatFcfa(limits.minDailyBudget)} par jour : choisissez moins de jours ou un montant plus grand.`;
      if (!s.startDate) return "Choisissez la date de début.";
      if (!levelPicked) return "Choisissez votre formule.";
      return null;
    }
  }
}

/** Première étape encore incomplète (4 si tout est rempli). */
function firstIncomplete(s: State, limits: EditorData["limits"]) {
  for (let n = 1; n < LAST; n++) if (stepIssue(n, s, limits)) return n;
  return LAST;
}

/**
 * Création d'une publicité en quatre étapes : réseau, annonce, audience, budget.
 * Le client remplit tout lui-même ; l'aperçu de l'annonce suit en direct, à droite sur grand écran.
 */
export function Wizard({ data, initialStep }: { data: EditorData; initialStep: number }) {
  const router = useRouter();
  const c0 = data.campaign;
  const b0 = data.businesses.find((b) => b.id === c0.businessId) ?? data.businesses[0] ?? null;
  const [s, setS] = React.useState<State>({
    ...c0,
    // Une publicité se lance sur un seul réseau : un ancien brouillon à plusieurs réseaux est à choisir de nouveau.
    platforms: c0.platforms.length === 1 ? c0.platforms : [],
    business: b0 ? { ...b0 } : { id: null, name: "", sector: "", city: "" },
  });
  // On n'ouvre jamais une étape plus loin que la première encore incomplète.
  const [step, setStep] = React.useState(() => Math.min(LAST, Math.max(1, initialStep), firstIncomplete({ ...c0, platforms: c0.platforms.length === 1 ? c0.platforms : [], business: b0 ? { ...b0 } : { id: null, name: "", sector: "", city: "" } }, data.limits)));
  const [reached, setReached] = React.useState(step);
  const [links, setLinks] = React.useState<LinkedAsset[]>(data.links);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [promo, setPromo] = React.useState(data.promoCode ?? "");
  const [total, setTotal] = React.useState<number | null>(null);
  // La formule n'est pas cochée d'avance : elle l'est seulement si le client l'a déjà choisie et enregistrée.
  const [levelPicked, setLevelPicked] = React.useState(c0.serviceCode !== null || c0.adBudget > 0);
  const top = React.useRef<HTMLDivElement>(null);
  const set = React.useCallback((patch: Partial<State>) => { setS((prev) => ({ ...prev, ...patch })); setError(null); }, []);
  const objective = getObjective(s.objective);

  /** Nom donné à la campagne : ce que le client veut obtenir et le nom de son activité. */
  function autoName() {
    const auto = [objective ? objectiveShort(objective) : "", s.business.name.trim()].filter(Boolean).join(" — ");
    const isDefault = !s.name.trim() || DEFAULT_NAMES.includes(s.name) || s.name === objective?.label || s.name.includes(" — ");
    const name = (isDefault ? auto || s.name : s.name).slice(0, 80);
    return name.trim().length >= 2 ? name : "Ma campagne";
  }

  function patchFor(n: number): CampaignPatch {
    switch (n) {
      case 1: return { platforms: s.platforms, objective: s.objective ?? "", name: autoName(), business: s.business, destinationWhatsapp: s.destinationWhatsapp };
      case 2: return { adCopy: s.adCopy ?? emptyCopy };
      // Villes, centres d'intérêt et reciblage ne sont plus proposés : un ancien brouillon qui en contenait est remis à « tout le pays, tout le monde ».
      case 3: return { targeting: { ...s.targeting, cities: [], interests: [], categories: [], customAudience: { requested: false, note: "" } } };
      default: return { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.platforms[0] ? { [s.platforms[0]]: 100 } : {}, serviceCode: s.serviceCode };
    }
  }

  async function saveStep(n: number, nextStep: number, quiet = false) {
    const issue = stepIssue(n, s, data.limits, levelPicked);
    if (issue) { if (!quiet) setError(issue); return false; }
    setBusy(true);
    if (!quiet) setError(null);
    const patch = patchFor(n);
    const res = await saveCampaignAction(s.id, { ...patch, wizardStep: Math.min(LAST, nextStep) });
    setBusy(false);
    if (!res.ok) { if (!quiet) setError(res.error); return false; }
    const businessId = typeof res.data.businessId === "string" ? res.data.businessId : null;
    setS((prev) => ({ ...prev, name: patch.name ?? prev.name, business: patch.business && businessId ? { ...prev.business, id: businessId } : prev.business }));
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
    setReached((r) => Math.max(r, next));
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

  const meta = WIZARD_STEPS[step - 1]!;

  return (
    <div ref={top} className="mx-auto max-w-4xl scroll-mt-24">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={quit} disabled={busy} title="Enregistrer et quitter" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-3.5 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60">
          <X className="size-3.5" />Quitter
        </button>
        <span className={cn("flex items-center gap-1.5 text-[0.8125rem] text-green transition-opacity duration-300", saved ? "opacity-100" : "opacity-0")} aria-live="polite"><CircleCheck className="size-4" />Enregistré</span>
      </div>

      <div className="mb-6"><Stepper steps={WIZARD_STEPS} current={step} reached={reached} onSelect={go} disabled={busy} /></div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_17.5rem] md:items-start md:gap-6 lg:gap-8">
        <div className="min-w-0">
          <header key={step} className="mb-5 animate-rise">
            <p className="tnum text-[0.8125rem] font-medium text-green">Étape {step} sur {LAST}</p>
            <h1 className="text-[1.5rem] font-semibold leading-tight sm:text-[1.75rem]">{meta.heading}</h1>
          </header>

          <div key={`step-${step}`} className="animate-rise">
            {step === 1 && <NetworkStep s={s} set={set} data={data} />}
            {step === 2 && <AdStep s={s} set={set} data={data} links={links} setLinks={setLinks} />}
            {step === 3 && <AudienceStep s={s} set={set} />}
            {step === 4 && <BudgetStep s={s} set={set} data={data} promo={promo} setPromo={setPromo} onTotal={setTotal} levelPicked={levelPicked} onLevelPicked={() => setLevelPicked(true)} />}
          </div>

          {error && <Notice tone="danger" className="mt-6">{error}</Notice>}

          <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-line bg-canvas/95 px-4 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
            <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => go(step - 1)}><ArrowLeft />Retour</Button>
            {step < LAST ? (
              <Button type="button" size="lg" disabled={busy} aria-busy={busy} onClick={() => go(step + 1)}>{busy && <LoaderCircle className="animate-spin" />}Continuer<ArrowRight /></Button>
            ) : (
              <Button type="button" size="lg" variant="accent" disabled={busy} aria-busy={busy} onClick={order}>
                {busy && <LoaderCircle className="animate-spin" />}Payer{total ? <span className="tnum">· {formatFcfa(total)}</span> : null}<ArrowRight />
              </Button>
            )}
          </div>
        </div>

        {/* Aperçu en direct, à droite. Sur téléphone, il s'affiche sous les champs de l'étape « Annonce ». */}
        <aside className="sticky top-20 hidden md:block" aria-label="Aperçu de l'annonce"><PhonePreview s={s} links={links} /></aside>
      </div>
    </div>
  );
}

// ─────────────────────────── Étape 1 : le réseau ───────────────────────────

function NetworkStep({ s, set, data }: StepProps & { data: EditorData }) {
  const objective = getObjective(s.objective);
  const platform = s.platforms[0] ?? null;
  const [pick, setPick] = React.useState(false);
  // Ce que le client a déjà enregistré n'est plus redemandé. L'état est figé à l'ouverture de l'étape :
  // un champ ne disparaît pas pendant que le client le remplit.
  const [hadWhatsapp] = React.useState(Boolean(s.destinationWhatsapp.trim()));
  const [known] = React.useState(() => {
    const map = new Map(data.businesses.map((b) => [b.id, b]));
    if (s.business.id) map.set(s.business.id, { ...s.business, id: s.business.id });
    return map;
  });
  const saved = s.business.id ? known.get(s.business.id) : undefined;
  const askBusiness = !saved || saved.name.trim().length < 2 || !SECTORS.includes(saved.sector);
  const chooseBusiness = data.businesses.length > 1;
  const askAccount = platform !== null && !saved?.accounts?.[platform]?.trim();
  const askWhatsapp = !hadWhatsapp && Boolean(objective?.config.requires.includes("whatsapp"));
  const setB = (patch: Partial<State["business"]>) => set({ business: { ...s.business, ...patch } });

  function setObjective(code: string) {
    const o = getObjective(code);
    // Un réseau que le nouvel objectif ne propose pas est retiré : le client en choisit un autre.
    set({ objective: code, ...(o && platform && !o.platforms.includes(platform) ? { platforms: [] } : {}) });
    setPick(false);
  }

  return (
    <div className="space-y-7">
      {objective ? (
        <div className="flex items-center gap-3 rounded-[22px] bg-forest px-4 py-3 text-white shadow-lift sm:rounded-[28px] sm:px-6 sm:py-4">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-marigold"><ObjectiveIcon name={objective.icon} className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.78125rem] text-white/70">Vous voulez</span>
            <span className="block truncate text-[1rem] font-semibold">{objectiveShort(objective)}</span>
          </span>
          <Dialog open={pick} onOpenChange={setPick}>
            <DialogTrigger className="shrink-0 rounded-full bg-white/10 px-3.5 py-2 text-[0.8125rem] font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20">Changer</DialogTrigger>
            <DialogContent title="Que voulez-vous obtenir ?" side="bottom">
              <ObjectivePicker value={s.objective} platforms={[]} baseFees={data.baseFees} onChange={setObjective} />
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <Section icon={<Target />} tone="marigold" title="Que voulez-vous obtenir ?">
          <ObjectivePicker value={s.objective} platforms={[]} baseFees={data.baseFees} onChange={setObjective} />
        </Section>
      )}

      <Section icon={<Share2 />} tone="sky" title="Réseau" description="Un seul réseau par publicité.">
        <PlatformPicker value={platform} allowed={objective?.platforms} onChange={(p) => set({ platforms: [p] })} />
      </Section>

      {(askBusiness || chooseBusiness || askAccount || askWhatsapp) && (
        <Section icon={<Store />} title={askBusiness || chooseBusiness ? "Votre activité" : "À compléter"} description={askBusiness ? "Demandé une seule fois : nous le retenons pour vos prochaines publicités." : undefined}>
          <div className="space-y-4">
            {chooseBusiness && (
              <Field label="Entreprise" htmlFor="businessId">
                <Select id="businessId" value={s.business.id ?? ""} onChange={(e) => { const b = data.businesses.find((x) => x.id === e.target.value); set({ business: b ? { ...b } : { id: null, name: "", sector: "", city: "" } }); }}>
                  {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  <option value="">+ Nouvelle entreprise</option>
                </Select>
              </Field>
            )}
            {askBusiness && (
              <>
                <Field label="Nom de votre activité" htmlFor="bname"><Input id="bname" value={s.business.name} maxLength={80} autoComplete="organization" onChange={(e) => setB({ name: e.target.value })} placeholder="Boutique Afi" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Secteur" htmlFor="sector">
                    <Select id="sector" value={s.business.sector} onChange={(e) => setB({ sector: e.target.value })}><option value="" disabled>Choisir…</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</Select>
                  </Field>
                  <Field label="Ville" htmlFor="city" optional><Input id="city" value={s.business.city} maxLength={60} onChange={(e) => setB({ city: e.target.value })} placeholder="Cotonou" /></Field>
                </div>
              </>
            )}
            {askAccount && platform && <AccountFields platforms={[platform]} value={s.business.accounts} onChange={(accounts) => setB({ accounts })} />}
            {askWhatsapp && (
              <Field label="Votre numéro WhatsApp" htmlFor="wa" hint="Vos clients vous écriront sur ce numéro.">
                <Input id="wa" value={s.destinationWhatsapp} maxLength={40} inputMode="tel" autoComplete="tel" onChange={(e) => set({ destinationWhatsapp: e.target.value })} placeholder="01 97 00 00 00" />
              </Field>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─────────────────────────── Étape 2 : l'annonce ───────────────────────────

function AdStep({ s, set, data, links, setLinks }: StepProps & { data: EditorData; links: LinkedAsset[]; setLinks: SetLinks }) {
  const needs = getObjective(s.objective)?.config.requires ?? [];
  const media = links.filter((l) => l.role === "CREATIVE" || l.role === "PRODUCT_MEDIA");
  const copy = s.adCopy ?? emptyCopy;
  const setCopy = (patch: Partial<AdCopy>) => set({ adCopy: { ...copy, ...patch } });
  const warnings = policyWarnings([copy.headline, copy.body].filter(Boolean).join(" "));
  const pack = data.levels.find((l) => l.kind === "PACK");

  return (
    <div className="space-y-6">
      {/* Photo ou vidéo, titre, texte : les trois éléments de l'annonce, au même niveau et dans cet ordre. */}
      <div className={cn(card, "space-y-5")}>
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.84375rem] font-medium text-ink">Photo ou vidéo</p>
          <MediaGrid campaignId={s.id} role="CREATIVE" items={media} setLinks={setLinks} library={data.library} />
          {needs.includes("video") && <p className="text-[0.8125rem] text-muted">Une vidéo est recommandée pour cet objectif.</p>}
          {media.length === 0 && pack && <p className="text-[0.8125rem] text-muted">Pas de visuel ? Choisissez « {pack.name} » à l&apos;étape 4.</p>}
        </div>
        <Field label="Titre" htmlFor="copy-h" hint={<span className="tnum block text-right">{copy.headline.length} / 90</span>}>
          <Input id="copy-h" value={copy.headline} maxLength={90} onChange={(e) => setCopy({ headline: e.target.value })} placeholder="Votre robe sur mesure en 48 h" />
        </Field>
        <Field label="Texte" htmlFor="copy-b" hint={<span className="tnum block text-right">{copy.body.length} / 900</span>}>
          <Textarea id="copy-b" rows={5} value={copy.body} maxLength={900} onChange={(e) => setCopy({ body: e.target.value })} placeholder="Offrez-vous une robe unique, cousue à vos mesures…" />
        </Field>
      </div>

      {warnings.length > 0 && <Notice tone="warn" title="À vérifier">{warnings.map((w) => <p key={w}>{w}</p>)}</Notice>}

      <div className="md:hidden"><PhonePreview s={s} links={links} /></div>
    </div>
  );
}

// ─────────────────────────── Étape 3 : l'audience ───────────────────────────

function AudienceStep({ s, set }: StepProps) {
  const t = s.targeting;
  const latest = React.useRef(t);
  latest.current = t;
  const setT = (patch: Partial<Targeting>) => set({ targeting: { ...latest.current, ...patch } });
  const label = "mb-2 text-[0.8125rem] font-medium text-ink-soft";

  return (
    <div className="space-y-7">
      <Section icon={<MapPin />} title="Zone">
        <p className={label}>Pays</p>
        <div className="flex flex-wrap gap-1.5">
          {TARGET_COUNTRIES.map((c) => (
            <Chip key={c.code} active={t.countries.includes(c.code)} onClick={() => setT({ countries: toggle(t.countries, c.code) })}>{c.name}</Chip>
          ))}
        </div>
      </Section>

      <Section icon={<Users />} tone="sky" title="Profil">
        <div className="space-y-4">
          <div>
            <p className={label}>Genre</p>
            <div className="inline-flex gap-1 rounded-full bg-sand p-1">
              {GENDERS.map((g) => <button key={g.id} type="button" aria-pressed={t.gender === g.id} onClick={() => setT({ gender: g.id as Targeting["gender"] })} className={cn("rounded-full px-4 py-2 text-[0.84375rem] font-medium transition-colors", t.gender === g.id ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>{g.label}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Âge minimum" htmlFor="ageMin"><Select id="ageMin" value={t.ageMin} onChange={(e) => { const v = Number(e.target.value); setT({ ageMin: v, ageMax: Math.max(v, t.ageMax) }); }}>{AGE_BOUNDS.map((a) => <option key={a} value={a}>{a} ans</option>)}</Select></Field>
            <Field label="Âge maximum" htmlFor="ageMax"><Select id="ageMax" value={t.ageMax} onChange={(e) => { const v = Number(e.target.value); setT({ ageMax: v, ageMin: Math.min(v, t.ageMin) }); }}>{AGE_BOUNDS.map((a) => <option key={a} value={a}>{a === 65 ? "65 ans et plus" : `${a} ans`}</option>)}</Select></Field>
          </div>
          <p className="text-xs text-muted">18 ans et plus uniquement.</p>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────── Étape 4 : le budget ───────────────────────────

function BudgetStep({ s, set, data, promo, setPromo, onTotal, levelPicked, onLevelPicked }: StepProps & { data: EditorData; promo: string; setPromo: (v: string) => void; onTotal: (total: number | null) => void; levelPicked: boolean; onLevelPicked: () => void }) {
  const objective = getObjective(s.objective);
  const ready = s.adBudget > 0 && Boolean(s.durationDays) && levelPicked;
  const quote = useQuote(s.id, { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, serviceCode: s.serviceCode, platforms: s.platforms, promoCode: promo, objective: s.objective });
  const baseFee = objective ? data.baseFees[objective.serviceCode] ?? data.limits.minServiceFee : data.limits.minServiceFee;
  const total = ready ? quote.quote?.total ?? null : null;
  React.useEffect(() => { onTotal(total); }, [total, onTotal]);

  return (
    <div className="space-y-7">
      <Section icon={<Wallet />} title="Budget et durée">
        <div className="space-y-5">
          <BudgetQuick limits={data.limits} value={{ adBudget: s.adBudget, durationDays: s.durationDays ?? 0 }} onChange={set}
            recommended={objective ? { daily: objective.config.recommendedDailyBudget, days: objective.config.recommendedDays } : null} />
          <ScheduleFields value={{ durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "" }} onChange={set} />
        </div>
      </Section>

      <Section icon={<Sparkles />} tone="violet" title="Formule">
        <LevelPicker levels={data.levels} value={s.serviceCode} unset={!levelPicked} onChange={(serviceCode) => { set({ serviceCode }); onLevelPicked(); }} baseFee={baseFee} />
      </Section>

      <section data-quote className="space-y-2.5">
        {ready ? <QuotePanel state={quote} promo={promo} onPromo={setPromo} />
          : <p className="rounded-lg border border-dashed border-line-strong bg-paper px-4 py-4 text-[0.875rem] text-muted">Choisissez un montant, une durée et une formule : le total à payer s&apos;affichera ici.</p>}
        <p className="text-[0.8125rem] leading-relaxed text-muted">Les résultats ne sont pas garantis.</p>
      </section>
    </div>
  );
}

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

// ─────────────────────────── Aperçu ───────────────────────────

/** Aperçu de l'annonce sur un téléphone : il suit en direct ce que le client écrit et importe. */
function PhonePreview({ s, links }: { s: State; links: LinkedAsset[] }) {
  const chosen = s.platforms[0] ?? null;
  const platform: PlatformCode = chosen ?? "FACEBOOK";
  const image = links.find((l) => l.role === "CREATIVE" && l.kind === "IMAGE") ?? links.find((l) => l.role === "PRODUCT_MEDIA" && l.kind === "IMAGE");
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-[0.84375rem] font-semibold text-ink"><Eye className="size-4 text-green" />Aperçu</p>
      <div className="mx-auto w-full max-w-[19rem] rounded-[2.25rem] bg-forest p-2 shadow-pop">
        <div className="overflow-hidden rounded-[1.75rem] bg-surface">
          <div className="flex items-center justify-center bg-surface py-2"><span className="h-1.5 w-16 rounded-full bg-line-strong" /></div>
          <div key={platform} className="animate-fade">
            <AdPreview platform={platform} pageName={s.business.name.trim() || "Votre page"} copy={s.adCopy} imageId={image?.assetId ?? null} />
          </div>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-[19rem] text-center text-xs text-muted">{chosen ? `Aperçu indicatif · ${PLATFORMS[chosen].label}` : "Aperçu indicatif. Choisissez un réseau pour le voir sur ce réseau."}</p>
    </div>
  );
}
