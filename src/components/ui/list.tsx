import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Listes : la présentation par défaut de l'application. Une seule colonne, une ligne par élément,
 * l'information principale à gauche et la valeur ou l'état à droite.
 */

/** Titre de section avec, au besoin, un lien discret à droite. */
export function SectionTitle({ id, children, action, className }: { id?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3 px-1", className)}>
      <h2 id={id} className="font-display text-[18px] font-semibold text-ink">{children}</h2>
      {action && <div className="shrink-0 text-[13.5px] font-medium text-green [&_a:hover]:underline">{action}</div>}
    </div>
  );
}

export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("divide-y divide-line overflow-hidden rounded-lg border border-line/70 bg-surface shadow-card", className)} {...props} />;
}

/** Classes d'une ligne cliquable : à réutiliser pour un bouton de formulaire. */
export const rowClass = "group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none sm:px-5";

const ICON_TONES = {
  green: "bg-green-soft text-green",
  marigold: "bg-marigold-soft text-[#9a6400]",
  sky: "bg-sky-soft text-sky",
  violet: "bg-violet-soft text-violet",
  rose: "bg-rose-soft text-rose",
  clay: "bg-clay-soft text-clay",
  forest: "bg-forest text-marigold",
  neutral: "bg-sand text-ink-soft",
} as const;

/**
 * Contenu d'une ligne, toujours dans le même ordre pour que tout s'aligne d'une ligne à l'autre :
 * pictogramme (largeur fixe), titre puis précision sur une ligne chacun, et à droite `value` en face du titre,
 * `meta` (état, pastilles) en face de la précision. `trailing` reste centré sur la hauteur (bouton d'action).
 */
export function RowBody({ icon, tone = "neutral", title, subtitle, value, meta, trailing, chevron, below }: {
  icon?: React.ReactNode; tone?: keyof typeof ICON_TONES; title: React.ReactNode; subtitle?: React.ReactNode; value?: React.ReactNode; meta?: React.ReactNode;
  trailing?: React.ReactNode; chevron?: React.ReactNode | boolean; below?: React.ReactNode;
}) {
  return (
    <>
      {icon && <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-[14px] [&_svg]:size-5", ICON_TONES[tone])}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate font-semibold leading-snug text-ink">{title}</span>
          {value && <span className="shrink-0 text-right text-sm">{value}</span>}
        </span>
        {(subtitle || meta) && (
          <span className="mt-0.5 flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-[13.5px] leading-snug text-muted">{subtitle}</span>
            {meta && <span className="flex shrink-0 items-center">{meta}</span>}
          </span>
        )}
        {below}
      </span>
      {trailing && <span className="shrink-0 text-right text-sm">{trailing}</span>}
      {chevron === true ? <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-line-strong transition-colors group-hover:text-muted sm:block" /> : chevron || null}
    </>
  );
}

type RowProps = React.ComponentProps<typeof RowBody> & { href?: string; external?: boolean; className?: string };

/** Ligne de liste. Avec `href`, toute la ligne est un lien. */
export function ListRow({ href, external, className, chevron, ...body }: RowProps) {
  if (!href) return <li className={cn("flex items-center gap-3.5 px-4 py-3.5 sm:px-5", className)}><RowBody chevron={chevron ?? false} {...body} /></li>;
  const inner = <RowBody chevron={chevron ?? true} {...body} />;
  return (
    <li>
      {external
        ? <a href={href} target="_blank" rel="noreferrer" className={cn(rowClass, className)}>{inner}</a>
        : <Link href={href} className={cn(rowClass, className)}>{inner}</Link>}
    </li>
  );
}

/** Liste « libellé — valeur » : une information par ligne, la valeur alignée à droite. */
export function Figures({ items, className, bare }: { items: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; strong?: boolean }[]; className?: string; bare?: boolean }) {
  return (
    <dl className={cn("divide-y divide-line", !bare && "overflow-hidden rounded-lg border border-line bg-surface", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
          <dt className="min-w-0 text-sm text-ink-soft">
            {it.label}
            {it.hint && <span className="block text-[12.5px] leading-snug text-muted">{it.hint}</span>}
          </dt>
          <dd className={cn("tnum shrink-0 text-right text-sm text-ink", it.strong ? "font-display text-lg font-semibold" : "font-medium")}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
