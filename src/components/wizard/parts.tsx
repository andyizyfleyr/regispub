"use client";

import * as React from "react";
import { Check, LoaderCircle, TicketPercent } from "lucide-react";
import { ObjectiveIcon, PlatformBadge } from "@/components/icons";
import { QuoteLines } from "@/components/app/quote-box";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { EditorData } from "@/lib/campaigns/editor-data";
import { METRIC_LABELS, OBJECTIVE_CATEGORIES, OBJECTIVES, type Objective, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { PLATFORM_CHOICES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import type { Quote } from "@/lib/pricing/quote";
import { cn, formatFcfa } from "@/lib/utils";
import { previewQuoteAction } from "@/server/actions/campaigns";

export function Chip({ active, children, onClick, disabled }: { active: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40", active ? "border-forest bg-forest text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40")}>
      {children}
    </button>
  );
}

export function ChoiceCard({ active, onClick, children, className, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn("relative rounded-lg border bg-surface p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45", active ? "border-forest ring-1 ring-forest" : "border-line hover:border-line-strong", className)}>
      {active && <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-forest text-white"><Check className="size-3" /></span>}
      {children}
    </button>
  );
}

const samePlatforms = (a: PlatformCode[], b: PlatformCode[]) => a.length === b.length && a.every((p) => b.includes(p));

export function PlatformPicker({ value, onChange }: { value: PlatformCode[]; onChange: (p: PlatformCode[]) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PLATFORM_CHOICES.map((c) => (
        <ChoiceCard key={c.id} active={samePlatforms(value, c.platforms)} onClick={() => onChange(c.platforms)} className={c.id === "all" ? "sm:col-span-2" : ""}>
          <span className="flex items-center gap-1.5">{c.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}</span>
          <span className="mt-3 block font-medium text-ink">{c.label}</span>
          <span className="mt-0.5 block text-[13px] text-muted">{c.description}</span>
        </ChoiceCard>
      ))}
    </div>
  );
}

export function ObjectivePicker({ value, platforms, baseFees, onChange }: { value: string | null; platforms: PlatformCode[]; baseFees: Record<string, number>; onChange: (code: string) => void }) {
  const selected = OBJECTIVES.find((o) => o.code === value) ?? null;
  const [category, setCategory] = React.useState<ObjectiveCategory>(selected?.category ?? "business");
  const available = (o: Objective) => !platforms.length || o.platforms.some((p) => platforms.includes(p));
  return (
    <div>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-sand p-1" role="tablist">
        {(Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).map((c) => (
          <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
            className={cn("rounded-md px-2 py-2 text-[13px] font-medium transition-colors", category === c ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
            {OBJECTIVE_CATEGORIES[c].label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{OBJECTIVE_CATEGORIES[category].description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {OBJECTIVES.filter((o) => o.category === category).map((o) => {
          const ok = available(o);
          return (
            <ChoiceCard key={o.code} active={value === o.code} onClick={() => onChange(o.code)} disabled={!ok}>
              <span className="flex size-9 items-center justify-center rounded-md bg-green-soft text-green"><ObjectiveIcon name={o.icon} className="size-[18px]" /></span>
              <span className="mt-3 block pr-6 font-medium text-ink">{o.label}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{o.description}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="tnum">Prestation dès {formatFcfa(baseFees[o.serviceCode] ?? 10_000)}</span>
                {!ok && <span className="text-clay">Indisponible sur {platforms.map((p) => PLATFORMS[p].label).join(" + ")}</span>}
              </span>
            </ChoiceCard>
          );
        })}
      </div>
      {selected && (
        <div className="mt-5 rounded-lg border border-line bg-paper p-4">
          <p className="eyebrow">Notre recommandation pour « {selected.label} »</p>
          <p className="mt-2 text-sm text-ink-soft">{selected.recommendation}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div><dt className="text-muted">Indicateurs suivis</dt><dd className="text-ink">{selected.config.kpis.map((k) => METRIC_LABELS[k]).join(", ")}</dd></div>
            <div><dt className="text-muted">Repère de départ</dt><dd className="tnum text-ink">{formatFcfa(selected.config.recommendedDailyBudget)} par jour pendant {selected.config.recommendedDays} jours</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">Ces repères aident à démarrer ; ils ne constituent pas une promesse de résultat.</p>
        </div>
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

export function QuotePanel({ state, promo, onPromo }: { state: ReturnType<typeof useQuote>; promo: string; onPromo: (code: string) => void }) {
  const [draft, setDraft] = React.useState(promo);
  return (
    <div className="rounded-lg border border-line-strong bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Votre devis</p>
        {state.loading && <LoaderCircle className="size-4 animate-spin text-muted" aria-label="Calcul en cours" />}
      </div>
      {state.quote ? (
        <div className={cn("mt-2 transition-opacity", state.loading && "opacity-50")}>
          <QuoteLines lines={state.quote.lines} total={state.quote.total} />
          {state.quote.notes.map((n) => <p key={n} className="mt-2 text-xs text-muted">{n}</p>)}
        </div>
      ) : state.error ? <Notice tone="warn" className="mt-3">{state.error}</Notice> : <p className="mt-3 text-sm text-muted">Calcul du devis…</p>}
      <div className="mt-4 border-t border-line pt-4">
        <Field label="Code promotionnel ou bon d'achat" htmlFor="promo" optional error={state.promoError ?? undefined}>
          <div className="flex gap-2">
            <Input id="promo" value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} placeholder="BIENVENUE10" className="uppercase" maxLength={30}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPromo(draft.trim()); } }} />
            <Button type="button" variant="outline" onClick={() => onPromo(draft.trim())}><TicketPercent />Appliquer</Button>
          </div>
        </Field>
        {promo && !state.promoError && state.quote && state.quote.discount > 0 && <p className="mt-2 text-xs text-green">Code {promo} appliqué.</p>}
      </div>
    </div>
  );
}

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
  const presets = [10_000, 20_000, 30_000, 50_000, 100_000].filter((v) => v >= limits.minAdBudget);
  const [first, ...rest] = value.platforms;

  function setSplit(platform: string, pct: number) {
    // Répartition à deux curseurs au plus : la première plateforme absorbe le reste pour que le total fasse toujours 100 %.
    const next = { ...value.budgetSplit, [platform]: pct };
    const others = rest.reduce((a, p) => a + (next[p] ?? 0), 0);
    if (others > 95) return;
    next[first!] = 100 - others;
    onChange({ budgetSplit: next });
  }

  return (
    <div className="space-y-5">
      <Field label="Budget publicitaire total" htmlFor="adBudget" hint={`Montant dépensé sur les plateformes, hors frais de prestation. Minimum ${formatFcfa(limits.minAdBudget)}.`}>
        <div className="relative">
          <Input id="adBudget" inputMode="numeric" className="tnum pr-16 text-base font-medium" value={value.adBudget ? String(value.adBudget) : ""} placeholder="20000"
            onChange={(e) => onChange({ adBudget: Math.min(999_999_999, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">FCFA</span>
        </div>
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {presets.map((v) => <Chip key={v} active={value.adBudget === v} onClick={() => onChange({ adBudget: v })}><span className="tnum">{formatFcfa(v)}</span></Chip>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Durée" htmlFor="durationDays" hint={daily > 0 ? <span className={cn("tnum", daily < limits.minDailyBudget && "text-clay")}>Soit {formatFcfa(daily)} par jour (minimum {formatFcfa(limits.minDailyBudget)})</span> : "De 1 à 90 jours"}>
          <div className="relative">
            <Input id="durationDays" inputMode="numeric" className="tnum pr-14" value={value.durationDays ? String(value.durationDays) : ""} onChange={(e) => onChange({ durationDays: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">jours</span>
          </div>
        </Field>
        <Field label="Date de début souhaitée" htmlFor="startDate" hint={end ? `Fin prévue le ${end}` : undefined}>
          <Input id="startDate" type="date" min={today} value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
        </Field>
      </div>
      {recommended && (
        <button type="button" className="text-left text-[13px] text-green hover:underline" onClick={() => onChange({ adBudget: Math.max(limits.minAdBudget, recommended.daily * recommended.days), durationDays: recommended.days })}>
          Appliquer le repère conseillé : <span className="tnum">{formatFcfa(recommended.daily)}</span> par jour pendant {recommended.days} jours
        </button>
      )}
      {value.platforms.length > 1 && (
        <fieldset className="rounded-lg border border-line bg-paper p-4">
          <legend className="px-1 text-[13px] font-medium text-ink-soft">Répartition du budget entre les plateformes</legend>
          <div className="space-y-3">
            {value.platforms.map((p, i) => {
              const pct = value.budgetSplit[p] ?? 0;
              return (
                <div key={p} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                  <span className="flex w-24 items-center sm:w-28 gap-2 text-[13px] text-ink"><PlatformBadge platform={p} size="sm" />{PLATFORMS[p].label}</span>
                  {i === 0 ? <span className="h-1.5 rounded-full bg-line"><span className="block h-full rounded-full bg-green" style={{ width: `${pct}%` }} /></span>
                    : <input type="range" min={5} max={90} step={5} value={pct} onChange={(e) => setSplit(p, Number(e.target.value))} aria-label={`Part de ${PLATFORMS[p].label}`} className="w-full min-w-0 accent-[var(--color-green)]" />}
                  <span className="tnum w-[6.5rem] text-right text-[13px] text-ink-soft sm:w-28">{pct} % · {formatFcfa(Math.round((value.adBudget * pct) / 100))}</span>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function LevelPicker({ levels, value, onChange, baseLabel, baseFee, expert }: { levels: EditorData["levels"]; value: string | null; onChange: (code: string | null) => void; baseLabel: string; baseFee: number; expert?: boolean }) {
  return (
    <div className="grid gap-3">
      {!expert && (
        <ChoiceCard active={value === null} onClick={() => onChange(null)}>
          <span className="flex items-baseline justify-between gap-3 pr-7"><span className="font-medium text-ink">Lancement de ma campagne</span><span className="tnum text-sm font-medium">{formatFcfa(baseFee)}</span></span>
          <span className="mt-0.5 block text-[13px] text-muted">{baseLabel} : nous vérifions, configurons et lançons la publicité que vous avez préparée.</span>
        </ChoiceCard>
      )}
      {levels.filter((l) => !expert || l.kind === "MANAGEMENT" || l.kind === "PACK").map((l) => (
        <ChoiceCard key={l.code} active={value === l.code} onClick={() => onChange(l.code)}>
          <span className="flex items-baseline justify-between gap-3 pr-7"><span className="font-medium text-ink">{l.name}</span><span className="tnum text-sm font-medium">{formatFcfa(Math.max(l.fee, baseFee))}</span></span>
          <span className="mt-0.5 block text-[13px] text-muted">{l.description}</span>
          {value === l.code && l.features.length > 0 && <ul className="mt-2 space-y-1 text-[13px] text-ink-soft">{l.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-green" />{f}</li>)}</ul>}
        </ChoiceCard>
      ))}
    </div>
  );
}
