import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, ChevronDown, CircleCheck, CircleDot, CircleX, Eye, FileText, Flag, Info, MessageSquareText, Megaphone, Paintbrush, Pause, PencilLine, Rocket, Wallet } from "lucide-react";
import { AccessCard, EntrustedLogins, type AccessItem } from "@/components/app/access-card";
import { AdPreview } from "@/components/app/ad-preview";
import { CampaignActions, CreativeReview } from "@/components/app/campaign-client-parts";
import { CampaignSummary } from "@/components/app/campaign-summary";
import { MetricsView } from "@/components/app/metrics-view";
import { CampaignStatusIcon, StateIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { DefinitionList, Notice, TabsNav } from "@/components/ui/misc";
import type { TileTone } from "@/components/ui/tile";
import { Timeline } from "@/components/ui/timeline";
import { loadCampaignReport } from "@/lib/ads/report";
import { requireUser } from "@/lib/auth/session";
import { loadAccessRows } from "@/lib/campaigns/access";
import { readAdCopy } from "@/lib/campaigns/editor-data";
import { ACTIVE_STATUSES, clientCanCancel, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { accessState } from "@/lib/catalog/access";
import { accountDisplay, accountsOf } from "@/lib/catalog/accounts";
import { getObjective } from "@/lib/catalog/objectives";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
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
      business: { select: { name: true, sector: true, facebookUrl: true, instagramUrl: true, tiktokUrl: true } }, manager: { select: { name: true } },
      assets: { include: { asset: { select: { id: true, name: true, kind: true, format: true, ownerId: true } } }, orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      revisions: { orderBy: { createdAt: "desc" }, take: 10 },
      orders: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!c) notFound();
  if (c.status === "DRAFT") redirect(c.mode === "EXPERT" ? `/app/expert/${c.id}` : `/app/creer/${c.id}`);

  const status = c.status as CampaignStatusName;
  // Deux onglets : « Détails », ouvert d'office, puis « Résultats ». Un ancien lien (?onglet=messages, ?onglet=creations) ouvre « Détails ».
  const tab = onglet === "resultats" || onglet === "suivi" ? "resultats" : "details";
  const objective = getObjective(c.objective);
  const order = c.orders[0];
  const creatives = c.assets.filter((a) => a.role === "CREATIVE");
  // Seules les créations que l'équipe soumet au client s'affichent, le temps qu'il réponde.
  const toReview = creatives.filter((a) => a.approval === "PENDING");
  const base = `/app/campagnes/${c.id}`;
  const phase = PHASE_OF[status] ?? 0;
  const copy = readAdCopy(c.adCopy);
  // Accès aux comptes : demandé dès le paiement, tant que la publicité n'est pas lancée (ou s'il reste quelque chose à faire).
  const platforms = c.platforms as PlatformCode[];
  const accessRows = (ACTIVE_STATUSES as string[]).includes(status) ? await loadAccessRows(c.businessId) : [];
  const accounts = accountsOf(c.business);
  const accessItems: AccessItem[] = platforms.map((p) => {
    const row = accessRows.find((r) => r.platform === p);
    const state = accessState(accessRows, p, c.id);
    return { platform: p, account: accounts[p] ? accountDisplay(accounts[p]).replace(/^[^/]+\//, "") : "", state, method: state === "TODO" ? null : row?.method ?? null, note: row?.note ?? null };
  });
  // La carte ne s'affiche que s'il reste un accès à donner ou à refaire : une fois tout reçu, elle disparaît.
  const showAccess = (ACTIVE_STATUSES as string[]).includes(status) && accessItems.some((i) => i.state === "TODO" || i.state === "PROBLEM");
  // Identifiants confiés (option « Je donne mes identifiants ») : le client peut toujours les effacer, depuis « Détails ».
  const entrusted = accessItems.filter((i) => i.method === "LOGIN" && i.state !== "TODO").map((i) => i.platform);
  const awaitingInfo = status === "AWAITING_INFO";
  const settings = showAccess || awaitingInfo ? await getSettings() : null;
  const agency = settings ? settings.agencyFacebookName || settings.companyName : "";
  // Précision demandée par l'équipe : le client la lit ici et répond sur WhatsApp (ou par une demande d'aide si aucun numéro n'est réglé).
  const infoNote = awaitingInfo ? c.statusEvents.find((e) => e.toStatus === "AWAITING_INFO")?.note ?? null : null;
  const supportWa = settings?.supportWhatsapp.replace(/\D/g, "") ?? "";
  const firstImage = creatives.find((a) => a.asset.kind === "IMAGE") ?? c.assets.find((a) => a.asset.kind === "IMAGE");

  return (
    <>
      <Link href="/app/campagnes" className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2 pr-3 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
        <ArrowLeft className="size-3.5" />Campagnes
      </Link>

      <header className="mb-6 animate-rise">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <h1 className="min-w-0 text-[1.5rem] font-semibold leading-tight sm:text-[1.75rem]">{c.name}</h1>
          <CampaignStatusIcon status={status} />
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
      {showAccess && <AccessCard campaignId={c.id} items={accessItems} agency={agency} />}
      {awaitingInfo && (
        <Notice tone="warn" title="Une précision est attendue" className="mb-5">
          {infoNote && <p className="whitespace-pre-wrap">{infoNote}</p>}
          {supportWa
            ? <a href={`https://wa.me/${supportWa}?text=${encodeURIComponent(`Bonjour, au sujet de ma campagne ${c.reference} : `)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium underline">Répondre sur WhatsApp<ArrowRight className="size-3.5" /></a>
            : <Link href="/app/compte?onglet=support" className="mt-1 inline-flex items-center gap-1 font-medium underline">Répondre<ArrowRight className="size-3.5" /></Link>}
        </Notice>
      )}
      {toReview.length > 0 && (
        <Card className="mb-5">
          <CardHeader title={toReview.length > 1 ? "Créations à valider" : "Création à valider"} />
          <CreativeReview items={toReview.map((a) => ({ linkId: a.id, assetId: a.asset.id, name: a.asset.name, kind: a.asset.kind, format: a.asset.format, approval: a.approval, feedback: a.feedback, byTeam: a.addedById !== user.id }))} />
        </Card>
      )}

      <TabsNav current={tab} className="mb-5" tabs={[
        { id: "details", label: "Détails", icon: <Info />, href: base },
        { id: "resultats", label: "Résultats", icon: <BarChart3 />, href: `${base}?onglet=resultats` },
      ]} />

      {tab === "resultats" && (
        <div className="space-y-6">
          <MetricsView report={await loadCampaignReport(c.id, { validatedOnly: true })} kpis={objective?.config.kpis ?? []} adBudget={c.adBudget} />
          {["RUNNING", "PAUSED", "COMPLETED"].includes(status) && <div className="flex justify-end"><Button asChild variant="outline" size="sm"><Link href={`${base}/rapport`}><FileText />Rapport</Link></Button></div>}
        </div>
      )}

      {tab === "details" && (
        <div className="space-y-6">
          <section aria-labelledby="config">
            <SectionTitle id="config">Votre campagne</SectionTitle>
            <div className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5">
              <CampaignSummary c={c} compact />
              <DefinitionList className="mt-2.5 border-t border-line pt-2.5" items={[
                { label: "Gestionnaire", value: c.manager?.name ?? "Bientôt attribué" },
                { label: "Référence", value: <span className="font-mono text-[0.8125rem]">{c.reference}</span> },
                ...(entrusted.length ? [{ label: "Identifiants confiés", value: <EntrustedLogins campaignId={c.id} platforms={entrusted} /> }] : []),
              ]} />
            </div>
            <div className="mt-3"><CampaignActions id={c.id} canCancel={clientCanCancel(status)} canRevise={!["PENDING_PAYMENT", "COMPLETED", "CANCELLED"].includes(status)} /></div>
          </section>

          {order && (
            <List>
              <ListRow href={`/app/paiements/${order.id}`} title="Reçu" subtitle={<span className="font-mono text-[0.78125rem]">{order.reference}</span>} trailing={<span className="tnum font-semibold text-ink">{formatFcfa(order.total)}</span>} />
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
                    <div className="flex items-start justify-between gap-3"><p className="whitespace-pre-wrap text-ink">{r.description}</p><StateIcon kind="revision" value={r.status} /></div>
                    {r.response && <p className="mt-2 rounded-md bg-sand px-3 py-2 text-[0.8125rem] text-ink-soft">Réponse : {r.response}</p>}
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
