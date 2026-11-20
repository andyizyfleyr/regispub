"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { KeysError, saveKeys } from "@/lib/config";
import { KEY_NAMES, keyDef } from "@/lib/config/keys";
import { rateLimit } from "@/lib/rate-limit";
import { formAction, UserError } from "@/server/action";

const many = z.union([z.string(), z.array(z.string())]);

/**
 * Enregistre les clés des services externes saisies dans l'administration.
 * Réservé au super administrateur. Le journal d'audit garde le nom des clés modifiées, jamais leur valeur.
 */
export const saveKeysAction = formAction(z.record(z.string(), many), async (input) => {
  const actor = await assertPermission("keys.manage");
  if (!(await rateLimit(`keys:${actor.id}`, 30, 600))) throw new UserError("Trop de modifications en peu de temps. Réessayez dans quelques minutes.");

  const values: Record<string, string> = {};
  for (const name of KEY_NAMES) {
    const raw = input[name];
    if (typeof raw === "string") values[name] = raw;
  }
  const clear = [input.clear ?? []].flat().filter((name) => keyDef(name)?.secret);

  let changed: string[];
  try {
    changed = await saveKeys({ values, clear }, actor.id);
  } catch (error) {
    if (error instanceof KeysError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    throw error;
  }
  if (!changed.length) return { ok: true, message: "Aucun changement." };
  await audit({ actorId: actor.id, action: "keys.updated", entity: "AppKey", meta: { changed } });
  return { ok: true, message: "Clés enregistrées. Elles sont prises en compte en quelques secondes." };
});
