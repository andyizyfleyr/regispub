"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, LoaderCircle, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { OperatorChip } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { formatPhone, guessBeninOperator, normalizeBeninPhone, type OperatorCode } from "@/lib/phone";
import { cn, formatFcfa } from "@/lib/utils";
import { applyPromoAction, cancelOrderAction, startPaymentAction } from "@/server/actions/payments";

type Operator = { code: OperatorCode; label: string; ussdHint: string };
export type OpenPayment = { id: string; operator: OperatorCode; phone: string; expiresAt: string; redirectUrl: string | null };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/** Parcours de paiement : opérateur → numéro → confirmation → attente de la validation sur le téléphone. */
export function Checkout({ orderId, total, operators, defaultPhone, simulation, open, lastFailure, promoCode, canCancel }: {
  orderId: string; total: number; operators: Operator[]; defaultPhone: string; simulation: boolean; open: OpenPayment | null; lastFailure: string | null; promoCode: string | null; canCancel: boolean;
}) {
  const router = useRouter();
  const [operator, setOperator] = React.useState<OperatorCode | null>(null);
  const [phone, setPhone] = React.useState(defaultPhone);
  const [touched, setTouched] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<OpenPayment | null>(open);
  const [promo, setPromo] = React.useState(promoCode ?? "");
  const key = React.useRef(newKey());
  const normalized = normalizeBeninPhone(phone);

  React.useEffect(() => { setPending(open); }, [open]);
  React.useEffect(() => {
    // Suggestion de l'opérateur à partir du préfixe : jamais bloquante, l'utilisateur peut choisir autre chose.
    if (touched || !normalized) return;
    const guess = guessBeninOperator(normalized.national);
    if (guess && operators.some((o) => o.code === guess)) setOperator(guess);
  }, [normalized?.national, touched]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pay() {
    if (!operator || !normalized) return;
    setBusy(true);
    setError(null);
    const res = await startPaymentAction({ orderId, operator, phone, idempotencyKey: key.current });
    setBusy(false);
    setConfirm(false);
    if (!res.ok) { setError(res.error); key.current = newKey(); router.refresh(); return; }
    const redirectUrl = res.data.redirectUrl as string | null;
    if (redirectUrl) { window.location.assign(redirectUrl); return; }
    setPending({ id: res.data.paymentId as string, operator, phone: normalized.e164, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), redirectUrl: null });
    router.refresh();
  }

  if (pending) return <Waiting payment={pending} operators={operators} simulation={simulation} onDone={() => { key.current = newKey(); setPending(null); router.refresh(); }} />;

  return (
    <div className="space-y-5">
      {simulation && <Notice tone="warn" title="Mode simulation">Aucun prestataire de paiement réel n&apos;est branché : aucun débit ne sera effectué. Numéro se terminant par 00 = paiement refusé, par 99 = sans réponse, sinon accepté après quelques secondes.</Notice>}
      {(error ?? lastFailure) && <Notice tone="danger" title="Le paiement n'a pas abouti">{error ?? lastFailure} Vous pouvez réessayer ; aucun montant n&apos;a été encaissé pour cette tentative.</Notice>}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-soft">1. Votre opérateur Mobile Money</legend>
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {operators.map((o) => (
            <button key={o.code} type="button" aria-pressed={operator === o.code} onClick={() => { setOperator(o.code); setTouched(true); }}
              className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", operator === o.code ? "bg-green-soft/50" : "hover:bg-paper")}>
              <OperatorChip operator={o.code} />
              <span className="flex-1 text-sm font-medium text-ink">{o.label}</span>
              <span aria-hidden className={cn("flex size-5 items-center justify-center rounded-full border", operator === o.code ? "border-green bg-green" : "border-line-strong")}>{operator === o.code && <span className="size-2 rounded-full bg-white" />}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="2. Numéro à débiter" htmlFor="pay-phone" hint={normalized ? `Numéro reconnu : ${formatPhone(normalized.e164)}` : "Numéro béninois à 10 chiffres, par exemple 01 97 00 00 00."} error={phone.replace(/\D/g, "").length >= 10 && !normalized ? "Ce numéro n'est pas un numéro béninois valide." : undefined}>
        <Input id="pay-phone" type="tel" inputMode="tel" autoComplete="tel" className="tnum text-base" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 97 00 00 00" />
      </Field>

      <Button type="button" size="lg" variant="accent" className="w-full" disabled={!operator || !normalized} onClick={() => setConfirm(true)}>Payer {formatFcfa(total)} <ArrowRight /></Button>
      <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-px size-4 shrink-0 text-green" />Votre commande n&apos;est validée qu&apos;après confirmation du paiement par l&apos;opérateur. Nous ne conservons ni code secret ni donnée bancaire.</p>

      <details className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink-soft">J&apos;ai un code promotionnel</summary>
        <div className="mt-3 flex gap-2">
          <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="uppercase" placeholder="CODE" maxLength={30} aria-label="Code promotionnel" />
          <Button type="button" variant="outline" onClick={async () => { const res = await applyPromoAction(orderId, promo); if (!res.ok) toast.error(res.error); else { toast.success(promo ? "Code appliqué." : "Code retiré."); router.refresh(); } }}>Appliquer</Button>
        </div>
      </details>
      {canCancel && (
        <button type="button" className="text-[13px] text-muted underline-offset-4 hover:text-clay hover:underline" onClick={async () => { if (!window.confirm("Annuler cette commande ?")) return; const res = await cancelOrderAction(orderId); if (!res.ok) toast.error(res.error); else { toast.success("Commande annulée."); router.push("/app/paiements"); router.refresh(); } }}>
          Annuler cette commande
        </button>
      )}

      <Dialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <DialogContent title="Confirmer le paiement" description="Vérifiez le numéro avant de valider." side="bottom">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><dt className="text-muted">Montant</dt><dd className="tnum font-display text-2xl font-semibold">{formatFcfa(total)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted">Opérateur</dt><dd className="flex items-center gap-2 font-medium">{operator && <OperatorChip operator={operator} />}{operators.find((o) => o.code === operator)?.label}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted">Numéro débité</dt><dd className="tnum font-medium">{normalized ? formatPhone(normalized.e164) : ""}</dd></div>
          </dl>
          <p className="mt-4 rounded-md bg-sand px-3 py-2.5 text-[13px] text-ink-soft">Après validation, une demande de paiement s&apos;affiche sur votre téléphone. Saisissez votre code secret Mobile Money pour l&apos;approuver.</p>
          <div className="mt-5 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => setConfirm(false)}>Modifier</Button>
            <Button type="button" variant="accent" className="flex-1" disabled={busy} onClick={pay}>{busy && <LoaderCircle className="animate-spin" />}{busy ? "Envoi…" : "Confirmer et payer"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Waiting({ payment, operators, simulation, onDone }: { payment: OpenPayment; operators: Operator[]; simulation: boolean; onDone: () => void }) {
  const router = useRouter();
  const [left, setLeft] = React.useState(() => Math.max(0, Math.round((Date.parse(payment.expiresAt) - Date.now()) / 1000)));
  const [checking, setChecking] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const done = React.useRef(false);
  const op = operators.find((o) => o.code === payment.operator);

  const check = React.useCallback(async () => {
    if (done.current) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}`, { cache: "no-store" });
      setOffline(false);
      if (res.ok) {
        // La réponse ne fait que refléter l'état vérifié par le serveur auprès du prestataire.
        const json = (await res.json()) as { status: string };
        if (json.status !== "PENDING" && json.status !== "INITIATED") { done.current = true; if (json.status === "SUCCEEDED") router.refresh(); onDone(); }
      }
    } catch { setOffline(true); }
    setChecking(false);
  }, [payment.id, onDone, router]);

  React.useEffect(() => {
    const poll = setInterval(check, 4000);
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const first = setTimeout(check, 1500);
    return () => { clearInterval(poll); clearInterval(tick); clearTimeout(first); };
  }, [check]);

  return (
    <div className="rounded-lg border border-line-strong bg-surface p-6 text-center" role="status" aria-live="polite">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-marigold-soft text-marigold-600"><Smartphone className="size-6" /></span>
      <h2 className="mt-4 text-xl font-semibold">Validez le paiement sur votre téléphone</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Une demande a été envoyée au <span className="tnum font-medium text-ink">{formatPhone(payment.phone)}</span>{op ? ` (${op.label})` : ""}. {op?.ussdHint}</p>
      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-[13px] text-ink-soft">
        <LoaderCircle className="size-4 animate-spin" />En attente de confirmation
        {left > 0 && <span className="tnum text-muted">· {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
      </p>
      {offline && <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-clay"><CircleAlert className="size-4" />Connexion instable : la vérification reprendra automatiquement.</p>}
      {simulation && <p className="mt-3 text-xs text-muted">Mode simulation : la réponse arrive automatiquement en quelques secondes.</p>}
      <div className="mt-5 flex flex-col items-center gap-2">
        {payment.redirectUrl && <Button asChild variant="accent"><a href={payment.redirectUrl}>Ouvrir la page de paiement</a></Button>}
        <Button type="button" variant="outline" size="sm" disabled={checking} onClick={check}><RefreshCw className={checking ? "animate-spin" : ""} />Vérifier maintenant</Button>
      </div>
      <p className="mx-auto mt-5 max-w-sm text-xs text-muted">Vous pouvez fermer cette page : si le paiement est validé, votre commande sera confirmée automatiquement et vous recevrez une notification.</p>
    </div>
  );
}
