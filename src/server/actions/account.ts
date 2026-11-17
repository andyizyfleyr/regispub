"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword, passwordIssues, verifyPassword } from "@/lib/auth/password";
import { assertUser } from "@/lib/auth/session";
import { SECTORS, TARGET_COUNTRIES } from "@/lib/catalog/targeting";
import { db } from "@/lib/db";
import { notifyStaff } from "@/lib/notifications/service";
import { normalizeAnyPhone, toWhatsappLink } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { makeReference, truncate } from "@/lib/utils";
import { formAction, safeAction, UserError } from "@/server/action";

const optionalUrl = z.string().trim().max(300).refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Le lien doit commencer par https://");

export const updateProfileAction = formAction(
  z.object({ name: z.string().trim().min(2, "Indiquez votre nom.").max(80), phone: z.string().trim().min(1, "Indiquez votre téléphone."), accountType: z.enum(["INDIVIDUAL", "PROFESSIONAL"]).optional(), notifyEmail: z.string().optional(), notifyWhatsapp: z.string().optional() }),
  async (input) => {
    const user = await assertUser();
    const phone = normalizeAnyPhone(input.phone);
    if (!phone) return { ok: false, error: "Numéro de téléphone invalide.", fieldErrors: { phone: "Exemple : 01 97 00 00 00" } };
    await db.user.update({ where: { id: user.id }, data: { name: input.name, phone, ...(input.accountType ? { accountType: input.accountType } : {}), notifyEmail: input.notifyEmail === "on", notifyWhatsapp: input.notifyWhatsapp === "on" } });
    return { ok: true, message: "Profil mis à jour." };
  },
);

export const changePasswordAction = formAction(z.object({ current: z.string().min(1, "Saisissez votre mot de passe actuel."), password: z.string() }), async (input) => {
  const user = await assertUser();
  if (!(await rateLimit(`pwd:${user.id}`, 6, 900))) throw new UserError("Trop de tentatives. Réessayez plus tard.");
  const issue = passwordIssues(input.password);
  if (issue) return { ok: false, error: issue, fieldErrors: { password: issue } };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(input.current, row.passwordHash))) return { ok: false, error: "Mot de passe actuel incorrect.", fieldErrors: { current: "Mot de passe incorrect." } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
  await audit({ actorId: user.id, action: "user.password_changed", entity: "User", entityId: user.id });
  return { ok: true, message: "Mot de passe modifié." };
});

export const saveBusinessAction = formAction(
  z.object({
    id: z.string().optional(), name: z.string().trim().min(2, "Indiquez le nom de l'entreprise.").max(80), sector: z.string().refine((s) => SECTORS.includes(s), "Choisissez un secteur."),
    description: z.string().trim().max(1000).optional(), country: z.string().refine((c) => TARGET_COUNTRIES.some((t) => t.code === c), "Pays non proposé.").optional(),
    city: z.string().trim().max(60).optional(), whatsapp: z.string().trim().max(40).optional(), facebookUrl: optionalUrl.optional(), instagramUrl: optionalUrl.optional(), tiktokUrl: optionalUrl.optional(), website: optionalUrl.optional(),
  }),
  async (input) => {
    const user = await assertUser();
    if (input.whatsapp && !toWhatsappLink(input.whatsapp)) return { ok: false, error: "Numéro WhatsApp invalide.", fieldErrors: { whatsapp: "Exemple : 01 97 00 00 00" } };
    // Le formulaire ne demande plus que l'essentiel : un champ absent garde sa valeur enregistrée.
    const data = {
      name: input.name, sector: input.sector,
      ...(input.country !== undefined && { country: input.country }),
      ...(input.description !== undefined && { description: input.description || null }),
      ...(input.city !== undefined && { city: input.city || null }),
      ...(input.whatsapp !== undefined && { whatsapp: input.whatsapp || null }),
      ...(input.facebookUrl !== undefined && { facebookUrl: input.facebookUrl || null }),
      ...(input.instagramUrl !== undefined && { instagramUrl: input.instagramUrl || null }),
      ...(input.tiktokUrl !== undefined && { tiktokUrl: input.tiktokUrl || null }),
      ...(input.website !== undefined && { website: input.website || null }),
    };
    if (input.id) {
      const res = await db.business.updateMany({ where: { id: input.id, ownerId: user.id }, data });
      if (!res.count) throw new UserError("Entreprise introuvable.");
      return { ok: true, message: "Entreprise mise à jour." };
    }
    const count = await db.business.count({ where: { ownerId: user.id } });
    if (count >= 20) throw new UserError("Nombre maximal d'entreprises atteint.");
    await db.business.create({ data: { ...data, ownerId: user.id } });
    return { ok: true, message: "Entreprise ajoutée." };
  },
);

export async function deleteBusinessAction(id: string) {
  return safeAction(async () => {
    const user = await assertUser();
    const used = await db.campaign.count({ where: { businessId: id, userId: user.id, status: { notIn: ["DRAFT", "CANCELLED"] } } });
    if (used) throw new UserError("Cette entreprise est liée à des campagnes commandées : elle ne peut pas être supprimée.");
    const res = await db.business.deleteMany({ where: { id, ownerId: user.id } });
    if (!res.count) throw new UserError("Entreprise introuvable.");
  });
}

export async function markNotificationsReadAction(id?: string) {
  const user = await assertUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  return { ok: true };
}

const TICKET_CATEGORIES = ["Paiement", "Remboursement", "Campagne", "Compte", "Autre"];

export const createTicketAction = formAction(
  z.object({ category: z.string().refine((c) => TICKET_CATEGORIES.includes(c), "Choisissez une catégorie."), subject: z.string().trim().max(120).optional(), body: z.string().trim().min(20, "Décrivez votre demande (20 caractères minimum).").max(3000), campaignId: z.string().optional(), orderId: z.string().optional() }),
  async (input) => {
    const user = await assertUser();
    if (!(await rateLimit(`ticket:${user.id}`, 5, 3600))) throw new UserError("Vous avez déjà envoyé plusieurs demandes. Notre équipe vous répond au plus vite.");
    // L'objet n'est plus demandé : il reprend le début du message.
    const subject = input.subject && input.subject.length >= 5 ? input.subject : truncate(input.body.replace(/\s+/g, " "), 80);
    const campaign = input.campaignId ? await db.campaign.findFirst({ where: { id: input.campaignId, userId: user.id }, select: { id: true } }) : null;
    const order = input.orderId ? await db.order.findFirst({ where: { id: input.orderId, userId: user.id }, select: { id: true } }) : null;
    const ticket = await db.ticket.create({ data: { reference: makeReference("REC"), userId: user.id, category: input.category, subject, body: input.body, campaignId: campaign?.id ?? null, orderId: order?.id ?? null } });
    await notifyStaff("ticket.manage", { type: "ticket.created", title: `Nouvelle réclamation : ${input.category}`, body: truncate(subject, 160), link: `/gestion/reclamations?id=${ticket.id}` });
    return { ok: true, message: `Demande ${ticket.reference} envoyée. Nous vous répondons dans les meilleurs délais.` };
  },
);
