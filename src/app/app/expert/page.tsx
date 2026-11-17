import type { Metadata } from "next";
import { ArrowRight, Headset } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { List, SectionTitle } from "@/components/ui/list";
import { Banner, TILE_TONES, toneAt } from "@/components/ui/tile";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cn, formatFcfa } from "@/lib/utils";
import { createCampaignAction } from "@/server/actions/campaigns";

export const metadata: Metadata = { title: "Confier ma publicité à un expert" };

const STEPS = [
  { title: "Vous décrivez", text: "Votre activité, votre objectif, votre budget. Cinq minutes suffisent." },
  { title: "Vous payez", text: "Par Mobile Money. Budget et prestation affichés séparément." },
  { title: "Nous préparons", text: "Textes, visuels, ciblage. Vous échangez avec lui par messagerie." },
  { title: "Vous validez", text: "Nous lançons ensuite la campagne et suivons les résultats." },
];

export default async function ExpertPage() {
  const user = await requireUser();
  const [drafts, services, settings] = await Promise.all([
    db.campaign.findMany({ where: { userId: user.id, mode: "EXPERT", status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.service.findMany({ where: { active: true, kind: { in: ["MANAGEMENT", "PACK"] } }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  const wa = settings.supportWhatsapp.replace(/\D/g, "");
  return (
    <div className="animate-rise space-y-8">
      <Banner decoration={<Headset />}>
        <h1 className="max-w-md text-[26px] font-semibold leading-tight text-white sm:text-[32px]">Confiez votre publicité à un expert</h1>
        <p className="mt-2 max-w-md text-[15px] text-white/75">Vous décrivez votre besoin, notre équipe s&apos;occupe du reste. Rien n&apos;est diffusé sans votre accord.</p>
        <form action={createCampaignAction.bind(null, "EXPERT", undefined)} className="mt-5"><Button type="submit" variant="accent" size="lg">Remplir mon brief<ArrowRight /></Button></form>
      </Banner>

      {drafts.length > 0 && (
        <section aria-labelledby="briefs">
          <SectionTitle id="briefs">Reprendre un brief</SectionTitle>
          <List className="shadow-card">{drafts.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}

      <section aria-labelledby="etapes">
        <SectionTitle id="etapes">Comment ça se passe</SectionTitle>
        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <span className={cn("tnum flex size-9 items-center justify-center rounded-xl font-display text-base font-semibold", TILE_TONES[toneAt(i)])}>{i + 1}</span>
              <span className="mt-3 block text-[15px] font-semibold leading-snug text-ink">{s.title}</span>
              <span className="mt-1 block text-[13.5px] leading-snug text-muted">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {services.length > 0 && (
        <section aria-labelledby="formules">
          <SectionTitle id="formules">Formules</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-surface p-5 shadow-card">
                <p className="text-[15px] font-semibold text-ink">{s.name}</p>
                <p className="mt-2"><span className="tnum font-display text-[26px] font-semibold leading-none">{formatFcfa(s.fee)}</span><span className="ml-1.5 text-[13px] text-muted">par campagne</span></p>
                <p className="mt-2 text-[13.5px] leading-snug text-muted">{s.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-muted">Hors budget publicitaire, que vous fixez librement.{wa && <> Une question ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="font-medium text-green hover:underline">Écrivez-nous sur WhatsApp</a>.</>}</p>
        </section>
      )}
    </div>
  );
}
