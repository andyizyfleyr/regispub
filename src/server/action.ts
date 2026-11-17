import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { ForbiddenError } from "@/lib/auth/session";
import { AiError } from "@/lib/ai/providers";
import { DomainError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { QuoteError } from "@/lib/pricing/quote";

const log = createLogger("action");

export type ActionState = { ok: boolean; message?: string; error?: string; fieldErrors?: Partial<Record<string, string>>; data?: Record<string, unknown> } | null;

/** Erreur métier dont le message peut être affiché tel quel à l'utilisateur. */
export class UserError extends DomainError {}

export function formDataToObject(formData: FormData) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (!values.length) continue;
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

export function toActionError(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof ForbiddenError || error instanceof UserError || error instanceof DomainError || error instanceof QuoteError) return { ok: false, error: error.message };
  if (error instanceof AiError) return { ok: false, error: error.userMessage };
  log.error("action en échec", { error });
  return { ok: false, error: "Une erreur inattendue est survenue. Réessayez ; si le problème persiste, contactez le support." };
}

/**
 * Enveloppe une Server Action de formulaire : validation zod, gestion d'erreurs uniforme, journalisation.
 * Le contrôle des droits se fait dans le gestionnaire (assertUser / assertPermission).
 */
export function formAction<S extends z.ZodType>(schema: S, handler: (input: z.output<S>, formData: FormData) => Promise<ActionState | void>) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
    const parsed = schema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide.", fieldErrors };
    }
    try {
      return (await handler(parsed.data, formData)) ?? { ok: true };
    } catch (error) {
      return toActionError(error);
    }
  };
}

/** Variante pour les actions appelées directement depuis un composant client (sans FormData). */
export async function safeAction<T extends Record<string, unknown>>(fn: () => Promise<T | void>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: ((await fn()) ?? {}) as T };
  } catch (error) {
    const state = toActionError(error);
    return { ok: false, error: state?.error ?? "Erreur" };
  }
}
