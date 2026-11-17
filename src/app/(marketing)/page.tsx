import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChartColumn, Check, ChevronDown, CreditCard, Headset, ImagePlus, Megaphone, ReceiptText, RefreshCw, Smartphone, Sparkles, Target, Wallet } from "lucide-react";
import { ObjectiveIcon, OperatorChip, PlatformBadge, WhatsappIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { StepTile, Tile, TILE_TONES, toneAt } from "@/components/ui/tile";
import { db } from "@/lib/db";
import { getObjective, OBJECTIVES, objectiveShort } from "@/lib/catalog/objectives";
import { computeCampaignQuote } from "@/lib/pricing/quote";
import { getSettings } from "@/lib/settings";
import { cn, formatFcfa } from "@/lib/utils";

const STEPS = [
  { title: "Choisissez l'objectif", icon: <Target /> },
  { title: "Ajoutez une photo", icon: <ImagePlus /> },
  { title: "Payez par Mobile Money", icon: <Smartphone /> },
  { title: "Suivez les résultats", icon: <ChartColumn /> },
];
const POPULAR = ["whatsapp_orders", "sales", "page_awareness", "leads", "ig_followers", "store_visits"];

const PROMISES = [
  { icon: <Megaphone />, text: "Budget 100 % investi en publicité" },
  { icon: <ReceiptText />, text: "Prestation affichée à part" },
  { icon: <BadgeCheck />, text: "Vous validez avant diffusion" },
];

const FAQ = [
  { icon: <CreditCard />, q: "Faut-il une carte bancaire ?", a: "Non. Vous payez par Mobile Money, nous réglons les plateformes." },
  { icon: <Wallet />, q: "Budget ou prestation ?", a: "Le budget va aux plateformes. La prestation paie notre travail. Les deux sont affichés à part." },
  { icon: <Target />, q: "Les résultats sont-ils garantis ?", a: "Non. Ils dépendent aussi de votre offre, de vos visuels et de votre prix." },
  { icon: <RefreshCw />, q: "Et si mon paiement échoue ?", a: "Un paiement non confirmé n'est pas encaissé. Un double débit est remboursé." },
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
  const expertFees = services.filter((s) => s.kind === "MANAGEMENT").map((s) => s.fee);
  const expertFee = expertFees.length ? Math.min(...expertFees) : null;

  const wrap = "mx-auto max-w-6xl px-5";
  const title = "mt-2 max-w-2xl text-[28px] font-semibold leading-tight sm:text-[38px]";

  return (
    <>
      {/* ── Accroche ── */}
      <section className="bg-halo overflow-hidden">
        <div className={`${wrap} grid items-center gap-12 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-24`}>
          <div className="animate-rise">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3.5 shadow-card">
              <PlatformBadge platform="FACEBOOK" size="sm" /><PlatformBadge platform="INSTAGRAM" size="sm" /><PlatformBadge platform="TIKTOK" size="sm" />
              <span className="ml-1 text-[13px] font-medium text-ink-soft">Sans carte bancaire</span>
            </div>
            <h1 className="text-[36px] font-semibold leading-[1.08] sm:text-[54px] lg:text-[60px]">
              Votre publicité,{" "}
              <span className="box-decoration-clone bg-[linear-gradient(transparent_64%,rgb(248_168_31/0.7)_64%,rgb(248_168_31/0.7)_94%,transparent_94%)] px-0.5">payée par Mobile Money.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[19px] leading-relaxed text-ink-soft">Vous décrivez. Nous lançons.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/app/expert"><Headset /> Un expert s&apos;en charge</Link></Button>
            </div>
            <div className="mt-7 flex items-center gap-2">
              <OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" />
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
                <p className="px-4 pb-3 text-sm leading-snug text-ink-soft">Nouvelles robes en wax. Livraison en 48 h.</p>
                <Image src="/img/vitrine-wax.jpg" alt="Robes en wax suspendues dans une boutique" width={720} height={720} priority sizes="350px" className="aspect-[5/4] w-full object-cover" />
                <figcaption className="flex items-center justify-between gap-3 bg-paper px-4 py-3">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">Robes en wax</span><span className="block text-xs text-muted">Cotonou</span></span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#25d366] px-3.5 py-2 text-[13px] font-semibold text-white"><WhatsappIcon className="size-4" />WhatsApp</span>
                </figcaption>
              </figure>
              {example && (
                <div className="absolute -left-3 top-[46%] flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-lift sm:-left-14">
                  <span className="flex size-8 items-center justify-center rounded-full bg-green-soft text-green"><Check className="size-4" strokeWidth={3} /></span>
                  <span><span className="block text-[11.5px] leading-tight text-muted">Payé</span><span className="tnum block font-display text-[15px] font-semibold leading-tight text-ink">{formatFcfa(example.total)}</span></span>
                </div>
              )}
            </div>
            <p className="mt-7 text-center text-xs text-muted">Exemple</p>
          </div>
        </div>
      </section>

      {/* ── Fonctionnement ── */}
      <section id="fonctionnement" className="scroll-mt-20 border-y border-line bg-paper">
        <div className={`${wrap} py-16 sm:py-20`}>
          <h2 className={title}>4 étapes</h2>
          <ol className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STEPS.map((s, i) => <StepTile key={s.title} n={i + 1} icon={s.icon} title={s.title} tone={toneAt(i)} />)}
          </ol>
        </div>
      </section>

      {/* ── Objectifs ── */}
      <section id="objectifs" className={`${wrap} scroll-mt-20 py-16 sm:py-20`}>
        <h2 className={title}>Que voulez-vous obtenir ?</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {POPULAR.map((code, i) => { const o = getObjective(code); return o ? <Tile key={code} href="/app/creer" icon={<ObjectiveIcon name={o.icon} />} tone={toneAt(i)} title={objectiveShort(o)} /> : null; })}
        </div>
        <Link href="/app/creer" className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft shadow-card transition-colors hover:border-line-strong hover:text-ink">+ {OBJECTIVES.length - POPULAR.length} objectifs <ArrowRight className="size-3.5" /></Link>
      </section>

      {/* ── Deux façons de travailler ── */}
      <section className={`${wrap} pb-16 sm:pb-20`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-line bg-surface p-7 shadow-card">
            <span className={cn("flex size-11 items-center justify-center rounded-xl", TILE_TONES.marigold)}><Sparkles className="size-5" /></span>
            <h3 className="mt-4 text-2xl font-semibold">Je crée moi-même</h3>
            <p className="mt-1.5 text-sm text-ink-soft">Dès <span className="tnum font-semibold text-ink">{formatFcfa(minFee)}</span></p>
            <Button asChild className="mt-6 self-start"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
          </div>
          <div className="bg-brand relative flex flex-col overflow-hidden rounded-2xl p-7 text-white shadow-lift">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
            <div className="relative flex flex-1 flex-col">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-marigold"><Headset className="size-5" /></span>
              <h3 className="mt-4 text-2xl font-semibold text-white">Un expert s&apos;en charge</h3>
              <p className="mt-1.5 text-sm text-white/80">{expertFee ? <>Dès <span className="tnum font-semibold text-white">{formatFcfa(expertFee)}</span></> : "Textes et visuels compris"}</p>
              <Button asChild variant="accent" className="mt-6 self-start"><Link href="/app/expert">Confier à un expert <ArrowRight /></Link></Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section className="border-y border-line bg-paper">
        <div className={`${wrap} grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16`}>
          <div>
            <h2 className={title}>Des prix clairs</h2>
            <ul className="mt-6 space-y-3">
              {PROMISES.map((p, i) => (
                <li key={p.text} className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 shadow-card">
                  <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", TILE_TONES[toneAt(i)])}>{p.icon}</span>
                  <span className="text-[15px] font-medium text-ink">{p.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Résultats non garantis.</p>
              <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green hover:underline">Tous les tarifs <ArrowRight className="size-3.5" /></Link>
            </div>
          </div>
          {example && (
            <div className="relative mx-auto w-full max-w-sm">
              <div aria-hidden className="absolute -right-3 -top-3 h-full w-full rounded-2xl border border-line-strong bg-sand" />
              <div className="relative rounded-2xl border border-line-strong bg-surface p-6 shadow-pop">
                <div className="flex items-center justify-between"><p className="eyebrow">Exemple</p><PlatformBadge platform="FACEBOOK" size="sm" /></div>
                <p className="mt-3 font-display text-lg font-semibold">Page plus connue</p>
                <p className="text-[13px] text-muted">10 jours · Cotonou</p>
                <dl className="mt-5 space-y-3 text-sm">
                  {example.lines.map((l) => (
                    <div key={l.kind} className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-soft">{l.kind === "AD_BUDGET" ? "Budget publicitaire" : l.kind === "SERVICE_FEE" ? "Prestation" : "Frais Mobile Money"}</dt>
                      <dd className="tnum font-medium">{formatFcfa(l.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-line-strong pt-3">
                    <dt className="font-semibold">Total</dt>
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
          <h2 className={title}>Questions</h2>
          <div className="mt-8 space-y-2.5">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-line bg-surface px-5 py-4 shadow-card open:border-line-strong">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-soft text-green [&_svg]:size-[18px]">{f.icon}</span>{f.q}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 pl-12 text-sm leading-relaxed text-muted">{f.a}</p>
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
            <h2 className="mx-auto max-w-xl text-[30px] font-semibold leading-tight text-white sm:text-[42px]">Prêt à vous lancer ?</h2>
            <p className="mx-auto mt-3 max-w-md text-white/75">Compte gratuit. Vous payez à la commande.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"><Link href="/app/expert"><Headset />Un expert s&apos;en charge</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
