"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import type { EditorData, LinkedAsset } from "@/lib/campaigns/editor-data";
import { getObjective, OBJECTIVE_CATEGORIES, OBJECTIVES, type ObjectiveCategory } from "@/lib/catalog/objectives";
import { PLATFORM_CHOICES, type PlatformCode } from "@/lib/catalog/platforms";
import { SECTORS } from "@/lib/catalog/targeting";
import { placeOrderAction, saveCampaignAction } from "@/server/actions/campaigns";
import { BudgetFields, LevelPicker, QuotePanel, useQuote } from "./parts";
import { MediaGrid } from "./wizard";

export function ExpertBrief({ data }: { data: EditorData }) {
  const router = useRouter();
  const c = data.campaign;
  const b0 = data.businesses.find((b) => b.id === c.businessId) ?? data.businesses[0] ?? null;
  const [s, setS] = React.useState({
    ...c, business: b0 ? { ...b0 } : { id: null as string | null, name: "", sector: "", city: "Cotonou" },
    platforms: c.platforms.length ? c.platforms : (["FACEBOOK", "INSTAGRAM"] as PlatformCode[]), adBudget: c.adBudget || 30_000, durationDays: c.durationDays ?? 10,
    serviceCode: (c.serviceCode ?? data.levels.find((l) => l.kind === "MANAGEMENT")?.code ?? data.levels[0]?.code ?? null) as string | null,
  });
  const [links, setLinks] = React.useState<LinkedAsset[]>(data.links);
  const [promo, setPromo] = React.useState(data.promoCode ?? "");
  const [busy, setBusy] = React.useState<null | "save" | "order">(null);
  const [error, setError] = React.useState<string | null>(null);
  const set = (patch: Partial<typeof s>) => setS((prev) => ({ ...prev, ...patch }));
  const objective = getObjective(s.objective);
  const quote = useQuote(c.id, { adBudget: s.adBudget, durationDays: s.durationDays ?? 0, serviceCode: s.serviceCode, platforms: s.platforms, promoCode: promo });
  const choice = PLATFORM_CHOICES.find((p) => p.platforms.length === s.platforms.length && p.platforms.every((x) => s.platforms.includes(x)))?.id ?? "meta";
  const available = OBJECTIVES.filter((o) => o.platforms.some((p) => s.platforms.includes(p)));

  async function save(thenOrder: boolean) {
    setError(null);
    if (!s.objective) { setError("Choisissez l'objectif principal de votre campagne."); return; }
    setBusy(thenOrder ? "order" : "save");
    const res = await saveCampaignAction(c.id, {
      platforms: s.platforms, objective: s.objective, business: s.business, name: s.name, brief: s.brief, productName: s.productName, productPrice: s.productPrice,
      destinationWhatsapp: s.destinationWhatsapp, destinationUrl: s.destinationUrl, adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "",
      budgetSplit: s.budgetSplit, serviceCode: s.serviceCode, wizardStep: 7,
    });
    if (!res.ok) { setBusy(null); setError(res.error); return; }
    if (!thenOrder) { setBusy(null); router.push("/app/campagnes?etat=attente"); return; }
    const order = await placeOrderAction(c.id, promo || null);
    if (!order.ok) { setBusy(null); setError(order.error); return; }
    router.push(`/app/paiements/${order.data.orderId as string}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow">Votre besoin</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plateformes" htmlFor="eb-platforms">
              <Select id="eb-platforms" value={choice} onChange={(e) => { const p = PLATFORM_CHOICES.find((x) => x.id === e.target.value)!.platforms; const o = getObjective(s.objective); set({ platforms: p, objective: o && o.platforms.some((x) => p.includes(x)) ? s.objective : null, budgetSplit: Object.fromEntries(p.map((x, i) => [x, Math.floor(100 / p.length) + (i === 0 ? 100 - Math.floor(100 / p.length) * p.length : 0)])) }); }}>
                {PLATFORM_CHOICES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Objectif principal" htmlFor="eb-objective">
              <Select id="eb-objective" value={s.objective ?? ""} onChange={(e) => set({ objective: e.target.value })}>
                <option value="" disabled>Choisir…</option>
                {(Object.keys(OBJECTIVE_CATEGORIES) as ObjectiveCategory[]).map((cat) => (
                  <optgroup key={cat} label={OBJECTIVE_CATEGORIES[cat].label}>{available.filter((o) => o.category === cat).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</optgroup>
                ))}
              </Select>
            </Field>
          </div>
          {objective && <p className="text-[13px] text-muted">{objective.description}</p>}
          <Field label="Décrivez votre besoin" htmlFor="eb-brief" hint={`${s.brief.trim().length} / 3 000 — votre activité, ce que vous voulez promouvoir, votre clientèle, vos contraintes.`}>
            <Textarea id="eb-brief" rows={7} maxLength={3000} value={s.brief} onChange={(e) => set({ brief: e.target.value })} placeholder="Je vends des perruques naturelles à Cotonou. Je veux recevoir plus de commandes sur WhatsApp pour la collection de fin d'année. Mes clientes ont entre 20 et 40 ans…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Produit ou service concerné" htmlFor="eb-product" optional><Input id="eb-product" maxLength={120} value={s.productName} onChange={(e) => set({ productName: e.target.value })} /></Field>
            <Field label="Nom de la campagne" htmlFor="eb-name"><Input id="eb-name" maxLength={80} value={s.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow">Votre entreprise</h2>
          {data.businesses.length > 0 && (
            <Field label="Entreprise" htmlFor="eb-business">
              <Select id="eb-business" value={s.business.id ?? ""} onChange={(e) => { const b = data.businesses.find((x) => x.id === e.target.value); set({ business: b ? { ...b } : { id: null, name: "", sector: "", city: "" } }); }}>
                {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}<option value="">+ Nouvelle entreprise</option>
              </Select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nom" htmlFor="eb-bname"><Input id="eb-bname" maxLength={80} value={s.business.name} onChange={(e) => set({ business: { ...s.business, name: e.target.value } })} /></Field>
            <Field label="Secteur" htmlFor="eb-sector"><Select id="eb-sector" value={s.business.sector} onChange={(e) => set({ business: { ...s.business, sector: e.target.value } })}><option value="" disabled>Choisir…</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Ville" htmlFor="eb-city"><Input id="eb-city" maxLength={60} value={s.business.city} onChange={(e) => set({ business: { ...s.business, city: e.target.value } })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp" htmlFor="eb-wa" optional><Input id="eb-wa" inputMode="tel" maxLength={40} value={s.destinationWhatsapp} onChange={(e) => set({ destinationWhatsapp: e.target.value })} placeholder="01 97 00 00 00" /></Field>
            <Field label="Lien de votre page" htmlFor="eb-url" optional><Input id="eb-url" type="url" maxLength={300} value={s.destinationUrl} onChange={(e) => set({ destinationUrl: e.target.value })} placeholder="https://facebook.com/votrepage" /></Field>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow">Vos fichiers</h2>
          <p className="mt-1 text-sm text-muted">Photos, vidéos, logo, catalogue PDF : tout ce qui peut aider notre équipe.</p>
          <MediaGrid campaignId={c.id} role="BRIEF_FILE" items={links.filter((l) => l.role === "BRIEF_FILE")} setLinks={setLinks} library={data.library} accept="any" />
        </section>

        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="eyebrow mb-4">Budget publicitaire et durée</h2>
          <BudgetFields data={data} value={{ adBudget: s.adBudget, durationDays: s.durationDays ?? 0, startDate: s.startDate ?? "", budgetSplit: s.budgetSplit, platforms: s.platforms }} onChange={set}
            recommended={objective ? { daily: objective.config.recommendedDailyBudget, days: objective.config.recommendedDays } : null} />
        </section>

        <section>
          <h2 className="eyebrow mb-3">Formule</h2>
          <LevelPicker expert levels={data.levels} value={s.serviceCode} onChange={(serviceCode) => set({ serviceCode })} baseLabel="" baseFee={objective ? data.baseFees[objective.serviceCode] ?? data.limits.minServiceFee : data.limits.minServiceFee} />
        </section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <QuotePanel state={quote} promo={promo} onPromo={setPromo} />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="button" size="lg" variant="accent" className="w-full" disabled={busy !== null} onClick={() => save(true)}>{busy === "order" && <LoaderCircle className="animate-spin" />}Passer au paiement<ArrowRight /></Button>
        <Button type="button" variant="ghost" className="w-full" disabled={busy !== null} onClick={() => save(false)}>{busy === "save" && <LoaderCircle className="animate-spin" />}Enregistrer le brouillon</Button>
        <p className="text-xs leading-relaxed text-muted">Après paiement, un gestionnaire vous contacte par la messagerie de la campagne. Les créations vous sont soumises avant toute diffusion. <Link href="/conditions" className="underline">Conditions</Link></p>
      </aside>
    </div>
  );
}
