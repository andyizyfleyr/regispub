import "server-only";
import { cache } from "react";
import { db } from "./db";
import { DEFAULT_SETTINGS, sanitizeSettings, type PlatformSettings } from "./settings-schema";

/** Paramètres de la plateforme (mémoïsés par requête). Les valeurs absentes retombent sur les défauts. */
export const getSettings = cache(async (): Promise<PlatformSettings> => loadSettings());

export async function loadSettings(): Promise<PlatformSettings> {
  const rows = await db.setting.findMany();
  const raw: Record<string, unknown> = {};
  for (const row of rows) raw[row.key] = row.value;
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...raw });
}

export async function saveSettings(patch: Partial<PlatformSettings>, actorId: string) {
  const next = sanitizeSettings({ ...(await loadSettings()), ...patch });
  await db.$transaction(
    (Object.keys(patch) as (keyof PlatformSettings)[]).map((key) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: next[key] as never, updatedById: actorId },
        update: { value: next[key] as never, updatedById: actorId },
      }),
    ),
  );
  return next;
}
