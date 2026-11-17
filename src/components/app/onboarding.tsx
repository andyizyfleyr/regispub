"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SLIDES = [
  { img: "megaphone", bg: "bg-green-soft", title: "Choisissez un objectif", text: "Ventes, messages, abonnés…" },
  { img: "phone", bg: "bg-marigold-soft", title: "Payez par Mobile Money", text: "Sans carte bancaire." },
  { img: "chart", bg: "bg-sky-soft", title: "Suivez vos résultats", text: "Nous lançons, vous suivez." },
] as const;

/** Écrans de bienvenue : affichés une fois au nouveau client, ou sur demande (« Revoir le guide »). */
export function Onboarding({ userId, auto, force }: { userId: string; auto: boolean; force?: boolean }) {
  const router = useRouter();
  const key = `rp-guide-${userId}`;
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const track = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let seen = true;
    try { seen = window.localStorage.getItem(key) === "1"; } catch { /* stockage indisponible : on n'insiste pas */ }
    if (force || (auto && !seen)) setOpen(true);
  }, [auto, force, key]);

  const close = (next?: string) => {
    try { window.localStorage.setItem(key, "1"); } catch { /* idem */ }
    setOpen(false);
    if (next) router.push(next); else if (force) router.replace("/app");
  };
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  const last = index === SLIDES.length - 1;

  return (
    <D.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-fade bg-forest/45 backdrop-blur-[3px]" />
        <D.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] animate-sheet flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop sm:rounded-3xl" onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}>
          <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
          <D.Title className="sr-only">Bienvenue sur RegisPub</D.Title>
          <D.Description className="sr-only">Trois écrans pour comprendre le fonctionnement.</D.Description>
          <D.Close className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/70 text-muted hover:text-ink" aria-label="Passer"><X className="size-4" /></D.Close>

          <div ref={track} data-no-pull onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
            className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto">
            {SLIDES.map((s, i) => (
              <div key={s.img} className="w-full shrink-0 snap-center px-5 pt-5 text-center" aria-hidden={i !== index}>
                <div className={cn("mx-auto flex aspect-[4/3] w-full items-center justify-center rounded-3xl", s.bg)}>
                  <Image src={`/img/3d/${s.img}.webp`} alt="" width={280} height={280} unoptimized priority={i === 0} className="h-[82%] w-auto mix-blend-multiply" />
                </div>
                <p className="mt-5 font-display text-[24px] font-semibold leading-tight text-ink">{s.title}</p>
                <p className="mt-1.5 text-[15px] text-muted">{s.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 px-5 pb-6 pt-5">
            <div className="flex items-center gap-1.5">
              {SLIDES.map((s, i) => (
                <button key={s.img} type="button" onClick={() => go(i)} aria-label={`Écran ${i + 1}`} aria-current={i === index}
                  className={cn("h-2 rounded-full transition-[width,background-color] duration-300", i === index ? "w-6 bg-green" : "w-2 bg-line-strong")} />
              ))}
            </div>
            {last
              ? <Button variant="accent" size="lg" onClick={() => close("/app/creer")}>Commencer<ArrowRight /></Button>
              : <Button size="lg" onClick={() => go(index + 1)}>Suivant<ArrowRight /></Button>}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
