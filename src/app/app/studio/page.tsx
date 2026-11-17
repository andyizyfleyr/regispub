import type { Metadata } from "next";
import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { LibraryGrid } from "@/components/studio/library";
import { Button } from "@/components/ui/button";
import { PageHeader, TabsNav } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isRecord } from "@/lib/utils";

export const metadata: Metadata = { title: "Studio créatif" };

const FILTERS: Record<string, { label: string; where: object }> = {
  tout: { label: "Tout", where: {} },
  creations: { label: "Créations du studio", where: { source: "STUDIO" } },
  imports: { label: "Imports", where: { source: "UPLOAD" } },
  ia: { label: "Images IA", where: { source: "AI" } },
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const current = sp.vue && FILTERS[sp.vue] ? sp.vue : "tout";
  const [assets, templates] = await Promise.all([
    db.asset.findMany({ where: { ownerId: user.id, ...FILTERS[current]!.where }, orderBy: { createdAt: "desc" }, take: 120, include: { _count: { select: { campaignLinks: true } } } }),
    db.creativeTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Studio créatif" description="Créez vos visuels publicitaires à partir de modèles, adaptez-les à chaque format et retrouvez toutes vos créations." actions={<Button asChild variant="accent"><Link href="/app/studio/editeur"><CirclePlus /> Nouvelle création</Link></Button>} />

      <section aria-labelledby="modeles" className="mb-8">
        <h2 id="modeles" className="eyebrow mb-3">Partir d&apos;un modèle</h2>
        <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {templates.map((t) => {
            const p = isRecord(t.palette) ? t.palette : {};
            const d = isRecord(t.defaults) ? t.defaults : {};
            return (
              <Link key={t.id} href={`/app/studio/editeur?modele=${t.id}`} className="group w-40 shrink-0">
                <span className="flex aspect-square flex-col justify-end rounded-lg border border-line p-3 transition-transform group-hover:-translate-y-0.5" style={{ background: String(p.background ?? "#0E2A20"), color: String(p.text ?? "#fff") }}>
                  {d.badge ? <span className="mb-auto self-start rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: String(p.accent ?? "#F5A524"), color: String(p.background ?? "#0E2A20") }}>{String(d.badge)}</span> : null}
                  <span className="font-display text-[15px] font-semibold leading-tight">{String(d.headline ?? t.name)}</span>
                  <span className="mt-2 h-1 w-8 rounded-full" style={{ background: String(p.accent ?? "#F5A524") }} />
                </span>
                <span className="mt-2 block text-[13px] font-medium text-ink">{t.name}</span>
                <span className="block text-xs text-muted">{t.category}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <h2 className="eyebrow mb-1">Ma bibliothèque</h2>
      <TabsNav current={current} tabs={Object.entries(FILTERS).map(([id, f]) => ({ id, label: f.label, href: `/app/studio?vue=${id}` }))} className="mb-4" />
      <LibraryGrid items={assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, source: a.source, format: a.format, hasDesign: a.design !== null, createdAt: a.createdAt.toISOString(), usedIn: a._count.campaignLinks, width: a.width, height: a.height }))} />
    </>
  );
}
