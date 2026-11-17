import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { Figures, List, SectionTitle } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/utils";
import { createCampaignAction } from "@/server/actions/campaigns";

export const metadata: Metadata = { title: "Confier ma publicité à un expert" };

const STEPS = [
  { title: "Vous remplissez le brief", text: "Votre activité, votre objectif, votre budget. Cinq minutes suffisent." },
  { title: "Vous payez par Mobile Money", text: "Budget publicitaire et prestation sont affichés séparément." },
  { title: "Un gestionnaire prépare tout", text: "Textes, visuels, ciblage. Vous échangez avec lui par messagerie." },
  { title: "Vous validez, nous lançons", text: "Rien n'est diffusé sans votre accord." },
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
    <div className="space-y-8">
      <div>
        <PageHeader title="Confier ma publicité à un expert" description="Vous décrivez votre besoin, notre équipe s'occupe du reste." />
        <form action={createCampaignAction.bind(null, "EXPERT", undefined)}><Button type="submit" variant="accent" size="lg">Remplir mon brief<ArrowRight /></Button></form>
      </div>

      {drafts.length > 0 && (
        <section aria-labelledby="briefs">
          <SectionTitle id="briefs">Reprendre un brief</SectionTitle>
          <List>{drafts.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}

      <section aria-labelledby="etapes">
        <SectionTitle id="etapes">Comment ça se passe</SectionTitle>
        <List>
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
              <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-green-soft text-[13px] font-semibold text-green">{i + 1}</span>
              <span><span className="block font-medium leading-snug text-ink">{s.title}</span><span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{s.text}</span></span>
            </li>
          ))}
        </List>
      </section>

      {services.length > 0 && (
        <section aria-labelledby="formules">
          <SectionTitle id="formules">Formules</SectionTitle>
          <Figures items={services.map((s) => ({ label: s.name, value: formatFcfa(s.fee) }))} />
          <p className="mt-2 text-[13px] text-muted">Hors budget publicitaire, que vous fixez librement.{wa && <> Une question ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="font-medium text-green hover:underline">Écrivez-nous sur WhatsApp</a>.</>}</p>
        </section>
      )}
    </div>
  );
}
