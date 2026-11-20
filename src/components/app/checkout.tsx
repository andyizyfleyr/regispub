"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, LoaderCircle, Lock, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { OperatorChip } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { formatPhone, guessBeninOperator, normalizeBeninPhone, type OperatorCode } from "@/lib/phone";
import { cn, formatFcfa } from "@/lib/utils";
import { applyPromoAction, cancelOrderAction, startPaymentAction } from "@/server/actions/payments";

type Operator = { code: OperatorCode; label: string; ussdHint: string };
export type OpenPayment = { id: string; operator: OperatorCode | null; phone: string | null; expiresAt: string; redirectUrl: string | null };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/**
 * Règlement d'une commande.
 * - Prestataire avec sa propre page de paiement (FedaPay) : un seul bouton. Le client est envoyé sur cette page, qui lui
 *   demande son moyen de paiement et son numéro, puis il revient ici. Nous n'affichons ni numéro ni opérateur.
 * - Simulateur : le numéro et l'opérateur sont saisis ici.
 * Dans les deux cas, l'état « payé » vient du serveur, qui le vérifie auprès du prestataire.
 */
export function Checkout({ orderId, total, operators, hosted, defaultPhone, testNotice, providerLabel, open, lastFailure, promoCode, canCancel, allowPromo = true, children }: {
  orderId: string; total: number; operators: Operator[]; defaultPhone: string; open: OpenPayment | null; lastFailure: string | null; promoCode: string | null; canCancel: boolean;
  /** true : le client paie sur la page du prestataire. */
  hosted: boolean;
  /** Simulateur : rappel qu'aucun argent ne circule, avec les numéros à essayer. */
  testNotice: string | null;
  /** Nom du prestataire, pour désigner sa page de paiement. */
  providerLabel: string;
  /** Les codes promo portent sur les frais de prestation d'une publicité : ils ne s'appliquent pas aux achats d'abonnés ou de J'aime. */
  allowPromo?: boolean;
  /** Détail du prix, affiché sous le bouton de paiement. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [operator, setOperator] = React.useState<OperatorCode | null>(null);
  const [phone, setPhone] = React.useState(defaultPhone);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<OpenPayment | null>(open);
  const [promo, setPromo] = React.useState(promoCode ?? "");
  const key = React.useRef(newKey());
  const normalized = normalizeBeninPhone(phone);

  React.useEffect(() => { setPending(open); }, [open]);
  React.useEffect(() => {
    // Suggestion de l'opérateur à partir du préfixe : jamais bloquante, l'utilisateur peut choisir autre chose.
    if (hosted || touched || !normalized) return;
    const guess = guessBeninOperator(normalized.national);
    if (guess && operators.some((o) => o.code === guess)) setOperator(guess);
  }, [normalized?.national, touched]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    // Retour arrière depuis la page du prestataire : le navigateur ressort la page telle qu'elle était au départ.
    const back = (e: PageTransitionEvent) => { if (e.persisted) { setBusy(false); router.refresh(); } };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, [router]);

  async function pay() {
    if (!hosted && (!operator || !normalized)) return;
    setBusy(true);
    setError(null);
    const res = await startPaymentAction(hosted ? { orderId, idempotencyKey: key.current } : { orderId, operator, phone, idempotencyKey: key.current });
    if (!res.ok) { setBusy(false); setError(res.error); key.current = newKey(); router.refresh(); return; }
    const started = res.data as { paymentId: string; redirectUrl: string | null; expiresAt: string };
    if (hosted && started.redirectUrl) { window.location.assign(started.redirectUrl); return; } // le bouton reste occupé pendant le départ
    setBusy(false);
    if (!hosted && normalized) setPending({ id: started.paymentId, operator, phone: normalized.e164, expiresAt: started.expiresAt, redirectUrl: null });
    router.refresh();
  }

  if (pending) return <Waiting payment={pending} operators={operators} hosted={hosted} simulated={Boolean(testNotice)} onDone={() => { key.current = newKey(); setPending(null); router.refresh(); }} />;

  return (
    <div className="space-y-4">
      <div className="bg-brand relative overflow-hidden rounded-[22px] px-4 py-4 text-white shadow-lift sm:rounded-[28px] sm:px-6 sm:py-5">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-white/70">Total à payer</p>
            <p className="tnum font-display text-[1.875rem] font-semibold leading-none sm:text-[2.25rem]">{formatFcfa(total)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">{operators.map((o) => <OperatorChip key={o.code} operator={o.code} />)}</div>
        </div>
      </div>

      {(error ?? lastFailure) && <Notice tone="danger" title="Le paiement n'a pas abouti">{error ?? lastFailure} Rien n&apos;a été encaissé. Réessayez.</Notice>}

      {hosted ? (
        <div className="space-y-3 rounded-[22px] border border-line/70 bg-surface p-4 shadow-card sm:rounded-[28px] sm:p-6">
          <Button type="button" size="lg" variant="accent" className="w-full" disabled={busy} aria-busy={busy} onClick={pay}>
            {busy ? <LoaderCircle className="animate-spin" /> : null}{busy ? "Ouverture de la page de paiement…" : <>Payer {formatFcfa(total)} <ArrowRight /></>}
          </Button>
          <p className="flex items-start gap-2 text-xs text-muted"><Lock className="mt-px size-4 shrink-0 text-green" />Vous payez sur la page sécurisée de {providerLabel}, puis vous revenez ici.</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-[22px] border border-line/70 bg-surface p-4 shadow-card sm:rounded-[28px] sm:p-6">
          <Field label="Votre numéro Mobile Money" htmlFor="pay-phone" hint={normalized ? formatPhone(normalized.e164) : "10 chiffres"} error={phone.replace(/\D/g, "").length >= 10 && !normalized ? "Numéro béninois invalide." : undefined}>
            <Input id="pay-phone" type="tel" inputMode="tel" autoComplete="tel" className="tnum text-base" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 97 00 00 00" />
          </Field>

          <fieldset>
            <legend className="mb-2 text-[0.84375rem] font-medium text-ink">Opérateur</legend>
            <div className="grid grid-cols-3 gap-2">
              {operators.map((o) => (
                <button key={o.code} type="button" aria-pressed={operator === o.code} onClick={() => { setOperator(o.code); setTouched(true); }}
                  className={cn("flex flex-col items-center gap-1.5 rounded-xl border bg-surface px-1.5 py-2.5 text-center transition-[border-color,box-shadow,background-color]", operator === o.code ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line hover:border-line-strong")}>
                  <OperatorChip operator={o.code} />
                  <span className="text-[0.75rem] font-medium leading-tight text-ink">{o.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Button type="button" size="lg" variant="accent" className="w-full" disabled={!operator || !normalized || busy} aria-busy={busy} onClick={pay}>
            {busy ? <LoaderCircle className="animate-spin" /> : null}{busy ? "Envoi…" : <>Payer {formatFcfa(total)} <ArrowRight /></>}
          </Button>
          <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-px size-4 shrink-0 text-green" />Vous validez ensuite sur votre téléphone avec votre code secret. Nous ne le voyons jamais.</p>
          {testNotice && <p className="rounded-md bg-marigold-soft px-3 py-2 text-xs text-ink-soft">{testNotice}</p>}
        </div>
      )}

      {children}

      {allowPromo && (
        <details className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink-soft">Code promo</summary>
          <div className="mt-3 flex gap-2">
            <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="uppercase" placeholder="CODE" maxLength={30} aria-label="Code promotionnel" />
            <Button type="button" variant="outline" onClick={async () => { const res = await applyPromoAction(orderId, promo); if (!res.ok) toast.error(res.error); else { toast.success(promo ? "Code appliqué." : "Code retiré."); router.refresh(); } }}>Appliquer</Button>
          </div>
        </details>
      )}
      {canCancel && (
        <button type="button" className="text-[0.8125rem] text-muted underline-offset-4 hover:text-clay hover:underline" onClick={async () => { if (!window.confirm("Annuler cette commande ?")) return; const res = await cancelOrderAction(orderId); if (!res.ok) toast.error(res.error); else { toast.success("Commande annulée."); router.push("/app/paiements"); router.refresh(); } }}>
          Annuler la commande
        </button>
      )}
    </div>
  );
}

/** Tentative en cours : la page interroge le serveur jusqu'à ce que le prestataire ait tranché. */
function Waiting({ payment, operators, hosted, simulated, onDone }: { payment: OpenPayment; operators: Operator[]; hosted: boolean; simulated: boolean; onDone: () => void }) {
  const router = useRouter();
  // Temps restant, recalculé d'après l'échéance (et non décompté) : il reste juste si l'onglet a dormi.
  const remaining = React.useCallback(() => Math.max(0, Math.round((Date.parse(payment.expiresAt) - Date.now()) / 1000)), [payment.expiresAt]);
  const [left, setLeft] = React.useState<number | null>(null);
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
    setLeft(remaining());
    const tick = setInterval(() => setLeft(remaining()), 1000);
    const first = setTimeout(check, 1500);
    return () => { clearInterval(poll); clearInterval(tick); clearTimeout(first); };
  }, [check, remaining]);

  return (
    <div className="rounded-lg border border-line-strong bg-surface p-6 text-center" role="status" aria-live="polite">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-marigold-soft text-marigold-600">{hosted ? <Lock className="size-6" /> : <Smartphone className="size-6" />}</span>
      {hosted ? (
        <>
          <h2 className="mt-4 text-xl font-semibold">Paiement en attente</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Si vous avez terminé sur la page de paiement, la confirmation s&apos;affiche ici toute seule. Sinon, reprenez le paiement.</p>
          {payment.redirectUrl && <Button asChild variant="accent" size="lg" className="mt-5"><a href={payment.redirectUrl}>Reprendre le paiement <ArrowRight /></a></Button>}
        </>
      ) : (
        <>
          <h2 className="mt-4 text-xl font-semibold">Validez sur votre téléphone</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{payment.phone && <span className="tnum font-medium text-ink">{formatPhone(payment.phone)}</span>}{op ? ` · ${op.label}` : ""}. {op?.ussdHint}</p>
        </>
      )}
      <div className="mt-5">
        <p className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-[0.8125rem] text-ink-soft">
          <LoaderCircle className="size-4 animate-spin" />En attente
          {left !== null && left > 0 && <span className="tnum text-muted">· {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
        </p>
      </div>
      {offline && <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.8125rem] text-clay"><CircleAlert className="size-4" />Connexion instable. Nouvel essai automatique.</p>}
      {simulated && <p className="mt-3 text-xs text-muted">Simulation : aucun débit réel.</p>}
      <div className="mt-5 flex flex-col items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={checking} onClick={check}><RefreshCw className={checking ? "animate-spin" : ""} />Vérifier</Button>
      </div>
      <p className="mx-auto mt-5 max-w-sm text-xs text-muted">Vous pouvez fermer cette page : vous serez prévenu.</p>
    </div>
  );
}
