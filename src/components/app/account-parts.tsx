"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SECTORS, TARGET_COUNTRIES } from "@/lib/catalog/targeting";
import { formatFcfa } from "@/lib/utils";
import { saveBusinessAction } from "@/server/actions/account";
import { redeemLoyaltyAction } from "@/server/actions/payments";

export type BusinessData = { id: string; name: string; sector: string; description: string | null; country: string; city: string | null; whatsapp: string | null; facebookUrl: string | null; instagramUrl: string | null; tiktokUrl: string | null; website: string | null };

export function BusinessDialog({ business }: { business?: BusinessData }) {
  const [open, setOpen] = React.useState(false);
  const b = business;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{b ? <Button variant="ghost" size="sm"><Pencil />Modifier</Button> : <Button size="sm"><Plus />Ajouter une entreprise</Button>}</DialogTrigger>
      <DialogContent title={b ? "Modifier l'entreprise" : "Nouvelle entreprise"} description="Ces informations servent à préparer vos campagnes et à personnaliser l'assistant.">
        <ActionForm action={saveBusinessAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {b && <input type="hidden" name="id" value={b.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" htmlFor="b-name"><Input id="b-name" name="name" required maxLength={80} defaultValue={b?.name} /><FieldError name="name" /></Field>
            <Field label="Secteur" htmlFor="b-sector"><Select id="b-sector" name="sector" required defaultValue={b?.sector ?? ""}><option value="" disabled>Choisir…</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</Select><FieldError name="sector" /></Field>
            <Field label="Pays" htmlFor="b-country"><Select id="b-country" name="country" defaultValue={b?.country ?? "BJ"}>{TARGET_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select></Field>
            <Field label="Ville" htmlFor="b-city" optional><Input id="b-city" name="city" maxLength={60} defaultValue={b?.city ?? ""} placeholder="Cotonou" /></Field>
          </div>
          <Field label="Description" htmlFor="b-desc" optional><Textarea id="b-desc" name="description" rows={3} maxLength={1000} defaultValue={b?.description ?? ""} placeholder="Ce que vous vendez, à qui, ce qui vous distingue." /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp professionnel" htmlFor="b-wa" optional><Input id="b-wa" name="whatsapp" type="tel" inputMode="tel" defaultValue={b?.whatsapp ?? ""} placeholder="01 97 00 00 00" /><FieldError name="whatsapp" /></Field>
            <Field label="Site web" htmlFor="b-web" optional><Input id="b-web" name="website" type="url" defaultValue={b?.website ?? ""} placeholder="https://" /><FieldError name="website" /></Field>
            <Field label="Page Facebook" htmlFor="b-fb" optional><Input id="b-fb" name="facebookUrl" type="url" defaultValue={b?.facebookUrl ?? ""} placeholder="https://facebook.com/…" /><FieldError name="facebookUrl" /></Field>
            <Field label="Compte Instagram" htmlFor="b-ig" optional><Input id="b-ig" name="instagramUrl" type="url" defaultValue={b?.instagramUrl ?? ""} placeholder="https://instagram.com/…" /><FieldError name="instagramUrl" /></Field>
            <Field label="Compte TikTok" htmlFor="b-tt" optional><Input id="b-tt" name="tiktokUrl" type="url" defaultValue={b?.tiktokUrl ?? ""} placeholder="https://tiktok.com/@…" /><FieldError name="tiktokUrl" /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button><SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton></div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-paper py-1.5 pl-3 pr-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[13px]" aria-label={label}>{value}</span>
      <Button type="button" variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error("Copie impossible sur cet appareil."); } }}>
        {done ? <Check /> : <Copy />}{done ? "Copié" : "Copier"}
      </Button>
    </div>
  );
}

export function RedeemPoints({ balance, min, pointValue }: { balance: number; min: number; pointValue: number }) {
  const router = useRouter();
  const [points, setPoints] = React.useState(String(Math.max(min, Math.min(balance, min))));
  const [busy, setBusy] = React.useState(false);
  const n = Math.floor(Number(points)) || 0;
  if (balance < min) return <p className="text-[13px] text-muted">Conversion possible à partir de <span className="tnum">{min}</span> points ({formatFcfa(min * pointValue)}).</p>;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Points à convertir" htmlFor="redeem" className="w-40" hint={n >= min ? `= bon de ${formatFcfa(n * pointValue)}` : `Minimum ${min}`}>
        <Input id="redeem" type="number" inputMode="numeric" min={min} max={balance} step={1} className="tnum" value={points} onChange={(e) => setPoints(e.target.value)} />
      </Field>
      <Button className="mb-6" disabled={busy || n < min || n > balance} onClick={async () => {
        setBusy(true);
        const res = await redeemLoyaltyAction(n);
        setBusy(false);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(`Bon ${res.data.code} créé : ${formatFcfa(res.data.value)} sur vos prochains frais de prestation.`);
        router.refresh();
      }}>Convertir en bon d&apos;achat</Button>
    </div>
  );
}
