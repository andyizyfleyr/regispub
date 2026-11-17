import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, ChevronDown, CircleCheck, CircleDot, CircleX, Eye, FileText, Flag, Images, Info, MessageSquareText, Megaphone, Paintbrush, Pause, PencilLine, Rocket, Wallet } from "lucide-react";
import { AdPreview } from "@/components/app/ad-preview";
import { CampaignActions, CreativeReview } from "@/components/app/campaign-client-parts";
import { CampaignSummary } from "@/components/app/campaign-summary";
import { MetricsView } from "@/components/app/metrics-view";
import { Thread } from "@/components/app/thread";
import { CampaignStatusBadge, StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { DefinitionList, EmptyState, Notice, TabsNav } from "@/components/ui/misc";
import type { TileTone } from "@/components/ui/tile";
import { Timeline } from "@/components/ui/timeline";
import { loadCampaignReport } from "@/lib/ads/report";
import { ROLE_LABELS, type RoleName } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { readAdCopy } from "@/lib/campaigns/editor-data";
import { clientCanCancel, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective } from "@/lib/catalog/objectives";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { cn, formatDateTime, formatFcfa } from "@/lib/utils";

const STATUS_ICONS: Partial<Record<CampaignStatusName, typeof Wallet>> = {
  DRAFT: PencilLine, PENDING_PAYMENT: Wallet, PAID: CircleCheck, AWAITING_INFO: MessageSquareText, IN_PREPARATION: Paintbrush, CLIENT_REVIEW: Eye,
  READY_TO_LAUNCH: Rocket, RUNNING: Megaphone, PAUSED: Pause, COMPLETED: Flag, CANCELLED: CircleX,
};
const STATUS_TONES: Record<string, TileTone> = { neutral: "sky", info: "sky", ok: "green", warn: "marigold", danger: "rose", accent: "violet" };

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
        <ArrowLeft className="size-3.5" />Campagnes
      </Link>

      <header className="mb-6 animate-rise">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[24px] font-semibold leading-tight sm:text-[28px]">{c.name}</h1>
          <CampaignStatusBadge status={status} />
        </div>
        <p className="mt-1.5 text-muted">{STATUS_META[status].clientHint}</p>
        {status !== "CANCELLED" && (
          <ol className="mt-5 flex gap-1.5" aria-label="Avancement de la campagne">
            {PHASES.map((label, i) => {
              const done = i < phase || status === "COMPLETED";
              const current = i === phase && status !== "COMPLETED";
              return (
                <li key={label} className="min-w-0 flex-1" aria-current={current ? "step" : undefined}>
                  <div className={cn("h-1.5 rounded-full", done ? "bg-green" : current ? "bg-marigold" : "bg-sand")} />
                  <p className={cn("mt-1.5 truncate text-xs", current ? "font-semibold text-ink" : done ? "text-ink-soft" : "text-muted")}>{label}</p>
                </li>
              );
            })}
          </ol>
        )}
      </header>

      {status === "PENDING_PAYMENT" && order && (
        <Notice tone="warn" title="Paiement en attente" className="mb-5">
          <Link href={`/app/paiements/${order.id}`} className="inline-flex items-center gap-1 font-medium underline">Payer <span className="tnum">{formatFcfa(order.total)}</span><ArrowRight className="size-3.5" /></Link>
        </Notice>
      )}
      {status === "AWAITING_INFO" && <Notice tone="warn" title="Une précision est attendue" className="mb-5"><Link href={`${base}?onglet=messages`} className="inline-flex items-center gap-1 font-medium underline">Répondre<ArrowRight className="size-3.5" /></Link></Notice>}
      {pendingReview > 0 && tab !== "creations" && <Notice tone="info" title={`${pendingReview} création${pendingReview > 1 ? "s" : ""} à valider`} className="mb-5"><Link href={`${base}?onglet=creations`} className="inline-flex items-center gap-1 font-medium underline">Voir<ArrowRight className="size-3.5" /></Link></Notice>}

      <TabsNav current={tab} className="mb-5" tabs={[
        { id: "suivi", label: "Résultats", icon: <BarChart3 />, href: base },
        { id: "creations", label: "Créations", icon: <Images />, href: `${base}?onglet=creations`, count: pendingReview || undefined },
        { id: "messages", label: "Messages", icon: <MessageSquareText />, href: `${base}?onglet=messages`, count: unread || undefined },
        { id: "details", label: "Détails", icon: <Info />, href: `${base}?onglet=details` },
      ]} />

      {tab === "suivi" && (
        <div className="space-y-6">
          <MetricsView report={await loadCampaignReport(c.id, { validatedOnly: true })} kpis={objective?.config.kpis ?? []} adBudget={c.adBudget} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Chiffres validés par votre gestionnaire{c.manager ? ` (${c.manager.name})` : ""}.</p>
            {["RUNNING", "PAUSED", "COMPLETED"].includes(status) && <Button asChild variant="outline" size="sm"><Link href={`${base}/rapport`}><FileText />Rapport</Link></Button>}
          </div>
        </div>
      )}

      {tab === "creations" && (
        <Card>
          <CardHeader title="Créations" />
          {creatives.length ? (
            <CreativeReview items={creatives.map((a) => ({ linkId: a.id, assetId: a.asset.id, name: a.asset.name, kind: a.asset.kind, format: a.asset.format, approval: a.approval, feedback: a.feedback, byTeam: a.addedById !== user.id }))} />
          ) : <EmptyState icon={<Images />} title="Aucune création" />}
        </Card>
      )}

      {tab === "messages" && (
        <Card>
          <CardHeader title="Messages" description={c.manager ? `Gestionnaire : ${c.manager.name}` : "Gestionnaire attribué après paiement."} />
          <Thread campaignId={c.id} canPost={!["CANCELLED"].includes(status)} disabledReason="Campagne annulée : messagerie fermée."
            messages={(await db.message.findMany({ where: { campaignId: c.id, internal: false }, orderBy: { createdAt: "asc" }, take: 200, include: { sender: { select: { name: true, role: true } } } }))
              .map((m) => ({ id: m.id, body: m.body, internal: false, createdAt: m.createdAt.toISOString(), mine: m.senderId === user.id, author: m.sender.name, role: m.sender.role === "CLIENT" ? null : ROLE_LABELS[m.sender.role as RoleName] }))} />
        </Card>
      )}

      {tab === "details" && (
        <div className="space-y-6">
          <section aria-labelledby="config">
            <SectionTitle id="config">Votre campagne</SectionTitle>
            <div className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5">
              <CampaignSummary c={c} compact />
              <DefinitionList className="mt-2.5 border-t border-line pt-2.5" items={[
                { label: "Gestionnaire", value: c.manager?.name ?? "Bientôt attribué" },
                { label: "Référence", value: <span className="font-mono text-[13px]">{c.reference}</span> },
              ]} />
            </div>
            <div className="mt-3"><CampaignActions id={c.id} canCancel={clientCanCancel(status)} canRevise={!["PENDING_PAYMENT", "COMPLETED", "CANCELLED"].includes(status)} /></div>
          </section>

          {order && (
            <List>
              <ListRow href={`/app/paiements/${order.id}`} title="Reçu" subtitle={<span className="font-mono text-[12.5px]">{order.reference}</span>} trailing={<span className="tnum font-semibold text-ink">{formatFcfa(order.total)}</span>} />
            </List>
          )}

          {copy && (
            <details className="group rounded-lg border border-line bg-surface">
              <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-ink sm:px-5">Aperçu<ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
              <div className="border-t border-line p-4"><div className="mx-auto max-w-sm"><AdPreview platform={(c.platforms[0] ?? "FACEBOOK") as PlatformCode} pageName={c.business?.name ?? user.name} copy={copy} imageId={firstImage?.asset.id ?? null} /></div></div>
            </details>
          )}

          {c.revisions.length > 0 && (
            <section aria-labelledby="demandes">
              <SectionTitle id="demandes">Modifications demandées</SectionTitle>
              <List>
                {c.revisions.map((r) => (
                  <li key={r.id} className="px-4 py-3.5 text-sm sm:px-5">
                    <div className="flex items-start justify-between gap-3"><p className="whitespace-pre-wrap text-ink">{r.description}</p><StateBadge kind="revision" value={r.status} /></div>
                    {r.response && <p className="mt-2 rounded-md bg-sand px-3 py-2 text-[13px] text-ink-soft">Réponse : {r.response}</p>}
                    <p className="mt-1.5 text-xs text-muted">{formatDateTime(r.createdAt)}</p>
                  </li>
                ))}
              </List>
            </section>
          )}

          <details open className="group rounded-lg border border-line bg-surface">
            <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-ink sm:px-5">Historique<ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
            <div className="border-t border-line px-4 py-5 sm:px-5">
              <Timeline items={c.statusEvents.map((e, i) => {
                const meta = STATUS_META[e.toStatus as CampaignStatusName];
                const Icon = STATUS_ICONS[e.toStatus as CampaignStatusName] ?? CircleDot;
                return { id: e.id, icon: <Icon />, tone: STATUS_TONES[meta.tone] ?? "green", title: meta.label, text: e.note ?? undefined, time: formatDateTime(e.createdAt), current: i === 0 };
              })} />
            </div>
          </details>
        </div>
      )}
    </>
  );
}
