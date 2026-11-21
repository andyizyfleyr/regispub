import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Link as LinkIcon, MessageCircle } from "lucide-react";
import { CampaignSummary } from "@/components/app/campaign-summary";
import { AssetThumb } from "@/components/app/uploader";
import { MetricsView } from "@/components/app/metrics-view";
import { AccessPanel, AssignPanel, CreativesPanel, ExternalRefsPanel, MetricsPanel, RevisionItem, StatusPanel } from "@/components/staff/campaign-panels";
import { CampaignStatusIcon, StateIcon } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, EmptyState, Notice, PageHeader, Table, TabsNav } from "@/components/ui/misc";
import { ADS_ADAPTERS } from "@/lib/ads/adapters";
import { CSV_TEMPLATE } from "@/lib/ads/csv";
import { loadCampaignReport } from "@/lib/ads/report";
import { readExternalRefs } from "@/lib/ads/sync";
import { can, canViewCampaign, ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { loadAccessRows } from "@/lib/campaigns/access";
import { readAdCopy } from "@/lib/campaigns/editor-data";
import { STATUS_META, staffTransitions, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective } from "@/lib/catalog/objectives";
import { accessState, accessToGive } from "@/lib/catalog/access";
import { accountDisplay, accountsOf } from "@/lib/catalog/accounts";
import { PLATFORM_CODES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { formatPhone, toWhatsappLink } from "@/lib/phone";
import { formatDateTime, formatFcfa, formatNumber, formatPureDate, todayUtc, toIsoDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Campagne" };

const TABS = ["apercu", "creations", "modifications", "statistiques"] as const;

export default async function StaffCampaign({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const { onglet } = await searchParams;
  const c = await db.campaign.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, accountType: true } }, business: true, manager: { select: { name: true } }, designer: { select: { name: true } },
      assets: { include: { asset: { select: { id: true, name: true, kind: true } } }, orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 30 }, revisions: { orderBy: { createdAt: "desc" }, include: { requester: { select: { name: true } } } },
      orders: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!c || c.status === "DRAFT") notFound();
  if (!canViewCampaign(user, c)) redirect("/gestion?refus=1");

  const status = c.status as CampaignStatusName;
  const tab = (TABS as readonly string[]).includes(onglet ?? "") ? (onglet as (typeof TABS)[number]) : "apercu";
  const base = `/gestion/campagnes/${c.id}`;
  const platforms = c.platforms as PlatformCode[];
  const objective = getObjective(c.objective);
  const accessRows = await loadAccessRows(c.businessId);
  const accessMissing = accessToGive(accessRows, platforms, c.id);
  const [pendingMetrics, actors] = await Promise.all([
    db.metricSnapshot.count({ where: { campaignId: c.id, validated: false } }),
    db.user.findMany({ where: { id: { in: c.statusEvents.map((e) => e.actorId).filter((v): v is string => Boolean(v)) } }, select: { id: true, name: true } }),
  ]);
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const openRevisions = c.revisions.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;
  const creatives = c.assets.filter((a) => a.role === "CREATIVE");
  const order = c.orders[0];
  const copy = readAdCopy(c.adCopy);
  const wa = c.user.phone ? toWhatsappLink(c.user.phone) : null;
  const accounts = accountsOf(c.business);
  const clientFiles = c.assets.filter((a) => a.addedById === c.userId);

  return (
    <>
      <PageHeader title={c.name} back={{ href: "/gestion/campagnes", label: "Campagnes" }} eyebrow={<span className="font-mono normal-case tracking-normal">{c.reference}</span>}
        description={`${c.user.name} · ${c.mode === "EXPERT" ? "Confiée à un expert" : "Créée par le client"} · ${objective?.label ?? "objectif non défini"}`} status={<CampaignStatusIcon status={status} />} />

      <TabsNav current={tab} tabs={[
        { id: "apercu", label: "Aperçu", href: base },
        { id: "creations", label: "Créations", href: `${base}?onglet=creations`, count: creatives.filter((a) => a.approval === "CHANGES_REQUESTED").length || undefined },
        { id: "modifications", label: "Modifications", href: `${base}?onglet=modifications`, count: openRevisions || undefined },
        { id: "statistiques", label: "Statistiques", href: `${base}?onglet=statistiques`, count: pendingMetrics || undefined },
      ]} />

      {tab === "apercu" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <Card><CardHeader title="Configuration demandée" /><CardBody><CampaignSummary c={c} /></CardBody></Card>

            {clientFiles.length > 0 && (
              <Card>
                <CardHeader title={`Fichiers du client (${clientFiles.length})`} action={<Link href={`${base}?onglet=creations`} className="text-[0.8125rem] font-medium text-green hover:underline">Tout voir</Link>} />
                <CardBody>
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                    {clientFiles.slice(0, 10).map((a) => (
                      <li key={a.id}><a href={`/api/files/${a.asset.id}`} target="_blank" rel="noreferrer" title={a.asset.name} className="block overflow-hidden rounded-lg border border-line bg-sand"><AssetThumb id={a.asset.id} kind={a.asset.kind} name={a.asset.name} className="aspect-square w-full" /></a></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {objective && (
              <Card>
                <CardHeader title="Paramétrage publicitaire recommandé" />
                <CardBody>
                  <DefinitionList items={[
                    ...(platforms.some((p) => p !== "TIKTOK") ? [{ label: "Objectif Meta", value: objective.config.metaObjective ? <span className="font-mono text-[0.8125rem]">{objective.config.metaObjective}</span> : "Non adapté" }, { label: "Optimisation Meta", value: objective.config.metaOptimization ? <span className="font-mono text-[0.8125rem]">{objective.config.metaOptimization}</span> : null }] : []),
                    ...(platforms.includes("TIKTOK") ? [{ label: "Objectif TikTok", value: objective.config.tiktokObjective ? <span className="font-mono text-[0.8125rem]">{objective.config.tiktokObjective}</span> : "Non adapté" }, { label: "Optimisation TikTok", value: objective.config.tiktokOptimization ? <span className="font-mono text-[0.8125rem]">{objective.config.tiktokOptimization}</span> : null }] : []),
                    { label: "Formats conseillés", value: objective.config.formats.join(", ") },
                    { label: "Boutons d'action", value: objective.config.ctas.join(", ") },
                    { label: "Prérequis", value: objective.config.requires.length ? objective.config.requires.join(", ") : "Aucun" },
                  ]} />
                </CardBody>
              </Card>
            )}

            {copy && (
              <Card>
                <CardHeader title="Texte de l'annonce" />
                <CardBody className="text-sm">
                  <div className="rounded-md border border-line bg-paper p-4"><p className="font-medium text-ink">{copy.headline}</p><p className="mt-1.5 whitespace-pre-wrap text-ink-soft">{copy.body}</p>{copy.cta && <p className="mt-2 text-[0.8125rem] text-green">Bouton : {copy.cta}</p>}</div>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader title="Historique" />
              <ol className="space-y-4 px-4 sm:px-5 py-4">
                {c.statusEvents.map((e) => (
                  <li key={e.id} className="relative pl-5 text-sm before:absolute before:left-0 before:top-1.5 before:size-2 before:rounded-full before:bg-line-strong">
                    <p className="font-medium text-ink">{STATUS_META[e.toStatus as CampaignStatusName].label}</p>
                    {e.note && <p className="text-[0.8125rem] text-ink-soft">{e.note}</p>}
                    <p className="text-xs text-muted">{formatDateTime(e.createdAt)}{e.actorId ? ` · ${actorName.get(e.actorId) ?? "compte supprimé"}` : " · automatique"}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader title="Comptes du client" description={accessMissing.length ? `Accès manquant : ${accessMissing.map((p) => PLATFORMS[p].label).join(", ")}.` : "Lancez la publicité sur ces comptes."} />
              <AccessPanel campaignId={c.id} canReveal={can(user.role, "access.reveal")} canReview={can(user.role, "campaign.update_status")}
                items={platforms.map((p) => { const row = accessRows.find((r) => r.platform === p); const state = accessState(accessRows, p, c.id); return { platform: p, url: accounts[p] ?? "", state, method: state === "TODO" ? null : row?.method ?? null, hasSecret: state !== "TODO" && Boolean(row?.hasSecret), note: row?.note ?? null, updatedAt: row?.updatedAt.toISOString() ?? null }; })} />
              <ul className="divide-y divide-line border-t border-line empty:hidden">
                {c.destinationWhatsapp && <li className="flex items-center gap-3 px-4 sm:px-5 py-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-green-soft text-green"><MessageCircle className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block text-xs text-muted">WhatsApp des clients</span><span className="tnum block font-medium text-ink">{formatPhone(c.destinationWhatsapp)}</span></span></li>}
                {c.destinationUrl && <li className="flex items-center gap-3 px-4 sm:px-5 py-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sand text-ink-soft"><LinkIcon className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block text-xs text-muted">Lien de destination</span><a href={c.destinationUrl} target="_blank" rel="noreferrer nofollow" className="block truncate font-medium text-green hover:underline">{accountDisplay(c.destinationUrl)}</a></span></li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Statut" />
              <CardBody>
                {can(user.role, "campaign.update_status") ? <StatusPanel campaignId={c.id} status={status} next={staffTransitions(status)} /> : <p className="text-sm text-muted">Votre rôle ne permet pas de modifier le statut.</p>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Équipe" />
              <CardBody>
                {can(user.role, "campaign.assign") ? <Assign campaignId={c.id} managerId={c.managerId} designerId={c.designerId} /> : <DefinitionList className="sm:grid-cols-1" items={[{ label: "Gestionnaire", value: c.manager?.name ?? "Non attribuée" }, { label: "Designer", value: c.designer?.name ?? "Aucun" }]} />}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Campagne sur les plateformes" />
              <CardBody><ExternalRefsPanel campaignId={c.id} platforms={platforms} refs={readExternalRefs(c.externalRefs)} canEdit={can(user.role, "campaign.update_status") && !["COMPLETED", "CANCELLED"].includes(status)} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Client" />
              <CardBody className="space-y-1.5 text-sm">
                <p className="font-medium text-ink">{c.user.name}</p>
                <p className="text-muted">{c.user.accountType === "PROFESSIONAL" ? "Compte professionnel" : "Particulier"}</p>
                <a href={`mailto:${c.user.email}`} className="block truncate text-green hover:underline">{c.user.email}</a>
                {c.user.phone && (wa ? <a href={wa} target="_blank" rel="noreferrer" className="tnum block text-green hover:underline">{formatPhone(c.user.phone)}</a> : <p className="tnum">{formatPhone(c.user.phone)}</p>)}
                {c.business && <p className="pt-2 text-[0.8125rem] text-ink-soft">{c.business.name} · {c.business.sector}{c.business.city ? ` · ${c.business.city}` : ""}</p>}
                {c.business && [...PLATFORM_CODES.filter((p) => !platforms.includes(p)).map((p) => accounts[p]), c.business.website].filter(Boolean).map((u) => <a key={u} href={u!} target="_blank" rel="noreferrer nofollow" className="block truncate text-[0.8125rem] text-green hover:underline">{u}</a>)}
              </CardBody>
            </Card>
            {order && can(user.role, "order.view") && (
              <Card>
                <CardHeader title="Commande" action={<StateIcon kind="order" value={order.status} />} />
                <CardBody>
                  <DefinitionList className="sm:grid-cols-2" items={[
                    { label: "Référence", value: <span className="font-mono text-[0.8125rem]">{order.reference}</span> },
                    { label: "Total", value: <span className="tnum font-medium">{formatFcfa(order.total)}</span> },
                    { label: "Budget publicitaire", value: <span className="tnum">{formatFcfa(order.adBudget)}</span> },
                    { label: "Prestation nette", value: <span className="tnum">{formatFcfa(order.serviceFee - order.discount)}</span> },
                  ]} />
                  {can(user.role, "payment.view") && <Link href={`/gestion/paiements?q=${order.reference}`} className="mt-3 inline-block text-[0.8125rem] font-medium text-green hover:underline">Voir les paiements</Link>}
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      )}

      {tab === "creations" && (
        <Card>
          <CardHeader title="Fichiers et créations" />
          <CreativesPanel campaignId={c.id} canManage={can(user.role, "campaign.manage_creatives") && !["COMPLETED", "CANCELLED"].includes(status)}
            items={c.assets.map((a) => ({ linkId: a.id, assetId: a.asset.id, name: a.asset.name, kind: a.asset.kind, approval: a.approval, feedback: a.feedback, byClient: a.addedById === c.userId, role: a.role }))} />
        </Card>
      )}

      {tab === "modifications" && (
        <Card>
          <CardHeader title="Demandes de modification" />
          {c.revisions.length ? (
            <ul className="divide-y divide-line">
              {c.revisions.map((r) => <RevisionItem key={r.id} id={r.id} description={r.description} status={r.status} response={r.response} requester={r.requester.name} createdAt={r.createdAt.toISOString()} canManage={can(user.role, "revision.manage")} />)}
            </ul>
          ) : <EmptyState title="Aucune demande" />}
        </Card>
      )}

      {tab === "statistiques" && <Stats campaignId={c.id} platforms={platforms} adBudget={c.adBudget} kpis={objective?.config.kpis ?? []} launched={Boolean(c.launchedAt)} canImport={can(user.role, "metrics.import")} canValidate={can(user.role, "metrics.validate")} />}
    </>
  );
}

async function Assign({ campaignId, managerId, designerId }: { campaignId: string; managerId: string | null; designerId: string | null }) {
  const staff = await db.user.findMany({ where: { role: { not: "CLIENT" }, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
  return <AssignPanel campaignId={campaignId} managerId={managerId} designerId={designerId}
    managers={staff.filter((s) => can(s.role, "campaign.update_status")).map((s) => ({ id: s.id, name: `${s.name} — ${ROLE_LABELS[s.role]}` }))}
    designers={staff.filter((s) => can(s.role, "campaign.manage_creatives")).map((s) => ({ id: s.id, name: `${s.name} — ${ROLE_LABELS[s.role]}` }))} />;
}

async function Stats({ campaignId, platforms, adBudget, kpis, launched, canImport, canValidate }: { campaignId: string; platforms: PlatformCode[]; adBudget: number; kpis: NonNullable<ReturnType<typeof getObjective>>["config"]["kpis"]; launched: boolean; canImport: boolean; canValidate: boolean }) {
  const [report, rows, imports] = await Promise.all([
    loadCampaignReport(campaignId, { validatedOnly: false }),
    db.metricSnapshot.findMany({ where: { campaignId }, orderBy: [{ date: "desc" }, { platform: "asc" }], take: 120 }),
    db.metricImport.findMany({ where: { campaignId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const apiReady = (await Promise.all(platforms.map((p) => ADS_ADAPTERS[p === "TIKTOK" ? "TIKTOK" : "META"].isConfigured()))).some(Boolean);
  const sourceLabel: Record<string, string> = { API: "API", IMPORT: "Import CSV", MANUAL: "Saisie" };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Alimenter les statistiques" />
        <CardBody><MetricsPanel campaignId={campaignId} platforms={platforms} pending={report.pending} canImport={canImport} canValidate={canValidate} apiReady={apiReady} launched={launched} today={toIsoDate(todayUtc())} template={CSV_TEMPLATE} /></CardBody>
      </Card>
      {report.pending > 0 && report.totals.days > 0 && <Notice tone="info">L&apos;aperçu ci-dessous inclut les lignes en attente de validation. Le client ne voit que les lignes validées.</Notice>}
      <MetricsView report={report} kpis={kpis} adBudget={adBudget} staff />
      {rows.length > 0 && (
        <Card>
          <CardHeader title="Lignes enregistrées" />
          <Table head={["Date", "Plateforme", "Impressions", "Clics", "Dépenses", "Source", "État"]} mobileCorner={7} mobileHide={[6]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatPureDate(r.date)}</td>
                <td>{PLATFORMS[r.platform as PlatformCode].label}</td>
                <td className="tnum">{formatNumber(r.impressions)}</td>
                <td className="tnum">{formatNumber(r.clicks)}</td>
                <td className="tnum">{formatFcfa(r.spend)}</td>
                <td className="text-muted">{sourceLabel[r.source] ?? r.source}</td>
                <td><StateIcon kind="import" value={r.validated ? "VALIDATED" : "PENDING"} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {imports.length > 0 && (
        <Card>
          <CardHeader title="Imports" />
          <ul className="divide-y divide-line">
            {imports.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 text-sm">
                <span className="min-w-0"><span className="block truncate text-ink">{i.fileName} · <span className="tnum">{i.rowCount}</span> ligne(s)</span><span className="block text-xs text-muted">{formatDateTime(i.createdAt)}{i.note ? ` · ${i.note}` : ""}</span></span>
                <StateIcon kind="import" value={i.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
