import type { Metadata } from "next";
import { ArrowRight, ClipboardList, MessagesSquare, ShieldCheck, Smartphone } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/utils";
import { createCampaignAction } from "@/server/actions/campaigns";

export const metadata: Metadata = { title: "Confier ma publicité à un expert" };

const STEPS = [
  { icon: ClipboardList, title: "Vous remplissez le brief", text: "Votre activité, votre objectif, votre budget et vos fichiers. Cinq minutes suffisent." },
  { icon: Smartphone, title: "Vous payez par Mobile Money", text: "Budget publicitaire et frais de prestation sont affichés séparément avant validation." },
  { icon: MessagesSquare, title: "Un gestionnaire prépare tout", text: "Textes, visuels, ciblage. Vous échangez avec lui par messagerie et suivez l'avancement." },
  { icon: ShieldCheck, title: "Vous validez, nous lançons", text: "Rien n'est diffusé sans votre accord. Vous pouvez demander des modifications." },
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
    <>
      <PageHeader title="Confier ma publicité à un expert" description="Vous décrivez votre besoin, notre équipe s'occupe du reste : stratégie, créations, lancement et suivi." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex items-center gap-3"><span className="tnum font-display text-3xl font-semibold leading-none text-line-strong">{i + 1}</span><s.icon className="size-5 text-green" /></div>
              <p className="mt-3 font-medium text-ink">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <aside className="flex flex-col rounded-xl bg-forest p-6 text-white">
          <p className="eyebrow !text-white/60">Formules</p>
          <ul className="mt-3 space-y-3">
            {services.map((s) => <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm"><span className="text-white/85">{s.name}</span><span className="tnum shrink-0 font-semibold">{formatFcfa(s.fee)}</span></li>)}
          </ul>
          <p className="mt-3 text-xs text-white/60">Hors budget publicitaire, que vous fixez librement.</p>
          <form action={createCampaignAction.bind(null, "EXPERT", undefined)} className="mt-6"><Button type="submit" variant="accent" size="lg" className="w-full">Remplir mon brief <ArrowRight /></Button></form>
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="mt-3 text-center text-[13px] text-white/75 underline-offset-4 hover:underline">Une question ? Écrivez-nous sur WhatsApp</a>}
        </aside>
      </div>
      {drafts.length > 0 && (
        <Card className="mt-8"><CardHeader title="Briefs en cours" /><div className="divide-y divide-line">{drafts.map((c) => <CampaignRow key={c.id} c={c} />)}</div></Card>
      )}
    </>
  );
}
