"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Eye, Heart, ImagePlus, LoaderCircle, MapPin, Sparkles, Store, Trash2, Type, Users, Wallet, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AdPreview } from "@/components/app/ad-preview";
import { AssetThumb, Uploader } from "@/components/app/uploader";
import { ObjectiveIcon, PlatformIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch, ToggleRow } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { AdCopy, EditorData, LinkedAsset } from "@/lib/campaigns/editor-data";
import { policyWarnings } from "@/lib/campaigns/policy";
import { getObjective, objectiveShort } from "@/lib/catalog/objectives";
import { defaultSplit, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { defaultAudience } from "@/lib/catalog/audience-defaults";
import { AGE_BOUNDS, CITIES_BY_COUNTRY, CUSTOMER_CATEGORIES, GENDERS, INTEREST_GROUPS, SECTORS, TARGET_COUNTRIES, type Targeting } from "@/lib/catalog/targeting";
import { cn, formatDate, formatFcfa } from "@/lib/utils";
import { attachAssetAction, detachAssetAction, placeOrderAction, saveCampaignAction, type CampaignPatch } from "@/server/actions/campaigns";
import { AccountFields, BudgetQuick, Chip, LevelPicker, ObjectivePicker, PlatformPicker, QuotePanel, ScheduleFields, useQuote } from "./parts";
import { missingAccountMessage, missingAccounts, type Accounts } from "@/lib/catalog/accounts";

const DEFAULT_NAMES = ["Nouvelle campagne", "Campagne confiée à un expert"];

type State = EditorData["campaign"] & { business: { id: string | null; name: string; sector: string; city: string; accounts?: Accounts } };
type SetLinks = React.Dispatch<React.SetStateAction<LinkedAsset[]>>;
/** Bloc de la page concerné par une erreur : on y fait défiler l'écran et le message s'y affiche. */
type BlockId = "objectif" | "reseaux" | "annonce" | "budget" | "fin";
type Issue = { block: BlockId; message: string };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const emptyCopy: AdCopy = { headline: "", body: "", cta: "" };
const snapAge = (v: number) => AGE_BOUNDS.reduce((best, b) => (Math.abs(b - v) < Math.abs(best - v) ? b : best), AGE_BOUNDS[0] as number);

/** Bloc numéroté : la page se lit de haut en bas, un bloc après l'autre. */
function Block({ id, n, title, hint, issue, children }: { id: BlockId; n: number; title: string; hint?: React.ReactNode; issue: Issue | null; children: React.ReactNode }) {
  return (
    <section id={`bloc-${id}`} aria-labelledby={`titre-${id}`} className="scroll-mt-20 rounded-[22px] border border-line/70 bg-surface p-4 shadow-card sm:rounded-[28px] sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-forest text-[0.875rem] font-semibold text-white">{n}</span>
        <div className="min-w-0">
          <h2 id={`titre-${id}`} className="text-[1.0625rem] font-semibold leading-snug">{title}</h2>
          {hint && <p className="text-[0.8125rem] text-muted">{hint}</p>}
        </div>
      </div>
      {children}
      {issue?.block === id && <Notice tone="danger" className="mt-4">{issue.message}</Notice>}
    </section>
  );
}

/** Réglage déjà fait pour le client : une ligne avec sa valeur, qui s'ouvre pour la changer. */
function Setting({ icon, title, value, children }: { icon: React.ReactNode; title: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line first:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sand text-ink-soft [&_svg]:size-4">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.78125rem] text-muted">{title}</span>
          <span className="block truncate text-[0.90625rem] font-medium text-ink">{value}</span>
        </span>
        <span className="shrink-0 text-[0.8125rem] font-medium text-green group-open:hidden">Changer</span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="animate-rise px-4 pb-5 pt-1 sm:px-5">{children}</div>
    </details>
  );
}

/**
 * Création d'une publicité sur une seule page : où, quoi, combien, puis payer.
 * Tout le reste (audience, texte, date, formule) est déjà réglé et reste modifiable en bas de page.
 */
export function Wizard({ data }: { data: EditorData }) {
  const router = useRouter();
  const c0 = data.campaign;
  const b0 = data.businesses.find((b) => b.id === c0.businessId) ?? data.businesses[0] ?? null;
  const objective0 = getObjective(c0.objective);
  const [s, setS] = React.useState<State>({
    ...c0, business: b0 ? { ...b0 } : { id: null, name: "", sector: "", city: "Cotonou" },
    adBudget: c0.adBudget || (objective0 ? Math.max(data.limits.minAdBudget, objective0.config.recommendedDailyBudget * objective0.config.recommendedDays) : 0),
    durationDays: c0.durationDays ?? objective0?.config.recommendedDays ?? 7,
  });
  const [links, setLinks] = React.useState<LinkedAsset[]>(data.links);
  const [busy, setBusy] = React.useState(false);
  const [issue, setIssue] = React.useState<Issue | null>(null);
  const [promo, setPromo] = React.useState(data.promoCode ?? "");
  const [pickObjective, setPickObjective] = React.useState(false);
  const set = React.useCallback((patch: Partial<State>) => { setS((prev) => ({ ...prev, ...patch })); setIssue(null); }, []);
  const setB = (patch: Partial<State["business"]>) => set({ business: { ...s.business, ...patch } });
  const objective = getObjective(s.objective);
  const needs = objective?.config.requires ?? [];

  // L'activité déjà connue n'est pas redemandée ; elle reste modifiable dans les réglages.
  const [knownBusiness] = React.useState(Boolean(b0?.id && b0.name && b0.sector));
  // Un compte déjà enregistré n'est pas redemandé : seuls les réseaux choisis sans compte connu ont un champ.
  const toAsk = s.platforms.filter((p) => !b0?.accounts?.[p]?.trim());
  const [hadWhatsapp] = React.useState(Boolean(c0.destinationWhatsapp));
  const askWhatsapp = hadWhatsapp || needs.includes("whatsapp");

  // Audience de départ selon le secteur et la ville, tant que le client n'y a pas touché.
  const audienceTouched = React.useRef(Boolean(c0.targeting.interests.length || c0.targeting.cities.length || c0.targeting.categories.length));
  const { sector, city } = s.business;
  React.useEffect(() => {
    if (audienceTouched.current || !sector) return;
    const d = defaultAudience({ sector, city });
    setS((prev) => {
      const allowed = new Set(prev.targeting.countries.flatMap((c) => CITIES_BY_COUNTRY[c] ?? []));
      return { ...prev, targeting: { ...prev.targeting, cities: d.cities.filter((c) => allowed.has(c)), ageMin: snapAge(d.ageMin), ageMax: snapAge(d.ageMax), gender: d.gender, interests: d.interests, categories: d.categories.filter((c) => CUSTOMER_CATEGORIES.includes(c)) } };
    });
  }, [sector, city]);
  const setTargeting = (targeting: Targeting) => { audienceTouched.current = true; set({ targeting }); };

  const quote = useQuote(s.id, { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, serviceCode: s.serviceCode, platforms: s.platforms, promoCode: promo, objective: s.objective });
  const total = quote.quote?.total ?? null;
  const baseFee = objective ? data.baseFees[objective.serviceCode] ?? data.limits.minServiceFee : data.limits.minServiceFee;
  const pack = data.levels.find((l) => l.kind === "PACK") ?? null;
  const level = data.levels.find((l) => l.code === s.serviceCode) ?? null;
  const media = links.filter((l) => l.role === "CREATIVE" || l.role === "PRODUCT_MEDIA");
  const copy = s.adCopy ?? emptyCopy;
  const hasCopy = Boolean(copy.headline.trim() || copy.body.trim());
  const warnings = policyWarnings([s.productDescription, copy.headline, copy.body].filter(Boolean).join(" "));

  /** Nom donné automatiquement tant que le client ne l'a pas personnalisé. */
  function autoName() {
    const auto = [objective ? objectiveShort(objective) : "", s.business.name.trim()].filter(Boolean).join(" — ");
    const isDefault = !s.name.trim() || DEFAULT_NAMES.includes(s.name) || s.name === objective?.label || (s.business.name.trim().length > 0 && s.name.endsWith(` — ${s.business.name.trim()}`));
    const name = (isDefault ? s.productName.trim() || auto || s.name : s.name).slice(0, 80);
    return name.trim().length >= 2 ? name : "Ma campagne";
  }

  /** Ce qui manque avant de payer, dans l'ordre de la page. Le serveur revérifie tout. */
  function check(): Issue | null {
    if (!s.objective) return { block: "objectif", message: "Choisissez ce que vous voulez obtenir." };
    if (!s.platforms.length) return { block: "reseaux", message: "Choisissez au moins un réseau." };
    const noAccount = missingAccounts(s.platforms, s.business.accounts);
    if (noAccount.length) return { block: "reseaux", message: missingAccountMessage(noAccount[0]!) };
    if (needs.includes("whatsapp") && !s.destinationWhatsapp.trim()) return { block: "reseaux", message: "Indiquez votre numéro WhatsApp : c'est là que vos clients vous écriront." };
    if (s.business.name.trim().length < 2) return { block: "annonce", message: "Indiquez le nom de votre activité." };
    if (!SECTORS.includes(s.business.sector)) return { block: "annonce", message: "Choisissez votre secteur." };
    if (s.productDescription.trim().length < 20) return { block: "annonce", message: "Dites en une phrase ou deux ce que vous vendez (20 caractères au minimum)." };
    if (s.adBudget < data.limits.minAdBudget) return { block: "budget", message: `Le budget minimum est de ${formatFcfa(data.limits.minAdBudget)}.` };
    if (!s.durationDays) return { block: "budget", message: "Choisissez une durée." };
    if (Math.floor(s.adBudget / s.durationDays) < data.limits.minDailyBudget) return { block: "budget", message: `Il faut au moins ${formatFcfa(data.limits.minDailyBudget)} par jour : choisissez moins de jours ou un montant plus grand.` };
    return null;
  }

  /** Les quatre parties de la page, enregistrées ensemble au paiement ou une par une quand le client quitte. */
  function patches(): CampaignPatch[] {
    return [
      { platforms: s.platforms, ...(s.objective ? { objective: s.objective } : {}) },
      {
        name: autoName(), business: s.business, productName: s.productName, productDescription: s.productDescription, productPrice: s.productPrice,
        destinationWhatsapp: s.destinationWhatsapp, destinationUrl: s.destinationUrl, ...(hasCopy ? { adCopy: copy } : {}),
      },
      { targeting: s.targeting, audienceNote: s.audienceNote },
      { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, serviceCode: s.serviceCode },
    ];
  }

  function show(next: Issue) {
    setIssue(next);
    requestAnimationFrame(() => document.getElementById(`bloc-${next.block}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function quit() {
    setBusy(true);
    // Brouillon : chaque partie valable est gardée, les autres seront à compléter au retour.
    for (const patch of patches()) await saveCampaignAction(s.id, patch);
    router.push("/app/campagnes?etat=attente");
  }

  async function order() {
    const missing = check();
    if (missing) { show(missing); return; }
    setBusy(true);
    setIssue(null);
    const all: CampaignPatch = Object.assign({}, ...patches());
    const saved = await saveCampaignAction(s.id, { ...all, wizardStep: 4 });
    if (!saved.ok) { setBusy(false); show({ block: "fin", message: saved.error }); return; }
    const res = await placeOrderAction(s.id, promo || null);
    if (!res.ok) { setBusy(false); show({ block: "fin", message: res.error }); return; }
    router.push(`/app/paiements/${res.data.orderId as string}`);
  }

  function setPlatforms(platforms: PlatformCode[]) {
    const o = getObjective(s.objective);
    const lost = o && platforms.length > 0 && !o.platforms.some((p) => platforms.includes(p));
    set({ platforms, budgetSplit: defaultSplit(platforms), ...(lost ? { objective: null, adCopy: null } : {}) });
  }

  function setObjective(code: string) {
    const o = getObjective(code);
    set({ objective: code, ...(code !== s.objective ? { adCopy: null, adBudget: o ? Math.max(data.limits.minAdBudget, o.config.recommendedDailyBudget * o.config.recommendedDays) : s.adBudget, durationDays: o?.config.recommendedDays ?? s.durationDays } : {}) });
    setPickObjective(false);
  }

  const t = s.targeting;
  const zone = t.cities.length ? t.cities.slice(0, 2).join(", ") + (t.cities.length > 2 ? ` +${t.cities.length - 2}` : "") : t.countries.map((c) => TARGET_COUNTRIES.find((x) => x.code === c)?.name ?? c).join(", ");
  const audienceLabel = `${zone} · ${t.ageMin}–${t.ageMax >= 65 ? "65+" : t.ageMax} ans · ${GENDERS.find((g) => g.id === t.gender)?.label ?? "Tout le monde"}`;
  const levelLabel = level ? level.name : "J'ai mes textes et visuels";
  let n = 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={quit} disabled={busy} aria-label="Enregistrer et quitter" title="Enregistrer et quitter" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft shadow-card transition-colors hover:text-ink disabled:opacity-60"><ArrowLeft className="size-5" /></button>
        <h1 className="min-w-0 flex-1 truncate text-[1.375rem] font-semibold leading-tight sm:text-[1.75rem]">Votre publicité</h1>
      </div>

      <div className="space-y-4 sm:space-y-5">
        {objective ? (
          <div id="bloc-objectif" className="flex scroll-mt-20 items-center gap-3 rounded-[22px] bg-forest px-4 py-3 text-white shadow-lift sm:rounded-[28px] sm:px-6 sm:py-4">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-marigold"><ObjectiveIcon name={objective.icon} className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.78125rem] text-white/70">Vous voulez</span>
              <span className="block truncate text-[1rem] font-semibold">{objectiveShort(objective)}</span>
            </span>
            <Dialog open={pickObjective} onOpenChange={setPickObjective}>
              <DialogTrigger className="shrink-0 rounded-full bg-white/10 px-3.5 py-2 text-[0.8125rem] font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20">Changer</DialogTrigger>
              <DialogContent title="Que voulez-vous obtenir ?" side="bottom">
                <ObjectivePicker value={s.objective} platforms={s.platforms} baseFees={data.baseFees} onChange={setObjective} />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <Block id="objectif" n={++n} title="Que voulez-vous obtenir ?" issue={issue}>
            <ObjectivePicker value={s.objective} platforms={s.platforms} baseFees={data.baseFees} onChange={setObjective} />
          </Block>
        )}

        <Block id="reseaux" n={++n} title="Où la montrer ?" issue={issue}>
          <PlatformPicker value={s.platforms} onChange={setPlatforms} extraFee={data.limits.extraPlatformFee} />
          {(toAsk.length > 0 || askWhatsapp) && (
            <div className="mt-5 space-y-4">
              {toAsk.length > 0 && <AccountFields platforms={toAsk} value={s.business.accounts} onChange={(accounts) => setB({ accounts })} />}
              {askWhatsapp && (
                <Field label="Votre numéro WhatsApp" htmlFor="wa" hint={needs.includes("whatsapp") ? "Vos clients vous écriront sur ce numéro." : undefined}>
                  <Input id="wa" value={s.destinationWhatsapp} maxLength={40} inputMode="tel" autoComplete="tel" onChange={(e) => set({ destinationWhatsapp: e.target.value })} placeholder="01 97 00 00 00" />
                </Field>
              )}
            </div>
          )}
        </Block>

        <Block id="annonce" n={++n} title="Que vendez-vous ?" issue={issue}>
          <div className="space-y-4">
            {!knownBusiness && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom de votre activité" htmlFor="bname"><Input id="bname" value={s.business.name} maxLength={80} autoComplete="organization" onChange={(e) => setB({ name: e.target.value })} placeholder="Boutique Afi" /></Field>
                <Field label="Secteur" htmlFor="sector">
                  <Select id="sector" value={s.business.sector} onChange={(e) => setB({ sector: e.target.value })}><option value="" disabled>Choisir…</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</Select>
                </Field>
              </div>
            )}
            <div>
              <label htmlFor="pdesc" className="sr-only">Que vendez-vous ?</label>
              <Textarea id="pdesc" rows={3} value={s.productDescription} maxLength={1500} onChange={(e) => set({ productDescription: e.target.value })} placeholder="Robes en wax cousues main, 15 000 F, livraison à Cotonou en 48 h…" />
              <p className="mt-1.5 text-[0.8125rem] text-muted">Le produit, le prix, la livraison : une ou deux phrases suffisent.</p>
            </div>
            {warnings.length > 0 && <Notice tone="warn" title="À vérifier">{warnings.map((w) => <p key={w}>{w}</p>)}</Notice>}
            <div>
              <p className="mb-2 text-[0.84375rem] font-medium text-ink">Photo ou vidéo <span className="ml-1 rounded-full bg-sand px-1.5 py-px text-[11px] font-normal text-muted">facultatif</span></p>
              <MediaGrid campaignId={s.id} role="CREATIVE" items={media} setLinks={setLinks} library={data.library} />
            </div>
            {pack && (!level || level.code === pack.code) && (
              <ToggleRow icon={<Wand2 />} label="Créez mes visuels et mes textes" htmlFor="pack-toggle"
                hint={<span className="tnum">Notre équipe s&apos;en charge{Math.max(pack.fee, baseFee) > baseFee ? ` : + ${formatFcfa(Math.max(pack.fee, baseFee) - baseFee)}` : ""}</span>}>
                <Switch id="pack-toggle" checked={s.serviceCode === pack.code} onCheckedChange={(v) => set({ serviceCode: v ? pack.code : null })} />
              </ToggleRow>
            )}
          </div>
        </Block>

        <Block id="budget" n={++n} title="Votre budget" issue={issue}>
          <BudgetQuick limits={data.limits} value={{ adBudget: s.adBudget, durationDays: s.durationDays ?? 0 }} onChange={set}
            recommended={objective ? { daily: objective.config.recommendedDailyBudget, days: objective.config.recommendedDays } : null} />
        </Block>

        <section aria-labelledby="titre-reglages">
          <div className="mb-2 px-1">
            <h2 id="titre-reglages" className="text-[1.0625rem] font-semibold leading-snug">Déjà réglé pour vous</h2>
            <p className="text-[0.8125rem] text-muted">Rien à faire ici. Touchez une ligne pour la changer.</p>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-line/70 bg-surface shadow-card sm:rounded-[28px]">
            <Setting icon={<Users />} title="À qui la montrer" value={audienceLabel}>
              <AudiencePanel t={t} onChange={setTargeting} />
            </Setting>
            <Setting icon={<Type />} title="Texte de l'annonce" value={hasCopy ? copy.headline || copy.body : "Écrit par notre équipe"}>
              <div className="space-y-4">
                <Field label="Texte" htmlFor="copy-b" hint={<span className="tnum block text-right">{copy.body.length} / 900</span>}>
                  <Textarea id="copy-b" rows={4} value={copy.body} maxLength={900} onChange={(e) => set({ adCopy: { ...copy, body: e.target.value } })} placeholder="Offrez-vous une robe unique, cousue à vos mesures…" />
                </Field>
                <Field label="Titre" htmlFor="copy-h"><Input id="copy-h" value={copy.headline} maxLength={90} onChange={(e) => set({ adCopy: { ...copy, headline: e.target.value } })} placeholder="Votre robe sur mesure en 48 h" /></Field>
                <p className="text-[0.8125rem] text-muted">Laissez vide : notre équipe l&apos;écrit pour vous.</p>
              </div>
            </Setting>
            <Setting icon={<CalendarDays />} title="Début" value={s.startDate ? formatDate(new Date(`${s.startDate}T00:00:00Z`)) : "À choisir"}>
              <ScheduleFields value={{ adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, platforms: s.platforms }} onChange={set} />
            </Setting>
            <Setting icon={<Sparkles />} title="Formule" value={levelLabel}>
              <LevelPicker levels={data.levels} value={s.serviceCode} onChange={(serviceCode) => set({ serviceCode })} baseFee={baseFee} />
            </Setting>
            {knownBusiness && (
              <Setting icon={<Store />} title="Votre activité" value={[s.business.name, s.business.city].filter(Boolean).join(" · ")}>
                <div className="space-y-4">
                  {data.businesses.length > 1 && (
                    <Field label="Entreprise" htmlFor="businessId">
                      <Select id="businessId" value={s.business.id ?? ""} onChange={(e) => { const b = data.businesses.find((x) => x.id === e.target.value); if (b) set({ business: { ...b } }); }}>
                        {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </Select>
                    </Field>
                  )}
                  <Field label="Nom de votre activité" htmlFor="bname"><Input id="bname" value={s.business.name} maxLength={80} onChange={(e) => setB({ name: e.target.value })} /></Field>
                  <Field label="Secteur" htmlFor="sector"><Select id="sector" value={s.business.sector} onChange={(e) => setB({ sector: e.target.value })}>{SECTORS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
                  <Field label="Ville" htmlFor="city"><Input id="city" value={s.business.city} maxLength={60} onChange={(e) => setB({ city: e.target.value })} placeholder="Cotonou" /></Field>
                  <AccountFields platforms={s.platforms.filter((p) => !toAsk.includes(p))} value={s.business.accounts} onChange={(accounts) => setB({ accounts })} />
                </div>
              </Setting>
            )}
            <Setting icon={<Eye />} title="Aperçu" value="Voir l'annonce sur un téléphone">
              <PhonePreview s={s} links={links} />
            </Setting>
          </div>
        </section>

        <section id="bloc-fin" data-quote className="scroll-mt-20 space-y-2.5">
          <QuotePanel state={quote} promo={promo} onPromo={setPromo} />
          <p className="px-1 text-[0.8125rem] leading-relaxed text-muted">Les résultats ne sont pas garantis.</p>
          {issue?.block === "fin" && <Notice tone="danger">{issue.message}</Notice>}
        </section>
      </div>

      <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-t-2xl lg:border-x lg:px-4">
        <Button type="button" size="lg" variant="accent" className="w-full" disabled={busy} aria-busy={busy} onClick={order}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Wallet />}Payer{total ? <span className="tnum"> · {formatFcfa(total)}</span> : null}{!busy && <ArrowRight />}
        </Button>
      </div>
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

function PhonePreview({ s, links }: { s: State; links: LinkedAsset[] }) {
  const [platform, setPlatform] = React.useState<PlatformCode>(s.platforms[0] ?? "FACEBOOK");
  const current = s.platforms.includes(platform) ? platform : s.platforms[0] ?? "FACEBOOK";
  const image = links.find((l) => l.role === "CREATIVE" && l.kind === "IMAGE") ?? links.find((l) => l.role === "PRODUCT_MEDIA" && l.kind === "IMAGE");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[0.84375rem] font-semibold text-ink">Aperçu</p>
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

// ─────────────────────────── Audience ───────────────────────────

/** Réglage fin de l'audience : zone, profil, centres d'intérêt. Facultatif, un réglage de départ est déjà appliqué. */
function AudiencePanel({ t, onChange }: { t: Targeting; onChange: (next: Targeting) => void }) {
  const latest = React.useRef(t);
  latest.current = t;
  const setT = (patch: Partial<Targeting>) => onChange({ ...latest.current, ...patch });
  const cities = t.countries.flatMap((c) => (CITIES_BY_COUNTRY[c] ?? []).map((city) => ({ city, country: c })));
  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold [font-family:var(--font-sans)]"><MapPin className="size-4 text-green" />Zone</h3>
        <div>
          <p className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Pays</p>
          <div className="flex flex-wrap gap-1.5">{TARGET_COUNTRIES.map((c) => <Chip key={c.code} active={t.countries.includes(c.code)} onClick={() => { const countries = toggle(t.countries, c.code); const ok = new Set(countries.flatMap((x) => CITIES_BY_COUNTRY[x] ?? [])); setT({ countries: countries.length ? countries : t.countries, cities: t.cities.filter((x) => ok.has(x)) }); }}>{c.name}</Chip>)}</div>
        </div>
        {cities.length > 0 && (
          <div>
            <p className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Villes <span className="font-normal text-muted">— aucune = tout le pays</span></p>
            <div className="flex flex-wrap gap-1.5">{cities.map(({ city }) => <Chip key={city} active={t.cities.includes(city)} onClick={() => setT({ cities: toggle(t.cities, city) })}>{city}</Chip>)}</div>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold [font-family:var(--font-sans)]"><Users className="size-4 text-sky" />Profil</h3>
        <div>
          <p className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Genre</p>
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

      <div className="space-y-3 border-t border-line pt-6">
        <div className="flex items-baseline justify-between"><h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold [font-family:var(--font-sans)]"><Heart className="size-4 text-rose" />Centres d&apos;intérêt</h3><span className="tnum text-xs text-muted">{t.interests.length} sélectionné{t.interests.length > 1 ? "s" : ""}</span></div>
        {INTEREST_GROUPS.map((g) => {
          const picked = g.items.filter((i) => t.interests.includes(i)).length;
          return (
            <details key={g.group} className="group rounded-md bg-paper" open={picked > 0 || undefined}>
              <summary className="flex items-center justify-between gap-3 px-4 py-3 text-[0.84375rem] font-medium text-ink">
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
  );
}
