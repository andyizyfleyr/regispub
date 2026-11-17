import "server-only";
import { env } from "@/lib/env";

export class AiError extends Error {
  constructor(message: string, readonly userMessage = "L'assistant IA n'a pas pu répondre. Réessayez dans un instant.") { super(message); }
}

export type TextRequest = { system: string; prompt: string; maxTokens?: number };
export interface TextProvider { readonly id: string; readonly model: string; generateJson(req: TextRequest): Promise<string> }
export interface ImageProvider { readonly id: string; readonly model: string; generate(prompt: string, size: "square" | "portrait" | "landscape"): Promise<{ bytes: Uint8Array; mime: string }> }

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 60_000) {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (error) {
    throw new AiError(`Fournisseur IA injoignable : ${(error as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new AiError(`Fournisseur IA HTTP ${res.status} : ${text.slice(0, 300)}`, res.status === 429 ? "L'assistant IA est très sollicité. Réessayez dans une minute." : undefined);
  }
  try { return JSON.parse(text) as Record<string, any>; } catch { throw new AiError("Réponse IA illisible"); }
}

/** API « chat completions » : OpenAI et tous les services compatibles (OpenRouter, Groq, Mistral, DeepSeek…). */
class OpenAiCompatible implements TextProvider {
  readonly id = "openai";
  constructor(readonly model: string, private readonly key: string, private readonly baseUrl: string) {}
  async generateJson(req: TextRequest) {
    const json = await postJson(`${this.baseUrl}/chat/completions`, { Authorization: `Bearer ${this.key}` }, {
      model: this.model, response_format: { type: "json_object" }, max_completion_tokens: req.maxTokens ?? 2500,
      messages: [{ role: "system", content: req.system }, { role: "user", content: req.prompt }],
    });
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new AiError("Réponse OpenAI vide");
    return content;
  }
}

class Anthropic implements TextProvider {
  readonly id = "anthropic";
  constructor(readonly model: string, private readonly key: string) {}
  async generateJson(req: TextRequest) {
    const json = await postJson("https://api.anthropic.com/v1/messages", { "x-api-key": this.key, "anthropic-version": "2023-06-01" }, {
      model: this.model, max_tokens: req.maxTokens ?? 2500, system: req.system, messages: [{ role: "user", content: req.prompt }],
    });
    const content = Array.isArray(json.content) ? json.content.map((c: { text?: string }) => c.text ?? "").join("") : "";
    if (!content) throw new AiError("Réponse Anthropic vide");
    return content;
  }
}

class Gemini implements TextProvider {
  readonly id = "gemini";
  constructor(readonly model: string, private readonly key: string) {}
  async generateJson(req: TextRequest) {
    const json = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, { "x-goog-api-key": this.key }, {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxTokens ?? 2500 },
    });
    const content = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
    if (!content) throw new AiError("Réponse Gemini vide");
    return content;
  }
}

class OpenAiImages implements ImageProvider {
  readonly id = "openai";
  constructor(readonly model: string, private readonly key: string, private readonly baseUrl: string) {}
  async generate(prompt: string, size: "square" | "portrait" | "landscape") {
    const dims = { square: "1024x1024", portrait: "1024x1536", landscape: "1536x1024" }[size];
    const json = await postJson(`${this.baseUrl}/images/generations`, { Authorization: `Bearer ${this.key}` }, { model: this.model, prompt, size: dims, n: 1 }, 120_000);
    const b64 = json.data?.[0]?.b64_json;
    if (typeof b64 !== "string") throw new AiError("Aucune image renvoyée par le fournisseur");
    return { bytes: new Uint8Array(Buffer.from(b64, "base64")), mime: "image/png" };
  }
}

const DEFAULT_MODELS: Record<string, string> = { openai: "gpt-4o-mini", anthropic: "claude-haiku-4-5", gemini: "gemini-2.5-flash" };

export function getTextProvider(): TextProvider | null {
  const id = env.aiTextProvider;
  const model = env.aiTextModel || DEFAULT_MODELS[id] || "";
  if (id === "openai" && env.openaiKey) return new OpenAiCompatible(model, env.openaiKey, env.openaiBaseUrl);
  if (id === "anthropic" && env.anthropicKey) return new Anthropic(model, env.anthropicKey);
  if (id === "gemini" && env.geminiKey) return new Gemini(model, env.geminiKey);
  return null;
}

export function getImageProvider(): ImageProvider | null {
  if (env.aiImageProvider === "openai" && env.openaiKey) return new OpenAiImages(env.aiImageModel || "gpt-image-1", env.openaiKey, env.openaiBaseUrl);
  return null;
}

/** Extrait l'objet JSON d'une réponse, même entourée de texte ou de balises de code. */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("La réponse de l'IA ne contient pas de JSON");
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { throw new AiError("JSON de l'IA invalide"); }
}
