"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch, ToggleRow } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatFcfa } from "@/lib/utils";
import { changeRoleAction, requestRefundAction, resolveRefundAction, saveServiceAction, updateTicketAction } from "@/server/actions/staff-admin";

type Result = { ok: true; data: unknown } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<Result>, success: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return false; }
    toast.success(success);
    router.refresh();
    return true;
  };
  return { busy, run };
}

export function RefundDialog({ paymentId, max, label }: { paymentId: string; max: number; label: string }) {
  const { busy, run } = useRun();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(String(max));
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Rembourser</Button></DialogTrigger>
      <DialogContent title="Créer un remboursement" description={label}>
        <div className="space-y-4">
          <Field label="Montant à rembourser (F CFA)" htmlFor="rf-amount" hint={`Maximum remboursable : ${formatFcfa(max)}`}>
            <Input id="rf-amount" type="number" inputMode="numeric" min={1} max={max} step={1} className="tnum" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Motif" htmlFor="rf-reason"><Textarea id="rf-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Annulation avant lancement, budget non dépensé, paiement en double…" /></Field>
          <p className="rounded-md bg-sand px-3 py-2.5 text-[13px] text-ink-soft">Le remboursement est enregistré comme « à traiter ». Le transfert Mobile Money vers le client se fait depuis le compte du prestataire de paiement, puis sa référence est saisie ici pour le clôturer.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
            <Button disabled={busy} onClick={async () => { if (await run(() => requestRefundAction(paymentId, Number(amount), reason), "Remboursement créé.")) setOpen(false); }}>Créer le remboursement</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveRefund({ refundId }: { refundId: string }) {
  const { busy, run } = useRun();
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <Field label="Référence du transfert" htmlFor={`rr-${refundId}`}><Input id={`rr-${refundId}`} className="font-mono text-[13px]" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Réf. Mobile Money" /></Field>
      <Field label="Note ou motif de refus" htmlFor={`rn-${refundId}`} optional><Input id={`rn-${refundId}`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button size="sm" className="sm:mb-0.5" disabled={busy} onClick={() => run(() => resolveRefundAction(refundId, "PROCESSED", reference, note), "Remboursement clôturé, client notifié.")}>Marquer effectué</Button>
      <Button size="sm" variant="danger-outline" className="sm:mb-0.5" disabled={busy} onClick={() => run(() => resolveRefundAction(refundId, "REJECTED", reference, note), "Remboursement refusé, client notifié.")}>Refuser</Button>
    </div>
  );
}

export function TicketPanel({ ticketId, status, resolution }: { ticketId: string; status: string; resolution: string | null }) {
  const { busy, run } = useRun();
  const [text, setText] = React.useState(resolution ?? "");
  if (status === "CLOSED") return resolution ? <p className="rounded-md bg-green-soft px-3 py-2 text-[13px] text-forest">Réponse : {resolution}</p> : null;
  return (
    <div className="space-y-2">
      <Textarea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Réponse envoyée au client" aria-label="Réponse au client" />
      <div className="flex flex-wrap gap-2">
        {status === "OPEN" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => updateTicketAction(ticketId, "IN_PROGRESS", text), "Réclamation prise en charge.")}>Prendre en charge</Button>}
        {status !== "RESOLVED" && <Button size="sm" disabled={busy} onClick={() => run(() => updateTicketAction(ticketId, "RESOLVED", text), "Réponse envoyée au client.")}>Répondre et résoudre</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => updateTicketAction(ticketId, "CLOSED", text), "Réclamation clôturée.")}>Clôturer</Button>
      </div>
    </div>
  );
}

export function RoleSelect({ userId, role, roles }: { userId: string; role: string; roles: { id: string; label: string }[] }) {
  const { busy, run } = useRun();
  if (!roles.some((r) => r.id === role)) return <span className="text-sm text-ink-soft">{roles.find((r) => r.id === role)?.label ?? role}</span>;
  return (
    <Select aria-label="Rôle" className="h-9 w-56 text-[13px]" value={role} disabled={busy} onChange={(e) => { const next = e.target.value; if (window.confirm("Changer le rôle de ce collaborateur ? Il devra se reconnecter.")) void run(() => changeRoleAction(userId, next), "Rôle modifié."); }}>
      {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
    </Select>
  );
}

export type ServiceData = { id: string; code: string; name: string; description: string; kind: string; fee: number; periodDays: number | null; features: string[]; active: boolean; sortOrder: number };

export function ServiceDialog({ service, minFee }: { service?: ServiceData; minFee: number }) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState(service?.kind ?? "PACK");
  const s = service;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{s ? <Button variant="ghost" size="sm"><Pencil />Modifier</Button> : <Button size="sm"><Plus />Nouvelle prestation</Button>}</DialogTrigger>
      <DialogContent title={s ? s.name : "Nouvelle prestation"} description={s ? `Code ${s.code}` : "Niveau d'accompagnement ou abonnement proposé aux clients."}>
        <ActionForm action={saveServiceAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {s ? <input type="hidden" name="id" value={s.id} /> : (
            <Field label="Type" htmlFor="sv-kind"><Select id="sv-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="PACK">Pack création + publicité</option><option value="MANAGEMENT">Gestion complète</option><option value="SUBSCRIPTION">Abonnement</option></Select></Field>
          )}
          <Field label="Nom" htmlFor="sv-name"><Input id="sv-name" name="name" required maxLength={80} defaultValue={s?.name} /><FieldError name="name" /></Field>
          <Field label="Description" htmlFor="sv-desc"><Textarea id="sv-desc" name="description" rows={2} required maxLength={400} defaultValue={s?.description} /><FieldError name="description" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Frais (F CFA)" htmlFor="sv-fee" hint={`Minimum ${formatFcfa(minFee)}`}><Input id="sv-fee" name="fee" type="number" inputMode="numeric" min={minFee} step={500} required className="tnum" defaultValue={s?.fee ?? minFee} /><FieldError name="fee" /></Field>
            {kind === "SUBSCRIPTION" && <Field label="Période (jours)" htmlFor="sv-period"><Input id="sv-period" name="periodDays" type="number" min={7} max={365} className="tnum" defaultValue={s?.periodDays ?? 30} /></Field>}
            <Field label="Ordre" htmlFor="sv-order"><Input id="sv-order" name="sortOrder" type="number" min={0} max={999} className="tnum" defaultValue={s?.sortOrder ?? 50} /></Field>
          </div>
          <Field label="Inclus dans la prestation" htmlFor="sv-feat" hint="Une ligne par élément." optional><Textarea id="sv-feat" name="features" rows={4} defaultValue={s?.features.join("\n")} /></Field>
          <ToggleRow label="Proposée aux clients" htmlFor="sv-active"><Switch id="sv-active" name="active" defaultChecked={s?.active ?? true} /></ToggleRow>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button><SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton></div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
