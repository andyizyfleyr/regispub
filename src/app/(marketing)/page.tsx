import Link from "next/link";
import { ArrowRight, BadgeCheck, ChartColumn, Check, Headset, Minus, Palette, ShieldCheck, Smartphone, Sparkles, Target } from "lucide-react";
import { ObjectiveIcon, OperatorChip, PlatformBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { OBJECTIVE_CATEGORIES, OBJECTIVES, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { computeCampaignQuote } from "@/lib/pricing/quote";
import { getSettings } from "@/lib/settings";
import { formatFcfa, formatNumber } from "@/lib/utils";

const STEPS = [
  { icon: Target, title: "Choisissez votre objectif", text: "Vendre, gagner des abonnés, vous faire connaître : chaque objectif a sa configuration publicitaire." },
  { icon: Sparkles, title: "Décrivez votre activité", text: "L'assistant propose textes, audiences et idées de visuels. Vous modifiez et validez." },
  { icon: Smartphone, title: "Payez par Mobile Money", text: "MTN, Moov ou Celtiis. Vous validez sur votre téléphone, le reçu arrive aussitôt." },
  { icon: ChartColumn, title: "Suivez vos résultats", text: "Notre équipe lance la campagne. Vous suivez chaque étape et les statistiques depuis votre espace." },
];

const FAQ = [
  { q: "Ai-je besoin d'une carte bancaire ?", a: "Non. Vous réglez par Mobile Money et nous payons les plateformes publicitaires pour vous, depuis nos comptes professionnels." },
  { q: "Quelle différence entre budget publicitaire et frais de prestation ?", a: "Le budget publicitaire est la somme dépensée auprès de Facebook, Instagram ou TikTok pour diffuser votre annonce : il leur est intégralement reversé. Les frais de prestation rémunèrent notre travail : configuration, création, gestion et suivi. Les deux montants sont toujours affichés séparément." },
  { q: "Garantissez-vous un nombre d'abonnés ou de ventes ?", a: "Non, et personne ne peut honnêtement le faire. Les résultats dépendent de votre offre, de vos visuels, de votre prix et de la concurrence. Nous nous engageons sur ce que nous maîtrisons : une campagne bien configurée, un budget intégralement investi et des statistiques transparentes." },
  { q: "Faut-il déjà avoir une page Facebook ou un compte TikTok ?", a: "Oui pour la plupart des objectifs : la publicité est diffusée au nom de votre page. Si vous n'en avez pas, notre équipe vous indique comment la créer avant le lancement." },
  { q: "Que se passe-t-il après le paiement ?", a: "Votre commande passe au statut « Payé », un gestionnaire la prend en charge, prépare la campagne et vous soumet les créations si nécessaire. Chaque annonce est ensuite examinée par la plateforme avant diffusion." },
  { q: "Et si mon paiement échoue ou est débité deux fois ?", a: "Un paiement non confirmé par l'opérateur n'est jamais considéré comme reçu. En cas de double débit, le système le détecte et ouvre automatiquement une demande de remboursement." },
];

export default async function HomePage() {
  const [services, settings] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, kind: true, fee: true, active: true } }),
    getSettings(),
  ]);
  let example: ReturnType<typeof computeCampaignQuote> | null = null;
  try {
    example = computeCampaignQuote({ objectiveCode: "page_awareness", levelCode: null, platforms: ["FACEBOOK"], adBudget: 20_000, durationDays: 10 }, services, settings);
  } catch { /* catalogue incomplet : l'exemple est masqué */ }
  const minFee = services.length ? Math.min(...services.map((s) => s.fee)) : settings.minServiceFee;

  return (
    <>
      {/* ── Accroche ── */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:pb-24">
        <div className="animate-rise">
          <div className="mb-6 flex items-center gap-2">
            <PlatformBadge platform="FACEBOOK" size="sm" /><PlatformBadge platform="INSTAGRAM" size="sm" /><PlatformBadge platform="TIKTOK" size="sm" />
            <span className="ml-1 text-[13px] text-muted">Publicité sans carte bancaire</span>
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.04] sm:text-[56px] lg:text-[62px]">
            Faites votre publicité sur Facebook, Instagram et TikTok.{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">Payez avec Mobile Money.</span>
              <span aria-hidden className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.32em] bg-marigold/70" />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">Nous vous accompagnons de la création aux résultats : stratégie, visuels, lancement et suivi. Vous gardez la main, notre équipe s&apos;occupe de la technique.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/app/expert"><Headset /> Parler à un expert</Link></Button>
          </div>
          <Link href="/services" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline">Découvrir nos services <ArrowRight className="size-3.5" /></Link>
        </div>

        {example && (
          <div className="animate-rise [animation-delay:120ms]">
            <div className="relative mx-auto max-w-sm">
              <div aria-hidden className="absolute -right-3 -top-3 h-full w-full rounded-xl border border-line-strong bg-sand" />
              <div className="relative rounded-xl border border-line-strong bg-surface p-6 shadow-pop">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Exemple de récapitulatif</p>
                  <PlatformBadge platform="FACEBOOK" size="sm" />
                </div>
                <p className="mt-3 font-display text-lg font-semibold">Faire connaître ma page</p>
                <p className="text-[13px] text-muted">10 jours · Cotonou et environs</p>
                <dl className="mt-5 space-y-3 text-sm">
                  {example.lines.map((l) => (
                    <div key={l.kind} className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-soft">{l.kind === "AD_BUDGET" ? "Budget publicitaire" : l.kind === "SERVICE_FEE" ? "Frais de prestation" : "Frais de paiement"}</dt>
                      <dd className="tnum font-medium">{formatFcfa(l.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-line-strong pt-3">
                    <dt className="font-semibold">Total à payer</dt>
                    <dd className="tnum font-display text-2xl font-semibold">{formatFcfa(example.total)}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex items-center gap-2 rounded-md bg-sand px-3 py-2.5">
                  <OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" />
                  <span className="ml-auto text-xs text-muted">Mobile Money</span>
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-px size-3.5 shrink-0 text-green" />Le budget publicitaire est intégralement reversé aux plateformes.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Fonctionnement ── */}
      <section id="fonctionnement" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="eyebrow">Fonctionnement</p>
          <h2 className="mt-2 max-w-2xl text-[30px] font-semibold leading-tight sm:text-[38px]">De l&apos;idée à la diffusion, en quatre étapes.</h2>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="tnum font-display text-[44px] font-semibold leading-none text-line-strong">{i + 1}</span>
                  <s.icon className="size-5 text-green" />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold tracking-normal [font-family:var(--font-sans)]">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Objectifs ── */}
      <section id="objectifs" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20">
        <p className="eyebrow">Objectifs publicitaires</p>
        <h2 className="mt-2 max-w-2xl text-[30px] font-semibold leading-tight sm:text-[38px]">Dites-nous ce que vous voulez obtenir. Nous configurons la campagne en conséquence.</h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {(Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).map((cat) => (
            <div key={cat} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="text-xl font-semibold">{OBJECTIVE_CATEGORIES[cat].label}</h3>
              <p className="mt-1 text-sm text-muted">{OBJECTIVE_CATEGORIES[cat].description}</p>
              <ul className="mt-5 space-y-3">
                {OBJECTIVES.filter((o) => o.category === cat).map((o) => (
                  <li key={o.code} className="flex items-center gap-3 text-sm text-ink-soft">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-green-soft text-green"><ObjectiveIcon name={o.icon} className="size-3.5" /></span>
                    {o.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Deux façons de travailler ── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-line bg-surface p-7">
            <Palette className="size-6 text-green" />
            <h3 className="mt-4 text-2xl font-semibold">Je crée ma publicité</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Un assistant vous guide : plateforme, objectif, textes, visuels dans le studio créatif, ciblage et budget. Notre équipe vérifie puis lance la campagne.</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              {["Assistant en 7 étapes, utilisable sur téléphone", "Studio créatif et bibliothèque de visuels", `Prestation à partir de ${formatFcfa(minFee)}`].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{t}</li>)}
            </ul>
            <Button asChild className="mt-7 self-start"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
          </div>
          <div className="flex flex-col rounded-xl bg-forest p-7 text-white">
            <Headset className="size-6 text-marigold" />
            <h3 className="mt-4 text-2xl font-semibold">Je confie ma publicité à un expert</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">Décrivez votre besoin, transmettez vos fichiers et laissez un gestionnaire dédié s&apos;occuper de tout. Vous validez les créations avant le lancement.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/85">
              {["Gestionnaire dédié et messagerie directe", "Visuels et textes réalisés par notre équipe", "Validation des créations et demandes de modification"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-marigold" />{t}</li>)}
            </ul>
            <Button asChild variant="accent" className="mt-7 self-start"><Link href="/app/expert">Parler à un expert <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Tarifs transparents</p>
            <h2 className="mt-2 text-[30px] font-semibold leading-tight sm:text-[38px]">Vous savez toujours ce que vous payez, et à qui.</h2>
            <p className="mt-4 text-ink-soft">Chaque commande détaille quatre montants distincts. Aucun frais caché, aucune commission prélevée sur votre budget publicitaire.</p>
            <ol className="mt-6 space-y-3 text-sm">
              {[
                ["Budget publicitaire", "Reversé en totalité à Facebook, Instagram ou TikTok."],
                ["Frais de prestation", `Notre travail, à partir de ${formatFcfa(minFee)} selon le service.`],
                ["Frais de paiement", settings.paymentFeePayer === "CLIENT" && settings.paymentFeePercent > 0 ? `${String(settings.paymentFeePercent).replace(".", ",")} % prélevés par l'opérateur Mobile Money.` : "Pris en charge par RegisPub."],
                ["Total à payer", "La somme exacte débitée de votre compte Mobile Money."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{i + 1}</span>
                  <span><span className="font-medium text-ink">{t}.</span> <span className="text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="self-start overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-sand text-[12px] uppercase tracking-wider text-muted"><th className="px-5 py-3 font-medium">Service</th><th className="px-5 py-3 text-right font-medium">À partir de</th></tr></thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.code} className="border-t border-line">
                    <td className="px-5 py-3 text-ink-soft">{s.name}</td>
                    <td className="tnum whitespace-nowrap px-5 py-3 text-right font-medium text-ink">{formatNumber(s.fee)} F{s.kind === "SUBSCRIPTION" ? " / mois" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line bg-sand/50 px-5 py-3 text-xs text-muted">Frais de prestation en francs CFA, hors budget publicitaire. <Link href="/services" className="font-medium text-green hover:underline">Voir le détail des services</Link></p>
          </div>
        </div>
      </section>

      {/* ── Engagements ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
          <div className="bg-surface p-7 sm:p-9">
            <BadgeCheck className="size-6 text-green" />
            <h3 className="mt-4 text-2xl font-semibold">Ce sur quoi nous nous engageons</h3>
            <ul className="mt-5 space-y-3 text-sm text-ink-soft">
              {["Votre budget publicitaire est investi en totalité sur les plateformes.", "Un paiement n'est confirmé qu'après vérification auprès de l'opérateur.", "Les statistiques affichées proviennent des plateformes ou de rapports validés.", "Vous validez les créations avant toute diffusion."].map((t) => <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-green" />{t}</li>)}
            </ul>
          </div>
          <div className="bg-surface p-7 sm:p-9">
            <Minus className="size-6 text-clay" />
            <h3 className="mt-4 text-2xl font-semibold">Ce que nous ne promettons pas</h3>
            <ul className="mt-5 space-y-3 text-sm text-ink-soft">
              {["Un nombre garanti d'abonnés, de vues ou de ventes.", "Des résultats identiques d'une campagne à l'autre.", "La diffusion d'annonces contraires aux règles de Meta ou de TikTok.", "Des chiffres estimés ou arrondis à notre avantage."].map((t) => <li key={t} className="flex gap-2.5"><Minus className="mt-0.5 size-4 shrink-0 text-clay" />{t}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Questions ── */}
      <section id="questions" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
          <p className="eyebrow">Questions fréquentes</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-tight sm:text-[38px]">Avant de vous lancer</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex list-none items-center justify-between gap-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className="bg-forest text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="max-w-xl text-[32px] font-semibold leading-tight sm:text-[42px]">Votre première campagne peut partir cette semaine.</h2>
            <p className="mt-3 max-w-lg text-white/70">Créez votre compte gratuitement, configurez votre publicité et ne payez qu&apos;au moment de commander.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/10"><Link href="/app/expert">Parler à un expert</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
