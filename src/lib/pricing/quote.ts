// Calcul du devis. Module pur : toute la tarification passe par ici, côté serveur.
// Le budget publicitaire (reversé à Meta/TikTok) et les frais de prestation ne sont jamais mélangés.
import { getObjective } from "@/lib/catalog/objectives";
import { platformFamilies, type PlatformCode } from "@/lib/catalog/platforms";
import { HARD_MIN_SERVICE_FEE, type PlatformSettings } from "@/lib/settings-schema";
import { formatFcfa } from "@/lib/utils";

export type ServicePrice = { code: string; name: string; kind: string; fee: number; active: boolean };
export type PromoInput = { id: string; code: string; type: "PERCENT" | "FIXED"; value: number; minServiceFee: number | null };

export type QuoteLine = { kind: "AD_BUDGET" | "SERVICE_FEE" | "EXTRA_PLATFORM" | "DISCOUNT" | "PAYMENT_FEE"; label: string; amount: number; hint?: string };

export type Quote = {
  serviceCode: string;
  serviceLabel: string;
  adBudget: number;
  serviceFee: number; // prestation avant remise (supplément multi-plateformes inclus)
  discount: number;
  netServiceFee: number;
  paymentFee: number;
  total: number;
  lines: QuoteLine[];
  notes: string[];
  promoCodeId: string | null;
};

export class QuoteError extends Error {}

export function effectiveMinFee(settings: Pick<PlatformSettings, "minServiceFee">) {
  return Math.max(HARD_MIN_SERVICE_FEE, settings.minServiceFee);
}

export function computePaymentFee(subtotal: number, settings: Pick<PlatformSettings, "paymentFeePercent" | "paymentFeePayer">) {
  if (settings.paymentFeePayer !== "CLIENT" || settings.paymentFeePercent <= 0) return 0;
  return Math.ceil((subtotal * settings.paymentFeePercent) / 100);
}

/** Applique une remise sans jamais faire passer la prestation sous le tarif plancher. */
export function applyDiscount(fee: number, promo: PromoInput | null | undefined, minFee: number) {
  if (!promo) return { discount: 0, capped: false };
  if (promo.minServiceFee && fee < promo.minServiceFee) return { discount: 0, capped: false, ineligible: true as const };
  const raw = promo.type === "PERCENT" ? Math.floor((fee * Math.min(100, promo.value)) / 100) : promo.value;
  const max = Math.max(0, fee - minFee);
  return { discount: Math.max(0, Math.min(raw, max)), capped: raw > max };
}

function assemble(args: {
  serviceCode: string; serviceLabel: string; adBudget: number; baseFee: number; extra: number; extraLabel?: string;
  promo?: PromoInput | null; settings: PlatformSettings; notes?: string[];
}): Quote {
  const { settings } = args;
  const minFee = effectiveMinFee(settings);
  const notes = [...(args.notes ?? [])];
  const baseFee = Math.max(args.baseFee, minFee);
  const serviceFee = baseFee + args.extra;
  const d = applyDiscount(serviceFee, args.promo, minFee);
  if (args.promo && "ineligible" in d) notes.push(`Le code ${args.promo.code} s'applique à partir de ${formatFcfa(args.promo.minServiceFee ?? 0)} de prestation.`);
  else if (args.promo && d.capped) notes.push(`Remise plafonnée : la prestation ne peut pas descendre sous ${formatFcfa(minFee)}.`);
  const netServiceFee = serviceFee - d.discount;
  const subtotal = args.adBudget + netServiceFee;
  const paymentFee = computePaymentFee(subtotal, settings);

  const lines: QuoteLine[] = [];
  if (args.adBudget > 0) lines.push({ kind: "AD_BUDGET", label: "Budget publicitaire", amount: args.adBudget, hint: "Intégralement dépensé sur les plateformes" });
  lines.push({ kind: "SERVICE_FEE", label: `Prestation — ${args.serviceLabel}`, amount: baseFee });
  if (args.extra > 0) lines.push({ kind: "EXTRA_PLATFORM", label: args.extraLabel ?? "Supplément multi-plateformes", amount: args.extra });
  if (d.discount > 0) lines.push({ kind: "DISCOUNT", label: `Remise ${args.promo!.code}`, amount: -d.discount });
  if (paymentFee > 0) lines.push({ kind: "PAYMENT_FEE", label: `Frais de paiement Mobile Money (${String(settings.paymentFeePercent).replace(".", ",")} %)`, amount: paymentFee });

  return {
    serviceCode: args.serviceCode, serviceLabel: args.serviceLabel, adBudget: args.adBudget, serviceFee, discount: d.discount,
    netServiceFee, paymentFee, total: subtotal + paymentFee, lines, notes, promoCodeId: d.discount > 0 ? args.promo!.id : null,
  };
}

export type CampaignQuoteInput = {
  objectiveCode: string;
  /** Niveau d'accompagnement choisi : null = prestation liée à l'objectif. */
  levelCode: string | null;
  platforms: PlatformCode[];
  adBudget: number;
  durationDays: number;
  promo?: PromoInput | null;
};

export function validateBudget(adBudget: number, durationDays: number, settings: PlatformSettings): string | null {
  if (!Number.isInteger(adBudget) || adBudget < settings.minAdBudget) return `Le budget publicitaire minimum est de ${formatFcfa(settings.minAdBudget)}.`;
  if (adBudget > settings.maxAdBudget) return `Le budget publicitaire maximum en ligne est de ${formatFcfa(settings.maxAdBudget)}. Contactez-nous pour un montant supérieur.`;
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) return "La durée doit être comprise entre 1 et 90 jours.";
  if (adBudget / durationDays < settings.minDailyBudget) {
    return `Le budget quotidien doit être d'au moins ${formatFcfa(settings.minDailyBudget)} : augmentez le budget ou réduisez la durée (${Math.floor(adBudget / settings.minDailyBudget)} jours maximum pour ce montant).`;
  }
  return null;
}

export function computeCampaignQuote(input: CampaignQuoteInput, services: ServicePrice[], settings: PlatformSettings): Quote {
  const objective = getObjective(input.objectiveCode);
  if (!objective) throw new QuoteError("Objectif publicitaire inconnu.");
  if (!input.platforms.length) throw new QuoteError("Sélectionnez au moins une plateforme.");
  const budgetIssue = validateBudget(input.adBudget, input.durationDays, settings);
  if (budgetIssue) throw new QuoteError(budgetIssue);

  const find = (code: string) => services.find((s) => s.code === code && s.active);
  const base = find(objective.serviceCode);
  if (!base) throw new QuoteError("La prestation associée à cet objectif n'est pas disponible pour le moment.");
  let chosen = base;
  if (input.levelCode && input.levelCode !== base.code) {
    const level = find(input.levelCode);
    if (!level || (level.kind !== "PACK" && level.kind !== "MANAGEMENT")) throw new QuoteError("Niveau d'accompagnement indisponible.");
    // Un niveau supérieur ne coûte jamais moins que la prestation de base de l'objectif.
    chosen = level.fee >= base.fee ? level : { ...level, fee: base.fee };
  }
  const families = platformFamilies(input.platforms);
  const extra = Math.max(0, families.length - 1) * settings.extraPlatformFee;
  return assemble({
    serviceCode: chosen.code, serviceLabel: chosen.name, adBudget: input.adBudget, baseFee: chosen.fee, extra,
    extraLabel: "Supplément plateforme supplémentaire (Meta + TikTok)", promo: input.promo, settings,
  });
}

/** Devis d'une prestation sans budget publicitaire (abonnement, accompagnement). */
export function computeServiceQuote(service: ServicePrice, settings: PlatformSettings, promo?: PromoInput | null): Quote {
  if (!service.active) throw new QuoteError("Cette prestation n'est plus proposée.");
  return assemble({ serviceCode: service.code, serviceLabel: service.name, adBudget: 0, baseFee: service.fee, extra: 0, promo, settings });
}

export function loyaltyPointsFor(netServiceFee: number, settings: Pick<PlatformSettings, "loyaltyPointsPer1000">) {
  return Math.floor(netServiceFee / 1000) * settings.loyaltyPointsPer1000;
}
