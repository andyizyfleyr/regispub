import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, Images } from "lucide-react";
import { AdPreview } from "@/components/app/ad-preview";
import { CampaignActions, CreativeReview } from "@/components/app/campaign-client-parts";
import { CampaignSummary } from "@/components/app/campaign-summary";
import { MetricsView } from "@/components/app/metrics-view";
import { Thread } from "@/components/app/thread";
import { PlatformStack } from "@/components/icons";
import { CampaignStatusBadge, StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice, TabsNav } from "@/components/ui/misc";
import { loadCampaignReport } from "@/lib/ads/report";
import { ROLE_LABELS, type RoleName } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { readAdCopy } from "@/lib/campaigns/editor-data";
import { clientCanCancel, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective } from "@/lib/catalog/objectives";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { cn, formatDateTime, formatFcfa, formatPureDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Campagne" };

/** Avancement présenté au client en quatre phases plutôt qu'en statuts internes. */
const PHASES = ["Paiement", "Préparation", "Validation", "Diffusion"];
const PHASE_OF: Partial<Record<CampaignStatusName, number>> = {
  PENDING_PAYMENT: 0, PAID: 1, AWAITING_INFO: 1, IN_PREPARATION: 1, CLIENT_REVIEW: 2, READY_TO_LAUNCH: 2, RUNNING: 3, PAUSED: 3, COMPLETED: 4,
};

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { onglet } = await searchParams;
  const c = await db.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      business: { select: { name: true, sector: true } }, manager: { select: { name: true } },
      assets: { include: { asset: { select: { id: true, name: true, kind: true, format: true, ownerId: true } } }, orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      revisions: { orderBy: { createdAt: "desc" }, take: 10 },
      orders: { orderBy: { createdAt: "desc" }, take: 1 },
      reads: { where: { userId: user.id } },
    },
  });
  if (!c) notFound();
  if (c.status === "DRAFT") redirect(c.mode === "EXPERT" ? `/app/expert/${c.id}` : `/app/creer/${c.id}`);

  const status = c.status as CampaignStatusName;
  const tab = onglet === "messages" || onglet === "creations" || onglet === "details" ? onglet : "suivi";
  const objective = getObjective(c.objective);
  const order = c.orders[0];
  const creatives = c.assets.filter((a) => a.role === "CREATIVE");
  const pendingReview = creatives.filter((a) => a.approval === "PENDING").length;
  const lastRead = c.reads[0]?.lastReadAt ?? new Date(0);
  const unread = await db.message.count({ where: { campaignId: c.id, internal: false, senderId: { not: user.id }, createdAt: { gt: lastRead } } });
  const base = `/app/campagnes/${c.id}`;
  const phase = PHASE_OF[status] ?? 0;
  const copy = readAdCopy(c.adCopy);
  const firstImage = creatives.find((a) => a.asset.kind === "IMAGE") ?? c.assets.find((a) => a.asset.kind === "IMAGE");

  return (
    <>
      <Link href="/app/campagnes" className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2 pr-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
        <ArrowLeft className="size-3.5" />Mes campagnes
      </Link>

      <header className="mb-5 animate-rise rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <PlatformStack platforms={c.platforms as PlatformCode[]} size="md" />
          <CampaignStatusBadge status={status} />
          <span className="ml-auto font-mono text-xs text-muted">{c.reference}</span>
        </div>
        <h1 className="mt-4 text-[24px] font-semibold leading-tight sm:text-[30px]">{c.name}</h1>
        <p className="mt-1.5 max-w-2xl text-muted">{STATUS_META[status].clientHint}</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 text-sm lg:grid-cols-4">
          <div><dt className="text-[13px] text-muted">Objectif</dt><dd className="mt-0.5 font-medium text-ink">{objective?.label ?? "—"}</dd></div>
          <div><dt className="text-[13px] text-muted">Budget publicitaire</dt><dd className="tnum mt-0.5 font-medium text-ink">{formatFcfa(c.adBudget)}</dd></div>
          <div><dt className="text-[13px] text-muted">Période</dt><dd className="mt-0.5 font-medium text-ink">{c.startDate ? `${formatPureDate(c.startDate)}${c.endDate ? ` → ${formatPureDate(c.endDate)}` : ""}` : "À définir"}</dd></div>
          <div><dt className="text-[13px] text-muted">Votre gestionnaire</dt><dd className="mt-0.5 font-medium text-ink">{c.manager?.name ?? "En cours d'attribution"}</dd></div>
        </dl>

        {status !== "CANCELLED" && (
          <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Avancement de la campagne">
            {PHASES.map((label, i) => {
              const done = i < phase || status === "COMPLETED";
              const current = i === phase && status !== "COMPLETED";
              return (
                <li key={label} aria-current={current ? "step" : undefined}>
                  <div className={cn("h-1.5 rounded-full", done ? "bg-green" : current ? "bg-marigold" : "bg-sand")} />
                  <p className={cn("mt-2 flex items-center gap-1 text-xs sm:text-[13px]", done || current ? "font-medium text-ink" : "text-muted")}>{done && <Check className="size-3.5 shrink-0 text-green" />}{label}</p>
                </li>
              );
            })}
          </ol>
        )}
      </header>

      {status === "PENDING_PAYMENT" && order && (
        <Notice tone="warn" title="Paiement en attente" className="mb-5">
          Votre campagne sera prise en charge dès que le paiement de <span className="tnum font-medium">{formatFcfa(order.total)}</span> sera confirmé.{" "}
          <Link href={`/app/paiements/${order.id}`} className="font-medium underline">Payer maintenant</Link>
        </Notice>
      )}
      {status === "AWAITING_INFO" && <Notice tone="warn" title="Nous avons besoin d'informations" className="mb-5">Votre gestionnaire attend un complément pour avancer. <Link href={`${base}?onglet=messages`} className="font-medium underline">Voir les messages</Link></Notice>}
      {pendingReview > 0 && tab !== "creations" && <Notice tone="info" title={`${pendingReview} création${pendingReview > 1 ? "s" : ""} à valider`} className="mb-5">Votre validation est nécessaire avant le lancement. <Link href={`${base}?onglet=creations`} className="font-medium underline">Voir les créations</Link></Notice>}

      <TabsNav current={tab} className="mb-6" tabs={[
        { id: "suivi", label: "Résultats", href: base },
        { id: "creations", label: "Créations", href: `${base}?onglet=creations`, count: pendingReview || undefined },
        { id: "messages", label: "Messages", href: `${base}?onglet=messages`, count: unread || undefined },
        { id: "details", label: "Détails", href: `${base}?onglet=details` },
      ]} />

      {tab === "suivi" && (
        <div className="space-y-6">
          <MetricsView report={await loadCampaignReport(c.id, { validatedOnly: true })} kpis={objective?.config.kpis ?? []} adBudget={c.adBudget} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Chiffres relevés sur les plateformes publicitaires et validés par votre gestionnaire{c.manager ? ` (${c.manager.name})` : ""}.</p>
            {["RUNNING", "PAUSED", "COMPLETED"].includes(status) && <Button asChild variant="outline" size="sm"><Link href={`${base}/rapport`}><FileText />Rapport de campagne</Link></Button>}
          </div>
        </div>
      )}

      {tab === "creations" && (
        <Card>
          <CardHeader title="Créations publicitaires" description="Visuels et vidéos de la campagne. Ceux soumis par notre équipe attendent votre validation." />
          {creatives.length ? (
            <CreativeReview items={creatives.map((a) => ({ linkId: a.id, assetId: a.asset.id, name: a.asset.name, kind: a.asset.kind, format: a.asset.format, approval: a.approval, feedback: a.feedback, byTeam: a.addedById !== user.id }))} />
          ) : <EmptyState icon={<Images />} title="Aucune création pour l'instant" description="Les visuels préparés par notre équipe apparaîtront ici pour validation." />}
        </Card>
      )}

      {tab === "messages" && (
        <Card>
          <CardHeader title="Échanges avec votre gestionnaire" description={c.manager ? `${c.manager.name} suit votre campagne.` : "Un gestionnaire vous sera attribué après le paiement."} />
          <Thread campaignId={c.id} canPost={!["CANCELLED"].includes(status)} disabledReason="Cette campagne est annulée : la messagerie est fermée. Contactez le support depuis votre compte."
            messages={(await db.message.findMany({ where: { campaignId: c.id, internal: false }, orderBy: { createdAt: "asc" }, take: 200, include: { sender: { select: { name: true, role: true } } } }))
              .map((m) => ({ id: m.id, body: m.body, internal: false, createdAt: m.createdAt.toISOString(), mine: m.senderId === user.id, author: m.sender.name, role: m.sender.role === "CLIENT" ? null : ROLE_LABELS[m.sender.role as RoleName] }))} />
        </Card>
      )}

      {tab === "details" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Configuration" action={<CampaignActions id={c.id} canCancel={clientCanCancel(status)} canRevise={!["PENDING_PAYMENT", "COMPLETED", "CANCELLED"].includes(status)} />} />
              <CardBody><CampaignSummary c={c} /></CardBody>
            </Card>
            {c.revisions.length > 0 && (
              <Card>
                <CardHeader title="Demandes de modification" />
                <ul className="divide-y divide-line">
                  {c.revisions.map((r) => (
                    <li key={r.id} className="px-5 py-3.5 text-sm">
                      <div className="flex items-start justify-between gap-3"><p className="whitespace-pre-wrap text-ink">{r.description}</p><StateBadge kind="revision" value={r.status} /></div>
                      {r.response && <p className="mt-2 rounded-md bg-sand px-3 py-2 text-[13px] text-ink-soft">Réponse : {r.response}</p>}
                      <p className="mt-1.5 text-xs text-muted">{formatDateTime(r.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card>
              <CardHeader title="Historique" />
              <ol className="space-y-4 px-5 py-4">
                {c.statusEvents.map((e) => (
                  <li key={e.id} className="relative pl-5 text-sm before:absolute before:left-0 before:top-1.5 before:size-2 before:rounded-full before:bg-line-strong">
                    <p className="font-medium text-ink">{STATUS_META[e.toStatus as CampaignStatusName].label}</p>
                    {e.note && <p className="text-[13px] text-ink-soft">{e.note}</p>}
                    <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <aside className="space-y-4">
            {copy && <AdPreview platform={(c.platforms[0] ?? "FACEBOOK") as PlatformCode} pageName={c.business?.name ?? user.name} copy={copy} imageId={firstImage?.asset.id ?? null} />}
            {order && (
              <Card>
                <CardBody className="flex items-center justify-between gap-3 text-sm">
                  <span><span className="block text-muted">Commande <span className="font-mono text-xs">{order.reference}</span></span><span className="tnum font-medium">{formatFcfa(order.total)}</span></span>
                  <Button asChild variant="ghost" size="sm"><Link href={`/app/paiements/${order.id}`}>Voir <ArrowRight /></Link></Button>
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
