import type { Metadata } from "next";
import { Assistant } from "@/components/app/assistant";
import { Notice, PageHeader } from "@/components/ui/misc";
import { aiStatus } from "@/lib/ai/service";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addDays, todayUtc, toIsoDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Assistant marketing" };

export default async function AssistantPage() {
  const user = await requireUser();
  const today = todayUtc();
  const [businesses, entries] = await Promise.all([
    db.business.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.calendarEntry.findMany({ where: { userId: user.id, date: { gte: addDays(today, -7) } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 80 }),
  ]);
  const status = aiStatus();
  return (
    <>
      <PageHeader title="Assistant marketing" description="Diagnostic, idées de contenus, légendes, hashtags et calendrier éditorial pour votre activité." />
      {!status.text && <Notice tone="info" title="Suggestions guidées" className="mb-5">Aucun modèle d&apos;IA n&apos;est activé pour l&apos;instant : l&apos;assistant s&apos;appuie sur des modèles de contenus préparés par notre équipe et adaptés à votre secteur. Chaque résultat indique son origine.</Notice>}
      <Assistant businesses={businesses} hasModel={Boolean(status.text)} today={toIsoDate(today)}
        entries={entries.map((e) => ({ id: e.id, date: toIsoDate(e.date), platform: e.platform, title: e.title, caption: e.caption, hashtags: e.hashtags, done: e.done }))} />
    </>
  );
}
