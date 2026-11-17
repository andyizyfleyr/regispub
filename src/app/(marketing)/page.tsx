import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Headset } from "lucide-react";
import { ObjectiveIcon, OperatorChip, PlatformBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Figures, List, ListRow } from "@/components/ui/list";
import { db } from "@/lib/db";
import { getObjective, OBJECTIVES } from "@/lib/catalog/objectives";
import { computeCampaignQuote } from "@/lib/pricing/quote";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/utils";

const STEPS = [
  { title: "Choisissez votre objectif", text: "Vendre, recevoir des messages WhatsApp, gagner des abonnés…" },
  { title: "Présentez votre offre", text: "Une photo et quelques mots. Nous proposons le texte et l'audience." },
  { title: "Payez par Mobile Money", text: "MTN, Moov ou Celtiis. Vous validez sur votre téléphone." },
  { title: "Suivez vos résultats", text: "Notre équipe lance la campagne. Les chiffres s'affichent dans votre espace." },
];
const POPULAR = ["whatsapp_orders", "sales", "page_awareness", "leads"];

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

  const wrap = "mx-auto max-w-3xl px-5";
  const title = "text-[26px] font-semibold leading-tight sm:text-[32px]";

  return (
    <>
      {/* ── Accroche ── */}
      <section className={`${wrap} animate-rise pb-14 pt-12 sm:pb-20 sm:pt-20`}>
        <div className="mb-5 flex items-center gap-2">
          <PlatformBadge platform="FACEBOOK" size="sm" /><PlatformBadge platform="INSTAGRAM" size="sm" /><PlatformBadge platform="TIKTOK" size="sm" />
          <span className="ml-1 text-[13px] text-muted">Publicité sans carte bancaire</span>
        </div>
        <h1 className="text-[36px] font-semibold leading-[1.06] sm:text-[52px]">Votre publicité sur Facebook, Instagram et TikTok, payée par Mobile Money.</h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">Vous décrivez ce que vous vendez. Notre équipe vérifie, lance et suit votre campagne.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/app/expert"><Headset /> Confier à un expert</Link></Button>
        </div>
      </section>

      {/* ── Fonctionnement ── */}
      <section id="fonctionnement" className={`${wrap} scroll-mt-20 pb-14 sm:pb-20`}>
        <h2 className={title}>Comment ça marche</h2>
        <List className="mt-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4 px-4 py-4 sm:px-5">
              <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-green-soft text-sm font-semibold text-green">{i + 1}</span>
              <span><span className="block font-medium leading-snug text-ink">{s.title}</span><span className="mt-0.5 block text-sm leading-relaxed text-muted">{s.text}</span></span>
            </li>
          ))}
        </List>
      </section>

      {/* ── Objectifs ── */}
      <section id="objectifs" className={`${wrap} scroll-mt-20 pb-14 sm:pb-20`}>
        <h2 className={title}>Ce que vous pouvez obtenir</h2>
        <List className="mt-6">
          {POPULAR.map((code) => { const o = getObjective(code); return o ? <ListRow key={code} href="/app/creer" icon={<ObjectiveIcon name={o.icon} />} tone="green" title={o.label} subtitle={o.description} /> : null; })}
        </List>
        <p className="mt-3 text-sm text-muted">Et {OBJECTIVES.length - POPULAR.length} autres objectifs : abonnés, vues vidéo, événements, demandes de devis…</p>
      </section>

      {/* ── Tarifs ── */}
      <section className={`${wrap} pb-14 sm:pb-20`}>
        <h2 className={title}>Vous savez ce que vous payez</h2>
        <p className="mt-3 text-ink-soft">Le budget publicitaire et notre prestation sont toujours affichés séparément. Prestation à partir de <span className="tnum font-medium text-ink">{formatFcfa(minFee)}</span>.</p>
        {example && (
          <>
            <p className="mb-2.5 mt-6 text-[13.5px] text-muted">Exemple : faire connaître ma page sur Facebook pendant 10 jours.</p>
            <Figures items={[
              ...example.lines.map((l) => ({ label: l.kind === "AD_BUDGET" ? "Budget publicitaire" : l.kind === "SERVICE_FEE" ? "Notre prestation" : "Frais Mobile Money", hint: l.kind === "AD_BUDGET" ? "Reversé en totalité aux plateformes" : undefined, value: formatFcfa(l.amount) })),
              { label: <span className="font-semibold text-ink">Total à payer</span>, value: formatFcfa(example.total), strong: true },
            ]} />
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2"><OperatorChip operator="MTN" /><OperatorChip operator="MOOV" /><OperatorChip operator="CELTIIS" /></span>
          <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline">Tous les services et tarifs <ArrowRight className="size-3.5" /></Link>
        </div>
      </section>

      {/* ── Engagements ── */}
      <section className={`${wrap} pb-14 sm:pb-20`}>
        <h2 className={title}>Nos engagements</h2>
        <List className="mt-6">
          {["Votre budget publicitaire est investi en totalité sur les plateformes.", "Un paiement n'est confirmé qu'après vérification auprès de l'opérateur.", "Vous validez les créations avant toute diffusion.", "Les statistiques affichées proviennent des plateformes, jamais d'estimations."].map((t) => (
            <li key={t} className="flex items-start gap-3 px-4 py-3.5 text-[15px] text-ink-soft sm:px-5"><Check className="mt-0.5 size-[18px] shrink-0 text-green" />{t}</li>
          ))}
        </List>
        <p className="mt-3 text-sm text-muted">Nous ne promettons pas un nombre garanti d&apos;abonnés ou de ventes : les résultats dépendent aussi de votre offre et de vos visuels.</p>
      </section>

      {/* ── Questions ── */}
      <section id="questions" className={`${wrap} scroll-mt-20 pb-14 sm:pb-20`}>
        <h2 className={title}>Questions fréquentes</h2>
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3.5 sm:px-5">
              <summary className="flex list-none items-center justify-between gap-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className="bg-forest text-white">
        <div className={`${wrap} py-14 sm:py-16`}>
          <h2 className="text-[28px] font-semibold leading-tight sm:text-[36px]">Votre première campagne peut partir cette semaine.</h2>
          <p className="mt-3 text-white/70">Créez votre compte gratuitement. Vous ne payez qu&apos;au moment de commander.</p>
          <div className="mt-6"><Button asChild size="lg" variant="accent"><Link href="/app/creer">Créer ma publicité <ArrowRight /></Link></Button></div>
        </div>
      </section>
    </>
  );
}
