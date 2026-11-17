import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Headset, Sparkles } from "lucide-react";
import { ObjectiveIcon, OperatorChip, PlatformBadge, WhatsappIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tile, TILE_TONES, toneAt } from "@/components/ui/tile";
import { db } from "@/lib/db";
import { getObjective, OBJECTIVES } from "@/lib/catalog/objectives";
import { computeCampaignQuote } from "@/lib/pricing/quote";
import { getSettings } from "@/lib/settings";
import { cn, formatFcfa } from "@/lib/utils";

const STEPS = [
  { title: "Choisissez votre objectif", text: "Vendre, recevoir des messages WhatsApp, gagner des abonnés…" },
  { title: "Présentez votre offre", text: "Une photo et quelques mots. Nous proposons le texte et l'audience." },
  { title: "Payez par Mobile Money", text: "MTN, Moov ou Celtiis. Vous validez sur votre téléphone." },
  { title: "Suivez vos résultats", text: "Notre équipe lance la campagne. Les chiffres s'affichent dans votre espace." },
];
const POPULAR = ["whatsapp_orders", "sales", "page_awareness", "leads", "ig_followers", "store_visits"];

const FAQ = [
  { q: "Ai-je besoin d'une carte bancaire ?", a: "Non. Vous réglez par Mobile Money et nous payons les plateformes publicitaires pour vous, depuis nos comptes professionnels." },
  { q: "Quelle différence entre budget publicitaire et frais de prestation ?", a: "Le budget publicitaire est la somme dépensée auprès de Facebook, Instagram ou TikTok pour diffuser votre annonce : il leur est intégralement reversé. Les frais de prestation rémunèrent notre travail : configuration, création, gestion et suivi. Les deux montants sont toujours affichés séparément." },
  { q: "Garantissez-vous un nombre d'abonnés ou de ventes ?", a: "Non, et personne ne peut honnêtement le faire. Les résultats dépendent de votre offre, de vos visuels, de votre prix et de la concurrence. Nous nous engageons sur ce que nous maîtrisons : une campagne bien configurée, un budget intégralement investi et des statistiques transparentes." },
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

  const wrap = "mx-auto max-w-6xl px-5";
  const eyebrow = "eyebrow text-green";
  const title = "mt-2 max-w-2xl text-[28px] font-semibold leading-tight sm:text-[38px]";

  return (
    <>
      {/* ── Accroche ── */}
      <section className="bg-halo overflow-hidden">
        <div className={`${wrap} grid items-center gap-12 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-24`}>
          <div className="animate-rise">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3.5 shadow-card">
              <PlatformBadge platform="FACEBOOK" size="sm" /><PlatformBadge platform="INSTAGRAM" size="sm" /><PlatformBadge platform="TIKTOK" size="sm" />
              <span className="ml-1 text-[13px] font-medium text-ink-soft">Publicité sans carte bancaire</span>
            </div>
            <h1 className="text-[36px] font-semibold leading-[1.08] sm:text-[54px] lg:text-[60px]">
              Votre publicité sur Facebook, Instagram et TikTok.{" "}
              <span className="box-decoration-clone bg-[linear-gradient(transparent_64%,rgb(248_168_31/0.7)_64%,rgb(248_168_31/0.7)_94%,transparent_94%)] px-0.5">Payée par Mobile Money.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">Vous décrivez ce que vous vendez. Notre équipe vérifie, lance et suit votre campagne.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/app/expert"><Headset /> Confier à un expert</Link></Button>
            </div>
            <div className="mt-7 flex items-center gap-2 text-[13px] text-muted">
              <OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" />
              <span className="ml-1">Paiement validé sur votre téléphone</span>
            </div>
          </div>

          {/* Exemple d'annonce, tel qu'il apparaît dans un fil d'actualité. */}
          <div className="animate-rise [animation-delay:120ms]">
            <div className="relative mx-auto w-full max-w-[350px]">
              <div aria-hidden className="absolute -inset-3 rotate-3 rounded-[32px] bg-gradient-to-br from-green-soft via-marigold-soft to-sky-soft" />
              <figure className="relative overflow-hidden rounded-[26px] border border-line bg-surface shadow-pop">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest font-display text-sm font-semibold text-white">BA</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">Boutique Awa</span><span className="block text-xs text-muted">Sponsorisé · Cotonou</span></span>
                  <PlatformBadge platform="FACEBOOK" size="sm" />
                </div>
                <p className="px-4 pb-3 text-sm leading-snug text-ink-soft">Nouvelles robes en wax, tailles 36 à 52. Livraison à Cotonou en 48 h.</p>
                <Image src="/img/vitrine-wax.jpg" alt="Robes en wax suspendues dans une boutique" width={720} height={720} priority sizes="350px" className="aspect-[5/4] w-full object-cover" />
                <figcaption className="flex items-center justify-between gap-3 bg-paper px-4 py-3">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">Robes en wax à Cotonou</span><span className="block text-xs text-muted">Commandez par message</span></span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#25d366] px-3.5 py-2 text-[13px] font-semibold text-white"><WhatsappIcon className="size-4" />WhatsApp</span>
                </figcaption>
              </figure>
              {example && (
                <div className="absolute -left-3 top-[46%] flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-lift sm:-left-14">
                  <span className="flex size-8 items-center justify-center rounded-full bg-green-soft text-green"><Check className="size-4" strokeWidth={3} /></span>
                  <span><span className="block text-[11.5px] leading-tight text-muted">Payé par Mobile Money</span><span className="tnum block font-display text-[15px] font-semibold leading-tight text-ink">{formatFcfa(example.total)}</span></span>
                </div>
              )}
            </div>
            <p className="mt-7 text-center text-xs text-muted">Exemple d&apos;annonce</p>
          </div>
        </div>
      </section>

      {/* ── Fonctionnement ── */}
      <section id="fonctionnement" className="scroll-mt-20 border-y border-line bg-paper">
        <div className={`${wrap} py-16 sm:py-20`}>
          <p className={eyebrow}>Comment ça marche</p>
          <h2 className={title}>De l&apos;idée à la diffusion, en quatre étapes.</h2>
          <ol className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
                <span className={cn("tnum flex size-11 items-center justify-center rounded-xl font-display text-lg font-semibold", TILE_TONES[toneAt(i)])}>{i + 1}</span>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug tracking-normal [font-family:var(--font-sans)] sm:text-[17px]">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Objectifs ── */}
      <section id="objectifs" className={`${wrap} scroll-mt-20 py-16 sm:py-20`}>
        <p className={eyebrow}>Objectifs</p>
        <h2 className={title}>Dites-nous ce que vous voulez obtenir.</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {POPULAR.map((code, i) => { const o = getObjective(code); return o ? <Tile key={code} href="/app/creer" icon={<ObjectiveIcon name={o.icon} />} tone={toneAt(i)} title={o.label} text={o.description} hideTextOnMobile /> : null; })}
        </div>
        <p className="mt-5 text-sm text-muted">Et {OBJECTIVES.length - POPULAR.length} autres objectifs : vues vidéo, événements, demandes de devis…</p>
      </section>

      {/* ── Deux façons de travailler ── */}
      <section className={`${wrap} pb-16 sm:pb-20`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-line bg-surface p-7 shadow-card">
            <span className={cn("flex size-11 items-center justify-center rounded-xl", TILE_TONES.marigold)}><Sparkles className="size-5" /></span>
            <h3 className="mt-4 text-2xl font-semibold">Je crée ma publicité</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Quatre étapes sur votre téléphone. Nous proposons le texte et l&apos;audience, puis notre équipe vérifie et lance.</p>
            <p className="mt-4 text-sm text-ink-soft">Prestation à partir de <span className="tnum font-semibold text-ink">{formatFcfa(minFee)}</span></p>
            <Button asChild className="mt-6 self-start"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
          </div>
          <div className="bg-brand relative flex flex-col overflow-hidden rounded-2xl p-7 text-white shadow-lift">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
            <div className="relative flex flex-1 flex-col">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-marigold"><Headset className="size-5" /></span>
              <h3 className="mt-4 text-2xl font-semibold text-white">Je confie tout à un expert</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">Un gestionnaire dédié réalise vos visuels et vos textes. Vous validez avant le lancement.</p>
              <p className="mt-4 text-sm text-white/85">Messagerie directe avec votre gestionnaire</p>
              <Button asChild variant="accent" className="mt-6 self-start"><Link href="/app/expert">Confier à un expert <ArrowRight /></Link></Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section className="border-y border-line bg-paper">
        <div className={`${wrap} grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16`}>
          <div>
            <p className={eyebrow}>Tarifs transparents</p>
            <h2 className={title}>Vous savez ce que vous payez, et à qui.</h2>
            <ul className="mt-6 space-y-3 text-[15px] text-ink-soft">
              {["Votre budget publicitaire est investi en totalité sur les plateformes.", "Notre prestation est affichée à part, avant tout paiement.", "Vous validez les créations avant toute diffusion."].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green text-white"><Check className="size-3" strokeWidth={3} /></span>{t}</li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted">Nous ne promettons pas un nombre garanti d&apos;abonnés ou de ventes : les résultats dépendent aussi de votre offre et de vos visuels.</p>
            <Link href="/services" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-green hover:underline">Tous les services et tarifs <ArrowRight className="size-3.5" /></Link>
          </div>
          {example && (
            <div className="relative mx-auto w-full max-w-sm">
              <div aria-hidden className="absolute -right-3 -top-3 h-full w-full rounded-2xl border border-line-strong bg-sand" />
              <div className="relative rounded-2xl border border-line-strong bg-surface p-6 shadow-pop">
                <div className="flex items-center justify-between"><p className="eyebrow">Exemple</p><PlatformBadge platform="FACEBOOK" size="sm" /></div>
                <p className="mt-3 font-display text-lg font-semibold">Faire connaître ma page</p>
                <p className="text-[13px] text-muted">10 jours · Cotonou et environs</p>
                <dl className="mt-5 space-y-3 text-sm">
                  {example.lines.map((l) => (
                    <div key={l.kind} className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-soft">{l.kind === "AD_BUDGET" ? "Budget publicitaire" : l.kind === "SERVICE_FEE" ? "Notre prestation" : "Frais Mobile Money"}</dt>
                      <dd className="tnum font-medium">{formatFcfa(l.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-line-strong pt-3">
                    <dt className="font-semibold">Total à payer</dt>
                    <dd className="tnum font-display text-2xl font-semibold">{formatFcfa(example.total)}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex items-center gap-2 rounded-lg bg-sand px-3 py-2.5">
                  <OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" />
                  <span className="ml-auto text-xs text-muted">Mobile Money</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Questions ── */}
      <section id="questions" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
          <p className={eyebrow}>Questions fréquentes</p>
          <h2 className={title}>Avant de vous lancer</h2>
          <div className="mt-8 space-y-2.5">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-line bg-surface px-5 py-4 shadow-card open:border-line-strong">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className={`${wrap} pb-16 sm:pb-20`}>
        <div className="bg-brand relative overflow-hidden rounded-[28px] px-6 py-12 text-center text-white shadow-lift sm:px-12 sm:py-16">
          <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
          <div className="relative">
            <h2 className="mx-auto max-w-xl text-[30px] font-semibold leading-tight text-white sm:text-[42px]">Votre première campagne peut partir cette semaine.</h2>
            <p className="mx-auto mt-3 max-w-md text-white/75">Créez votre compte gratuitement. Vous ne payez qu&apos;au moment de commander.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"><Link href="/app/expert">Confier à un expert</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
