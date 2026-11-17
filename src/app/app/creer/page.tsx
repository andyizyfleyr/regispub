import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Headset } from "lucide-react";
import { CampaignRow } from "@/components/app/campaign-row";
import { ObjectiveBrowser } from "@/components/app/quick-start";
import { Button } from "@/components/ui/button";
import { List, SectionTitle } from "@/components/ui/list";
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

      <Banner decoration={<Headset />} className="sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Vous préférez déléguer ?</h2>
            {managementFee ? <p className="tnum mt-1 text-[15px] text-white/75">Dès {formatFcfa(managementFee)}</p> : null}
          </div>
          <Button asChild variant="accent"><Link href="/app/expert"><Headset />Un expert<ArrowRight /></Link></Button>
        </div>
      </Banner>
    </div>
  );
}
