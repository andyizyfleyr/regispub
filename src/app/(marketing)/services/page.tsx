import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/utils";

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
    <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
      <p className="eyebrow">Services et tarifs</p>
      <h1 className="mt-2 max-w-3xl text-[36px] font-semibold leading-[1.08] sm:text-[48px]">Des prestations claires, en francs CFA, payables par Mobile Money.</h1>
      <p className="mt-5 max-w-2xl text-[17px] text-ink-soft">Les tarifs ci-dessous sont nos frais de prestation. Le budget publicitaire, que vous fixez librement à partir de {formatFcfa(settings.minAdBudget)}, s&apos;y ajoute et est intégralement reversé aux plateformes.</p>

      {(Object.keys(KIND_INFO) as (keyof typeof KIND_INFO)[]).map((kind) => {
        const list = services.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mt-14">
            <div className="flex flex-col gap-1 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-2xl font-semibold">{KIND_INFO[kind].title}</h2>
              <p className="max-w-md text-sm text-muted">{KIND_INFO[kind].text}</p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <article key={s.id} className="flex flex-col rounded-xl border border-line bg-surface p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[17px] font-semibold tracking-normal [font-family:var(--font-sans)]">{s.name}</h3>
                    {kind === "MANAGEMENT" && <Badge tone="accent">Clé en main</Badge>}
                  </div>
                  <p className="mt-3">
                    <span className="tnum font-display text-[30px] font-semibold leading-none">{formatFcfa(s.fee)}</span>
                    <span className="ml-1.5 text-sm text-muted">{kind === "SUBSCRIPTION" ? "par mois" : "par campagne"}</span>
                  </p>
                  <p className="mt-3 text-sm text-muted">{s.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                    {s.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{f}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-xl bg-forest p-8 text-white sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Prêt à lancer votre campagne ?</h2>
          <p className="mt-1.5 text-sm text-white/70">Le montant exact est calculé et affiché avant tout paiement.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
          <Button asChild variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10"><Link href="/app/expert">Parler à un expert</Link></Button>
        </div>
      </div>
    </div>
  );
}
