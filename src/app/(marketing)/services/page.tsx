import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
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
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <p className="eyebrow">Services et tarifs</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] sm:text-[40px]">Des prestations claires, payables par Mobile Money.</h1>
      <p className="mt-4 text-ink-soft">Les tarifs ci-dessous sont nos frais de prestation. Le budget publicitaire, que vous fixez librement à partir de {formatFcfa(settings.minAdBudget)}, s&apos;y ajoute et est intégralement reversé aux plateformes.</p>

      {(Object.keys(KIND_INFO) as (keyof typeof KIND_INFO)[]).map((kind) => {
        const list = services.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mt-10">
            <h2 className="text-xl font-semibold">{KIND_INFO[kind].title}</h2>
            <p className="mt-1 text-sm text-muted">{KIND_INFO[kind].text}</p>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {list.map((s) => (
                <details key={s.id} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{s.name}</span><span className="block text-[13px] text-muted">{kind === "SUBSCRIPTION" ? "par mois" : "par campagne"}</span></span>
                    <span className="tnum shrink-0 font-display text-lg font-semibold">{formatFcfa(s.fee)}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 sm:px-5">
                    <p className="text-sm text-muted">{s.description}</p>
                    <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                      {s.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{f}</li>)}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-12 border-t border-line pt-8">
        <h2 className="text-xl font-semibold">Prêt à lancer votre campagne ?</h2>
        <p className="mt-1.5 text-sm text-muted">Le montant exact est calculé et affiché avant tout paiement.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
          <Button asChild variant="outline"><Link href="/app/expert">Confier à un expert</Link></Button>
        </div>
      </div>
    </div>
  );
}
