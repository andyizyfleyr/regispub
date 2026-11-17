"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageSquareWarning, PenLine, Printer, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AssetThumb } from "@/components/app/uploader";
import { StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { cancelCampaignAction, decideCreativeAction, duplicateCampaignAction, requestRevisionAction } from "@/server/actions/campaigns";

export function CampaignActions({ id, canCancel, canRevise }: { id: string; canCancel: boolean; canRevise: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {canRevise && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline" size="sm"><PenLine />Demander une modification</Button></DialogTrigger>
          <DialogContent title="Demander une modification" description="Budget, ciblage, texte, visuel, dates… Votre gestionnaire vous répond avant d'appliquer le changement.">
            <Textarea rows={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Décrivez précisément ce que vous souhaitez changer." aria-label="Modification souhaitée" />
            <p className="mt-2 text-xs text-muted">Une modification du budget publicitaire peut entraîner un complément de paiement ou un remboursement partiel, traité par notre équipe.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
              <Button disabled={busy || text.trim().length < 10} onClick={async () => {
                setBusy(true);
                const res = await requestRevisionAction(id, text);
                setBusy(false);
                if (!res.ok) { toast.error(res.error); return; }
                toast.success("Demande envoyée à votre gestionnaire.");
                setText(""); setOpen(false); router.refresh();
              }}>{busy ? "Envoi…" : "Envoyer la demande"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <form action={duplicateCampaignAction.bind(null, id)}><Button type="submit" variant="outline" size="sm"><Copy />Dupliquer</Button></form>
      {canCancel && (
        <Button variant="danger-outline" size="sm" onClick={async () => {
          if (!window.confirm("Annuler cette campagne ? La commande en attente sera annulée.")) return;
          const res = await cancelCampaignAction(id);
          if (!res.ok) toast.error(res.error); else { toast.success("Campagne annulée."); router.refresh(); }
        }}><Trash2 />Annuler</Button>
      )}
    </div>
  );
}

export type ReviewItem = { linkId: string; assetId: string; name: string; kind: string; format: string | null; approval: string; feedback: string | null; byTeam: boolean };

/** Créations soumises par l'équipe : le client valide ou demande une modification. */
export function CreativeReview({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function decide(linkId: string, decision: "APPROVED" | "CHANGES_REQUESTED") {
    setBusy(linkId);
    const res = await decideCreativeAction(linkId, decision, decision === "CHANGES_REQUESTED" ? note : undefined);
    setBusy(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(decision === "APPROVED" ? "Création validée." : "Demande de modification envoyée.");
    setEditing(null); setNote(""); router.refresh();
  }

  return (
    <ul className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      {items.map((it) => (
        <li key={it.linkId} className="overflow-hidden rounded-lg border border-line bg-surface">
          <a href={`/api/files/${it.assetId}`} target="_blank" rel="noreferrer" className="block bg-sand"><AssetThumb id={it.assetId} kind={it.kind} name={it.name} className="aspect-square w-full" /></a>
          <div className="space-y-3 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium" title={it.name}>{it.name}</p>
              {it.approval !== "NOT_REQUIRED" ? <StateBadge kind="approval" value={it.approval} /> : <span className="shrink-0 text-xs text-muted">{it.byTeam ? "Équipe" : "Fourni par vous"}</span>}
            </div>
            {it.feedback && <p className="rounded-md bg-sand px-3 py-2 text-[13px] text-ink-soft"><MessageSquareWarning className="mr-1.5 inline size-3.5" />{it.feedback}</p>}
            {it.approval === "PENDING" && (editing === it.linkId ? (
              <div className="space-y-2">
                <Textarea rows={3} maxLength={1000} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Que faut-il changer ?" aria-label="Modifications souhaitées" />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setNote(""); }}>Retour</Button>
                  <Button size="sm" className="flex-1" disabled={busy === it.linkId || note.trim().length < 5} onClick={() => decide(it.linkId, "CHANGES_REQUESTED")}>Envoyer</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" disabled={busy === it.linkId} onClick={() => { setEditing(it.linkId); setNote(""); }}><X />À modifier</Button>
                <Button size="sm" className="flex-1" disabled={busy === it.linkId} onClick={() => decide(it.linkId, "APPROVED")}><Check />Valider</Button>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PrintButton() {
  return <Button className="no-print" variant="outline" size="sm" onClick={() => window.print()}><Printer />Imprimer ou enregistrer en PDF</Button>;
}
