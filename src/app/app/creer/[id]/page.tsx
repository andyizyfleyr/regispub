import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Wizard } from "@/components/wizard/wizard";
import { requireUser } from "@/lib/auth/session";
import { loadEditorData } from "@/lib/campaigns/editor-data";
import { clientCanEdit, type CampaignStatusName } from "@/lib/campaigns/status";

export const metadata: Metadata = { title: "Créer une publicité" };

export default async function WizardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etape?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadEditorData(id, user.id);
  if (!data) notFound();
  if (!clientCanEdit(data.campaign.status as CampaignStatusName)) redirect(`/app/campagnes/${id}`);
  if (data.campaign.mode === "EXPERT") redirect(`/app/expert/${id}`);
  // Étape demandée dans l'adresse (?etape=2), sans dépasser celle déjà atteinte ; sinon on reprend où le client s'est arrêté.
  const asked = Number(sp.etape);
  const step = Number.isInteger(asked) && asked >= 1 && asked <= Math.max(1, data.campaign.wizardStep) ? asked : data.campaign.wizardStep;
  return <Wizard key={id} data={data} initialStep={step} />;
}
