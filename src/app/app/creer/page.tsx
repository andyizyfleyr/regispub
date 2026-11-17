import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Headset, Palette } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatFcfa } from "@/lib/utils";
import { createCampaignAction } from "@/server/actions/campaigns";

export const metadata: Metadata = { title: "Créer une publicité" };

export default async function CreatePage() {
  const user = await requireUser();
  const [drafts, services] = await Promise.all([
    db.campaign.findMany({ where: { userId: user.id, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.service.findMany({ where: { active: true }, select: { kind: true, fee: true } }),
  ]);
  const min = (kind: string) => Math.min(...services.filter((s) => s.kind === kind).map((s) => s.fee), Infinity);
  return (
    <>
      <PageHeader title="Créer une publicité" description="Deux façons d'avancer : préparez votre campagne pas à pas, ou laissez un expert s'en charger entièrement." />
      <div className="grid gap-5 md:grid-cols-2">
        <form action={createCampaignAction.bind(null, "SELF_SERVICE", undefined)} className="flex flex-col rounded-xl border border-line bg-surface p-6">
          <Palette className="size-6 text-green" />
          <h2 className="mt-4 text-xl font-semibold">Je crée ma publicité</h2>
          <p className="mt-1.5 text-sm text-muted">Un assistant en 7 étapes : plateforme, objectif, textes, visuels, ciblage et budget. Notre équipe vérifie et lance.</p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
            {["Environ 10 minutes", "Brouillon enregistré à chaque étape", Number.isFinite(min("CAMPAIGN")) ? `Prestation à partir de ${formatFcfa(min("CAMPAIGN"))}` : "Tarifs affichés avant paiement"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{t}</li>)}
          </ul>
          <Button type="submit" variant="accent" size="lg" className="mt-6 self-start">Commencer <ArrowRight /></Button>
        </form>
        <div className="flex flex-col rounded-xl bg-forest p-6 text-white">
          <Headset className="size-6 text-marigold" />
          <h2 className="mt-4 text-xl font-semibold">Je confie ma publicité à un expert</h2>
          <p className="mt-1.5 text-sm text-white/70">Décrivez votre besoin et transmettez vos fichiers. Un gestionnaire prépare tout et vous soumet les créations.</p>
          <ul className="mt-4 space-y-1.5 text-sm text-white/85">
            {["Brief en une page", "Messagerie directe avec votre gestionnaire", Number.isFinite(min("MANAGEMENT")) ? `Gestion complète : ${formatFcfa(min("MANAGEMENT"))}` : "Tarifs affichés avant paiement"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-marigold" />{t}</li>)}
          </ul>
          <Button asChild variant="outline" size="lg" className="mt-6 self-start border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/10"><Link href="/app/expert">Parler à un expert <ArrowRight /></Link></Button>
        </div>
      </div>
      {drafts.length > 0 && (
        <Card className="mt-8">
          <CardHeader title="Reprendre un brouillon" description="Vos campagnes en cours de préparation." />
          <div className="divide-y divide-line">{drafts.map((c) => <CampaignRow key={c.id} c={c} />)}</div>
        </Card>
      )}
    </>
  );
}
