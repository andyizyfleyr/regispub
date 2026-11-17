import "server-only";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { AiError, extractJson, getImageProvider, getTextProvider } from "./providers";
import { rulesCalendar, rulesCaptions, rulesDiagnostic, rulesHashtags, rulesIdeas, rulesStrategy, rulesTargeting } from "./rules";
import { AI_TASKS, type AiTaskKind, type BusinessContext } from "./schemas";

const log = createLogger("ai");

const SYSTEM = `Tu es un consultant senior en marketing digital et publicité Meta Ads / TikTok Ads pour les petites entreprises d'Afrique de l'Ouest francophone, en particulier au Bénin.
Règles impératives :
- Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, en respectant exactement la structure demandée.
- Écris en français simple et concret, adapté au contexte local (WhatsApp, Mobile Money, livraison, repères de quartier). Les prix sont en francs CFA.
- N'invente aucun chiffre, aucune statistique, aucun témoignage, aucune caractéristique du produit : utilise seulement les informations fournies.
- Ne promets jamais de résultat garanti (abonnés, ventes, vues). Respecte les politiques publicitaires de Meta et TikTok : pas d'allégation de santé, pas de « avant/après », pas de gain facile, pas d'interpellation sur une caractéristique personnelle.
- Les textes publicitaires doivent être prêts à publier, sans crochets ni mentions à compléter.`;

const SHAPES: Record<AiTaskKind, string> = {
  strategy: `{"analysis": "analyse du produit et de l'angle recommandé", "sellingPoints": ["4 arguments commerciaux"], "audiences": [{"name": "", "description": "", "interests": [""]}], "hooks": ["5 accroches courtes"], "texts": [{"headline": "", "body": "", "cta": ""}], "ctas": [""], "videoIdeas": [{"title": "", "script": "déroulé seconde par seconde"}], "visualConcepts": [{"title": "", "description": ""}], "formats": [{"format": "", "reason": ""}], "variants": [{"name": "", "angle": "", "audience": "", "headline": "", "body": "", "cta": ""}]} — 3 audiences, 3 textes, 3 idées de vidéo, 3 concepts visuels, exactement 3 variantes de campagne aux angles différents.`,
  targeting: `{"cities": [""], "ageMin": 18, "ageMax": 45, "gender": "ALL|FEMALE|MALE", "interests": [""], "categories": [""], "rationale": "justification en 3 phrases"} — âges entre 18 et 65.`,
  diagnostic: `{"summary": "", "strengths": [""], "weaknesses": [""], "priorities": [{"title": "", "action": ""}], "campaignSuggestions": [{"objective": "", "why": ""}]}`,
  calendar: `{"entries": [{"dayOffset": 0, "platform": "FACEBOOK|INSTAGRAM|TIKTOK", "title": "", "caption": "légende prête à publier", "hashtags": ["#..."]}]} — dayOffset = nombre de jours après la date de début.`,
  ideas: `{"ideas": [{"title": "", "format": "", "description": ""}]} — 8 idées variées.`,
  captions: `{"captions": ["4 légendes prêtes à publier, de styles différents"]}`,
  hashtags: `{"hashtags": ["#..."], "note": "conseil d'utilisation"} — 15 hashtags pertinents, mêlant marque, produit et localisation.`,
  competition: `{"summary": "", "observations": [""], "opportunities": [""], "limits": "rappelle que l'analyse repose uniquement sur les éléments fournis par l'utilisateur"}`,
  advice: `{"answer": "réponse argumentée", "steps": ["étapes concrètes"]}`,
};

function describe(ctx: BusinessContext) {
  const lines = [
    `Entreprise : ${ctx.businessName}`, `Secteur : ${ctx.sector || "non précisé"}`,
    ctx.description && `Présentation : ${ctx.description}`,
    ctx.productName && `Produit ou service : ${ctx.productName}`,
    ctx.productDescription && `Description : ${ctx.productDescription}`,
    ctx.productPrice ? `Prix : ${ctx.productPrice} FCFA` : null,
    `Zone : ${[ctx.city, ctx.country].filter(Boolean).join(", ") || "Bénin"}`,
    ctx.audienceNote && `Public visé selon le client : ${ctx.audienceNote}`,
    ctx.objectiveLabel && `Objectif publicitaire : ${ctx.objectiveLabel}`,
    ctx.platforms?.length ? `Plateformes : ${ctx.platforms.join(", ")}` : null,
    ...Object.entries(ctx.extra ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`),
  ];
  return lines.filter(Boolean).join("\n");
}

function runRules(kind: AiTaskKind, ctx: BusinessContext): unknown | null {
  const x = ctx.extra ?? {};
  switch (kind) {
    case "strategy": return rulesStrategy(ctx);
    case "targeting": return rulesTargeting(ctx);
    case "diagnostic": return rulesDiagnostic(ctx);
    case "calendar": return rulesCalendar(ctx, Number(x.days) || 28, Number(x.perWeek) || 3);
    case "ideas": return rulesIdeas(ctx);
    case "captions": return rulesCaptions(ctx, x.topic ?? "", x.tone ?? "");
    case "hashtags": return rulesHashtags(ctx, x.topic ?? "");
    default: return null;
  }
}

export type AiRunResult<T = unknown> =
  | { ok: true; data: T; engine: "ai" | "rules"; provider: string; notice?: string; generationId: string }
  | { ok: false; error: string };

export function aiStatus() {
  const text = getTextProvider();
  const image = getImageProvider();
  return { text: text ? { provider: text.id, model: text.model } : null, image: image ? { provider: image.id, model: image.model } : null };
}

/** Exécute une tâche de l'assistant : modèle d'IA s'il est configuré, sinon suggestions guidées (clairement signalées). */
export async function runAiTask<T = unknown>(kind: AiTaskKind, ctx: BusinessContext, user: { id: string }, campaignId?: string): Promise<AiRunResult<T>> {
  if (!(await rateLimit(`ai:${user.id}`, 40, 3600))) return { ok: false, error: "Vous avez atteint la limite de générations pour cette heure. Réessayez plus tard." };
  const task = AI_TASKS[kind];
  const provider = getTextProvider();
  let data: unknown = null;
  let engine: "ai" | "rules" = "rules";
  let notice: string | undefined;

  if (provider) {
    try {
      const raw = await provider.generateJson({ system: SYSTEM, prompt: `Tâche : ${task.label}.\n\nInformations fournies par le client :\n${describe(ctx)}\n\nStructure JSON attendue :\n${SHAPES[kind]}` });
      data = task.schema.parse(extractJson(raw));
      engine = "ai";
    } catch (error) {
      log.warn("génération IA en échec", { error, kind, provider: provider.id });
      if (task.needsModel) return { ok: false, error: error instanceof AiError ? error.userMessage : "La réponse de l'IA était inexploitable. Réessayez." };
      notice = "L'IA n'a pas pu répondre : voici nos suggestions guidées à la place.";
    }
  } else if (task.needsModel) {
    return { ok: false, error: "Cette fonction nécessite un fournisseur d'IA, qui n'est pas encore configuré sur la plateforme." };
  }

  if (data === null) {
    const parsed = task.schema.safeParse(runRules(kind, ctx));
    if (!parsed.success) return { ok: false, error: "Informations insuffisantes pour générer des suggestions." };
    data = parsed.data;
  }

  const saved = await db.aiGeneration.create({
    data: { userId: user.id, campaignId: campaignId ?? null, kind, provider: engine === "ai" ? provider!.id : "rules", model: engine === "ai" ? provider!.model : null, input: ctx as never, output: data as never },
  });
  return { ok: true, data: data as T, engine, provider: engine === "ai" ? provider!.id : "rules", notice, generationId: saved.id };
}

export async function generateAdImage(prompt: string, size: "square" | "portrait" | "landscape", userId: string) {
  const provider = getImageProvider();
  if (!provider) throw new AiError("aucun fournisseur d'images", "La génération d'images IA n'est pas encore activée sur la plateforme.");
  if (!(await rateLimit(`ai-image:${userId}`, 10, 3600))) throw new AiError("limite atteinte", "Limite de générations d'images atteinte pour cette heure.");
  const safePrompt = `Photographie publicitaire professionnelle, sans aucun texte ni logo dans l'image. ${prompt.slice(0, 800)}`;
  const image = await provider.generate(safePrompt, size);
  return { ...image, provider: provider.id, model: provider.model };
}
