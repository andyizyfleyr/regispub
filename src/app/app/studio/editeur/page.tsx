import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioEditor, type StudioTemplate } from "@/components/studio/editor";
import { PageHeader } from "@/components/ui/misc";
import { aiStatus } from "@/lib/ai/service";
import { requireUser } from "@/lib/auth/session";
import { AD_FORMATS } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { DEFAULT_DESIGN, sanitizeDesign } from "@/lib/studio/render";
import { isRecord } from "@/lib/utils";

export const metadata: Metadata = { title: "Éditeur — Studio créatif" };

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ modele?: string; creation?: string; campagne?: string; image?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [templates, library, source, campaign] = await Promise.all([
    db.creativeTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.asset.findMany({ where: { ownerId: user.id, kind: "IMAGE", source: { not: "STUDIO" } }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, name: true } }),
    sp.creation ? db.asset.findFirst({ where: { id: sp.creation, ownerId: user.id } }) : null,
    sp.campagne ? db.campaign.findFirst({ where: { id: sp.campagne, userId: user.id }, include: { business: { select: { name: true } } } }) : null,
  ]);
  if (sp.creation && !source) notFound();
  if (sp.campagne && !campaign) notFound();

  const list: StudioTemplate[] = templates.map((t) => ({ id: t.id, name: t.name, category: t.category, design: sanitizeDesign({ layout: t.layout, palette: t.palette, ...(isRecord(t.defaults) ? t.defaults : {}), templateId: t.id }) }));
  const copy = campaign && isRecord(campaign.adCopy) ? campaign.adCopy : null;
  const strategy = campaign && isRecord(campaign.strategy) && Array.isArray(campaign.strategy.texts) ? (campaign.strategy.texts as { headline?: string; cta?: string }[]) : [];
  let design = source?.design ? sanitizeDesign(source.design) : list.find((t) => t.id === sp.modele)?.design ?? list[0]?.design ?? DEFAULT_DESIGN;
  if (!source && copy) design = { ...design, headline: String(copy.headline || design.headline).slice(0, 90), cta: String(copy.cta || design.cta).slice(0, 40), badge: campaign?.productPrice ? `${new Intl.NumberFormat("fr-FR").format(campaign.productPrice).replace(/\u202f|\u00a0/g, " ")} F` : design.badge };
  if (sp.image && library.some((l) => l.id === sp.image)) design = { ...design, imageId: sp.image };
  // Une création réouverte ne garde ses images que si elles appartiennent toujours à l'utilisateur.
  const owned = new Set(library.map((l) => l.id));
  if (design.imageId && !owned.has(design.imageId)) design = { ...design, imageId: (await db.asset.count({ where: { id: design.imageId, ownerId: user.id } })) ? design.imageId : null };
  if (design.logoId && !owned.has(design.logoId)) design = { ...design, logoId: (await db.asset.count({ where: { id: design.logoId, ownerId: user.id } })) ? design.logoId : null };

  const platforms = campaign?.platforms ?? [];
  const defaultFormat = source?.format && AD_FORMATS.some((f) => f.id === source.format) ? source.format : platforms.length === 1 && platforms[0] === "TIKTOK" ? "story" : "square";
  const backHref = campaign ? (campaign.status === "DRAFT" || campaign.status === "PENDING_PAYMENT" ? (campaign.mode === "EXPERT" ? `/app/expert/${campaign.id}` : `/app/creer/${campaign.id}?etape=5`) : `/app/campagnes/${campaign.id}?onglet=creations`) : "/app/studio";

  return (
    <>
      <PageHeader title="Éditeur de création" back={{ href: backHref, label: campaign ? "Retour à la campagne" : "Studio créatif" }} description="Choisissez un modèle, ajoutez votre photo et vos textes, puis exportez dans tous les formats publicitaires." />
      <StudioEditor
        initial={design} initialFormat={defaultFormat} initialName={source ? source.name.replace(/ — [^—]+$/, "") : campaign ? campaign.name : "Nouvelle création"} templates={list} library={library}
        campaign={campaign ? { id: campaign.id, name: campaign.name, backHref, platforms } : null} imageAi={Boolean(aiStatus().image)}
        suggestedTexts={strategy.filter((t) => t.headline).map((t) => ({ headline: String(t.headline), cta: String(t.cta ?? "") }))}
      />
    </>
  );
}
