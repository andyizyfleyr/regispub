"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Binoculars, CalendarDays, CalendarPlus, Check, Copy, Hash, Lightbulb, LoaderCircle, MessageCircleQuestion, Sparkles, Stethoscope, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { PlatformBadge } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, DatePicker } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { TILE_TONES, toneAt } from "@/components/ui/tile";
import type { Advice, CalendarPlan, Captions, Competition, Diagnostic, Hashtags, Ideas } from "@/lib/ai/schemas";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { cn, formatDay } from "@/lib/utils";
import { deleteCalendarEntryAction, runAssistantAction, saveCalendarAction, toggleCalendarEntryAction } from "@/server/actions/assistant";

type Kind = "diagnostic" | "calendar" | "ideas" | "captions" | "hashtags" | "competition" | "advice";
type FieldDef = { name: string; label: string; placeholder?: string; long?: boolean; options?: string[]; optional?: boolean };

const TOOL_ICONS: Record<Kind, typeof Stethoscope> = { diagnostic: Stethoscope, calendar: CalendarDays, ideas: Lightbulb, captions: Type, hashtags: Hash, competition: Binoculars, advice: MessageCircleQuestion };

const TOOLS: { kind: Kind; label: string; description: string; needsModel?: boolean; fields: FieldDef[] }[] = [
  { kind: "diagnostic", label: "Diagnostic", description: "Points forts, points faibles et priorités de votre présence en ligne.", fields: [
    { name: "Objectif principal", label: "Votre objectif", options: ["Vendre plus", "Recevoir plus de messages", "Gagner des abonnés", "Me faire connaître", "Fidéliser mes clients"] },
    { name: "Fréquence de publication", label: "Vous publiez", options: ["Rarement", "1 à 2 fois par semaine", "3 à 5 fois par semaine", "Tous les jours"] },
    { name: "Difficultés", label: "Vos difficultés", long: true, optional: true, placeholder: "Peu de messages, pas le temps de publier…" },
  ] },
  { kind: "calendar", label: "Calendrier", description: "Un planning de publications prêt à enregistrer.", fields: [
    { name: "Durée", label: "Période", options: ["7 jours", "14 jours", "30 jours"] },
    { name: "Rythme", label: "Rythme", options: ["3 publications par semaine", "5 publications par semaine", "1 publication par jour"] },
    { name: "topic", label: "Thème ou produit", optional: true, placeholder: "Nouvelle collection, promotion de fin de mois…" },
  ] },
  { kind: "ideas", label: "Idées", description: "Des idées de publications et de vidéos courtes.", fields: [
    { name: "topic", label: "Produit, service ou thème", placeholder: "Pagnes tissés, livraison de repas…" },
    { name: "Format préféré", label: "Format", options: ["Tous les formats", "Vidéo courte", "Image", "Carrousel", "Story"] },
  ] },
  { kind: "captions", label: "Légendes", description: "Des textes prêts à publier.", fields: [
    { name: "topic", label: "Sujet", placeholder: "Arrivage de sacs en cuir à 15 000 F" },
    { name: "Ton", label: "Ton", options: ["Chaleureux", "Professionnel", "Dynamique", "Humoristique"] },
    { name: "Plateforme", label: "Plateforme", options: ["Facebook", "Instagram", "TikTok"] },
  ] },
  { kind: "hashtags", label: "Hashtags", description: "Des hashtags adaptés à votre activité et à votre ville.", fields: [
    { name: "topic", label: "Sujet", placeholder: "Coiffure afro à Cotonou" },
  ] },
  { kind: "competition", label: "Concurrence", needsModel: true, description: "Une lecture de ce que vous observez chez vos concurrents.", fields: [
    { name: "Concurrents observés", label: "Vos concurrents", long: true, placeholder: "Noms, types de publications, prix, promotions, ce qui semble bien fonctionner…" },
  ] },
  { kind: "advice", label: "Conseil", needsModel: true, description: "Posez une question marketing précise.", fields: [
    { name: "Question", label: "Votre question", long: true, placeholder: "Comment relancer mes anciens clients sur WhatsApp sans les déranger ?" },
  ] },
];

type Entry = { id: string; date: string; platform: string; title: string; caption: string | null; hashtags: string[]; done: boolean };
type Result = { kind: Kind; data: Record<string, unknown>; engine: "ai" | "rules"; notice: string | null };

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green hover:bg-green-soft"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error("Copie impossible sur cet appareil."); } }}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{done ? "Copié" : "Copier"}
    </button>
  );
}

const Bullets = ({ title, items }: { title: string; items: string[] }) => items.length ? (
  <div><h4 className="text-[13px] font-semibold text-ink">{title}</h4><ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-soft">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
) : null;

export function Assistant({ businesses, hasModel, entries, today }: { businesses: { id: string; name: string }[]; hasModel: boolean; entries: Entry[]; today: string }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<Kind>("diagnostic");
  const [businessId, setBusinessId] = React.useState(businesses[0]?.id ?? "");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [startDate, setStartDate] = React.useState(today);
  const tool = TOOLS.find((t) => t.kind === kind)!;
  const locked = Boolean(tool.needsModel && !hasModel);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fields: Record<string, string> = {};
    for (const f of tool.fields) { const v = (values[`${kind}:${f.name}`] ?? f.options?.[0] ?? "").trim(); if (v) fields[f.name] = v; }
    const res = await runAssistantAction({ kind, businessId: businessId || null, fields });
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    setResult({ kind, data: res.data.data, engine: res.data.engine, notice: res.data.notice });
  }

  if (!businesses.length) {
    return <Notice tone="info" title="Ajoutez d'abord votre entreprise"><Link href="/app/compte?onglet=entreprises" className="font-medium underline">Ajouter mon entreprise</Link></Notice>;
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0 space-y-4">
        <div role="tablist" aria-label="Outils" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {TOOLS.map((t, i) => {
            const Icon = TOOL_ICONS[t.kind];
            const on = t.kind === kind;
            return (
              <button key={t.kind} type="button" role="tab" aria-selected={on} title={t.description} onClick={() => setKind(t.kind)}
                className={cn("flex flex-col items-center gap-1.5 rounded-xl border bg-surface px-1 py-3 text-center transition-[border-color,box-shadow,background-color]", on ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line shadow-card hover:border-line-strong")}>
                <span aria-hidden className={cn("flex size-9 items-center justify-center rounded-xl", TILE_TONES[toneAt(i)])}><Icon className="size-[18px]" /></span>
                <span className="text-[12px] font-medium leading-tight text-ink">{t.label}</span>
              </button>
            );
          })}
        </div>
        <Card>
          <CardBody>
            {locked ? (
              <Notice tone="warn" title="Bientôt disponible">Cet outil n&apos;est pas encore activé.</Notice>
            ) : (
              <form onSubmit={run} className="space-y-4">
                {businesses.length > 1 && (
                  <Field label="Entreprise" htmlFor="as-biz"><Select id="as-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
                )}
                {tool.fields.map((f) => {
                  const id = `as-${kind}-${f.name}`; const key = `${kind}:${f.name}`;
                  const set = (v: string) => setValues((s) => ({ ...s, [key]: v }));
                  return (
                    <Field key={key} label={f.label} htmlFor={id} optional={f.optional}>
                      {f.options ? <Select id={id} value={values[key] ?? f.options[0]} onChange={(e) => set(e.target.value)}>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
                        : f.long ? <Textarea id={id} rows={4} maxLength={2000} value={values[key] ?? ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} required={!f.optional} />
                        : <Input id={id} maxLength={200} value={values[key] ?? ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} required={!f.optional} />}
                    </Field>
                  );
                })}
                <Button type="submit" className="w-full" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy ? "Préparation…" : "Générer"}</Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        {result ? (
          <Card>
            <CardHeader title={TOOLS.find((t) => t.kind === result.kind)!.label} action={<Badge tone={result.engine === "ai" ? "ok" : "neutral"}>{result.engine === "ai" ? "Généré par IA" : "Suggestions guidées"}</Badge>} />
            <CardBody className="space-y-5">
              {result.notice && <Notice tone="info">{result.notice}</Notice>}
              <ResultView result={result} startDate={startDate} setStartDate={setStartDate} today={today} onSave={async () => {
                const res = await saveCalendarAction(businessId || null, startDate, (result.data as CalendarPlan).entries);
                if (!res.ok) toast.error(res.error); else { toast.success(`${res.data.count} publication(s) ajoutée(s) à votre calendrier.`); router.refresh(); }
              }} />
              <p className="border-t border-line pt-3 text-xs text-muted">Propositions à relire. Aucun résultat garanti.</p>
            </CardBody>
          </Card>
        ) : null}
        <CalendarList entries={entries} />
      </div>
    </div>
  );
}

function ResultView({ result, onSave, startDate, setStartDate, today }: { result: Result; onSave: () => Promise<void>; startDate: string; setStartDate: (v: string) => void; today: string }) {
  const [saving, setSaving] = React.useState(false);
  switch (result.kind) {
    case "diagnostic": { const d = result.data as Diagnostic; return (
      <>
        <p className="text-sm text-ink-soft">{d.summary}</p>
        <div className="space-y-5"><Bullets title="Points forts" items={d.strengths} /><Bullets title="Points à améliorer" items={d.weaknesses} /></div>
        {d.priorities.length > 0 && <div><h4 className="text-[13px] font-semibold">Priorités</h4><ol className="mt-2 space-y-2">{d.priorities.map((p, i) => <li key={i} className="flex gap-3 rounded-md bg-paper px-3 py-2.5 text-sm"><span className="tnum font-semibold text-green">{i + 1}</span><span><span className="font-medium text-ink">{p.title}</span><span className="block text-ink-soft">{p.action}</span></span></li>)}</ol></div>}
        {d.campaignSuggestions.length > 0 && <div><h4 className="text-[13px] font-semibold">Campagnes conseillées</h4><ul className="mt-2 space-y-2 text-sm">{d.campaignSuggestions.map((s, i) => <li key={i}><span className="font-medium">{s.objective}</span> — <span className="text-ink-soft">{s.why}</span></li>)}</ul><Button asChild size="sm" className="mt-3"><Link href="/app/creer">Créer une publicité</Link></Button></div>}
      </>
    ); }
    case "calendar": { const d = result.data as CalendarPlan; return (
      <>
        <ul className="divide-y divide-line rounded-md border border-line">
          {d.entries.map((e, i) => (
            <li key={i} className="flex gap-3 px-3.5 py-3 text-sm">
              <span className="tnum w-10 shrink-0 text-xs font-medium text-muted">J+{e.dayOffset}</span>
              <PlatformBadge platform={e.platform as PlatformCode} size="sm" />
              <span className="min-w-0 flex-1"><span className="font-medium text-ink">{e.title}</span><span className="block whitespace-pre-wrap text-[13px] text-ink-soft">{e.caption}</span>{e.hashtags.length > 0 && <span className="mt-1 block text-xs text-green">{e.hashtags.join(" ")}</span>}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Date de début" htmlFor="cal-start" className="w-44"><DatePicker id="cal-start" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Button disabled={saving || !d.entries.length} onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}><CalendarPlus />{saving ? "Enregistrement…" : "Ajouter à mon calendrier"}</Button>
        </div>
      </>
    ); }
    case "ideas": { const d = result.data as Ideas; return <ul className="divide-y divide-line rounded-md border border-line">{d.ideas.map((x, i) => <li key={i} className="px-3.5 py-3 text-sm"><p className="font-medium text-ink">{x.title}</p><p className="text-xs text-green">{x.format}</p><p className="mt-1.5 text-ink-soft">{x.description}</p></li>)}</ul>; }
    case "captions": { const d = result.data as Captions; return <ul className="space-y-3">{d.captions.map((c, i) => <li key={i} className="flex items-start gap-3 rounded-md border border-line p-3.5 text-sm"><p className="min-w-0 flex-1 whitespace-pre-wrap text-ink-soft">{c}</p><CopyButton text={c} /></li>)}</ul>; }
    case "hashtags": { const d = result.data as Hashtags; return (
      <>
        <div className="flex flex-wrap gap-1.5">{d.hashtags.map((h) => <span key={h} className="rounded-full bg-green-soft px-2.5 py-1 text-[13px] text-forest">{h}</span>)}</div>
        <div className="flex items-center justify-between gap-3">{d.note ? <p className="text-[13px] text-muted">{d.note}</p> : <span />}<CopyButton text={d.hashtags.join(" ")} /></div>
      </>
    ); }
    case "competition": { const d = result.data as Competition; return <><p className="text-sm text-ink-soft">{d.summary}</p><Bullets title="Observations" items={d.observations} /><Bullets title="Opportunités" items={d.opportunities} />{d.limits && <Notice tone="warn" title="Limites de l'analyse">{d.limits}</Notice>}</>; }
    case "advice": { const d = result.data as Advice; return <><p className="whitespace-pre-wrap text-sm text-ink-soft">{d.answer}</p><Bullets title="Étapes" items={d.steps} /></>; }
  }
}

function CalendarList({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  if (!entries.length) return null;
  return (
    <Card>
      <CardHeader title="Mon calendrier" description="Cochez ce qui est publié." />
      <ul className="divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <Checkbox className="mt-0.5" checked={e.done} aria-label={`Marquer « ${e.title} » comme publiée`}
              onCheckedChange={async (v) => { await toggleCalendarEntryAction(e.id, v === true); router.refresh(); }} />
            <div className={cn("min-w-0 flex-1 text-sm", e.done && "opacity-55")}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium capitalize text-muted">{formatDay(e.date)}</span><PlatformBadge platform={e.platform as PlatformCode} size="sm" /><span className={cn("font-medium text-ink", e.done && "line-through")}>{e.title}</span></p>
              {e.caption && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] text-ink-soft">{e.caption}</p>}
            </div>
            {e.caption && <CopyButton text={`${e.caption}${e.hashtags.length ? `\n\n${e.hashtags.join(" ")}` : ""}`} />}
            <button type="button" aria-label="Supprimer" className="rounded-md p-1.5 text-muted hover:bg-sand hover:text-clay" onClick={async () => { await deleteCalendarEntryAction(e.id); router.refresh(); }}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
