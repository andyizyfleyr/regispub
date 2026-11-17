import type { Metadata } from "next";
import { Headset } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { ObjectiveBrowser } from "@/components/app/quick-start";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Créer une publicité" };

export default async function CreatePage() {
  const user = await requireUser();
  const [drafts, services] = await Promise.all([
    db.campaign.findMany({ where: { userId: user.id, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 3 }),
    db.service.findMany({ where: { active: true, kind: "MANAGEMENT" }, select: { fee: true } }),
  ]);
  const managementFee = services.length ? Math.min(...services.map((s) => s.fee)) : null;
  return (
    <div className="space-y-8">
      <PageHeader title="Que voulez-vous obtenir ?" description="Choisissez un objectif. La suite se fait en quatre étapes." />

      {drafts.length > 0 && (
        <section aria-labelledby="brouillons">
          <SectionTitle id="brouillons">Reprendre un brouillon</SectionTitle>
          <List>{drafts.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}

      <ObjectiveBrowser />

      <section aria-labelledby="expert">
        <SectionTitle id="expert">Vous préférez déléguer ?</SectionTitle>
        <List>
          <ListRow href="/app/expert" icon={<Headset />} tone="green" title="Confier ma publicité à un expert"
            subtitle={<>Un gestionnaire prépare textes, visuels et ciblage.{managementFee ? <span className="tnum"> Dès {formatFcfa(managementFee)}.</span> : null}</>} />
        </List>
      </section>
    </div>
  );
}
