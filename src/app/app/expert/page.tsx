import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, ClipboardList, Headset, Palette, Smartphone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { List, SectionTitle } from "@/components/ui/list";
import { Carousel } from "@/components/ui/carousel";
import { Banner, StepTile, TILE_TONES, toneAt } from "@/components/ui/tile";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cn, formatFcfa } from "@/lib/utils";
import { createCampaignAction } from "@/server/actions/campaigns";

export const metadata: Metadata = { title: "Confier ma publicité à un expert" };

const STEPS = [
  { title: "Vous décrivez", icon: <ClipboardList /> },
  { title: "Vous payez", icon: <Smartphone /> },
  { title: "Nous préparons", icon: <Palette /> },
  { title: "Vous validez", icon: <BadgeCheck /> },
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
        <h1 className="max-w-md text-[26px] font-semibold leading-tight text-white sm:text-[32px]">Un expert s&apos;en charge</h1>
        <p className="mt-1.5 max-w-md text-[15px] text-white/75">Rien n&apos;est diffusé sans votre accord.</p>
        <form action={createCampaignAction.bind(null, "EXPERT", undefined)} className="mt-5"><Button type="submit" variant="accent" size="lg">Commencer<ArrowRight /></Button></form>
      </Banner>

      {drafts.length > 0 && (
        <section aria-labelledby="briefs">
          <SectionTitle id="briefs">Brouillons</SectionTitle>
          <List className="shadow-card">{drafts.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}

      <section aria-label="Étapes">
        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STEPS.map((s, i) => <StepTile key={s.title} n={i + 1} icon={s.icon} title={s.title} tone={toneAt(i)} />)}
        </ol>
      </section>

      {services.length > 0 && (
        <section aria-labelledby="formules">
          <SectionTitle id="formules">Formules</SectionTitle>
          <Carousel label="Formules" itemClassName="basis-[78%] sm:basis-[47%]">
            {services.map((s, i) => (
              <div key={s.id} className="flex w-full flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-card">
                <span aria-hidden className={cn("flex size-11 items-center justify-center rounded-xl [&_svg]:size-5", TILE_TONES[toneAt(i)])}>{s.kind === "PACK" ? <Palette /> : <Headset />}</span>
                <p className="mt-4 text-[15px] font-semibold leading-snug text-ink">{s.name}</p>
                <p className="mt-auto pt-3"><span className="tnum font-display text-[26px] font-semibold leading-none">{formatFcfa(s.fee)}</span><span className="ml-1.5 text-[13px] text-muted">/ campagne</span></p>
              </div>
            ))}
          </Carousel>
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">Hors budget publicitaire.{wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-green hover:underline"><WhatsappIcon className="size-4" />Une question ?</a>}</p>
        </section>
      )}
    </div>
  );
}
