"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, Lock, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PlatformBadge } from "@/components/icons";
import { ToneIcon } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { ACCESS_STATE_META, accountNoun, inviteNeedsCode, inviteSteps, inviteTitle, METHOD_LABELS, type AccessMethod, type AccessState } from "@/lib/catalog/access";
import { PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { cn } from "@/lib/utils";
import { giveAccessAction, removeAccessAction } from "@/server/actions/access";

export type AccessItem = { platform: PlatformCode; account: string; state: AccessState; method: AccessMethod | null; note: string | null };

/**
 * Après le paiement : le client ouvre l'accès à ses comptes pour que l'équipe y lance la publicité.
 * La carte ne s'affiche que s'il reste un accès à donner ou à refaire ; une fois tout reçu, elle disparaît de la page.
 */
export function AccessCard({ campaignId, items, agency }: { campaignId: string; items: AccessItem[]; agency: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState<PlatformCode | null>(null);
  const [busy, setBusy] = React.useState<PlatformCode | null>(null);
  const current = items.find((i) => i.platform === open) ?? null;
  const remove = useRemoveAccess(campaignId, setBusy);

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-marigold/50 bg-surface" aria-label="Accès à vos comptes">
      <header className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marigold-soft text-[#8a5a00]"><KeyRound className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-ink">Donnez-nous l&apos;accès</h2>
          <p className="text-[0.8125rem] text-muted">Sans accès, nous ne pouvons pas lancer.</p>
        </div>
      </header>
      <ul className="divide-y divide-line border-t border-line">
        {items.map((it) => {
          const meta = ACCESS_STATE_META[it.state];
          const act = it.state === "TODO" || it.state === "PROBLEM";
          return (
            <li key={it.platform} className="px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <PlatformBadge platform={it.platform} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink"><span className="w-[4.5rem] shrink-0">{PLATFORMS[it.platform].label}</span><ToneIcon tone={meta.tone} label={meta.label} /></p>
                  {it.account && <p className="mt-0.5 truncate text-[0.8125rem] text-muted">{it.account}</p>}
                </div>
                {act ? (
                  <Button size="sm" variant={it.state === "PROBLEM" ? "outline" : "accent"} onClick={() => setOpen(it.platform)}>{it.state === "PROBLEM" ? "Refaire" : "Donner l'accès"}<ArrowRight /></Button>
                ) : it.method === "LOGIN" ? (
                  <button type="button" disabled={busy === it.platform} onClick={() => remove(it.platform)} aria-label={`Effacer mes identifiants ${PLATFORMS[it.platform].label}`} title="Effacer mes identifiants"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-clay-soft hover:text-clay">{busy === it.platform ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>
                ) : null}
              </div>
              {it.state === "PROBLEM" && it.note && <p className="mt-2 rounded-lg bg-clay-soft px-3 py-2 text-[0.8125rem] text-ink">{it.note}</p>}
            </li>
          );
        })}
      </ul>
      <Dialog open={open !== null} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        {current && (
          <DialogContent title={`Accès à votre ${accountNoun(current.platform)}`}>
            <AccessForm key={current.platform} campaignId={campaignId} platform={current.platform} agency={agency} onDone={() => { setOpen(null); router.refresh(); }} />
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}

function useRemoveAccess(campaignId: string, setBusy: (p: PlatformCode | null) => void) {
  const router = useRouter();
  return async function remove(p: PlatformCode) {
    if (!window.confirm(`Effacer vos identifiants ${PLATFORMS[p].label} ? Nous n'aurons plus accès à votre ${accountNoun(p)}.`)) return;
    setBusy(p);
    const res = await removeAccessAction(campaignId, p);
    setBusy(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Identifiants effacés.");
    router.refresh();
  };
}

/** Dans « Détails » : le client peut reprendre les identifiants qu'il a confiés, même une fois la carte d'accès disparue. */
export function EntrustedLogins({ campaignId, platforms }: { campaignId: string; platforms: PlatformCode[] }) {
  const [busy, setBusy] = React.useState<PlatformCode | null>(null);
  const remove = useRemoveAccess(campaignId, setBusy);
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {platforms.map((p) => (
        <span key={p} className="inline-flex items-center gap-2">
          {PLATFORMS[p].label}
          <button type="button" disabled={busy !== null} onClick={() => remove(p)} className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-clay underline underline-offset-2 disabled:opacity-60">
            {busy === p ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}Effacer
          </button>
        </span>
      ))}
    </span>
  );
}

function AccessForm({ campaignId, platform, agency, onDone }: { campaignId: string; platform: PlatformCode; agency: string; onDone: () => void }) {
  const [method, setMethod] = React.useState<AccessMethod>("INVITE");
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const needsCode = inviteNeedsCode(platform);
  const steps = inviteSteps(platform, agency);
  const ready = method === "LOGIN" ? login.trim().length >= 3 && password.length >= 4 : !needsCode || code.trim().length >= 6;

  async function submit() {
    setBusy(true); setError(null);
    const res = await giveAccessAction(campaignId, platform, method === "LOGIN" ? { method, login, password } : { method, code });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setPassword("");
    toast.success(method === "LOGIN" ? "Identifiants reçus." : "Merci. Nous vérifions.");
    onDone();
  }

  const options: { id: AccessMethod; icon: React.ReactNode; badge?: string }[] = [{ id: "INVITE", icon: <UserPlus />, badge: "Conseillé" }, { id: "LOGIN", icon: <KeyRound /> }];
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Comment donner l'accès" className="grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const active = method === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={active} onClick={() => { setMethod(o.id); setError(null); }}
              className={cn("relative rounded-xl border px-3.5 py-3 text-left transition-colors", active ? "border-green bg-green-soft/60 ring-1 ring-green" : "border-line bg-surface hover:border-line-strong")}>
              <span className={cn("flex size-8 items-center justify-center rounded-full [&_svg]:size-4", active ? "bg-green text-white" : "bg-sand text-ink-soft")}>{o.icon}</span>
              <span className="mt-2 block text-sm font-semibold leading-snug text-ink">{o.id === "INVITE" ? inviteTitle(platform) : METHOD_LABELS[o.id].title}</span>
              <span className="mt-0.5 block text-[0.78125rem] leading-snug text-muted">{METHOD_LABELS[o.id].hint}</span>
              {o.badge && <span className="absolute right-2.5 top-2.5 rounded-full bg-green px-2 py-0.5 text-[11px] font-medium text-white">{o.badge}</span>}
            </button>
          );
        })}
      </div>

      {method === "INVITE" ? (
        <>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[0.875rem] leading-relaxed text-ink">
                <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{i + 1}</span>
                <span className="min-w-0">
                  {s.text}
                  {s.link && (
                    <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="mt-2 flex h-10 w-fit items-center gap-2 rounded-full bg-green-soft px-4 text-[0.84375rem] font-medium text-green transition-colors hover:bg-green-soft/70">
                      {s.link.label}<ExternalLink className="size-4" />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {needsCode && <Field label="Code de la vidéo" htmlFor="acc-code"><Input id="acc-code" value={code} maxLength={300} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setCode(e.target.value)} placeholder="#Ab12Cd…" /></Field>}
        </>
      ) : (
        <>
          <Field label="Identifiant" htmlFor="acc-login"><Input id="acc-login" value={login} maxLength={120} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setLogin(e.target.value)} placeholder="E-mail, téléphone ou nom d'utilisateur" /></Field>
          <Field label="Mot de passe" htmlFor="acc-password">
            <div className="relative">
              <Input id="acc-password" type={show ? "text" : "password"} className="pr-12" value={password} maxLength={200} autoComplete="off" onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-soft"><Lock className="mt-0.5 size-4 shrink-0 text-green" /><span>Chiffrés, effacés à la fin de la campagne. {PLATFORMS[platform].label} peut vous envoyer un code : restez joignable.</span></p>
        </>
      )}

      {error && <p role="alert" className="rounded-lg bg-clay-soft px-3 py-2 text-[0.84375rem] text-clay">{error}</p>}
      <Button type="button" size="lg" variant="accent" className="w-full" disabled={busy || !ready} onClick={submit}>{busy && <LoaderCircle className="animate-spin" />}{method === "INVITE" ? "C'est fait" : "Envoyer"}</Button>
    </div>
  );
}
