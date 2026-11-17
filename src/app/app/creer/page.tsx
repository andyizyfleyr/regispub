import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Headset } from "lucide-react";
import { CampaignCard } from "@/components/app/campaign-card";
import { ObjectiveBrowser } from "@/components/app/quick-start";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Créer une publicité" };

const HOW = [
  { title: "Choisissez un objectif", text: "Nous réglons la campagne en conséquence." },
  { title: "Présentez votre offre", text: "Une photo, quelques mots. Nous pouvons rédiger le texte." },
  { title: "Fixez votre budget", text: "Vous voyez le total avant de payer." },
  { title: "Payez par Mobile Money", text: "Notre équipe vérifie puis lance votre publicité." },
];

export default async function CreatePage() {
  const user = await requireUser();
  const [drafts, services] = await Promise.all([
    db.campaign.findMany({ where: { userId: user.id, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 2 }),
    db.service.findMany({ where: { active: true }, select: { kind: true, fee: true } }),
  ]);
  const min = (kind: string) => Math.min(...services.filter((s) => s.kind === kind).map((s) => s.fee), Infinity);
  const managementFee = min("MANAGEMENT");
  return (
    <>
      <PageHeader title="Que voulez-vous obtenir ?" description="Choisissez un objectif : votre publicité est prête en quatre étapes, sans connaissance technique." />

      {drafts.length > 0 && (
        <section aria-labelledby="brouillons" className="mb-8">
          <h2 id="brouillons" className="mb-3 text-lg font-semibold">Reprendre où vous en étiez</h2>
          <div className="stagger grid gap-3 sm:grid-cols-2">{drafts.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ObjectiveBrowser />

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-brand relative overflow-hidden rounded-lg p-5 text-white">
            <span aria-hidden className="bg-grid absolute inset-0" />
            <div className="relative">
              <span className="flex size-10 items-center justify-center rounded-md bg-white/10 text-marigold"><Headset className="size-5" /></span>
              <h2 className="mt-4 text-lg font-semibold leading-snug">Pas le temps ? Confiez tout à un expert.</h2>
              <ul className="mt-3 space-y-1.5 text-[13.5px] text-white/80">
                {["Vous décrivez votre besoin en une page", "Un gestionnaire prépare textes et visuels", "Vous validez avant toute diffusion"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-marigold" />{t}</li>)}
              </ul>
              {Number.isFinite(managementFee) && <p className="tnum mt-3 text-[13px] text-white/60">Gestion complète dès {formatFcfa(managementFee)}</p>}
              <Button asChild variant="accent" className="mt-4 w-full"><Link href="/app/expert">Confier ma publicité<ArrowRight /></Link></Button>
            </div>
          </div>

          <div className="rounded-lg border border-line p-5">
            <h2 className="text-[15px] font-semibold [font-family:var(--font-sans)]">Comment ça se passe</h2>
            <ol className="mt-4 space-y-4">
              {HOW.map((h, i) => (
                <li key={h.title} className="flex gap-3">
                  <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-green-soft text-[13px] font-semibold text-green">{i + 1}</span>
                  <span><span className="block text-[14px] font-medium leading-snug text-ink">{h.title}</span><span className="block text-[13px] leading-snug text-muted">{h.text}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
