// Formats de sortie de l'assistant. Les mêmes schémas valident la réponse d'un modèle d'IA
// et celle du moteur de suggestions guidées : l'interface ne dépend pas du fournisseur.
import { z } from "zod";

const s = (max = 600) => z.string().trim().min(1).transform((v) => v.slice(0, max));
const list = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).default([]).transform((v) => v.slice(0, max));

export const strategySchema = z.object({
  analysis: s(1200),
  sellingPoints: list(s(240), 6),
  audiences: list(z.object({ name: s(80), description: s(400), interests: list(s(60), 8) }), 4),
  hooks: list(s(160), 6),
  texts: list(z.object({ headline: s(90), body: s(900), cta: s(40) }), 4),
  ctas: list(s(40), 5),
  videoIdeas: list(z.object({ title: s(100), script: s(700) }), 4),
  visualConcepts: list(z.object({ title: s(100), description: s(500) }), 4),
  formats: list(z.object({ format: s(60), reason: s(300) }), 5),
  variants: list(z.object({ name: s(60), angle: s(240), audience: s(200), headline: s(90), body: s(900), cta: s(40) }), 3),
});
export type Strategy = z.infer<typeof strategySchema>;

export const targetingAdviceSchema = z.object({
  cities: list(s(60), 12),
  ageMin: z.coerce.number().int().min(18).max(65).catch(18),
  ageMax: z.coerce.number().int().min(18).max(65).catch(45),
  gender: z.enum(["ALL", "FEMALE", "MALE"]).catch("ALL"),
  interests: list(s(60), 12),
  categories: list(s(60), 6),
  rationale: s(900),
});
export type TargetingAdvice = z.infer<typeof targetingAdviceSchema>;

export const diagnosticSchema = z.object({
  summary: s(900),
  strengths: list(s(300), 6),
  weaknesses: list(s(300), 6),
  priorities: list(z.object({ title: s(100), action: s(500) }), 6),
  campaignSuggestions: list(z.object({ objective: s(80), why: s(400) }), 4),
});
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const calendarSchema = z.object({
  entries: list(
    z.object({
      dayOffset: z.coerce.number().int().min(0).max(60),
      platform: z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK"]).catch("FACEBOOK"),
      title: s(120),
      caption: s(900),
      hashtags: list(s(40), 10),
    }),
    31,
  ),
});
export type CalendarPlan = z.infer<typeof calendarSchema>;

export const ideasSchema = z.object({ ideas: list(z.object({ title: s(120), format: s(60), description: s(500) }), 12) });
export type Ideas = z.infer<typeof ideasSchema>;

export const captionsSchema = z.object({ captions: list(s(1200), 6) });
export type Captions = z.infer<typeof captionsSchema>;

export const hashtagsSchema = z.object({ hashtags: list(s(40), 30), note: s(400).optional() });
export type Hashtags = z.infer<typeof hashtagsSchema>;

export const competitionSchema = z.object({
  summary: s(900),
  observations: list(s(400), 8),
  opportunities: list(s(400), 6),
  limits: s(400),
});
export type Competition = z.infer<typeof competitionSchema>;

export const adviceSchema = z.object({ answer: s(2400), steps: list(s(300), 8) });
export type Advice = z.infer<typeof adviceSchema>;

export const AI_TASKS = {
  strategy: { schema: strategySchema, label: "Stratégie publicitaire", needsModel: false },
  targeting: { schema: targetingAdviceSchema, label: "Optimisation du ciblage", needsModel: false },
  diagnostic: { schema: diagnosticSchema, label: "Diagnostic d'entreprise", needsModel: false },
  calendar: { schema: calendarSchema, label: "Calendrier éditorial", needsModel: false },
  ideas: { schema: ideasSchema, label: "Idées de publications", needsModel: false },
  captions: { schema: captionsSchema, label: "Légendes", needsModel: false },
  hashtags: { schema: hashtagsSchema, label: "Hashtags", needsModel: false },
  competition: { schema: competitionSchema, label: "Analyse de la concurrence", needsModel: true },
  advice: { schema: adviceSchema, label: "Conseil personnalisé", needsModel: true },
} as const;

export type AiTaskKind = keyof typeof AI_TASKS;

/** Contexte métier transmis à l'assistant. Seules ces informations, fournies par le client, sont utilisées. */
export type BusinessContext = {
  businessName: string;
  sector: string;
  description?: string;
  productName?: string;
  productDescription?: string;
  productPrice?: number | null;
  city?: string;
  country?: string;
  audienceNote?: string;
  objectiveLabel?: string;
  objectiveCode?: string;
  platforms?: string[];
  extra?: Record<string, string>;
};

// ── Garde-fous publicitaires (politiques Meta et TikTok) ──
const POLICY_RULES: { pattern: RegExp; message: string }[] = [
  { pattern: /\bgaranti(e|s|es)?\b|\b100\s?%/i, message: "Évitez les promesses de résultat garanti : les plateformes les refusent et nous ne pouvons pas les tenir." },
  { pattern: /\b(perd(re|ez)|maigri(r|ssez))\b.{0,30}\b\d+\s?(kg|kilos)/i, message: "Les promesses chiffrées de perte de poids sont interdites." },
  { pattern: /avant\s*\/?\s*apr[eè]s/i, message: "Les comparaisons « avant / après » sont refusées pour la santé, la beauté et la minceur." },
  { pattern: /\b(gagne[zr]?|devene[zr]?\s+riche|revenus?)\b.{0,40}\b(facile(ment)?|rapide(ment)?|sans effort)/i, message: "Les promesses de gains faciles ou rapides sont interdites." },
  { pattern: /\b(guéri[tr]?|soigne|traite)\b.{0,40}\b(diabète|cancer|sida|vih|hypertension|stérilité)/i, message: "Les allégations de guérison de maladies sont interdites." },
  { pattern: /\b(êtes-vous|tu es|vous êtes|souffrez-vous)\b.{0,40}\b(gros|grosse|obèse|malade|endetté|pauvre|célibataire|diabétique|stérile)/i, message: "N'évoquez pas directement une caractéristique personnelle du lecteur (santé, finances, situation)." },
  { pattern: /\b(abonnés|followers|vues|likes)\b.{0,20}\b(garantis?|assurés?)|\b\d+\s?(k|000)?\s?(abonnés|followers|vues)\s+(en|sous)\s+\d+/i, message: "Ne promettez pas un nombre d'abonnés ou de vues." },
];

export function policyWarnings(text: string): string[] {
  return Array.from(new Set(POLICY_RULES.filter((r) => r.pattern.test(text)).map((r) => r.message)));
}
