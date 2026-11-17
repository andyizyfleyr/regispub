// Numéros de téléphone Mobile Money.
// Bénin : depuis le 30/11/2024 les numéros comptent 10 chiffres (« 01 » + les 8 anciens chiffres).
export type OperatorCode = "MTN" | "MOOV" | "CELTIIS";

export type PaymentCountry = {
  code: string;
  name: string;
  dialCode: string;
  currency: "XOF";
  enabled: boolean;
  operators: { code: OperatorCode; label: string; ussdHint: string }[];
};

export const PAYMENT_COUNTRIES: PaymentCountry[] = [
  {
    code: "BJ", name: "Bénin", dialCode: "229", currency: "XOF", enabled: true,
    operators: [
      { code: "MTN", label: "MTN Mobile Money", ussdHint: "Validez la demande reçue sur votre téléphone, ou composez *880#." },
      { code: "MOOV", label: "Moov Money", ussdHint: "Validez la demande reçue sur votre téléphone, ou composez *855#." },
      { code: "CELTIIS", label: "Celtiis Cash", ussdHint: "Validez la demande reçue sur votre téléphone avec votre code Celtiis Cash." },
    ],
  },
  { code: "TG", name: "Togo", dialCode: "228", currency: "XOF", enabled: false, operators: [] },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "225", currency: "XOF", enabled: false, operators: [] },
  { code: "SN", name: "Sénégal", dialCode: "221", currency: "XOF", enabled: false, operators: [] },
  { code: "BF", name: "Burkina Faso", dialCode: "226", currency: "XOF", enabled: false, operators: [] },
  { code: "NE", name: "Niger", dialCode: "227", currency: "XOF", enabled: false, operators: [] },
];

// Préfixes historiques (2 premiers chiffres de l'ancien numéro à 8 chiffres). Les plans de
// numérotation évoluent : ces listes servent uniquement à suggérer l'opérateur, jamais à bloquer.
const BJ_PREFIX_HINTS: Record<OperatorCode, string[]> = {
  MTN: ["42", "46", "50", "51", "52", "53", "54", "56", "57", "59", "61", "62", "66", "67", "69", "90", "91", "96", "97"],
  MOOV: ["45", "55", "58", "60", "63", "64", "65", "68", "94", "95", "98", "99"],
  CELTIIS: ["40", "41", "43", "44", "47"],
};

export type NormalizedPhone = { e164: string; national: string; country: "BJ" };

/** Accepte « 01 97 00 00 00 », « +229 0197000000 », « 22997000000 », « 97000000 »… */
export function normalizeBeninPhone(input: string): NormalizedPhone | null {
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("00229")) digits = digits.slice(5);
  else if (digits.startsWith("229") && digits.length > 10) digits = digits.slice(3);
  if (digits.length === 8) digits = `01${digits}`;
  if (digits.length !== 10 || !digits.startsWith("01")) return null;
  return { e164: `+229${digits}`, national: digits, country: "BJ" };
}

export function guessBeninOperator(national: string): OperatorCode | null {
  const prefix = national.slice(2, 4);
  for (const [op, list] of Object.entries(BJ_PREFIX_HINTS) as [OperatorCode, string[]][]) {
    if (list.includes(prefix)) return op;
  }
  return null;
}

export function formatPhone(e164: string) {
  const m = e164.match(/^\+229(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+229 ${m.slice(1).join(" ")}` : e164;
}

export function maskPhone(e164: string) {
  const m = e164.match(/^\+229(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+229 ${m[1]} ${m[2]} •• •• ${m[5]}` : e164.replace(/\d(?=\d{2})/g, "•");
}

/** Lien wa.me à partir d'un numéro ou d'un lien fourni par le client. */
export function toWhatsappLink(value: string): string | null {
  const v = value.trim();
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(v)) return v;
  const p = normalizeBeninPhone(v);
  if (p) return `https://wa.me/${p.e164.slice(1)}`;
  const digits = v.replace(/[^\d]/g, "");
  return v.startsWith("+") && digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

/** Numéro de contact : béninois (normalisé) ou international au format +XXX. */
export function normalizeAnyPhone(input: string): string | null {
  const bj = normalizeBeninPhone(input);
  if (bj) return bj.e164;
  const compact = input.replace(/[\s.-]/g, "");
  return /^\+\d{8,15}$/.test(compact) ? compact : null;
}
