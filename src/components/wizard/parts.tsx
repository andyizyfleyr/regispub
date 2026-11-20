"use client";

import { ACCOUNT_FIELDS, type Accounts } from "@/lib/catalog/accounts";
import * as React from "react";
import { Check, ChevronDown, Lightbulb, LoaderCircle, Megaphone, ShoppingBag, TicketPercent, Users } from "lucide-react";
import { ObjectiveIcon, OperatorChip, PlatformBadge } from "@/components/icons";
import { QuoteLines } from "@/components/app/quote-box";
import { Button } from "@/components/ui/button";
import { DatePicker, Slider } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { EditorData } from "@/lib/campaigns/editor-data";
import { getObjective, OBJECTIVE_CATEGORIES, OBJECTIVES, objectiveShort, type Objective, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { PLATFORM_CODES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import type { Quote } from "@/lib/pricing/quote";
import { cn, formatFcfa } from "@/lib/utils";
import { TILE_TONES, toneAt } from "@/components/ui/tile";
import { previewQuoteAction } from "@/server/actions/campaigns";

/** Bloc de formulaire : un pictogramme, un titre court, puis les champs. Les blocs sont séparés par un simple filet. */
export function Section({ icon, tone = "green", title, description, action, children, className }: { icon?: React.ReactNode; tone?: keyof typeof TILE_TONES; title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-line pt-7 first:border-0 first:pt-0", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[1.125rem]", TILE_TONES[tone])}>{icon}</span>}
          <div className="min-w-0">
            <h2 className="text-[1.0625rem] font-semibold leading-snug">{title}</h2>
            {description && <p className="mt-0.5 text-[0.84375rem] text-muted">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Chip({ active, children, onClick, disabled }: { active: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.8125rem] font-medium transition-colors disabled:opacity-40", active ? "border-forest bg-forest text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40 hover:bg-paper")}>
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

/** Cartes de choix : une carte par option, la sélection est encadrée en vert. */
export function ChoiceList({ children, className, cols }: { children: React.ReactNode; className?: string; cols?: 2 | 3 }) {
  return <div className={cn("grid gap-2.5", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", className)}>{children}</div>;
}

export function ChoiceRow({ active, onClick, children, leading, multiple, disabled, className, title }: { active: boolean; onClick: () => void; children: React.ReactNode; leading?: React.ReactNode; multiple?: boolean; disabled?: boolean; className?: string; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} title={title}
      className={cn("flex h-full w-full items-start gap-3.5 rounded-xl border bg-surface p-4 text-left transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line shadow-card hover:border-line-strong hover:shadow-lift", className)}>
      {leading}
      <span className="min-w-0 flex-1">{children}</span>
      <span aria-hidden className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center border transition-colors", multiple ? "rounded-[6px]" : "rounded-full", active ? "border-green bg-green text-white" : "border-line-strong bg-surface text-transparent")}><Check className="size-3" strokeWidth={3} /></span>
    </button>
  );
}

/** Choix des plateformes : une ou plusieurs, en un geste. */
/** Choix du réseau : un seul à la fois, une publicité se lance sur un réseau. */
export function PlatformPicker({ value, onChange, allowed }: { value: PlatformCode | null; onChange: (p: PlatformCode) => void; allowed?: PlatformCode[] }) {
  return (
    <div role="radiogroup" aria-label="Réseau" className="grid grid-cols-3 gap-2.5">
      {PLATFORM_CODES.map((p) => {
        const active = value === p;
        const off = Boolean(allowed && !allowed.includes(p));
        return (
          <button key={p} type="button" role="radio" aria-checked={active} disabled={off} onClick={() => onChange(p)} title={off ? "Non proposé pour cet objectif" : undefined}
            className={cn("relative flex flex-col items-center rounded-xl border bg-surface px-2 py-4 text-center transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-45 sm:px-4 sm:py-5",
              active ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line shadow-card enabled:hover:border-line-strong enabled:hover:shadow-lift")}>
            <span aria-hidden className={cn("absolute right-2 top-2 flex size-5 items-center justify-center rounded-full border transition-colors", active ? "border-green bg-green text-white" : "border-line-strong bg-surface text-transparent")}><Check className="size-3" strokeWidth={3} /></span>
            <PlatformBadge platform={p} size="lg" />
            <span className="mt-2.5 block text-[0.9375rem] font-semibold text-ink">{PLATFORMS[p].label}</span>
          </button>
        );
      })}
    </div>
  );
}

const CATEGORY_ICONS: Record<ObjectiveCategory, typeof Users> = { community: Users, business: ShoppingBag, awareness: Megaphone };

export function ObjectivePicker({ value, platforms, baseFees, onChange }: { value: string | null; platforms: PlatformCode[]; baseFees: Record<string, number>; onChange: (code: string) => void }) {
  const selected = getObjective(value);
  const [category, setCategory] = React.useState<ObjectiveCategory>(selected?.category ?? "business");
  const available = (o: Objective) => !platforms.length || o.platforms.some((p) => platforms.includes(p));
  return (
    <div>
      <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <div className="inline-flex gap-1 rounded-full bg-sand p-1" role="tablist">
          {(Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
              className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[0.84375rem] font-medium transition-colors", category === c ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
              {React.createElement(CATEGORY_ICONS[c], { className: "size-4" })}{OBJECTIVE_CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </div>
      <ChoiceList key={category} cols={2} className="mt-3 animate-fade">
        {OBJECTIVES.filter((o) => o.category === category).map((o, i) => {
          const ok = available(o);
          return (
            <ChoiceRow key={o.code} active={selected?.code === o.code} onClick={() => onChange(o.code)} disabled={!ok} className="items-center" title={o.label}
              leading={<span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TILE_TONES[toneAt(i)])}><ObjectiveIcon name={o.icon} className="size-[1.125rem]" /></span>}>
              <span className="block font-medium leading-snug text-ink">{objectiveShort(o)}</span>
              {!ok && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-clay">Indisponible sur {platforms.map((p) => PLATFORMS[p].label).join(" + ")}</span>}
            </ChoiceRow>
          );
        })}
      </ChoiceList>
      {selected && (
        <details className="group mt-3 animate-rise rounded-xl bg-marigold-soft/60 px-4 py-3 text-[0.84375rem] text-ink-soft">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-ink [&::-webkit-details-marker]:hidden">
            <Lightbulb className="size-4 shrink-0 text-[#9a6400]" />
            <span className="tnum flex-1">Prestation dès {formatFcfa(baseFees[selected.serviceCode] ?? 10_000)}</span>
            <span className="text-[0.8125rem] font-normal text-ink-soft">Conseil</span>
            <ChevronDown className="size-4 text-ink-soft transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 leading-relaxed">{selected.recommendation}</p>
        </details>
      )}
    </div>
  );
}

/** Devis en direct. Le calcul est toujours fait par le serveur à partir du catalogue en vigueur. */
export function useQuote(campaignId: string, input: { adBudget: number; durationDays: number; serviceCode: string | null; platforms: PlatformCode[]; promoCode: string; objective?: string | null }) {
  const [state, setState] = React.useState<{ quote: Quote | null; error: string | null; promoError: string | null; loading: boolean }>({ quote: null, error: null, promoError: null, loading: true });
  const key = JSON.stringify(input);
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      const res = await previewQuoteAction(campaignId, JSON.parse(key));
      if (cancelled) return;
      if (!res.ok) setState({ quote: null, error: res.error, promoError: null, loading: false });
      else setState({ quote: res.data.quote, error: res.data.error, promoError: res.data.promoError, loading: false });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [campaignId, key]);
  return state;
}

export function QuotePanel({ state, promo, onPromo, children }: { state: ReturnType<typeof useQuote>; promo: string; onPromo: (code: string) => void; children?: React.ReactNode }) {
  const [draft, setDraft] = React.useState(promo);
  const applied = Boolean(promo && !state.promoError && state.quote && state.quote.discount > 0);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 sm:px-5 py-3.5">
        <p className="text-[0.9375rem] font-semibold">Total</p>
        {state.loading && <LoaderCircle className="size-4 animate-spin text-muted" aria-label="Calcul en cours" />}
      </div>
      <div className="p-4 sm:p-5">
        {state.quote ? (
          <div className={cn("transition-opacity", state.loading && "opacity-50")}>
            <QuoteLines lines={state.quote.lines} total={state.quote.total} />
            {state.quote.notes.map((n) => <p key={n} className="mt-2 text-xs text-muted">{n}</p>)}
          </div>
        ) : state.error ? <Notice tone="warn">{state.error}</Notice> : <div className="space-y-3" aria-label="Calcul du devis"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-8 w-1/2" /></div>}

        <details className="group mt-4 border-t border-line pt-3" open={Boolean(promo) || undefined}>
          <summary className="flex items-center justify-between gap-2 text-[0.8125rem] font-medium text-green">
            <span className="flex items-center gap-2"><TicketPercent className="size-4" />{applied ? `Code ${promo} appliqué` : "Code promo"}</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <div className="flex gap-2">
              <Input id="promo" aria-label="Code promotionnel" value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} placeholder="BIENVENUE10" className="uppercase" maxLength={30}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPromo(draft.trim()); } }} />
              <Button type="button" variant="outline" onClick={() => onPromo(draft.trim())}>Appliquer</Button>
            </div>
            {state.promoError && <p className="mt-2 text-[0.8125rem] text-clay">{state.promoError}</p>}
          </div>
        </details>
        {children}
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" />
          <span className="ml-1 text-xs leading-snug text-muted">Mobile Money</span>
        </div>
      </div>
    </div>
  );
}

const DURATION_PRESETS = [3, 7, 14, 30];

export function BudgetFields({ data, value, onChange, recommended }: {
  data: EditorData; recommended: { daily: number; days: number } | null;
  value: { adBudget: number; durationDays: number; startDate: string; budgetSplit: Record<string, number>; platforms: PlatformCode[] };
  onChange: (patch: Partial<{ adBudget: number; durationDays: number; startDate: string; budgetSplit: Record<string, number> }>) => void;
}) {
  const { limits } = data;
  const daily = value.durationDays > 0 ? Math.floor(value.adBudget / value.durationDays) : 0;
  const end = React.useMemo(() => {
    if (!value.startDate || !value.durationDays) return null;
    const d = new Date(`${value.startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + value.durationDays - 1);
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  }, [value.startDate, value.durationDays]);
  const today = new Date().toISOString().slice(0, 10);
  const presets = [5_000, 10_000, 20_000, 30_000, 50_000, 100_000].filter((v) => v >= limits.minAdBudget);
  const sliderMax = Math.max(300_000, limits.minAdBudget * 10);
  // Saisie libre : seulement sur demande, ou si le montant enregistré sort des crans du curseur.
  const [custom, setCustom] = React.useState(value.adBudget > sliderMax || value.adBudget % 1000 !== 0);
  const durations = Array.from(new Set([...DURATION_PRESETS, ...(value.durationDays > 0 ? [value.durationDays] : [])])).sort((a, b) => a - b);
  const [first, ...rest] = value.platforms;
  const advised = recommended ? Math.max(limits.minAdBudget, recommended.daily * recommended.days) : null;

  function setSplit(platform: string, pct: number) {
    // Répartition à deux curseurs au plus : la première plateforme absorbe le reste pour que le total fasse toujours 100 %.
    const next = { ...value.budgetSplit, [platform]: pct };
    const others = rest.reduce((a, p) => a + (next[p] ?? 0), 0);
    if (others > 95) return;
    next[first!] = 100 - others;
    onChange({ budgetSplit: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[0.8125rem] font-medium text-ink">Budget publicitaire</p>
          <p className="tnum font-display text-[1.5rem] font-semibold leading-none text-ink">{formatFcfa(value.adBudget)}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((v) => <Chip key={v} active={value.adBudget === v} onClick={() => onChange({ adBudget: v })}><span className="tnum">{formatFcfa(v)}</span>{advised === v && <span className="font-normal opacity-70">· conseillé</span>}</Chip>)}
        </div>
        <Slider className="mt-3" label="Budget publicitaire" value={value.adBudget} min={limits.minAdBudget} max={sliderMax} step={1000} onChange={(v) => onChange({ adBudget: v })} />
        <p className="tnum flex items-center justify-between text-[0.75rem] text-muted">
          <span>{formatFcfa(limits.minAdBudget)}</span>
          {!custom && <button type="button" onClick={() => setCustom(true)} className="text-[0.8125rem] font-medium text-green hover:underline">Autre montant</button>}
          <span>{formatFcfa(sliderMax)}</span>
        </p>
        {custom && (
          <div className="relative mt-2.5">
            <Input id="adBudget" inputMode="numeric" aria-label="Budget publicitaire en francs CFA" className="tnum pr-16 text-base font-semibold" value={value.adBudget ? String(value.adBudget) : ""} placeholder="Autre montant"
              onChange={(e) => onChange({ adBudget: Math.min(999_999_999, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">FCFA</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-[0.8125rem] font-medium text-ink">Durée</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {durations.map((d) => <Chip key={d} active={value.durationDays === d} onClick={() => onChange({ durationDays: d })}>{d} jours</Chip>)}
        </div>
        <p className={cn("tnum mt-1.5 text-[0.8125rem]", daily > 0 && daily < limits.minDailyBudget ? "text-clay" : "text-muted")}>
          {daily > 0 ? <>{formatFcfa(daily)} par jour{daily < limits.minDailyBudget ? ` : minimum ${formatFcfa(limits.minDailyBudget)}` : ""}.</> : "Choisissez une durée."}
        </p>
      </div>

      <Field label="Début" htmlFor="startDate" hint={end ? `Fin le ${end}` : undefined} className="max-w-xs">
        <DatePicker id="startDate" min={today} value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
      </Field>

      {value.platforms.length > 1 && (
        <details className="group rounded-md bg-paper">
          <summary className="flex items-center justify-between gap-3 px-4 py-3 text-[0.84375rem] font-medium text-ink">
            Répartition
            <span className="flex items-center gap-2 text-[0.8125rem] font-normal text-muted"><span className="tnum">{value.platforms.map((p) => `${value.budgetSplit[p] ?? 0} %`).join(" · ")}</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="space-y-3 px-4 pb-4">
            {value.platforms.map((p, i) => {
              const pct = value.budgetSplit[p] ?? 0;
              return (
                <div key={p} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                  <span className="flex w-24 items-center gap-2 text-[0.8125rem] text-ink sm:w-28"><PlatformBadge platform={p} size="sm" />{PLATFORMS[p].label}</span>
                  {i === 0 ? <span className="h-1.5 rounded-full bg-line"><span className="block h-full rounded-full bg-green" style={{ width: `${pct}%` }} /></span>
                    : <Slider min={5} max={90} step={5} value={pct} onChange={(v) => setSplit(p, v)} label={`Part de ${PLATFORMS[p].label}`} className="min-w-0" />}
                  <span className="tnum w-[6.5rem] text-right text-[0.8125rem] text-ink-soft sm:w-28">{pct} % · {formatFcfa(Math.round((value.adBudget * pct) / 100))}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/** Remplace la valeur la plus proche de la liste par la valeur conseillée, si elle n'y figure pas déjà. */
function withAdvised(list: number[], advised: number | null): number[] {
  if (!advised || list.includes(advised)) return list;
  const nearest = list.reduce((best, v) => (Math.abs(v - advised) < Math.abs(best - advised) ? v : best), list[0]!);
  return list.map((v) => (v === nearest ? advised : v)).sort((a, b) => a - b);
}

/**
 * Budget en deux gestes : un montant, une durée. Rien n'est choisi d'avance ; le montant conseillé est seulement signalé.
 * Les durées qui feraient passer le budget par jour sous le minimum ne sont pas proposées.
 */
export function BudgetQuick({ limits, value, onChange, recommended }: {
  limits: EditorData["limits"]; recommended: { daily: number; days: number } | null;
  value: { adBudget: number; durationDays: number };
  onChange: (patch: { adBudget?: number; durationDays?: number }) => void;
}) {
  const advised = recommended ? Math.max(limits.minAdBudget, recommended.daily * recommended.days) : null;
  // Le montant et la durée conseillés prennent la place du choix le plus proche : toujours six montants et quatre durées.
  const presets = withAdvised([5_000, 10_000, 20_000, 30_000, 50_000, 100_000], advised).filter((v) => v >= limits.minAdBudget && v <= limits.maxAdBudget);
  const [custom, setCustom] = React.useState(value.adBudget > 0 && !presets.includes(value.adBudget));
  const base = withAdvised(DURATION_PRESETS, recommended?.days ?? null);
  const durations = value.durationDays > 0 && !base.includes(value.durationDays) ? withAdvised(base, value.durationDays) : base;
  const fits = (budget: number, days: number) => days > 0 && Math.floor(budget / days) >= limits.minDailyBudget;
  const daily = value.durationDays > 0 ? Math.floor(value.adBudget / value.durationDays) : 0;
  const tooLow = value.adBudget > 0 && value.adBudget < limits.minAdBudget;

  const setBudget = (adBudget: number) => onChange({ adBudget });

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[0.84375rem] font-medium text-ink">Combien voulez-vous dépenser en publicité ?</p>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((v) => {
            const active = !custom && value.adBudget === v;
            return (
              <button key={v} type="button" aria-pressed={active} onClick={() => { setCustom(false); setBudget(v); }}
                className={cn("relative rounded-xl border bg-surface px-1 py-3 text-center transition-[border-color,box-shadow,background-color]", active ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line shadow-card hover:border-line-strong")}>
                <span className="tnum block text-[0.9375rem] font-semibold text-ink">{formatFcfa(v)}</span>
                {advised === v && <span className="block text-[0.6875rem] font-medium text-green">conseillé</span>}
              </button>
            );
          })}
        </div>
        {custom ? (
          <div className="relative mt-2.5">
            <Input id="adBudget" inputMode="numeric" aria-label="Budget publicitaire en francs CFA" className="tnum pr-16 text-base font-semibold" value={value.adBudget ? String(value.adBudget) : ""} placeholder="Montant"
              onChange={(e) => setBudget(Math.min(999_999_999, Number(e.target.value.replace(/\D/g, "")) || 0))} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">FCFA</span>
          </div>
        ) : (
          <button type="button" onClick={() => setCustom(true)} className="mt-2.5 text-[0.84375rem] font-medium text-green underline-offset-4 hover:underline">Autre montant</button>
        )}
        {tooLow && <p className="tnum mt-1.5 text-[0.8125rem] text-clay">Minimum {formatFcfa(limits.minAdBudget)}.</p>}
      </div>

      <div>
        <p className="mb-2 text-[0.84375rem] font-medium text-ink">Pendant combien de jours ?</p>
        <div className="grid grid-cols-4 gap-2">
          {durations.map((d) => {
            const active = value.durationDays === d;
            const ok = !value.adBudget || fits(value.adBudget, d) || active;
            return (
              <button key={d} type="button" aria-pressed={active} disabled={!ok} onClick={() => onChange({ durationDays: d })}
                className={cn("rounded-xl border bg-surface px-1 py-3 text-center text-[0.9375rem] font-semibold text-ink transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-40", active ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line shadow-card hover:border-line-strong")}>
                <span className="tnum">{d}</span> <span className="font-normal text-muted">jours</span>
              </button>
            );
          })}
        </div>
        <p className={cn("tnum mt-2 text-[0.8125rem]", daily > 0 && daily < limits.minDailyBudget ? "text-clay" : "text-muted")}>
          {daily > 0 ? <>Soit {formatFcfa(daily)} par jour{daily < limits.minDailyBudget ? ` : il faut au moins ${formatFcfa(limits.minDailyBudget)} par jour. Choisissez moins de jours ou un montant plus grand.` : "."}</> : "Choisissez une durée."}
        </p>
      </div>
    </div>
  );
}

/** Date de début, choisie par le client. */
export function ScheduleFields({ value, onChange }: { value: { durationDays: number; startDate: string }; onChange: (patch: { startDate: string }) => void }) {
  const end = React.useMemo(() => {
    if (!value.startDate || !value.durationDays) return null;
    const d = new Date(`${value.startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + value.durationDays - 1);
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  }, [value.startDate, value.durationDays]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Field label="Date de début" htmlFor="startDate" hint={end ? `Fin le ${end}` : undefined} className="max-w-xs">
      <DatePicker id="startDate" min={today} value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
    </Field>
  );
}

/** `unset` : le client n'a encore rien choisi, aucune ligne n'est cochée. */
export function LevelPicker({ levels, value, onChange, baseFee, expert, unset }: { levels: EditorData["levels"]; value: string | null; onChange: (code: string | null) => void; baseFee: number; expert?: boolean; unset?: boolean }) {
  const base = !unset && (value === null || !levels.some((l) => l.code === value));
  return (
    <ChoiceList>
      {!expert && (
        <ChoiceRow active={base} onClick={() => onChange(null)}>
          <span className="flex items-baseline justify-between gap-3"><span className="font-medium text-ink">J&apos;ai mes textes et visuels</span><span className="tnum shrink-0 text-sm font-semibold">{formatFcfa(baseFee)}</span></span>
          <span className="mt-0.5 block text-[0.84375rem] text-muted">Nous vérifions et lançons.</span>
        </ChoiceRow>
      )}
      {levels.filter((l) => !expert || l.kind === "MANAGEMENT" || l.kind === "PACK").map((l) => (
        <ChoiceRow key={l.code} active={!unset && value === l.code} onClick={() => onChange(l.code)}>
          <span className="flex items-baseline justify-between gap-3"><span className="font-medium text-ink">{l.name}</span><span className="tnum shrink-0 text-sm font-semibold">{formatFcfa(Math.max(l.fee, baseFee))}</span></span>
          {!unset && value === l.code && l.features.length > 0 && <ul className="mt-2 animate-rise space-y-1 text-[0.8125rem] text-ink-soft">{l.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-green" />{f}</li>)}</ul>}
        </ChoiceRow>
      ))}
    </ChoiceList>
  );
}

/** Avancement : un pictogramme par étape. Les étapes déjà atteintes sont cliquables. */
export function Stepper({ steps, current, reached, onSelect, disabled }: { steps: { title: string; icon: React.ReactNode }[]; current: number; reached: number; onSelect: (n: number) => void; disabled?: boolean }) {
  return (
    <ol className="flex items-start" aria-label="Étapes">
      {steps.map((step, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        const clickable = n <= reached && !active && !disabled;
        return (
          <li key={step.title} className="relative flex flex-1 flex-col items-center">
            {i > 0 && <span aria-hidden className={cn("absolute right-1/2 top-5 h-0.5 w-full -translate-y-1/2", done || active ? "bg-green" : "bg-line")} />}
            <button type="button" disabled={!clickable} onClick={() => onSelect(n)} aria-current={active ? "step" : undefined} aria-label={`Étape ${n} : ${step.title}`}
              className={cn("relative flex size-10 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-default [&_svg]:size-[1.125rem]",
                active ? "border-forest bg-forest text-white shadow-lift" : done ? "border-green bg-green text-white" : "border-line bg-surface text-muted")}>
              {done ? <Check strokeWidth={3} /> : step.icon}
            </button>
            <span className={cn("mt-1.5 text-xs", active ? "font-semibold text-ink" : "text-muted")}>{step.title}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Comptes du client, un champ par réseau choisi : c'est là que l'équipe lance la publicité. */
export function AccountFields({ platforms, value, onChange }: { platforms: PlatformCode[]; value: Accounts | undefined; onChange: (next: Accounts) => void }) {
  if (!platforms.length) return null;
  return (
    <div className="space-y-4">
      {platforms.map((p) => (
        <Field key={p} label={ACCOUNT_FIELDS[p].label} htmlFor={`acc-${p}`}>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"><PlatformBadge platform={p} size="sm" /></span>
            <Input id={`acc-${p}`} className="pl-11" value={value?.[p] ?? ""} maxLength={300} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => onChange({ ...value, [p]: e.target.value })} placeholder={ACCOUNT_FIELDS[p].placeholder} />
          </div>
        </Field>
      ))}
      <p className="text-[0.8125rem] text-muted">Nous lançons votre publicité sur {platforms.length > 1 ? "ces comptes" : "ce compte"}.</p>
    </div>
  );
}
