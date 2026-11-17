import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { TemplateDialog } from "@/components/staff/admin-panels";
import { ActionButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LAYOUTS, PALETTES } from "@/lib/studio/render";
import { isRecord } from "@/lib/utils";
import { deleteTemplateAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Modèles de création" };

export default async function TemplatesPage() {
  await requirePermission("template.manage");
  const templates = await db.creativeTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <>
      <PageHeader title="Modèles de création" description="Points de départ proposés aux clients dans le studio créatif." actions={<TemplateDialog />} />
      {templates.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const pal = isRecord(t.palette) ? t.palette : {};
            const def = isRecord(t.defaults) ? t.defaults : {};
            const paletteIndex = Math.max(0, PALETTES.findIndex((p) => p.background === pal.background && p.accent === pal.accent));
            return (
              <li key={t.id}>
                <Card className="overflow-hidden">
                  <div className="flex aspect-[16/10] flex-col justify-end p-5" style={{ background: str(pal.background) || "#0E2A20", color: str(pal.text) || "#fff" }}>
                    {str(def.badge) && <span className="mb-auto self-start rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: str(pal.accent), color: str(pal.background) }}>{str(def.badge)}</span>}
                    <p className="font-display text-xl font-semibold leading-tight">{str(def.headline) || t.name}</p>
                    {str(def.subline) && <p className="mt-1 text-[13px] opacity-80">{str(def.subline)}</p>}
                    {str(def.cta) && <span className="mt-3 self-start rounded-full px-3 py-1 text-xs font-semibold" style={{ background: str(pal.accent), color: str(pal.background) }}>{str(def.cta)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{t.name}</p><p className="text-xs text-muted">{t.category} · {LAYOUTS.find((l) => l.id === t.layout)?.label ?? t.layout}</p></div>
                    <Badge tone={t.active ? "ok" : "neutral"}>{t.active ? "Visible" : "Masqué"}</Badge>
                  </div>
                  <div className="flex justify-end gap-1 border-t border-line px-2 py-1.5">
                    <TemplateDialog template={{ id: t.id, name: t.name, category: t.category, layout: t.layout, paletteIndex, headline: str(def.headline), subline: str(def.subline), cta: str(def.cta), badge: str(def.badge), active: t.active, sortOrder: t.sortOrder }} />
                    <ActionButton variant="ghost" size="sm" className="text-clay" action={deleteTemplateAction.bind(null, t.id)} confirm={`Supprimer le modèle « ${t.name} » ?`} successMessage="Modèle supprimé.">Supprimer</ActionButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : <Card><EmptyState icon={<LayoutTemplate />} title="Aucun modèle" description="Créez un premier modèle pour le studio créatif." /></Card>}
    </>
  );
}
