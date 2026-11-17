"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CloudDownload, Copy, Eye, EyeOff, FileUp, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AssetThumb, Uploader } from "@/components/app/uploader";
import { PlatformBadge } from "@/components/icons";
import { Badge, StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker, Switch } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { ACCESS_STATE_META, METHOD_LABELS, type AccessMethod, type AccessState } from "@/lib/catalog/access";
import { accountDisplay } from "@/lib/catalog/accounts";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { formatDateTime } from "@/lib/utils";
import {
  assignCampaignAction, discardPendingMetricsAction, handleRevisionAction, importMetricsAction, revealAccessAction, reviewAccessAction, saveExternalRefsAction, saveMetricRowAction, staffAttachCreativeAction,
  staffChangeStatusAction, staffRemoveCreativeAction, staffSubmitCreativeAction, syncMetricsAction, validateMetricsAction,
} from "@/server/actions/staff-campaigns";

type Result = { ok: true; data: unknown } | { ok: false; error: string };

/** Exécute une action serveur, affiche le résultat et rafraîchit la page. */
function useRun() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(async (fn: () => Promise<Result>, success?: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return null; }
    if (success) toast.success(success);
    router.refresh();
    return res;
  }, [router]);
  return { busy, run };
}

export function StatusPanel({ campaignId, status, next }: { campaignId: string; status: CampaignStatusName; next: CampaignStatusName[] }) {
  const { busy, run } = useRun();
  const [to, setTo] = React.useState<CampaignStatusName | "">(next[0] ?? "");
  const [note, setNote] = React.useState("");
  React.useEffect(() => { setTo(next[0] ?? ""); setNote(""); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!next.length) return <p className="text-sm text-muted">{status === "PENDING_PAYMENT" ? "En attente du paiement du client : le passage à « Payé » est automatique, après vérification auprès du prestataire." : "Aucun changement de statut possible."}</p>;
  const destructive = to === "CANCELLED";
  return (
    <div className="space-y-3">
      <Field label="Nouveau statut" htmlFor="st-to">
        <Select id="st-to" value={to} onChange={(e) => setTo(e.target.value as CampaignStatusName)}>{next.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</Select>
      </Field>
      <Field label={to === "AWAITING_INFO" ? "Information attendue du client" : "Note pour le client"} htmlFor="st-note" optional={to !== "AWAITING_INFO"}>
        <Textarea id="st-note" rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder={to === "AWAITING_INFO" ? "Ex. : merci d'envoyer le lien de votre page Facebook." : "Ajoutée à la notification envoyée au client."} />
      </Field>
      {destructive && <Notice tone="warn">L&apos;annulation d&apos;une campagne payée ne rembourse pas le client automatiquement : créez le remboursement depuis la page Paiements.</Notice>}
      <Button variant={destructive ? "danger" : "primary"} disabled={busy || !to} onClick={() => { if (destructive && !window.confirm("Annuler définitivement cette campagne ?")) return; void run(() => staffChangeStatusAction(campaignId, to, note), "Statut mis à jour, client notifié."); }}>
        {busy ? "Mise à jour…" : "Mettre à jour le statut"}
      </Button>
    </div>
  );
}

export function AssignPanel({ campaignId, managerId, designerId, managers, designers }: { campaignId: string; managerId: string | null; designerId: string | null; managers: { id: string; name: string }[]; designers: { id: string; name: string }[] }) {
  const { busy, run } = useRun();
  const [m, setM] = React.useState(managerId ?? "");
  const [d, setD] = React.useState(designerId ?? "");
  return (
    <div className="space-y-3">
      <Field label="Gestionnaire" htmlFor="as-m"><Select id="as-m" value={m} onChange={(e) => setM(e.target.value)}><option value="">Non attribuée</option>{managers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
      <Field label="Designer" htmlFor="as-d"><Select id="as-d" value={d} onChange={(e) => setD(e.target.value)}><option value="">Aucun</option>{designers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
      <Button variant="outline" disabled={busy || (m === (managerId ?? "") && d === (designerId ?? ""))} onClick={() => run(() => assignCampaignAction(campaignId, m || null, d || null), "Attribution enregistrée.")}>Enregistrer</Button>
    </div>
  );
}

export function ExternalRefsPanel({ campaignId, platforms, refs, canEdit }: { campaignId: string; platforms: PlatformCode[]; refs: Record<string, string | undefined>; canEdit: boolean }) {
  const { busy, run } = useRun();
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(platforms.map((p) => [p, refs[p] ?? ""])));
  return (
    <div className="space-y-3">
      {platforms.map((p) => (
        <Field key={p} label={`Identifiant de campagne ${PLATFORMS[p].label}`} htmlFor={`ref-${p}`} optional>
          <Input id={`ref-${p}`} className="font-mono text-[13px]" value={values[p] ?? ""} disabled={!canEdit} onChange={(e) => setValues((s) => ({ ...s, [p]: e.target.value.trim() }))} placeholder={p === "TIKTOK" ? "ID TikTok Ads Manager" : "ID Gestionnaire de publicités Meta"} />
        </Field>
      ))}
      <p className="text-xs text-muted">La campagne est créée manuellement dans le gestionnaire de publicités de la plateforme. Son identifiant sert à relier les statistiques. Une campagne Meta diffusée sur Facebook et Instagram porte le même identifiant.</p>
      {canEdit && <Button variant="outline" disabled={busy} onClick={() => run(() => saveExternalRefsAction(campaignId, values), "Identifiants enregistrés.")}>Enregistrer</Button>}
    </div>
  );
}

export type StaffCreative = { linkId: string; assetId: string; name: string; kind: string; approval: string; feedback: string | null; byClient: boolean; role: string };

export function CreativesPanel({ campaignId, items, canManage }: { campaignId: string; items: StaffCreative[]; canManage: boolean }) {
  const { busy, run } = useRun();
  const [submit, setSubmit] = React.useState(true);
  return (
    <div className="space-y-5 p-4 sm:p-5">
      {canManage && (
        <div className="space-y-2">
          <Uploader compact label="Ajouter une création" hint="Image ou vidéo aux dimensions de la plateforme" onUploaded={async (asset) => { await run(() => staffAttachCreativeAction(campaignId, asset.id, submit), submit ? "Création soumise au client." : "Création ajoutée."); }} />
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft"><Switch checked={submit} onCheckedChange={setSubmit} aria-label="Soumettre au client" />Soumettre au client dès l&apos;ajout</label>
        </div>
      )}
      {items.length === 0 ? <p className="py-6 text-center text-sm text-muted">Aucun fichier pour cette campagne.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <li key={it.linkId} className="overflow-hidden rounded-lg border border-line">
              <a href={`/api/files/${it.assetId}`} target="_blank" rel="noreferrer" className="block bg-sand"><AssetThumb id={it.assetId} kind={it.kind} name={it.name} className="aspect-square w-full" /></a>
              <div className="space-y-2.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium" title={it.name}>{it.name}</p>
                  {it.role === "CREATIVE" ? <StateBadge kind="approval" value={it.approval} /> : <span className="shrink-0 text-xs text-muted">{it.role === "BRIEF_FILE" ? "Brief" : "Média produit"}</span>}
                </div>
                <p className="text-xs text-muted">{it.byClient ? "Fourni par le client" : "Ajouté par l'équipe"} · <a className="text-green hover:underline" href={`/api/files/${it.assetId}?telecharger`}>Télécharger</a></p>
                {it.feedback && <p className="rounded-md bg-marigold-soft px-3 py-2 text-[13px] text-ink">Retour du client : {it.feedback}</p>}
                {canManage && it.role === "CREATIVE" && (
                  <div className="flex gap-2">
                    {it.approval !== "PENDING" && it.approval !== "APPROVED" && <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => run(() => staffSubmitCreativeAction(it.linkId), "Soumise au client.")}><Send />Soumettre</Button>}
                    {!it.byClient && it.approval !== "APPROVED" && <Button size="sm" variant="ghost" className="text-clay" disabled={busy} aria-label="Retirer" onClick={() => { if (window.confirm("Retirer cette création ?")) void run(() => staffRemoveCreativeAction(it.linkId), "Création retirée."); }}><Trash2 /></Button>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RevisionItem({ id, description, status, response, requester, createdAt, canManage }: { id: string; description: string; status: string; response: string | null; requester: string; createdAt: string; canManage: boolean }) {
  const { busy, run } = useRun();
  const [text, setText] = React.useState(response ?? "");
  const open = status === "OPEN" || status === "IN_PROGRESS";
  return (
    <li className="space-y-3 px-4 sm:px-5 py-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="whitespace-pre-wrap text-ink">{description}</p><p className="mt-1 text-xs text-muted">{requester} · {formatDateTime(createdAt)}</p></div>
        <StateBadge kind="revision" value={status} />
      </div>
      {open && canManage ? (
        <div className="space-y-2">
          <Textarea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Réponse au client (obligatoire en cas de refus)" aria-label="Réponse au client" />
          <div className="flex flex-wrap gap-2">
            {status === "OPEN" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => handleRevisionAction(id, "IN_PROGRESS", text), "Demande prise en charge.")}>Prendre en charge</Button>}
            <Button size="sm" disabled={busy} onClick={() => run(() => handleRevisionAction(id, "DONE", text), "Demande clôturée, client notifié.")}><Check />Modification appliquée</Button>
            <Button size="sm" variant="danger-outline" disabled={busy} onClick={() => run(() => handleRevisionAction(id, "REJECTED", text), "Demande refusée, client notifié.")}><X />Refuser</Button>
          </div>
        </div>
      ) : response ? <p className="rounded-md bg-sand px-3 py-2 text-[13px] text-ink-soft">Réponse : {response}</p> : null}
    </li>
  );
}

const ROW_FIELDS: { key: string; label: string }[] = [
  { key: "impressions", label: "Impressions" }, { key: "reach", label: "Portée" }, { key: "clicks", label: "Clics" }, { key: "engagements", label: "Engagement" },
  { key: "videoViews", label: "Vues vidéo" }, { key: "leads", label: "Prospects" }, { key: "conversions", label: "Conversions" }, { key: "spend", label: "Dépenses (F)" }, { key: "revenue", label: "Revenu déclaré (F)" },
];

export function MetricsPanel({ campaignId, platforms, pending, canImport, canValidate, apiReady, launched, today, template }: {
  campaignId: string; platforms: PlatformCode[]; pending: number; canImport: boolean; canValidate: boolean; apiReady: boolean; launched: boolean; today: string; template: string;
}) {
  const { busy, run } = useRun();
  const [platform, setPlatform] = React.useState<string>(platforms.length === 1 ? platforms[0]! : "");
  const [row, setRow] = React.useState<Record<string, string>>({ date: today, platform: platforms[0] ?? "FACEBOOK" });
  const [issues, setIssues] = React.useState<string[]>([]);
  const file = React.useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 400_000) { toast.error("Fichier trop volumineux (400 Ko maximum)."); return; }
    let text: string;
    try { text = await f.text(); } catch { toast.error("Lecture du fichier impossible."); return; }
    const res = await run(() => importMetricsAction(campaignId, text, f.name, platform || null));
    if (file.current) file.current.value = "";
    if (res?.ok) { const d = res.data as { stored: number; issues: string[] }; toast.success(`${d.stored} ligne(s) importée(s), en attente de validation.`); setIssues(d.issues); }
  }

  if (!launched) return <Notice tone="info">Les statistiques pourront être saisies une fois la campagne déclarée « En cours ».</Notice>;
  return (
    <div className="space-y-5">
      {pending > 0 && (
        <Notice tone="warn" title={`${pending} ligne${pending > 1 ? "s" : ""} en attente de validation`}>
          Ces chiffres ne sont pas encore visibles du client. Vérifiez-les par rapport au gestionnaire de publicités avant de les publier.
          <span className="mt-3 flex flex-wrap gap-2">
            {canValidate && <Button size="sm" disabled={busy} onClick={() => run(() => validateMetricsAction(campaignId), "Statistiques publiées, client notifié.")}><Check />Valider et publier</Button>}
            {canImport && <Button size="sm" variant="danger-outline" disabled={busy} onClick={() => { if (window.confirm("Supprimer les lignes non validées ?")) void run(() => discardPendingMetricsAction(campaignId), "Lignes en attente supprimées."); }}>Rejeter</Button>}
          </span>
        </Notice>
      )}
      {canImport && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-line p-4">
            <h3 className="text-sm font-semibold">Importer un export CSV</h3>
            <Field label="Plateforme par défaut" htmlFor="imp-pf" hint="Utilisée si le fichier n'a pas de colonne « plateforme ».">
              <Select id="imp-pf" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">Lue dans le fichier</option>{platforms.map((p) => <option key={p} value={p}>{PLATFORMS[p].label}</option>)}</Select>
            </Field>
            <input ref={file} type="file" accept=".csv,text/csv,text/plain" className="sr-only" id="imp-file" onChange={(e) => void onFile(e.target.files?.[0])} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={busy} onClick={() => file.current?.click()}><FileUp />Choisir un fichier</Button>
              <a className="text-[13px] font-medium text-green hover:underline" download="modele-statistiques.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}>Télécharger le modèle</a>
            </div>
            {issues.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-clay">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>}
            <div className="border-t border-line pt-3">
              <Button variant="ghost" size="sm" disabled={busy || !apiReady} onClick={async () => { const res = await run(() => syncMetricsAction(campaignId)); if (res?.ok) { const d = res.data as { synced: number; messages: string[] }; toast.message(d.messages.join(" ") || `${d.synced} ligne(s) synchronisée(s).`); } }}><CloudDownload />Synchroniser depuis l&apos;API</Button>
              {!apiReady && <p className="mt-1 text-xs text-muted">Synchronisation indisponible : aucun accès API Meta ou TikTok n&apos;est configuré (voir Intégrations).</p>}
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-line p-4">
            <h3 className="text-sm font-semibold">Saisir une journée</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="row-date"><DatePicker id="row-date" max={today} value={row.date ?? ""} onChange={(e) => setRow((s) => ({ ...s, date: e.target.value }))} /></Field>
              <Field label="Plateforme" htmlFor="row-pf"><Select id="row-pf" value={row.platform} onChange={(e) => setRow((s) => ({ ...s, platform: e.target.value }))}>{platforms.map((p) => <option key={p} value={p}>{PLATFORMS[p].label}</option>)}</Select></Field>
              {ROW_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`row-${f.key}`} optional={f.key === "revenue"}>
                  <Input id={`row-${f.key}`} type="number" inputMode="numeric" min={0} step={1} className="tnum" value={row[f.key] ?? ""} onChange={(e) => setRow((s) => ({ ...s, [f.key]: e.target.value }))} />
                </Field>
              ))}
            </div>
            <Button variant="outline" disabled={busy || !row.date} onClick={async () => { const res = await run(() => saveMetricRowAction(campaignId, row), "Ligne enregistrée, en attente de validation."); if (res) setRow((s) => ({ date: s.date ?? today, platform: s.platform ?? platforms[0] ?? "FACEBOOK" })); }}>Enregistrer la ligne</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export type StaffAccessItem = { platform: PlatformCode; url: string; state: AccessState; method: AccessMethod | null; hasSecret: boolean; note: string | null; updatedAt: string | null };

/** Comptes du client et accès donnés : c'est ici que l'équipe récupère de quoi lancer la campagne. */
export function AccessPanel({ campaignId, items, canReveal, canReview }: { campaignId: string; items: StaffAccessItem[]; canReveal: boolean; canReview: boolean }) {
  const { busy, run } = useRun();
  const [shown, setShown] = React.useState<Record<string, { login: string; password: string | null }>>({});
  const [problem, setProblem] = React.useState<PlatformCode | null>(null);
  const [note, setNote] = React.useState("");

  // Les identifiants affichés disparaissent d'eux-mêmes après une minute.
  React.useEffect(() => {
    if (!Object.keys(shown).length) return;
    const timer = setTimeout(() => setShown({}), 60_000);
    return () => clearTimeout(timer);
  }, [shown]);

  async function reveal(p: PlatformCode) {
    if (shown[p]) { setShown(({ [p]: _hidden, ...rest }) => rest); return; }
    const res = await revealAccessAction(campaignId, p);
    if (!res.ok) { toast.error(res.error); return; }
    setShown((prev) => ({ ...prev, [p]: res.data as { login: string; password: string | null } }));
  }
  const copy = async (value: string, label: string) => { try { await navigator.clipboard.writeText(value); toast.success(`${label} copié.`); } catch { toast.error("Copie impossible."); } };

  return (
    <ul className="divide-y divide-line">
      {items.map((it) => {
        const meta = ACCESS_STATE_META[it.state];
        const secret = shown[it.platform];
        return (
          <li key={it.platform} className="space-y-2.5 px-4 sm:px-5 py-3.5 text-sm">
            <div className="flex items-center gap-3">
              <PlatformBadge platform={it.platform} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{PLATFORMS[it.platform].label}</span>
                {it.url ? <a href={it.url} target="_blank" rel="noreferrer nofollow" className="block truncate font-medium text-green hover:underline">{accountDisplay(it.url)}</a> : <span className="block font-medium text-clay">Compte non fourni</span>}
              </span>
              <Badge tone={meta.tone}>{meta.staffLabel}</Badge>
            </div>
            {it.method && it.state !== "TODO" && (
              <p className="text-[13px] text-ink-soft">{METHOD_LABELS[it.method].staff}{it.method === "INVITE" && it.hasSecret ? " (code de vidéo)" : ""}{it.updatedAt ? ` · ${formatDateTime(it.updatedAt)}` : ""}</p>
            )}
            {it.state === "PROBLEM" && it.note && <p className="rounded-md bg-clay-soft px-3 py-2 text-[13px] text-ink">Dit au client : {it.note}</p>}
            {secret && (
              <dl className="space-y-1.5 rounded-lg border border-line bg-paper p-3 text-[13px]">
                {([[it.method === "LOGIN" ? "Identifiant" : "Code", secret.login], ...(secret.password !== null ? [["Mot de passe", secret.password]] : [])] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-2">
                    <dt className="w-24 shrink-0 text-muted">{label}</dt>
                    <dd className="min-w-0 flex-1 select-all break-all font-mono text-ink">{value}</dd>
                    <button type="button" onClick={() => copy(value, label)} aria-label={`Copier : ${label}`} className="flex size-8 shrink-0 items-center justify-center rounded-full text-green hover:bg-green-soft"><Copy className="size-3.5" /></button>
                  </div>
                ))}
              </dl>
            )}
            {(canReveal || canReview) && (
              <div className="flex flex-wrap gap-2">
                {canReveal && it.hasSecret && <Button size="sm" variant="outline" disabled={busy} onClick={() => reveal(it.platform)}>{secret ? <EyeOff /> : <Eye />}{secret ? "Masquer" : it.method === "LOGIN" ? "Voir les identifiants" : "Voir le code"}</Button>}
                {canReview && it.state !== "VERIFIED" && <Button size="sm" disabled={busy} onClick={() => run(() => reviewAccessAction(campaignId, it.platform, true, ""), "Accès vérifié.")}><Check />{it.state === "TODO" ? "J'ai déjà l'accès" : "Accès OK"}</Button>}
                {canReview && it.state !== "TODO" && problem !== it.platform && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setProblem(it.platform); setNote(""); }}><X />Problème</Button>}
              </div>
            )}
            {problem === it.platform && (
              <div className="space-y-2">
                <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Message au client" placeholder="Ex. : Facebook demande un code, envoyez-le-nous sur WhatsApp." />
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" disabled={busy || note.trim().length < 5} onClick={async () => { if (await run(() => reviewAccessAction(campaignId, it.platform, false, note), "Client prévenu.")) setProblem(null); }}>Prévenir le client</Button>
                  <Button size="sm" variant="ghost" onClick={() => setProblem(null)}>Fermer</Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
