import * as React from "react";
import { cn } from "@/lib/utils";
import { TILE_TONES, type TileTone } from "@/components/ui/tile";

export type TimelineItem = { id: string; icon: React.ReactNode; tone?: TileTone; title: React.ReactNode; text?: React.ReactNode; time?: React.ReactNode; current?: boolean };

/** Fil chronologique : une pastille à icône par étape, reliée par un trait. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < items.length - 1 && <span aria-hidden className="absolute bottom-0 left-[17px] top-9 w-px bg-line-strong" />}
          <span aria-hidden className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-[1.0625rem]", TILE_TONES[it.tone ?? "green"], it.current && "ring-4 ring-green/15")}>{it.icon}</span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-ink">{it.title}</p>
              {it.time && <p className="tnum text-xs text-muted">{it.time}</p>}
            </div>
            {it.text && <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">{it.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
