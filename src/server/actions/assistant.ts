"use server";

import { z } from "zod";
import type { AiTaskKind, BusinessContext, CalendarPlan } from "@/lib/ai/schemas";
import { runAiTask } from "@/lib/ai/service";
import { assertUser } from "@/lib/auth/session";
import { PLATFORM_CODES, type PlatformCode } from "@/lib/catalog/platforms";
import { TARGET_COUNTRIES } from "@/lib/catalog/targeting";
import { db } from "@/lib/db";
import { addDays, parseIsoDate, todayUtc, truncate } from "@/lib/utils";
import { safeAction, UserError } from "@/server/action";

const KINDS: AiTaskKind[] = ["diagnostic", "calendar", "ideas", "captions", "hashtags", "competition", "advice"];
const inputSchema = z.object({
  kind: z.enum(KINDS as [AiTaskKind, ...AiTaskKind[]]),
  businessId: z.string().nullable(),
  fields: z.record(z.string().max(40), z.string().max(2000)).refine((f) => Object.keys(f).length <= 12, "Trop de champs."),
});

async function businessContext(userId: string, businessId: string | null): Promise<BusinessContext> {
  const b = businessId ? await db.business.findFirst({ where: { id: businessId, ownerId: userId } }) : null;
  if (businessId && !b) throw new UserError("Entreprise introuvable.");
  if (!b) throw new UserError("Ajoutez d'abord votre entreprise : l'assistant en a besoin pour personnaliser ses réponses.");
  return {
    businessName: b.name, sector: b.sector, description: b.description ?? undefined, city: b.city ?? undefined,
    country: TARGET_COUNTRIES.find((c) => c.code === b.country)?.name,
  };
}

/** Exécute un outil de l'assistant marketing. `engine` vaut « ai » ou « rules » : l'interface affiche toujours l'origine. */
export async function runAssistantAction(input: z.input<typeof inputSchema>) {
  return safeAction(async () => {
    const user = await assertUser();
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new UserError("Demande invalide.");
    const { kind, businessId, fields } = parsed.data;
    const ctx = await businessContext(user.id, businessId);
    const b = await db.business.findFirst({ where: { id: businessId!, ownerId: user.id } });
    const extra: Record<string, string> = { ...fields };
    if (kind === "diagnostic" && b) {
      extra["Page Facebook"] = b.facebookUrl ?? "aucune";
      extra["Compte Instagram"] = b.instagramUrl ?? "aucun";
      extra["Compte TikTok"] = b.tiktokUrl ?? "aucun";
      extra["Site web"] = b.website ?? "aucun";
      extra["WhatsApp professionnel"] = b.whatsapp ? "oui" : "non";
    }
    if ((kind === "competition" || kind === "advice") && !Object.values(fields).some((v) => v.trim().length >= 10)) throw new UserError("Décrivez votre question ou vos concurrents en quelques phrases.");
    const res = await runAiTask(kind, { ...ctx, productName: fields.topic || undefined, extra }, user);
    if (!res.ok) throw new UserError(res.error);
    return { data: res.data as Record<string, unknown>, engine: res.engine, notice: res.notice ?? null };
  });
}

/** Ajoute au calendrier éditorial les publications proposées par l'assistant. */
export async function saveCalendarAction(businessId: string | null, startDate: string, entries: CalendarPlan["entries"]) {
  return safeAction(async () => {
    const user = await assertUser();
    const start = parseIsoDate(startDate) ?? todayUtc();
    if (businessId && !(await db.business.count({ where: { id: businessId, ownerId: user.id } }))) throw new UserError("Entreprise introuvable.");
    if (!Array.isArray(entries) || !entries.length || entries.length > 31) throw new UserError("Aucune publication à enregistrer.");
    if ((await db.calendarEntry.count({ where: { userId: user.id } })) + entries.length > 400) throw new UserError("Votre calendrier est plein. Supprimez d'anciennes publications.");
    await db.calendarEntry.createMany({
      data: entries.map((e) => ({
        userId: user.id, businessId, date: addDays(start, Math.min(60, Math.max(0, Math.round(Number(e.dayOffset) || 0)))),
        platform: (PLATFORM_CODES.includes(e.platform as PlatformCode) ? e.platform : "FACEBOOK") as PlatformCode,
        title: truncate(String(e.title ?? "Publication"), 120), caption: e.caption ? truncate(String(e.caption), 1200) : null,
        hashtags: (Array.isArray(e.hashtags) ? e.hashtags : []).slice(0, 10).map((h) => truncate(String(h), 40)),
      })),
    });
    return { count: entries.length };
  });
}

export async function toggleCalendarEntryAction(id: string, done: boolean) {
  return safeAction(async () => {
    const user = await assertUser();
    await db.calendarEntry.updateMany({ where: { id, userId: user.id }, data: { done: Boolean(done) } });
  });
}

export async function deleteCalendarEntryAction(id: string) {
  return safeAction(async () => {
    const user = await assertUser();
    await db.calendarEntry.deleteMany({ where: { id, userId: user.id } });
  });
}
