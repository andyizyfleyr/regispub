import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { ExpertBrief } from "@/components/wizard/expert-brief";
import { requireUser } from "@/lib/auth/session";
import { loadEditorData } from "@/lib/campaigns/editor-data";
import { clientCanEdit, type CampaignStatusName } from "@/lib/campaigns/status";

export const metadata: Metadata = { title: "Brief expert" };

export default async function ExpertBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await loadEditorData(id, user.id);
  if (!data) notFound();
  if (!clientCanEdit(data.campaign.status as CampaignStatusName)) redirect(`/app/campagnes/${id}`);
  if (data.campaign.mode !== "EXPERT") redirect(`/app/creer/${id}`);
  return (
    <>
      <PageHeader title="Votre brief" back={{ href: "/app/expert", label: "Confier à un expert" }} description="Plus votre brief est précis, plus la campagne sera pertinente. Vous pourrez compléter par messagerie ensuite." />
      <ExpertBrief data={data} />
    </>
  );
}
