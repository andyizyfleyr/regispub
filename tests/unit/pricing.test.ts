import { describe, expect, it } from "vitest";
import { applyDiscount, computeCampaignQuote, computePaymentFee, computeServiceQuote, effectiveMinFee, loyaltyPointsFor, QuoteError, validateBudget, type PromoInput, type ServicePrice } from "@/lib/pricing/quote";
import { DEFAULT_SETTINGS, type PlatformSettings } from "@/lib/settings-schema";

const settings: PlatformSettings = { ...DEFAULT_SETTINGS };
const services: ServicePrice[] = [
  { code: "sales", name: "Campagne de ventes", kind: "CAMPAIGN", fee: 20_000, active: true },
  { code: "visibility", name: "Campagne de visibilité", kind: "CAMPAIGN", fee: 10_000, active: true },
  { code: "pack_creative_ads", name: "Pack création", kind: "PACK", fee: 20_000, active: true },
  { code: "full_management", name: "Gestion complète", kind: "MANAGEMENT", fee: 30_000, active: true },
  { code: "monthly_support", name: "Accompagnement mensuel", kind: "SUBSCRIPTION", fee: 50_000, active: true },
];
const promo = (over: Partial<PromoInput> = {}): PromoInput => ({ id: "p1", code: "TEST", type: "PERCENT", value: 10, minServiceFee: null, ...over });
const base = { objectiveCode: "whatsapp_orders", levelCode: null, platforms: ["FACEBOOK", "INSTAGRAM"] as const, adBudget: 25_000, durationDays: 10 };

describe("devis d'une campagne", () => {
  it("sépare budget publicitaire, prestation et frais Mobile Money", () => {
    const q = computeCampaignQuote({ ...base, platforms: [...base.platforms] }, services, settings);
    expect(q.adBudget).toBe(25_000);
    expect(q.serviceFee).toBe(20_000);
    expect(q.paymentFee).toBe(810); // 1,8 % de 45 000
    expect(q.total).toBe(45_810);
    expect(q.lines.map((l) => l.kind)).toEqual(["AD_BUDGET", "SERVICE_FEE", "PAYMENT_FEE"]);
  });

  it("ne facture pas de supplément pour Facebook + Instagram (même famille Meta) mais en facture un pour TikTok", () => {
    const meta = computeCampaignQuote({ ...base, platforms: ["FACEBOOK", "INSTAGRAM"] }, services, settings);
    const both = computeCampaignQuote({ ...base, platforms: ["FACEBOOK", "TIKTOK"] }, services, settings);
    expect(meta.serviceFee).toBe(20_000);
    expect(both.serviceFee).toBe(25_000);
    expect(both.lines.some((l) => l.kind === "EXTRA_PLATFORM" && l.amount === 5_000)).toBe(true);
  });

  it("n'applique jamais une prestation inférieure à 10 000 F, même si le réglage ou le tarif est plus bas", () => {
    expect(effectiveMinFee({ minServiceFee: 2_000 })).toBe(10_000);
    const cheap = services.map((s) => (s.code === "visibility" ? { ...s, fee: 3_000 } : s));
    const q = computeCampaignQuote({ ...base, objectiveCode: "page_awareness", platforms: ["FACEBOOK"] }, cheap, { ...settings, minServiceFee: 1_000 });
    expect(q.serviceFee).toBe(10_000);
  });

  it("plafonne une remise pour que la prestation reste au tarif plancher", () => {
    const q = computeCampaignQuote({ ...base, platforms: ["FACEBOOK"], promo: promo({ type: "FIXED", value: 50_000 }) }, services, settings);
    expect(q.discount).toBe(10_000);
    expect(q.netServiceFee).toBe(10_000);
    expect(q.notes.join(" ")).toMatch(/plafonnée/);
  });

  it("la remise ne porte que sur la prestation, jamais sur le budget publicitaire", () => {
    const q = computeCampaignQuote({ ...base, platforms: ["FACEBOOK"], promo: promo({ value: 10 }) }, services, settings);
    expect(q.discount).toBe(2_000);
    expect(q.adBudget).toBe(25_000);
    expect(q.total).toBe(25_000 + 18_000 + Math.ceil(43_000 * 0.018));
  });

  it("ignore un code dont le minimum de prestation n'est pas atteint", () => {
    const d = applyDiscount(15_000, promo({ minServiceFee: 20_000 }), 10_000);
    expect(d.discount).toBe(0);
  });

  it("un niveau d'accompagnement supérieur ne coûte jamais moins que la prestation de l'objectif", () => {
    const pricey = services.map((s) => (s.code === "sales" ? { ...s, fee: 40_000 } : s));
    const q = computeCampaignQuote({ ...base, platforms: ["FACEBOOK"], levelCode: "full_management" }, pricey, settings);
    expect(q.serviceCode).toBe("full_management");
    expect(q.serviceFee).toBe(40_000);
  });

  it("refuse un abonnement comme niveau d'accompagnement d'une campagne", () => {
    expect(() => computeCampaignQuote({ ...base, platforms: ["FACEBOOK"], levelCode: "monthly_support" }, services, settings)).toThrow(QuoteError);
  });

  it("refuse les budgets hors limites", () => {
    expect(validateBudget(4_000, 3, settings)).toMatch(/minimum/);
    expect(validateBudget(10_000, 20, settings)).toMatch(/quotidien/);
    expect(validateBudget(6_000_000, 30, settings)).toMatch(/maximum/);
    expect(validateBudget(20_000, 91, settings)).toMatch(/durée/);
    expect(validateBudget(20_000, 10, settings)).toBeNull();
    expect(() => computeCampaignQuote({ ...base, platforms: ["FACEBOOK"], adBudget: 1_000 }, services, settings)).toThrow(QuoteError);
  });

  it("refuse un objectif inconnu ou une prestation désactivée", () => {
    expect(() => computeCampaignQuote({ ...base, platforms: ["FACEBOOK"], objectiveCode: "nope" }, services, settings)).toThrow(QuoteError);
    const off = services.map((s) => (s.code === "sales" ? { ...s, active: false } : s));
    expect(() => computeCampaignQuote({ ...base, platforms: ["FACEBOOK"] }, off, settings)).toThrow(QuoteError);
  });
});

describe("frais et fidélité", () => {
  it("arrondit les frais de paiement au franc supérieur et les annule s'ils sont à la charge de la plateforme", () => {
    expect(computePaymentFee(10_001, settings)).toBe(181);
    expect(computePaymentFee(10_000, { ...settings, paymentFeePayer: "PLATFORM" })).toBe(0);
  });
  it("calcule un devis d'abonnement sans budget publicitaire", () => {
    const q = computeServiceQuote(services[4]!, settings);
    expect(q.adBudget).toBe(0);
    expect(q.total).toBe(50_000 + 900);
  });
  it("attribue les points sur la prestation nette uniquement", () => {
    expect(loyaltyPointsFor(18_900, settings)).toBe(18);
    expect(loyaltyPointsFor(900, settings)).toBe(0);
  });
});
