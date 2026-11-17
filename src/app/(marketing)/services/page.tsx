import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, Headset, Megaphone, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { TILE_TONES } from "@/components/ui/tile";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Services et tarifs" };

const KIND_INFO = {
  CAMPAIGN: { title: "Vous créez", icon: <Megaphone />, tone: "green" },
  PACK: { title: "Nous créons vos visuels", icon: <Palette />, tone: "marigold" },
  MANAGEMENT: { title: "Un expert gère tout", icon: <Headset />, tone: "sky" },
  SUBSCRIPTION: { title: "Suivi mensuel", icon: <CalendarClock />, tone: "violet" },
} as const;

/** Au-delà de trois offres : carrousel. Sinon, simple grille. */
function Group({ many, children }: { many: boolean; children: React.ReactNode }) {
  return many
    ? <Carousel label="Offres" className="mt-5" itemClassName="basis-[78%] sm:basis-[44%] lg:basis-[31.5%]">{children}</Carousel>
    : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export default async function ServicesPage() {
  const [services, settings] = await Promise.all([db.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }), getSettings()]);
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.08] sm:text-[46px]">Tarifs</h1>
      <p className="tnum mt-3 max-w-2xl text-[17px] text-ink-soft">Hors budget publicitaire, dès {formatFcfa(settings.minAdBudget)}.</p>

      {(Object.keys(KIND_INFO) as (keyof typeof KIND_INFO)[]).map((kind) => {
        const list = services.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mt-12">
            <h2 className="flex items-center gap-3 text-2xl font-semibold"><span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", TILE_TONES[KIND_INFO[kind].tone])}>{KIND_INFO[kind].icon}</span>{KIND_INFO[kind].title}</h2>
            <Group many={list.length > 3}>
              {list.map((s, i) => (
                <article key={s.id} className="flex w-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-card">
                  <span aria-hidden className={cn("h-1.5 w-10 rounded-full", ["bg-green", "bg-marigold", "bg-sky", "bg-violet", "bg-rose"][i % 5])} />
                  <h3 className="mt-4 text-[17px] font-semibold tracking-normal [font-family:var(--font-sans)]">{s.name}</h3>
                  <p className="mt-2">
                    <span className="tnum font-display text-[30px] font-semibold leading-none">{formatFcfa(s.fee)}</span>
                    <span className="ml-1.5 text-sm text-muted">{kind === "SUBSCRIPTION" ? "/ mois" : "/ campagne"}</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                    {(list.length > 2 ? [] : s.features.slice(0, 3)).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{f}</li>)}
                  </ul>
                </article>
              ))}
            </Group>
          </section>
        );
      })}

      <div className="bg-brand relative mt-14 overflow-hidden rounded-[28px] px-6 py-10 text-white shadow-lift sm:px-10">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">Prêt à vous lancer ?</h2>
            <p className="mt-1.5 text-sm text-white/75">Le total s&apos;affiche avant de payer.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
            <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"><Link href="/app/expert"><Headset />Un expert</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
