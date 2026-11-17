// Paramètres configurables depuis l'administration. Module pur (testable, sans accès base).

/** Plancher absolu : aucune prestation ne peut être facturée moins de 10 000 FCFA, quel que soit le réglage. */
export const HARD_MIN_SERVICE_FEE = 10_000;

export type PlatformSettings = {
  minServiceFee: number;
  extraPlatformFee: number; // supplément par famille de plateformes supplémentaire (Meta, TikTok)
  paymentFeePercent: number;
  paymentFeePayer: "CLIENT" | "PLATFORM";
  minAdBudget: number;
  minDailyBudget: number;
  maxAdBudget: number;
  paymentExpiryMinutes: number;
  loyaltyPointsPer1000: number; // points gagnés par tranche de 1 000 F de prestation
  loyaltyPointValue: number; // valeur d'un point en FCFA lors de la conversion en bon
  loyaltyMinRedeem: number;
  referralReward: number; // bon offert au parrain au premier paiement du filleul
  companyName: string;
  companyAddress: string;
  companyTaxId: string;
  supportWhatsapp: string;
  supportEmail: string;
  agencyFacebookName: string; // nom du profil Facebook que les clients ajoutent à leur page
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  minServiceFee: 10_000,
  extraPlatformFee: 5_000,
  paymentFeePercent: 1.8,
  paymentFeePayer: "CLIENT",
  minAdBudget: 5_000,
  minDailyBudget: 1_000,
  maxAdBudget: 5_000_000,
  paymentExpiryMinutes: 15,
  loyaltyPointsPer1000: 1,
  loyaltyPointValue: 20,
  loyaltyMinRedeem: 100,
  referralReward: 2_000,
  companyName: "RegisPub",
  companyAddress: "Cotonou, Bénin",
  companyTaxId: "",
  supportWhatsapp: "",
  supportEmail: "",
  agencyFacebookName: "",
};

const int = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v: unknown, fallback: string, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : fallback);

export function sanitizeSettings(raw: Record<string, unknown>): PlatformSettings {
  const d = DEFAULT_SETTINGS;
  const pct = Number(raw.paymentFeePercent);
  return {
    minServiceFee: int(raw.minServiceFee, d.minServiceFee, HARD_MIN_SERVICE_FEE, 1_000_000),
    extraPlatformFee: int(raw.extraPlatformFee, d.extraPlatformFee, 0, 500_000),
    paymentFeePercent: Number.isFinite(pct) ? Math.min(10, Math.max(0, Math.round(pct * 100) / 100)) : d.paymentFeePercent,
    paymentFeePayer: raw.paymentFeePayer === "PLATFORM" ? "PLATFORM" : "CLIENT",
    minAdBudget: int(raw.minAdBudget, d.minAdBudget, 1_000, 1_000_000),
    minDailyBudget: int(raw.minDailyBudget, d.minDailyBudget, 500, 100_000),
    maxAdBudget: int(raw.maxAdBudget, d.maxAdBudget, 10_000, 100_000_000),
    paymentExpiryMinutes: int(raw.paymentExpiryMinutes, d.paymentExpiryMinutes, 5, 120),
    loyaltyPointsPer1000: int(raw.loyaltyPointsPer1000, d.loyaltyPointsPer1000, 0, 100),
    loyaltyPointValue: int(raw.loyaltyPointValue, d.loyaltyPointValue, 1, 1_000),
    loyaltyMinRedeem: int(raw.loyaltyMinRedeem, d.loyaltyMinRedeem, 1, 100_000),
    referralReward: int(raw.referralReward, d.referralReward, 0, 100_000),
    companyName: text(raw.companyName, d.companyName, 80) || d.companyName,
    companyAddress: text(raw.companyAddress, d.companyAddress),
    companyTaxId: text(raw.companyTaxId, d.companyTaxId, 40),
    supportWhatsapp: text(raw.supportWhatsapp, d.supportWhatsapp, 30),
    supportEmail: text(raw.supportEmail, d.supportEmail, 120),
    agencyFacebookName: text(raw.agencyFacebookName, d.agencyFacebookName, 80),
  };
}
