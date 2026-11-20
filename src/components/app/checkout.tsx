"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, FlaskConical, LoaderCircle, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { OperatorChip } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { formatPhone, groupDigits, guessBeninOperator, normalizeBeninPhone, type OperatorCode } from "@/lib/phone";
import { cn, formatFcfa } from "@/lib/utils";
import { applyPromoAction, cancelOrderAction, startPaymentAction } from "@/server/actions/payments";

type Operator = { code: OperatorCode; label: string; ussdHint: string };
export type OpenPayment = { id: string; operator: OperatorCode; phone: string; expiresAt: string; redirectUrl: string | null };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/**
 * Paiement en un geste : le numéro est déjà rempli, l'opérateur est reconnu d'après le numéro, il reste à toucher « Payer ».
 * La confirmation se fait sur le téléphone du client, avec son code secret : aucune seconde confirmation à l'écran.
 */
export function Checkout({ orderId, total, operators, defaultPhone, testNotice, testNumbers, testRefused = false, providerLabel, open, lastFailure, promoCode, canCancel, allowPromo = true, children }: {
  orderId: string; total: number; operators: Operator[]; defaultPhone: string; open: OpenPayment | null; lastFailure: string | null; promoCode: string | null; canCancel: boolean;
  /** Hors mode réel : rappel qu'aucun argent ne circule, avec les numéros à essayer. */
  testNotice: string | null;
  /** En mode test, seuls numéros (8 chiffres) que le prestataire accepte. null : pas de liste imposée. */
  testNumbers: string[] | null;
  /** La dernière tentative a été refusée parce que son numéro n'était pas un numéro d'essai. */
  testRefused?: boolean;
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
  /** Tentative dont la demande n'a pas pu partir sur le téléphone : le client doit passer par la page du prestataire. */
  const [notPushed, setNotPushed] = React.useState<string | null>(null);
  const [promo, setPromo] = React.useState(promoCode ?? "");
  const key = React.useRef(newKey());
  const normalized = normalizeBeninPhone(phone);
  const testList = testNumbers?.map(groupDigits).join(" ou ") ?? "";
  /** Mode test : le numéro saisi n'est pas un numéro d'essai, le prestataire le refusera d'office. */
  const willBeRefused = Boolean(testNumbers && normalized && !testNumbers.includes(normalized.national.slice(-8)));

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
    if (!res.ok) { setError(res.error); key.current = newKey(); router.refresh(); return; }
    const started = res.data as { paymentId: string; redirectUrl: string | null; pushed: boolean; expiresAt: string };
    if (!started.pushed) setNotPushed(started.paymentId);
    setPending({ id: started.paymentId, operator, phone: normalized.e164, expiresAt: started.expiresAt, redirectUrl: started.redirectUrl });
    router.refresh();
  }

  if (pending) return <Waiting payment={pending} operators={operators} testMode={Boolean(testNotice)} providerLabel={providerLabel} pushed={pending.id !== notPushed} onDone={() => { key.current = newKey(); setPending(null); if (testNumbers?.[0] && willBeRefused) setPhone(groupDigits(testNumbers[0])); router.refresh(); }} />;

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

      {error ? <Notice tone="danger" title="Le paiement n'a pas abouti">{error} Rien n&apos;a été encaissé. Réessayez.</Notice>
        : testRefused ? <Notice tone="warn" title="Numéro refusé : le paiement est en mode test">En mode test, {providerLabel} refuse d&apos;office tout numéro autre que {testList}. Ce n&apos;est pas une panne. Reprenez avec un numéro d&apos;essai.</Notice>
        : lastFailure ? <Notice tone="danger" title="Le paiement n'a pas abouti">{lastFailure} Rien n&apos;a été encaissé. Réessayez.</Notice> : null}

      <div className="space-y-4 rounded-[22px] border border-line/70 bg-surface p-4 shadow-card sm:rounded-[28px] sm:p-6">
        {testNotice && (
          <div className="rounded-xl bg-marigold-soft px-3.5 py-3 text-[0.8125rem] text-ink-soft">
            <p className="flex items-center gap-2 font-semibold text-ink"><FlaskConical className="size-4 shrink-0" />Mode test : aucun argent n&apos;est débité</p>
            {testNumbers ? (
              <>
                <p className="mt-1.5">{providerLabel} n&apos;accepte que ses numéros d&apos;essai. Tout autre numéro, même le vôtre, est refusé.</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {testNumbers.map((n) => (
                    <button key={n} type="button" onClick={() => setPhone(groupDigits(n))} aria-pressed={normalized?.national.slice(-8) === n}
                      className={cn("tnum rounded-full border bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-ink transition-colors", normalized?.national.slice(-8) === n ? "border-green shadow-[0_0_0_1px_var(--color-green)]" : "border-line-strong hover:border-green")}>
                      {groupDigits(n)}
                    </button>
                  ))}
                </div>
              </>
            ) : <p className="mt-1.5">{testNotice}</p>}
          </div>
        )}

        <Field label={testNumbers ? "Numéro d'essai" : "Votre numéro Mobile Money"} htmlFor="pay-phone" hint={willBeRefused ? undefined : normalized ? formatPhone(normalized.e164) : "10 chiffres"}
          error={phone.replace(/\D/g, "").length >= 10 && !normalized ? "Numéro béninois invalide." : willBeRefused ? `Ce numéro sera refusé : en mode test, seuls ${testList} passent.` : undefined}>
          <Input id="pay-phone" type="tel" inputMode="tel" autoComplete={testNumbers ? "off" : "tel"} className="tnum text-base" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 97 00 00 00" />
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
        {testNotice
          ? <p className="flex items-start gap-2 text-xs text-muted"><FlaskConical className="mt-px size-4 shrink-0" />Rien n&apos;arrive sur le téléphone en mode test : le résultat s&apos;affiche ici en quelques secondes.</p>
          : <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-px size-4 shrink-0 text-green" />Vous validez ensuite sur votre téléphone avec votre code secret. Nous ne le voyons jamais.</p>}
      </div>

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

function Waiting({ payment, operators, testMode, providerLabel, pushed, onDone }: { payment: OpenPayment; operators: Operator[]; testMode: boolean; providerLabel: string; pushed: boolean; onDone: () => void }) {
  const router = useRouter();
  // Temps restant, recalculé d'après l'échéance (et non décompté) : il reste juste si l'onglet a dormi.
  const remaining = React.useCallback(() => Math.max(0, Math.round((Date.parse(payment.expiresAt) - Date.now()) / 1000)), [payment.expiresAt]);
  const [left, setLeft] = React.useState<number | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const done = React.useRef(false);
  const op = operators.find((o) => o.code === payment.operator);
  const mustUsePage = !pushed && Boolean(payment.redirectUrl);

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
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-marigold-soft text-marigold-600"><Smartphone className="size-6" /></span>
      {mustUsePage ? (
        <>
          <h2 className="mt-4 text-xl font-semibold">Terminez sur la page de paiement</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">La demande n&apos;a pas pu être envoyée sur votre téléphone. Payez sur la page sécurisée de {providerLabel} : c&apos;est la même commande, vous ne serez pas débité deux fois.</p>
          <Button asChild variant="accent" size="lg" className="mt-5"><a href={payment.redirectUrl!}>Ouvrir la page de paiement <ArrowRight /></a></Button>
        </>
      ) : (
        <>
          <h2 className="mt-4 text-xl font-semibold">{testMode ? "Paiement d'essai en cours" : "Validez sur votre téléphone"}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted"><span className="tnum font-medium text-ink">{formatPhone(payment.phone)}</span>{op ? ` · ${op.label}` : ""}. {testMode ? "Rien n'arrive sur le téléphone en mode test : le résultat s'affiche ici tout seul." : op?.ussdHint}</p>
        </>
      )}
      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-[0.8125rem] text-ink-soft">
        <LoaderCircle className="size-4 animate-spin" />En attente
        {left !== null && left > 0 && <span className="tnum text-muted">· {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
      </p>
      {offline && <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.8125rem] text-clay"><CircleAlert className="size-4" />Connexion instable. Nouvel essai automatique.</p>}
      {testMode && mustUsePage && <p className="mt-3 text-xs text-muted">Mode test : aucun débit réel.</p>}
      <div className="mt-5 flex flex-col items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={checking} onClick={check}><RefreshCw className={checking ? "animate-spin" : ""} />Vérifier</Button>
        {!mustUsePage && payment.redirectUrl && (
          <p className="mt-2 max-w-sm text-[0.8125rem] text-muted">{testMode ? "Autre façon d'essayer :" : "Rien reçu sur votre téléphone ?"}{" "}
            <a href={payment.redirectUrl} className="font-medium text-green underline-offset-4 hover:underline">Payer sur la page {providerLabel}</a>
          </p>
        )}
      </div>
      <p className="mx-auto mt-5 max-w-sm text-xs text-muted">Vous pouvez fermer cette page : vous serez prévenu.</p>
    </div>
  );
}
