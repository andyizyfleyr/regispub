import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InfoTip } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

/**
 * Tuiles : cartes colorées pour les choix et les chiffres clés.
 * À utiliser avec parcimonie — une seule grille par page, six tuiles au plus — le reste en listes.
 */

export const TILE_TONES = {
  green: "bg-green-soft text-green",
  marigold: "bg-marigold-soft text-[#9a6400]",
  sky: "bg-sky-soft text-sky",
  violet: "bg-violet-soft text-violet",
  rose: "bg-rose-soft text-rose",
  neutral: "bg-sand text-ink-soft",
} as const;
export type TileTone = keyof typeof TILE_TONES;

/** Suite de couleurs pour une grille de tuiles : chaque tuile reçoit la sienne. */
export const TONE_CYCLE: TileTone[] = ["green", "marigold", "sky", "violet", "rose"];
export const toneAt = (i: number): TileTone => TONE_CYCLE[i % TONE_CYCLE.length];

/** Classes d'une tuile cliquable : à réutiliser pour un bouton de formulaire. */
export const tileClass = "lift group relative flex h-full w-full flex-col rounded-lg border border-line/70 bg-surface p-3.5 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/40 sm:p-5";

/** Contenu d'une tuile : pictogramme coloré, titre, précision. */
export function TileBody({ icon, tone = "green", title, text, arrow, hideTextOnMobile }: {
  icon: React.ReactNode; tone?: TileTone; title: React.ReactNode; text?: React.ReactNode; arrow?: React.ReactNode | boolean; hideTextOnMobile?: boolean;
}) {
  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-12 sm:rounded-2xl [&_svg]:size-[1.125rem] sm:[&_svg]:size-6", TILE_TONES[tone])}>{icon}</span>
        {arrow === true ? <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-line-strong transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-green" /> : arrow || null}
      </span>
      <span className="mt-2 block text-[0.875rem] font-semibold leading-snug text-ink sm:mt-3.5 sm:text-[0.9375rem]">{title}</span>
      {text && <span className={cn("mt-1 text-[0.84375rem] leading-snug text-muted", hideTextOnMobile ? "hidden sm:block" : "block")}>{text}</span>}
    </>
  );
}

/** Tuile-lien. */
export function Tile({ href, className, arrow = true, ...body }: React.ComponentProps<typeof TileBody> & { href: string; className?: string }) {
  return <Link href={href} className={cn(tileClass, className)}><TileBody arrow={arrow} {...body} /></Link>;
}

/** Étape illustrée : un pictogramme, un numéro, deux ou trois mots. */
export function StepTile({ n, icon, title, tone = "green" }: { n: number; icon: React.ReactNode; title: React.ReactNode; tone?: TileTone }) {
  return (
    <li className="relative flex flex-col items-center rounded-lg border border-line/70 bg-surface px-3 py-3.5 text-center shadow-card sm:py-5">
      <span aria-hidden className="tnum absolute left-3 top-3 flex size-6 items-center justify-center rounded-full bg-sand text-xs font-semibold text-ink-soft">{n}</span>
      <span className={cn("flex size-11 items-center justify-center rounded-2xl sm:size-14 [&_svg]:size-5 sm:[&_svg]:size-7", TILE_TONES[tone])}>{icon}</span>
      <span className="mt-2 block text-[0.875rem] font-semibold leading-snug text-ink sm:mt-3 sm:text-[0.9375rem]">{title}</span>
    </li>
  );
}

/** Chiffre clé : libellé, grande valeur, précision. */
export function StatTile({ label, value, hint, info, icon, tone = "green", className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; info?: React.ReactNode; icon?: React.ReactNode; tone?: TileTone; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-line/70 bg-surface p-3.5 shadow-card sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center text-[0.8125rem] leading-snug text-muted"><span className="truncate">{label}</span>{info && <InfoTip label={info} className="ml-1 shrink-0" />}</p>
        {icon && <span className={cn("size-7 shrink-0 items-center justify-center rounded-lg sm:size-8 [&_svg]:size-4", info ? "hidden sm:flex" : "flex", TILE_TONES[tone])}>{icon}</span>}
      </div>
      <p className="tnum mt-1.5 truncate font-display text-[1.1875rem] font-semibold leading-none text-ink sm:mt-2 sm:text-[1.625rem]">{value}</p>
      {hint && <p className="mt-2 text-xs leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/** Bandeau de marque : fond vert profond, pour l'accroche d'une page. Un seul par page. */
export function Banner({ children, className, decoration }: { children: React.ReactNode; className?: string; decoration?: React.ReactNode }) {
  return (
    <section className={cn("bg-brand relative overflow-hidden rounded-[22px] px-4 py-4 text-white shadow-lift sm:rounded-[28px] sm:px-8 sm:py-8", className)}>
      <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
      {decoration && <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 text-white/[0.08] [&_svg]:size-36 [&_svg]:-rotate-12 sm:[&_svg]:size-48">{decoration}</div>}
      <div className="relative">{children}</div>
    </section>
  );
}
