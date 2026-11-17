"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { ObjectiveIcon } from "@/components/icons";
import { getObjective, OBJECTIVE_CATEGORIES, OBJECTIVES, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { cn } from "@/lib/utils";
import { createCampaignAction } from "@/server/actions/campaigns";

const CATEGORY_TONE: Record<ObjectiveCategory, string> = {
  business: "bg-green-soft text-green",
  community: "bg-violet-soft text-violet",
  awareness: "bg-marigold-soft text-[#9a6400]",
};

function Arrow() {
  const { pending } = useFormStatus();
  return pending
    ? <LoaderCircle className="size-4 shrink-0 animate-spin text-green" />
    : <ArrowRight className="size-4 shrink-0 text-line-strong transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-green" />;
}

/** Raccourci : un clic crée la campagne avec l'objectif déjà choisi. */
export function ObjectiveShortcut({ code, className }: { code: string; className?: string }) {
  const o = getObjective(code);
  if (!o) return null;
  return (
    <form action={createCampaignAction.bind(null, "SELF_SERVICE", o.code)} className={className}>
      <button type="submit" className="lift group flex h-full w-full items-center gap-3.5 rounded-lg border border-line bg-surface p-4 text-left shadow-card">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-md", CATEGORY_TONE[o.category])}><ObjectiveIcon name={o.icon} className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug text-ink">{o.label}</span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{o.description}</span>
        </span>
        <Arrow />
      </button>
    </form>
  );
}

const POPULAR = ["whatsapp_orders", "sales", "page_awareness", "leads", "ig_followers", "store_visits"];
type Tab = "popular" | ObjectiveCategory;

/** Choix de l'objectif en entrée de création : les plus demandés d'abord, puis par famille. */
export function ObjectiveBrowser() {
  const [tab, setTab] = React.useState<Tab>("popular");
  const tabs: { id: Tab; label: string }[] = [
    { id: "popular", label: "Les plus demandés" },
    { id: "business", label: "Vendre" },
    { id: "community", label: "Communauté" },
    { id: "awareness", label: "Visibilité" },
  ];
  const codes = tab === "popular" ? POPULAR : OBJECTIVES.filter((o) => o.category === tab).map((o) => o.code);
  return (
    <div>
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-full bg-sand p-1" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn("whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors", tab === t.id ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab !== "popular" && <p className="mt-3 text-sm text-muted">{OBJECTIVE_CATEGORIES[tab].description}</p>}
      <div key={tab} className="stagger mt-4 grid gap-3 sm:grid-cols-2">
        {codes.map((code) => <ObjectiveShortcut key={code} code={code} />)}
      </div>
    </div>
  );
}
