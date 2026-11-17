"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, ChevronDown, LoaderCircle } from "lucide-react";
import { ObjectiveIcon } from "@/components/icons";
import { getObjective, OBJECTIVE_CATEGORIES, OBJECTIVES, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { List, RowBody, rowClass, SectionTitle } from "@/components/ui/list";
import { createCampaignAction } from "@/server/actions/campaigns";

function Arrow() {
  const { pending } = useFormStatus();
  return pending
    ? <LoaderCircle className="size-4 shrink-0 animate-spin text-green" />
    : <ArrowRight className="size-4 shrink-0 text-line-strong transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-green" />;
}

/** Ligne d'objectif : un clic crée la campagne avec l'objectif déjà choisi. */
export function ObjectiveShortcut({ code }: { code: string }) {
  const o = getObjective(code);
  if (!o) return null;
  return (
    <li>
      <form action={createCampaignAction.bind(null, "SELF_SERVICE", o.code)}>
        <button type="submit" className={rowClass}>
          <RowBody icon={<ObjectiveIcon name={o.icon} />} tone="green" title={o.label} subtitle={<span className="line-clamp-2">{o.description}</span>} chevron={<Arrow />} />
        </button>
      </form>
    </li>
  );
}

const POPULAR = ["whatsapp_orders", "sales", "page_awareness", "leads", "ig_followers", "store_visits"];

/** Choix de l'objectif en entrée de création : les plus demandés, puis tous les autres sur demande. */
export function ObjectiveBrowser() {
  const [all, setAll] = React.useState(false);
  const others = (category: ObjectiveCategory) => OBJECTIVES.filter((o) => o.category === category && !POPULAR.includes(o.code));
  return (
    <div className="space-y-6">
      <section aria-labelledby="objectifs">
        <SectionTitle id="objectifs">Les plus demandés</SectionTitle>
        <List>{POPULAR.map((code) => <ObjectiveShortcut key={code} code={code} />)}</List>
      </section>
      {all ? (
        (Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).filter((c) => others(c).length > 0).map((c) => (
          <section key={c} aria-label={OBJECTIVE_CATEGORIES[c].label} className="animate-rise">
            <SectionTitle>{OBJECTIVE_CATEGORIES[c].label}</SectionTitle>
            <List>{others(c).map((o) => <ObjectiveShortcut key={o.code} code={o.code} />)}</List>
          </section>
        ))
      ) : (
        <button type="button" onClick={() => setAll(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
          Voir tous les objectifs<ChevronDown className="size-4" />
        </button>
      )}
    </div>
  );
}
