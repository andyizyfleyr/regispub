"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Switch, ToggleRow } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { BOOST_KINDS, BOOST_MAX_PACKS, BOOST_MIN_PRICE, canMoveBoost, type BoostKindCode, type BoostPack, type BoostStatusName } from "@/lib/boost/catalog";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { formatFcfa, formatNumber } from "@/lib/utils";
import { saveBoostNoteAction, saveBoostProductAction, updateBoostAction } from "@/server/actions/boost";

/** Copie un texte (lien, commentaires) pour le coller chez le fournisseur. */
export function CopyButton({ text, label = "Copier", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button type="button" variant="outline" size="sm" className={className}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 1800); }
        catch { toast.error("Copie impossible. Sélectionnez le texte à la main."); }
      }}>
      {done ? <Check /> : <Copy />}{done ? "Copié" : label}
    </Button>
  );
}

export type BoostRow = {
  id: string; reference: string; label: string; quantity: number; link: string; comments: string[]; status: BoostStatusName; staffNote: string | null; cancelReason: string | null;
  client: { name: string; email: string; phone: string | null }; total: string;
};

/** Fiche d'une commande à livrer : ce qu'il faut passer chez le fournisseur, puis les boutons d'avancement. */
export function BoostManageDialog({ row }: { row: BoostRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState(row.staffNote ?? "");
  const [cancelling, setCancelling] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const can = (to: BoostStatusName) => canMoveBoost(row.status, to);
  const actionable = can("IN_PROGRESS") || can("DELIVERED") || can("CANCELLED");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Action impossible."); return; }
    toast.success(success);
    setOpen(false); setCancelling(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) setCancelling(false); } }}>
      <DialogTrigger asChild><Button variant={can("DELIVERED") ? "primary" : "ghost"} size="sm">{can("DELIVERED") ? "Traiter" : "Voir"}</Button></DialogTrigger>
      <DialogContent title={row.label} description={`Commande ${row.reference} · ${row.total}`}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[0.84375rem] font-medium text-ink">Lien à faire grandir</p>
            <div className="flex items-center gap-2">
              <a href={row.link} target="_blank" rel="noreferrer noopener" className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-2.5 text-[0.84375rem] text-green hover:underline">
                <span className="truncate">{row.link}</span><ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
              <CopyButton text={row.link} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-[0.84375rem]">
            <div><dt className="text-muted">Quantité</dt><dd className="tnum font-semibold text-ink">{formatNumber(row.quantity)}</dd></div>
            <div className="min-w-0"><dt className="text-muted">Client</dt><dd className="truncate font-medium text-ink">{row.client.name}</dd><dd className="truncate text-xs text-muted">{row.client.phone ?? row.client.email}</dd></div>
          </dl>

          {row.comments.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[0.84375rem] font-medium text-ink">Commentaires du client <span className="tnum font-normal text-muted">({row.comments.length})</span></p>
                <CopyButton text={row.comments.join("\n")} label="Tout copier" />
              </div>
              <ol className="max-h-44 list-decimal space-y-1 overflow-y-auto rounded-md border border-line bg-paper py-2.5 pl-8 pr-3 text-[0.84375rem] text-ink-soft">
                {row.comments.map((c, i) => <li key={i} className="break-words">{c}</li>)}
              </ol>
              {row.comments.length < row.quantity && <p className="mt-1.5 text-xs text-muted">Moins de textes que de commentaires commandés : à reprendre plusieurs fois.</p>}
            </div>
          )}

          {row.status === "CANCELLED" && row.cancelReason && <p className="rounded-md bg-sand px-3 py-2.5 text-[0.8125rem] text-ink-soft">Motif de l&apos;annulation : {row.cancelReason}</p>}

          <Field label="Note interne" htmlFor={`bn-${row.id}`} hint="Référence chez le fournisseur, remarque… Le client ne la voit pas." optional>
            <Textarea id={`bn-${row.id}`} rows={2} maxLength={500} className="min-h-16 sm:min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {cancelling ? (
            <div className="space-y-3 rounded-lg border border-clay/30 bg-clay-soft/40 p-3.5">
              <Field label="Motif envoyé au client" htmlFor={`bc-${row.id}`} hint="Un remboursement du montant payé sera ouvert dans Paiements.">
                <Textarea id={`bc-${row.id}`} rows={2} maxLength={300} className="min-h-16 sm:min-h-16" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compte privé, lien introuvable…" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setCancelling(false)}>Retour</Button>
                <Button type="button" variant="danger" disabled={busy || reason.trim().length < 3} onClick={() => run(() => updateBoostAction(row.id, "CANCELLED", note, reason), "Commande annulée. Remboursement à traiter.")}>Annuler la commande</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {can("CANCELLED") && <Button type="button" variant="danger-outline" disabled={busy} className="mr-auto" onClick={() => setCancelling(true)}>Annuler…</Button>}
              {!actionable && <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>}
              {(note.trim() || null) !== row.staffNote && <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => saveBoostNoteAction(row.id, note), "Note enregistrée.")}>Enregistrer la note</Button>}
              {can("IN_PROGRESS") && <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => updateBoostAction(row.id, "IN_PROGRESS", note, ""), "Commande marquée en cours.")}>En cours</Button>}
              {can("DELIVERED") && <Button type="button" disabled={busy} onClick={() => run(() => updateBoostAction(row.id, "DELIVERED", note, ""), "Commande livrée. Le client est prévenu.")}><Check />Livrée</Button>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type BoostProductForm = { id: string; platform: PlatformCode; kind: BoostKindCode; pricePer1000: number; minQuantity: number; maxQuantity: number; packs: BoostPack[]; delay: string; active: boolean };

/** Tarifs d'un produit : prix pour 1 000, quantités minimale et maximale, packs à prix fixe. */
export function BoostProductDialog({ product }: { product: BoostProductForm }) {
  const [open, setOpen] = React.useState(false);
  const nextKey = React.useRef(product.packs.length);
  const initial = () => product.packs.map((p, i) => ({ key: i, quantity: String(p.quantity), price: String(p.price) }));
  const [packs, setPacks] = React.useState(initial);
  const meta = BOOST_KINDS[product.kind];
  const title = `${meta.label} ${PLATFORMS[product.platform].label}`;
  const set = (key: number, patch: { quantity?: string; price?: string }) => setPacks((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setPacks(initial()); nextKey.current = product.packs.length; } }}>
      <DialogTrigger asChild><Button variant="ghost" size="sm"><Pencil />Modifier</Button></DialogTrigger>
      <DialogContent title={title} description="Les commandes déjà passées gardent leur prix.">
        <ActionForm action={saveBoostProductAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="id" value={product.id} />

          <fieldset>
            <legend className="mb-1.5 text-[0.84375rem] font-medium text-ink">Packs à prix fixe</legend>
            {packs.length > 0 && <div aria-hidden className="mb-1 flex gap-2 pr-11 text-xs text-muted sm:pr-12"><span className="flex-1">Quantité</span><span className="flex-1">Prix (F CFA)</span></div>}
            <div className="space-y-2">
              {packs.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <Input name="packQuantity" type="number" inputMode="numeric" min={1} step={1} className="tnum" placeholder="Quantité" aria-label={`Quantité de ${meta.many}`} value={p.quantity} onChange={(e) => set(p.key, { quantity: e.target.value })} />
                  <Input name="packPrice" type="number" inputMode="numeric" min={BOOST_MIN_PRICE} step={5} className="tnum" placeholder="Prix (F CFA)" aria-label="Prix du pack en F CFA" value={p.price} onChange={(e) => set(p.key, { price: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Retirer ce pack" onClick={() => setPacks((list) => list.filter((x) => x.key !== p.key))}><Trash2 /></Button>
                </div>
              ))}
              {packs.length === 0 && <p className="rounded-md bg-sand px-3 py-2.5 text-[0.8125rem] text-ink-soft">Aucun pack : le client saisit lui-même la quantité.</p>}
            </div>
            {packs.length < BOOST_MAX_PACKS && (
              <Button type="button" variant="outline" size="sm" className="mt-2.5" onClick={() => setPacks((list) => [...list, { key: nextKey.current++, quantity: "", price: "" }])}><Plus />Ajouter un pack</Button>
            )}
          </fieldset>

          <fieldset className="space-y-4 border-t border-line pt-4">
            <legend className="sr-only">Autre quantité</legend>
            <Field label="Prix pour 1 000 (F CFA)" htmlFor="bp-price" hint="Appliqué quand le client choisit « autre quantité »."><Input id="bp-price" name="pricePer1000" type="number" inputMode="numeric" min={1} step={1} required className="tnum" defaultValue={product.pricePer1000} /><FieldError name="pricePer1000" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantité minimale" htmlFor="bp-min"><Input id="bp-min" name="minQuantity" type="number" inputMode="numeric" min={1} step={1} required className="tnum" defaultValue={product.minQuantity} /><FieldError name="minQuantity" /></Field>
              <Field label="Quantité maximale" htmlFor="bp-max"><Input id="bp-max" name="maxQuantity" type="number" inputMode="numeric" min={1} step={1} required className="tnum" defaultValue={product.maxQuantity} /><FieldError name="maxQuantity" /></Field>
            </div>
            <Field label="Délai de livraison annoncé" htmlFor="bp-delay" hint="Affiché après « Livraison sous »." optional><Input id="bp-delay" name="delay" maxLength={60} placeholder="24 à 72 heures" defaultValue={product.delay} /></Field>
          </fieldset>

          <ToggleRow label="Proposé aux clients" htmlFor="bp-active"><Switch id="bp-active" name="active" defaultChecked={product.active} /></ToggleRow>
          <p className="text-xs text-muted">Montant minimal d&apos;une commande : {formatFcfa(BOOST_MIN_PRICE)}.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button><SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton></div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
