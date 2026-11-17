"use client";

import * as React from "react";
import { Check, ChevronDown, LoaderCircle, TicketPercent } from "lucide-react";
import { ObjectiveIcon, OperatorChip, PlatformBadge } from "@/components/icons";
import { QuoteLines } from "@/components/app/quote-box";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { EditorData } from "@/lib/campaigns/editor-data";
import { OBJECTIVE_CATEGORIES, OBJECTIVES, type Objective, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { platformFamilies, PLATFORM_CODES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import type { Quote } from "@/lib/pricing/quote";
import { cn, formatFcfa } from "@/lib/utils";
import { previewQuoteAction } from "@/server/actions/campaigns";

/** Bloc de formulaire : un titre, une phrase d'aide, puis les champs. Les blocs sont séparés par un simple filet. */
export function Section({ title, description, action, children, className }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-line pt-7 first:border-0 first:pt-0", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
          {description && <p className="mt-0.5 text-[13.5px] text-muted">{description}</p>}
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
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-40", active ? "border-forest bg-forest text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40 hover:bg-paper")}>
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

/** Liste de choix : une ligne par option, la coche à droite. */
export function ChoiceList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface", className)}>{children}</div>;
}

export function ChoiceRow({ active, onClick, children, leading, multiple, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; leading?: React.ReactNode; multiple?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn("flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:px-5", active ? "bg-green-soft/50" : "hover:bg-paper")}>
      {leading}
      <span className="min-w-0 flex-1">{children}</span>
      <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center border transition-colors", multiple ? "rounded-[6px]" : "rounded-full", active ? "border-green bg-green text-white" : "border-line-strong bg-surface text-transparent")}><Check className="size-3" strokeWidth={3} /></span>
    </button>
  );
}

const PLATFORM_HINT: Record<PlatformCode, string> = {
  FACEBOOK: "Le plus utilisé pour vendre près de chez vous",
  INSTAGRAM: "Mode, beauté, restauration, produits visuels",
  TIKTOK: "Vidéos courtes, public jeune",
};

/** Choix des plateformes : une ou plusieurs, en un geste. */
export function PlatformPicker({ value, onChange, extraFee }: { value: PlatformCode[]; onChange: (p: PlatformCode[]) => void; extraFee?: number }) {
  const toggle = (p: PlatformCode) => onChange(PLATFORM_CODES.filter((x) => (x === p ? !value.includes(p) : value.includes(x))));
  const families = platformFamilies(value).length;
  return (
    <div>
      <ChoiceList>
        {PLATFORM_CODES.map((p) => (
          <ChoiceRow key={p} multiple active={value.includes(p)} onClick={() => toggle(p)} leading={<PlatformBadge platform={p} size="md" />}>
            <span className="block font-medium text-ink">{PLATFORMS[p].label}</span>
            <span className="block text-[13.5px] leading-snug text-muted">{PLATFORM_HINT[p]}</span>
          </ChoiceRow>
        ))}
      </ChoiceList>
      {families > 1 && extraFee ? <p className="tnum mt-3 text-[13px] text-muted">Facebook et Instagram comptent pour une seule plateforme. Avec TikTok en plus : {formatFcfa(extraFee)} de prestation supplémentaire.</p> : null}
    </div>
  );
}

export function ObjectivePicker({ value, platforms, baseFees, onChange }: { value: string | null; platforms: PlatformCode[]; baseFees: Record<string, number>; onChange: (code: string) => void }) {
  const selected = OBJECTIVES.find((o) => o.code === value) ?? null;
  const [category, setCategory] = React.useState<ObjectiveCategory>(selected?.category ?? "business");
  const available = (o: Objective) => !platforms.length || o.platforms.some((p) => platforms.includes(p));
  return (
    <div>
      <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <div className="inline-flex gap-1 rounded-full bg-sand p-1" role="tablist">
          {(Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
              className={cn("whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors", category === c ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
              {OBJECTIVE_CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </div>
      <ChoiceList key={category} className="mt-3 animate-fade">
        {OBJECTIVES.filter((o) => o.category === category).map((o) => {
          const ok = available(o);
          return (
            <ChoiceRow key={o.code} active={value === o.code} onClick={() => onChange(o.code)} disabled={!ok}
              leading={<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-green-soft text-green"><ObjectiveIcon name={o.icon} className="size-[18px]" /></span>}>
              <span className="block font-medium leading-snug text-ink">{o.label}</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">
                {ok ? o.description : <span className="text-clay">Indisponible sur {platforms.map((p) => PLATFORMS[p].label).join(" + ")}</span>}
              </span>
            </ChoiceRow>
          );
        })}
      </ChoiceList>
      {selected && (
        <p className="tnum mt-3 animate-rise text-[13.5px] leading-relaxed text-muted">
          <span className="font-medium text-ink-soft">Notre conseil : </span>{selected.recommendation} Prestation dès {formatFcfa(baseFees[selected.serviceCode] ?? 10_000)}.
        </p>
      )}
    </div>
  );
}

/** Devis en direct. Le calcul est toujours fait par le serveur à partir du catalogue en vigueur. */
export function useQuote(campaignId: string, input: { adBudget: number; durationDays: number; serviceCode: string | null; platforms: PlatformCode[]; promoCode: string }) {
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
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="text-[15px] font-semibold">Ce que vous payez</p>
        {state.loading && <LoaderCircle className="size-4 animate-spin text-muted" aria-label="Calcul en cours" />}
      </div>
      <div className="p-5">
        {state.quote ? (
          <div className={cn("transition-opacity", state.loading && "opacity-50")}>
            <QuoteLines lines={state.quote.lines} total={state.quote.total} />
            {state.quote.notes.map((n) => <p key={n} className="mt-2 text-xs text-muted">{n}</p>)}
          </div>
        ) : state.error ? <Notice tone="warn">{state.error}</Notice> : <div className="space-y-3" aria-label="Calcul du devis"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-8 w-1/2" /></div>}

        <details className="group mt-4 border-t border-line pt-3" open={Boolean(promo) || undefined}>
          <summary className="flex items-center justify-between gap-2 text-[13px] font-medium text-green">
            <span className="flex items-center gap-2"><TicketPercent className="size-4" />{applied ? `Code ${promo} appliqué` : "J'ai un code promo"}</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <div className="flex gap-2">
              <Input id="promo" aria-label="Code promotionnel" value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} placeholder="BIENVENUE10" className="uppercase" maxLength={30}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPromo(draft.trim()); } }} />
              <Button type="button" variant="outline" onClick={() => onPromo(draft.trim())}>Appliquer</Button>
            </div>
            {state.promoError && <p className="mt-2 text-[13px] text-clay">{state.promoError}</p>}
          </div>
        </details>
        {children}
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" />
          <span className="ml-1 text-xs leading-snug text-muted">Paiement par Mobile Money</span>
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
        <label htmlFor="adBudget" className="text-[13px] font-medium text-ink">Budget publicitaire</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((v) => <Chip key={v} active={value.adBudget === v} onClick={() => onChange({ adBudget: v })}><span className="tnum">{formatFcfa(v)}</span>{advised === v && <span className="font-normal opacity-70">· conseillé</span>}</Chip>)}
        </div>
        <div className="relative mt-2.5">
          <Input id="adBudget" inputMode="numeric" className="tnum h-12 pr-16 text-base font-semibold" value={value.adBudget ? String(value.adBudget) : ""} placeholder="Autre montant"
            onChange={(e) => onChange({ adBudget: Math.min(999_999_999, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">FCFA</span>
        </div>
        <p className="tnum mt-1.5 text-[13px] text-muted">Dépensé en totalité sur les plateformes. Minimum {formatFcfa(limits.minAdBudget)}.</p>
      </div>

      <div>
        <label htmlFor="durationDays" className="text-[13px] font-medium text-ink">Durée</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((d) => <Chip key={d} active={value.durationDays === d} onClick={() => onChange({ durationDays: d })}>{d} jours</Chip>)}
          <div className="relative w-28">
            <Input id="durationDays" inputMode="numeric" className="tnum h-10 pr-12" aria-label="Durée en jours" value={value.durationDays ? String(value.durationDays) : ""} onChange={(e) => onChange({ durationDays: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">jours</span>
          </div>
        </div>
        <p className={cn("tnum mt-1.5 text-[13px]", daily > 0 && daily < limits.minDailyBudget ? "text-clay" : "text-muted")}>
          {daily > 0 ? <>Soit {formatFcfa(daily)} par jour{daily < limits.minDailyBudget ? ` : le minimum est de ${formatFcfa(limits.minDailyBudget)} par jour` : ""}.</> : "De 1 à 90 jours."}
        </p>
      </div>

      <Field label="Date de début souhaitée" htmlFor="startDate" hint={end ? `Fin prévue le ${end}` : undefined} className="max-w-xs">
        <Input id="startDate" type="date" min={today} value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
      </Field>

      {value.platforms.length > 1 && (
        <details className="group rounded-md bg-paper">
          <summary className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px] font-medium text-ink">
            Répartition entre les plateformes
            <span className="flex items-center gap-2 text-[13px] font-normal text-muted"><span className="tnum">{value.platforms.map((p) => `${value.budgetSplit[p] ?? 0} %`).join(" · ")}</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="space-y-3 px-4 pb-4">
            {value.platforms.map((p, i) => {
              const pct = value.budgetSplit[p] ?? 0;
              return (
                <div key={p} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                  <span className="flex w-24 items-center gap-2 text-[13px] text-ink sm:w-28"><PlatformBadge platform={p} size="sm" />{PLATFORMS[p].label}</span>
                  {i === 0 ? <span className="h-1.5 rounded-full bg-line"><span className="block h-full rounded-full bg-green" style={{ width: `${pct}%` }} /></span>
                    : <input type="range" min={5} max={90} step={5} value={pct} onChange={(e) => setSplit(p, Number(e.target.value))} aria-label={`Part de ${PLATFORMS[p].label}`} className="w-full min-w-0" />}
                  <span className="tnum w-[6.5rem] text-right text-[13px] text-ink-soft sm:w-28">{pct} % · {formatFcfa(Math.round((value.adBudget * pct) / 100))}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

export function LevelPicker({ levels, value, onChange, baseLabel, baseFee, expert }: { levels: EditorData["levels"]; value: string | null; onChange: (code: string | null) => void; baseLabel: string; baseFee: number; expert?: boolean }) {
  const base = value === null || !levels.some((l) => l.code === value);
  return (
    <ChoiceList>
      {!expert && (
        <ChoiceRow active={base} onClick={() => onChange(null)}>
          <span className="flex items-baseline justify-between gap-3"><span className="font-medium text-ink">Je fournis mes textes et visuels</span><span className="tnum shrink-0 text-sm font-semibold">{formatFcfa(baseFee)}</span></span>
          <span className="mt-0.5 block text-[13.5px] text-muted">{baseLabel} : nous vérifions, configurons et lançons votre publicité.</span>
        </ChoiceRow>
      )}
      {levels.filter((l) => !expert || l.kind === "MANAGEMENT" || l.kind === "PACK").map((l) => (
        <ChoiceRow key={l.code} active={value === l.code} onClick={() => onChange(l.code)}>
          <span className="flex items-baseline justify-between gap-3"><span className="font-medium text-ink">{l.name}</span><span className="tnum shrink-0 text-sm font-semibold">{formatFcfa(Math.max(l.fee, baseFee))}</span></span>
          <span className="mt-0.5 block text-[13.5px] text-muted">{l.description}</span>
          {value === l.code && l.features.length > 0 && <ul className="mt-2 animate-rise space-y-1 text-[13px] text-ink-soft">{l.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-green" />{f}</li>)}</ul>}
        </ChoiceRow>
      ))}
    </ChoiceList>
  );
}

/** Avancement : une barre en segments. Les étapes déjà atteintes sont cliquables. */
export function Stepper({ steps, current, reached, onSelect, disabled }: { steps: string[]; current: number; reached: number; onSelect: (n: number) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-2 text-[13px] text-muted">Étape {current} sur {steps.length} · <span className="font-medium text-ink">{steps[current - 1]}</span></p>
      <ol className="flex gap-1.5" aria-label="Étapes">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = n === current;
          const clickable = n <= reached && !active && !disabled;
          return (
            <li key={label} className="flex-1">
              <button type="button" disabled={!clickable} onClick={() => onSelect(n)} aria-current={active ? "step" : undefined} aria-label={`Étape ${n} : ${label}`} className="block w-full py-1.5 disabled:cursor-default">
                <span className={cn("block h-1.5 rounded-full transition-colors", n < current ? "bg-green" : active ? "bg-forest" : "bg-sand")} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
