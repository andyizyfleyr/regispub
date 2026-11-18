import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Headset, TrendingUp } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { ObjectiveBrowser } from "@/components/app/quick-start";
import { Button } from "@/components/ui/button";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { Banner } from "@/components/ui/tile";
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
      <PageHeader title="Que voulez-vous obtenir ?" />

      {drafts.length > 0 && (
        <section aria-labelledby="brouillons">
          <SectionTitle id="brouillons">Brouillons</SectionTitle>
          <List>{drafts.map((c) => <li key={c.id}><CampaignRow c={c} /></li>)}</List>
        </section>
      )}

      <ObjectiveBrowser />

      <section aria-labelledby="achat-direct">
        <SectionTitle id="achat-direct">Sans publicité</SectionTitle>
        <List><ListRow href="/app/booster" icon={<TrendingUp />} tone="violet" title="Abonnés, J'aime, commentaires, vues" subtitle="Achat à la quantité, livré par notre équipe" /></List>
      </section>

      <Banner decoration={<Headset />} className="sm:py-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[1rem] font-semibold text-white sm:text-xl">Vous préférez déléguer ?</h2>
            {managementFee ? <p className="tnum mt-0.5 text-[0.8125rem] text-white/75 sm:mt-1 sm:text-[0.9375rem]">Dès {formatFcfa(managementFee)}</p> : null}
          </div>
          <Button asChild variant="accent"><Link href="/app/expert"><Headset />Un expert<ArrowRight /></Link></Button>
        </div>
      </Banner>
    </div>
  );
}
