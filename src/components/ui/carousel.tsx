"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Carrousel : défilement au doigt avec aimantation, points de repère, flèches sur grand écran. */
export function Carousel({ children, label, className, itemClassName = "basis-[80%] sm:basis-[46%] lg:basis-[31.5%]" }: { children: React.ReactNode; label: string; className?: string; itemClassName?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const items = React.Children.toArray(children);
  const [index, setIndex] = React.useState(0);
  const [pages, setPages] = React.useState(items.length);

  const measure = React.useCallback(() => {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const step = first.offsetWidth + 12;
    const hidden = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / step));
    setPages(hidden + 1);
    setIndex(Math.min(hidden, Math.round(el.scrollLeft / step)));
  }, []);

  React.useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, items.length]);

  const go = (i: number) => {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (el && first) el.scrollTo({ left: i * (first.offsetWidth + 12), behavior: "smooth" });
  };
  const arrow = "hidden size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-card transition-colors hover:border-line-strong hover:text-ink disabled:opacity-35 sm:flex";

  return (
    <div className={className} role="group" aria-roledescription="carrousel" aria-label={label}>
      <div ref={ref} onScroll={measure} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:-mx-1 sm:scroll-px-1 sm:px-1">
        {items.map((child, i) => <div key={i} className={cn("flex shrink-0 snap-start", itemClassName)}>{child}</div>)}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" className={arrow} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Précédent"><ChevronLeft className="size-4" /></button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" onClick={() => go(i)} aria-label={`Élément ${i + 1}`} aria-current={i === index}
                className={cn("h-2 rounded-full transition-[width,background-color] duration-300", i === index ? "w-6 bg-green" : "w-2 bg-line-strong hover:bg-muted")} />
            ))}
          </div>
          <button type="button" className={arrow} onClick={() => go(index + 1)} disabled={index >= pages - 1} aria-label="Suivant"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
