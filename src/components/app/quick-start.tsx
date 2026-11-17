"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, ChevronDown, LoaderCircle } from "lucide-react";
import { ObjectiveIcon } from "@/components/icons";
import { getObjective, OBJECTIVE_CATEGORIES, OBJECTIVES, objectiveShort, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { SectionTitle } from "@/components/ui/list";
import { TileBody, tileClass, toneAt, type TileTone } from "@/components/ui/tile";
import { createCampaignAction } from "@/server/actions/campaigns";

function Arrow() {
  const { pending } = useFormStatus();
  return pending
    ? <LoaderCircle className="size-4 shrink-0 animate-spin text-green" />
    : <ArrowRight className="size-4 shrink-0 text-line-strong transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-green" />;
}

/** Tuile d'objectif : un clic crée la campagne avec l'objectif déjà choisi. */
export function ObjectiveShortcut({ code, tone = "green" }: { code: string; tone?: TileTone }) {
  const o = getObjective(code);
  if (!o) return null;
  return (
    <li>
      <form action={createCampaignAction.bind(null, "SELF_SERVICE", o.code)} className="h-full">
        <button type="submit" className={tileClass} title={o.label}>
          <TileBody icon={<ObjectiveIcon name={o.icon} />} tone={tone} title={objectiveShort(o)} arrow={<span className="mt-1"><Arrow /></span>} />
        </button>
      </form>
    </li>
  );
}

const GRID = "grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3";

const POPULAR = ["whatsapp_orders", "sales", "page_awareness", "leads", "ig_followers", "store_visits"];

/** Choix de l'objectif en entrée de création : les plus demandés, puis tous les autres sur demande. */
export function ObjectiveBrowser() {
  const [all, setAll] = React.useState(false);
  const others = (category: ObjectiveCategory) => OBJECTIVES.filter((o) => o.category === category && !POPULAR.includes(o.code));
  return (
    <div className="space-y-6">
      <section aria-labelledby="objectifs">
        <SectionTitle id="objectifs">Populaires</SectionTitle>
        <ul className={GRID}>{POPULAR.map((code, i) => <ObjectiveShortcut key={code} code={code} tone={toneAt(i)} />)}</ul>
      </section>
      {all ? (
        (Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).filter((c) => others(c).length > 0).map((c, ci) => (
          <section key={c} aria-label={OBJECTIVE_CATEGORIES[c].label} className="animate-rise">
            <SectionTitle>{OBJECTIVE_CATEGORIES[c].label}</SectionTitle>
            <ul className={GRID}>{others(c).map((o, i) => <ObjectiveShortcut key={o.code} code={o.code} tone={toneAt(i + ci)} />)}</ul>
          </section>
        ))
      ) : (
        <button type="button" onClick={() => setAll(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
          Tous les objectifs<ChevronDown className="size-4" />
        </button>
      )}
    </div>
  );
}
