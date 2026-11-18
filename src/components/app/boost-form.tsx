"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, LoaderCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { BOOST_KIND_ICONS } from "@/components/app/boost-icons";
import { PlatformBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SectionTitle } from "@/components/ui/list";
import {
  BOOST_COMMENT_MAX_LENGTH, BOOST_KIND_CODES, BOOST_KINDS, BoostError, boostFromPrice, boostLabel, computeBoostQuote, normalizeTarget, parseComments, targetHint, unitPriceLabel, validateComments,
  type BoostKindCode, type BoostProductData,
} from "@/lib/boost/catalog";
import { PLATFORM_CODES, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import type { PlatformSettings } from "@/lib/settings-schema";
import { cn, formatFcfa, formatNumber } from "@/lib/utils";
import { createBoostOrderAction } from "@/server/actions/boost";

const KIND_TONES: Record<BoostKindCode, string> = { FOLLOWERS: "bg-green-soft text-green", LIKES: "bg-rose-soft text-rose", COMMENTS: "bg-sky-soft text-sky", VIEWS: "bg-violet-soft text-violet" };

const choice = (active: boolean) => cn(
  "relative flex w-full flex-col rounded-xl border bg-surface text-left transition-[border-color,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/40",
  active ? "border-green bg-green-soft/40 shadow-[0_0_0_1px_var(--color-green)]" : "border-line shadow-card hover:border-line-strong",
);

type Fees = Pick<PlatformSettings, "paymentFeePercent" | "paymentFeePayer">;

/** Commande d'abonnés, de J'aime, de commentaires ou de vues : réseau, produit, quantité, lien, puis paiement. */
export function BoostForm({ products, fees, initial }: { products: BoostProductData[]; fees: Fees; initial?: { platform?: PlatformCode; kind?: BoostKindCode } }) {
  const router = useRouter();
  const platforms = PLATFORM_CODES.filter((p) => products.some((x) => x.platform === p));
  const [platform, setPlatform] = React.useState<PlatformCode>(initial?.platform && platforms.includes(initial.platform) ? initial.platform : platforms[0]!);
  const kinds = BOOST_KIND_CODES.filter((k) => products.some((x) => x.platform === platform && x.kind === k));
  const [kindChoice, setKind] = React.useState<BoostKindCode>(initial?.kind ?? "FOLLOWERS");
  const kind = kinds.includes(kindChoice) ? kindChoice : kinds[0]!;
  const product = products.find((x) => x.platform === platform && x.kind === kind)!;

  // Quantité : un pack, ou « autre quantité » saisie à la main.
  const [pack, setPack] = React.useState<number | null>(null);
  const [custom, setCustom] = React.useState(false);
  const [free, setFree] = React.useState("");
  const [link, setLink] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [errors, setErrors] = React.useState<{ quantity?: string; link?: string; comments?: string }>({});
  const [busy, setBusy] = React.useState(false);

  // À chaque changement de produit, on repart du premier pack : les quantités ne sont pas les mêmes d'un produit à l'autre.
  const productId = product.id;
  React.useEffect(() => {
    setPack(null); setCustom(product.packs.length === 0); setFree(""); setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const selectedPack = custom ? null : pack ?? product.packs[0]?.quantity ?? null;
  const quantity = custom ? Math.floor(Number(free.replace(/[^\d]/g, ""))) || 0 : selectedPack ?? 0;

  let quote: ReturnType<typeof computeBoostQuote> | null = null;
  let quantityIssue: string | null = null;
  if (quantity > 0) {
    try { quote = computeBoostQuote(product, quantity, fees); } catch (e) { quantityIssue = e instanceof BoostError ? e.message : "Quantité invalide."; }
  }

  const meta = BOOST_KINDS[kind];
  const hint = targetHint(platform, kind);
  const lines = kind === "COMMENTS" ? parseComments(comments) : [];
  const Icon = BOOST_KIND_ICONS[kind];

  async function submit() {
    const next: typeof errors = {};
    if (!quote) next.quantity = quantityIssue ?? "Choisissez une quantité.";
    const target = normalizeTarget(platform, kind, link);
    if (!target.ok) next.link = target.error;
    if (kind === "COMMENTS" && quantity > 0) { const issue = validateComments(lines, quantity); if (issue) next.comments = issue; }
    setErrors(next);
    if (Object.keys(next).length) {
      const first = next.quantity ? "boost-quantity" : next.link ? "boost-link" : "boost-comments";
      document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    const res = await createBoostOrderAction({ productId: product.id, quantity, link, comments: kind === "COMMENTS" ? comments : undefined });
    if (!res.ok) {
      setBusy(false);
      if (res.field === "quantity" || res.field === "link" || res.field === "comments") setErrors({ [res.field]: res.error });
      toast.error(res.error);
      return;
    }
    router.push(`/app/paiements/${res.orderId}`);
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      <section aria-labelledby="boost-reseau">
        <SectionTitle id="boost-reseau">Réseau</SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {platforms.map((p) => (
            <button key={p} type="button" aria-pressed={p === platform} onClick={() => setPlatform(p)} className={cn(choice(p === platform), "items-center gap-1.5 px-2 py-3 sm:flex-row sm:gap-3 sm:px-4")}>
              <PlatformBadge platform={p} size="md" />
              <span className="truncate text-[0.84375rem] font-semibold text-ink sm:text-[0.9375rem]">{PLATFORMS[p].label}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="boost-produit">
        <SectionTitle id="boost-produit">Que voulez-vous ?</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {kinds.map((k) => {
            const p = products.find((x) => x.platform === platform && x.kind === k)!;
            const KIcon = BOOST_KIND_ICONS[k];
            return (
              <button key={k} type="button" aria-pressed={k === kind} onClick={() => setKind(k)} className={cn(choice(k === kind), "gap-2 p-3 sm:p-4")}>
                <span className={cn("flex size-9 items-center justify-center rounded-xl [&_svg]:size-[1.125rem]", KIND_TONES[k])}><KIcon aria-hidden /></span>
                <span>
                  <span className="block text-[0.9375rem] font-semibold leading-tight text-ink">{BOOST_KINDS[k].label}</span>
                  <span className="tnum block text-[0.78125rem] text-muted">dès {formatFcfa(boostFromPrice(p))}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="boost-quantite" id="boost-quantity">
        <SectionTitle id="boost-quantite">Combien ?</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {product.packs.map((p) => {
            const active = !custom && selectedPack === p.quantity;
            return (
              <button key={p.quantity} type="button" aria-pressed={active} onClick={() => { setCustom(false); setPack(p.quantity); setErrors((e) => ({ ...e, quantity: undefined })); }} className={cn(choice(active), "p-3 sm:p-4")}>
                <span className="tnum block font-display text-[1.25rem] font-semibold leading-none text-ink sm:text-[1.375rem]">{formatNumber(p.quantity)}</span>
                <span className="mt-1 block text-[0.75rem] text-muted">{meta.many}</span>
                <span className="tnum mt-2 block text-[0.9375rem] font-semibold text-green">{formatFcfa(p.price)}</span>
              </button>
            );
          })}
        </div>
        {product.packs.length > 0 && !custom && (
          <button type="button" onClick={() => setCustom(true)} className="mt-3 text-[0.84375rem] font-medium text-green underline-offset-4 hover:underline">Autre quantité</button>
        )}
        {custom && (
          <div className="mt-3 rounded-xl border border-line bg-surface p-3.5 shadow-card sm:p-4">
            <Field label={`Nombre de ${meta.many}`} htmlFor="boost-free" error={errors.quantity ?? (quantity > 0 ? quantityIssue ?? undefined : undefined)}
              hint={<span className="tnum">De {formatNumber(product.minQuantity)} à {formatNumber(product.maxQuantity)} · {unitPriceLabel(product)}</span>}>
              <Input id="boost-free" inputMode="numeric" autoComplete="off" className="tnum text-base" placeholder={formatNumber(product.minQuantity)} value={free}
                onChange={(e) => { setFree(e.target.value.replace(/[^\d\s]/g, "").slice(0, 10)); setErrors((x) => ({ ...x, quantity: undefined })); }} />
            </Field>
            {product.packs.length > 0 && <button type="button" onClick={() => { setCustom(false); setErrors((e) => ({ ...e, quantity: undefined })); }} className="mt-2.5 text-[0.84375rem] font-medium text-green underline-offset-4 hover:underline">Revenir aux packs</button>}
          </div>
        )}
        {!custom && errors.quantity && <p className="mt-2 text-[0.8125rem] text-clay">{errors.quantity}</p>}
      </section>

      <section aria-labelledby="boost-cible">
        <SectionTitle id="boost-cible">{meta.target === "account" ? "Pour quel compte ?" : "Pour quelle publication ?"}</SectionTitle>
        <div className="space-y-4 rounded-xl border border-line bg-surface p-3.5 shadow-card sm:p-4">
        <Field label={hint.label} htmlFor="boost-link" error={errors.link}
          hint={meta.target === "account" ? "Le compte doit être public pendant la livraison." : "La publication doit être visible par tout le monde."}>
          <Input id="boost-link" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={hint.placeholder} value={link}
            onChange={(e) => { setLink(e.target.value); setErrors((x) => ({ ...x, link: undefined })); }} />
        </Field>
        {kind === "COMMENTS" && (
          <Field label="Vos commentaires" htmlFor="boost-comments" error={errors.comments}
            hint={<span className="tnum">Un commentaire par ligne · {lines.length} écrit{lines.length > 1 ? "s" : ""}{quantity > 0 ? ` sur ${formatNumber(quantity)}` : ""}. Si vous en écrivez moins, ils seront repris plusieurs fois.</span>}>
            <Textarea id="boost-comments" rows={6} maxLength={120_000} placeholder={"Très beau travail !\nJ'adore, où peut-on commander ?\nBravo, continuez comme ça"} value={comments}
              onChange={(e) => { setComments(e.target.value); setErrors((x) => ({ ...x, comments: undefined })); }} aria-describedby="boost-comments-rule" />
            <span id="boost-comments-rule" className="sr-only">{BOOST_COMMENT_MAX_LENGTH} caractères au maximum par commentaire.</span>
          </Field>
        )}
        </div>
      </section>

      <section aria-label="Récapitulatif" className="rounded-[22px] border border-line/70 bg-surface p-4 shadow-card sm:rounded-[28px] sm:p-6">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", KIND_TONES[kind])}><Icon aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">{quantity > 0 ? boostLabel(platform, kind, quantity) : `${meta.label} ${PLATFORMS[platform].label}`}</p>
            {product.delay && <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted"><Clock3 className="size-3.5" aria-hidden />Livraison sous {product.delay}</p>}
          </div>
          <p className="tnum shrink-0 text-right font-display text-[1.25rem] font-semibold leading-none text-ink sm:text-[1.5rem]">{quote ? formatFcfa(quote.total) : "—"}</p>
        </div>
        {quote && quote.paymentFee > 0 && <p className="tnum mt-2 text-right text-[0.78125rem] text-muted">dont {formatFcfa(quote.paymentFee)} de frais Mobile Money</p>}
        <Button type="button" size="lg" variant="accent" className="mt-4 w-full" disabled={busy} aria-busy={busy} onClick={submit}>
          {busy ? <LoaderCircle className="animate-spin" /> : null}Commander{quote ? ` · ${formatFcfa(quote.total)}` : ""}{!busy && <ArrowRight />}
        </Button>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Lock className="mt-px size-3.5 shrink-0 text-green" aria-hidden />Nous ne demandons jamais votre mot de passe. Paiement par Mobile Money à l&apos;étape suivante.</p>
      </section>
    </div>
  );
}
