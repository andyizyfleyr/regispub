import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Wizard } from "@/components/wizard/wizard";
import { requireUser } from "@/lib/auth/session";
import { loadEditorData } from "@/lib/campaigns/editor-data";
import { clientCanEdit, type CampaignStatusName } from "@/lib/campaigns/status";

export const metadata: Metadata = { title: "Créer une publicité" };

export default async function WizardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await loadEditorData(id, user.id);
  if (!data) notFound();
  if (!clientCanEdit(data.campaign.status as CampaignStatusName)) redirect(`/app/campagnes/${id}`);
  if (data.campaign.mode === "EXPERT") redirect(`/app/expert/${id}`);
  return <Wizard key={`${id}-${data.links.length}`} data={data} />;
}
