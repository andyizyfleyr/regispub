import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Services et tarifs" };

const KIND_INFO = {
  CAMPAIGN: { title: "Campagnes par objectif", text: "Vous préparez votre publicité avec l'assistant ; notre équipe la vérifie, la configure et la lance." },
  PACK: { title: "Création et publicité", text: "Nous réalisons aussi vos visuels et vos textes." },
  MANAGEMENT: { title: "Gestion complète", text: "Un expert dédié prend tout en charge, de la stratégie au bilan." },
  SUBSCRIPTION: { title: "Accompagnement mensuel", text: "Un partenaire marketing dans la durée. Renouvellement mensuel par Mobile Money, sans engagement." },
} as const;

export default async function ServicesPage() {
  const [services, settings] = await Promise.all([db.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }), getSettings()]);
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <p className="eyebrow">Services et tarifs</p>
      <h1 className="mt-2 max-w-3xl text-[34px] font-semibold leading-[1.08] sm:text-[46px]">Des prestations claires, payables par Mobile Money.</h1>
      <p className="mt-4 max-w-2xl text-[17px] text-ink-soft">Les tarifs ci-dessous sont nos frais de prestation. Le budget publicitaire, que vous fixez librement à partir de {formatFcfa(settings.minAdBudget)}, s&apos;y ajoute et est intégralement reversé aux plateformes.</p>

      {(Object.keys(KIND_INFO) as (keyof typeof KIND_INFO)[]).map((kind) => {
        const list = services.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mt-12">
            <h2 className="text-2xl font-semibold">{KIND_INFO[kind].title}</h2>
            <p className="mt-1 text-sm text-muted">{KIND_INFO[kind].text}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s, i) => (
                <article key={s.id} className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card">
                  <span aria-hidden className={cn("h-1.5 w-10 rounded-full", ["bg-green", "bg-marigold", "bg-sky", "bg-violet", "bg-rose"][i % 5])} />
                  <h3 className="mt-4 text-[17px] font-semibold tracking-normal [font-family:var(--font-sans)]">{s.name}</h3>
                  <p className="mt-2">
                    <span className="tnum font-display text-[30px] font-semibold leading-none">{formatFcfa(s.fee)}</span>
                    <span className="ml-1.5 text-sm text-muted">{kind === "SUBSCRIPTION" ? "par mois" : "par campagne"}</span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{s.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                    {s.features.slice(0, 4).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{f}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <div className="bg-brand relative mt-14 overflow-hidden rounded-[28px] px-6 py-10 text-white shadow-lift sm:px-10">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">Prêt à lancer votre campagne ?</h2>
            <p className="mt-1.5 text-sm text-white/75">Le montant exact est calculé et affiché avant tout paiement.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
            <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"><Link href="/app/expert">Confier à un expert</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
