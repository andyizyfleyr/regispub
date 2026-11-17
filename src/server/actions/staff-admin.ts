"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { assignableRoles, canManageAccount, isStaff, type RoleName } from "@/lib/auth/permissions";
import { assertPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/service";
import { refreshPayment, requestRefund, resolveRefund } from "@/lib/payments/service";
import { normalizeAnyPhone } from "@/lib/phone";
import { effectiveMinFee } from "@/lib/pricing/quote";
import { rateLimit } from "@/lib/rate-limit";
import { loadSettings, saveSettings } from "@/lib/settings";
import { sanitizeSettings, type PlatformSettings } from "@/lib/settings-schema";
import { LAYOUTS, PALETTES } from "@/lib/studio/render";
import { formatFcfa, parseIsoDate, randomCode, truncate } from "@/lib/utils";
import { formAction, safeAction, UserError } from "@/server/action";

const lines = (v: string | undefined, max: number) => (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, max).map((l) => l.slice(0, 160));
const intField = (label: string, min: number, max: number) => z.coerce.number({ error: `${label} : nombre attendu.` }).int(`${label} : nombre entier attendu.`).min(min, `${label} : minimum ${min}.`).max(max, `${label} : maximum ${max}.`);

// ─────────────────────────── Paiements et remboursements ───────────────────────────

export async function recheckPaymentAction(paymentId: string) {
  return safeAction(async () => {
    const actor = await assertPermission("payment.verify");
    if (!(await rateLimit(`recheck:${actor.id}`, 60, 600))) throw new UserError("Trop de vérifications en peu de temps.");
    const payment = await refreshPayment(paymentId, { force: true });
    if (!payment) throw new UserError("Paiement introuvable.");
    await audit({ actorId: actor.id, action: "payment.rechecked", entity: "Payment", entityId: paymentId, meta: { status: payment.status } });
    return { status: payment.status };
  });
}

export async function requestRefundAction(paymentId: string, amount: number, reason: string) {
  return safeAction(async () => {
    const actor = await assertPermission("payment.refund");
    const text = (reason ?? "").trim();
    if (text.length < 5 || text.length > 500) throw new UserError("Indiquez le motif du remboursement.");
    const refund = await requestRefund({ paymentId, amount: Math.floor(Number(amount)), reason: text, actorId: actor.id });
    await audit({ actorId: actor.id, action: "refund.requested", entity: "Refund", entityId: refund.id, meta: { amount: refund.amount } });
  });
}

export async function resolveRefundAction(refundId: string, decision: "PROCESSED" | "REJECTED", reference: string, note: string) {
  return safeAction(async () => {
    const actor = await assertPermission("payment.refund");
    if (decision !== "PROCESSED" && decision !== "REJECTED") throw new UserError("Décision inconnue.");
    const ref = (reference ?? "").trim().slice(0, 80);
    if (decision === "PROCESSED" && ref.length < 4) throw new UserError("Saisissez la référence du transfert Mobile Money effectué vers le client.");
    if (decision === "REJECTED" && (note ?? "").trim().length < 5) throw new UserError("Indiquez le motif du refus.");
    await resolveRefund({ refundId, decision, reference: ref, note: (note ?? "").trim().slice(0, 500), actorId: actor.id });
  });
}

// ─────────────────────────── Prestations et tarifs ───────────────────────────

export const saveServiceAction = formAction(
  z.object({
    id: z.string().optional(), name: z.string().trim().min(3, "Nom trop court.").max(80), description: z.string().trim().min(10, "Décrivez la prestation.").max(400),
    fee: intField("Frais", 0, 5_000_000), periodDays: z.string().optional(), features: z.string().optional(), active: z.string().optional(), sortOrder: z.string().optional(),
    kind: z.enum(["PACK", "MANAGEMENT", "SUBSCRIPTION"]).optional(),
  }),
  async (input) => {
    const actor = await assertPermission("pricing.manage");
    const min = effectiveMinFee(await loadSettings());
    if (input.fee < min) return { ok: false, error: `Les frais de prestation ne peuvent pas être inférieurs à ${formatFcfa(min)}.`, fieldErrors: { fee: `Minimum ${formatFcfa(min)}` } };
    const data = { name: input.name, description: input.description, fee: input.fee, features: lines(input.features, 8), active: input.active === "on", sortOrder: Math.min(999, Math.max(0, Number(input.sortOrder) || 0)) };
    if (input.id) {
      const before = await db.service.findUnique({ where: { id: input.id } });
      if (!before) throw new UserError("Prestation introuvable.");
      const periodDays = before.kind === "SUBSCRIPTION" ? Math.min(365, Math.max(7, Number(input.periodDays) || 30)) : null;
      await db.service.update({ where: { id: input.id }, data: { ...data, periodDays } });
      await audit({ actorId: actor.id, action: "service.updated", entity: "Service", entityId: input.id, meta: { feeBefore: before.fee, feeAfter: input.fee, active: data.active } });
      return { ok: true, message: "Prestation mise à jour. Les commandes déjà passées conservent leur tarif." };
    }
    if (!input.kind) throw new UserError("Choisissez un type de prestation.");
    const code = `${input.kind.toLowerCase()}_${randomCode(6).toLowerCase()}`;
    const created = await db.service.create({ data: { ...data, code, kind: input.kind, periodDays: input.kind === "SUBSCRIPTION" ? Math.min(365, Math.max(7, Number(input.periodDays) || 30)) : null } });
    await audit({ actorId: actor.id, action: "service.created", entity: "Service", entityId: created.id, meta: { code, fee: input.fee } });
    return { ok: true, message: "Prestation créée." };
  },
);

// ─────────────────────────── Codes promotionnels ───────────────────────────

export const savePromoAction = formAction(
  z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,24}$/, "4 à 24 caractères : lettres, chiffres ou tirets."), description: z.string().trim().max(160).optional(),
    type: z.enum(["PERCENT", "FIXED"]), value: intField("Valeur", 1, 1_000_000), maxUses: z.string().optional(), perUserLimit: z.string().optional(), minServiceFee: z.string().optional(),
    startsAt: z.string().optional(), endsAt: z.string().optional(),
  }),
  async (input) => {
    const actor = await assertPermission("promo.manage");
    if (input.type === "PERCENT" && input.value > 90) return { ok: false, error: "Une remise en pourcentage ne peut pas dépasser 90 %.", fieldErrors: { value: "Maximum 90" } };
    if (/^(FID|PAR)-/.test(input.code)) return { ok: false, error: "Les préfixes FID- et PAR- sont réservés aux bons générés automatiquement.", fieldErrors: { code: "Préfixe réservé" } };
    if (await db.promoCode.count({ where: { code: input.code } })) return { ok: false, error: "Ce code existe déjà.", fieldErrors: { code: "Déjà utilisé" } };
    const optInt = (v: string | undefined, max: number) => { const n = Math.floor(Number(v)); return v && Number.isFinite(n) && n > 0 ? Math.min(max, n) : null; };
    const startsAt = input.startsAt ? parseIsoDate(input.startsAt) : null;
    const endsAt = input.endsAt ? parseIsoDate(input.endsAt) : null;
    if (startsAt && endsAt && endsAt < startsAt) return { ok: false, error: "La date de fin précède la date de début.", fieldErrors: { endsAt: "Date incohérente" } };
    const promo = await db.promoCode.create({
      data: { code: input.code, description: input.description || null, type: input.type, value: input.value, maxUses: optInt(input.maxUses, 1_000_000), perUserLimit: optInt(input.perUserLimit, 100) ?? 1, minServiceFee: optInt(input.minServiceFee, 5_000_000), startsAt, endsAt: endsAt ? new Date(endsAt.getTime() + 86_399_000) : null },
    });
    await audit({ actorId: actor.id, action: "promo.created", entity: "PromoCode", entityId: promo.id, meta: { code: promo.code, type: promo.type, value: promo.value } });
    return { ok: true, message: `Code ${promo.code} créé. La remise s'applique aux frais de prestation uniquement.` };
  },
);

export async function togglePromoAction(id: string) {
  return safeAction(async () => {
    const actor = await assertPermission("promo.manage");
    const promo = await db.promoCode.findUnique({ where: { id } });
    if (!promo) throw new UserError("Code introuvable.");
    await db.promoCode.update({ where: { id }, data: { active: !promo.active } });
    await audit({ actorId: actor.id, action: promo.active ? "promo.disabled" : "promo.enabled", entity: "PromoCode", entityId: id });
  });
}

// ─────────────────────────── Comptes ───────────────────────────

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return safeAction(async () => {
    const actor = await assertPermission("user.manage");
    if (userId === actor.id) throw new UserError("Vous ne pouvez pas modifier votre propre compte ici.");
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) throw new UserError("Compte introuvable.");
    if (isStaff(target.role) && !canManageAccount(actor.role, target.role)) throw new UserError("Vous n'avez pas le droit de modifier ce compte.");
    if (status !== "ACTIVE" && status !== "SUSPENDED") throw new UserError("Statut inconnu.");
    await db.user.update({ where: { id: userId }, data: { status } });
    // Une suspension ferme immédiatement toutes les sessions ouvertes.
    if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
    await audit({ actorId: actor.id, action: status === "SUSPENDED" ? "user.suspended" : "user.reactivated", entity: "User", entityId: userId });
  });
}

export const createStaffAction = formAction(
  z.object({ name: z.string().trim().min(2, "Indiquez le nom.").max(80), email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(160), phone: z.string().trim().optional(), role: z.string(), password: z.string() }),
  async (input) => {
    const actor = await assertPermission("staff.manage");
    const role = input.role as RoleName;
    if (role === "CLIENT" || !assignableRoles(actor.role).includes(role)) return { ok: false, error: "Vous ne pouvez pas attribuer ce rôle.", fieldErrors: { role: "Rôle non autorisé" } };
    const issue = passwordIssues(input.password);
    if (issue) return { ok: false, error: issue, fieldErrors: { password: issue } };
    const phone = input.phone ? normalizeAnyPhone(input.phone) : null;
    if (input.phone && !phone) return { ok: false, error: "Numéro de téléphone invalide.", fieldErrors: { phone: "Numéro invalide" } };
    if (await db.user.count({ where: { email: input.email } })) return { ok: false, error: "Un compte existe déjà avec cette adresse.", fieldErrors: { email: "Adresse déjà utilisée" } };
    const user = await db.user.create({ data: { name: input.name, email: input.email, phone, role, passwordHash: await hashPassword(input.password), referralCode: randomCode(8), accountType: "PROFESSIONAL" } });
    await audit({ actorId: actor.id, action: "staff.created", entity: "User", entityId: user.id, meta: { role } });
    return { ok: true, message: "Collaborateur créé. Transmettez-lui son mot de passe provisoire par un canal sûr : il pourra le modifier." };
  },
);

export async function changeRoleAction(userId: string, role: string) {
  return safeAction(async () => {
    const actor = await assertPermission("staff.manage");
    if (userId === actor.id) throw new UserError("Vous ne pouvez pas modifier votre propre rôle.");
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target || !isStaff(target.role)) throw new UserError("Collaborateur introuvable.");
    const next = role as RoleName;
    if (next === "CLIENT" || !assignableRoles(actor.role).includes(next) || !canManageAccount(actor.role, target.role)) throw new UserError("Vous ne pouvez pas attribuer ce rôle à ce compte.");
    if (target.role === "SUPER_ADMIN" && next !== "SUPER_ADMIN" && (await db.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } })) <= 1) throw new UserError("Il doit rester au moins un super administrateur actif.");
    await db.user.update({ where: { id: userId }, data: { role: next } });
    await db.session.deleteMany({ where: { userId } });
    await audit({ actorId: actor.id, action: "staff.role_changed", entity: "User", entityId: userId, meta: { from: target.role, to: next } });
  });
}

// ─────────────────────────── Modèles de création ───────────────────────────

export const saveTemplateAction = formAction(
  z.object({
    id: z.string().optional(), name: z.string().trim().min(2, "Indiquez un nom.").max(60), category: z.string().trim().min(2, "Indiquez une catégorie.").max(40), layout: z.string(), palette: z.string(),
    headline: z.string().trim().max(60).optional(), subline: z.string().trim().max(120).optional(), cta: z.string().trim().max(24).optional(), badge: z.string().trim().max(20).optional(),
    active: z.string().optional(), sortOrder: z.string().optional(),
  }),
  async (input) => {
    const actor = await assertPermission("template.manage");
    if (!LAYOUTS.some((l) => l.id === input.layout)) return { ok: false, error: "Mise en page inconnue.", fieldErrors: { layout: "Choisissez une mise en page" } };
    const palette = PALETTES[Number(input.palette)];
    if (!palette) return { ok: false, error: "Palette inconnue.", fieldErrors: { palette: "Choisissez une palette" } };
    const data = {
      name: input.name, category: input.category, layout: input.layout, palette: { background: palette.background, accent: palette.accent, text: palette.text },
      defaults: { headline: input.headline ?? "", subline: input.subline ?? "", cta: input.cta ?? "", badge: input.badge ?? "" }, active: input.active === "on", sortOrder: Math.min(999, Math.max(0, Number(input.sortOrder) || 0)),
    };
    if (input.id) await db.creativeTemplate.update({ where: { id: input.id }, data });
    else if ((await db.creativeTemplate.count()) >= 60) throw new UserError("Nombre maximal de modèles atteint.");
    else await db.creativeTemplate.create({ data });
    await audit({ actorId: actor.id, action: input.id ? "template.updated" : "template.created", entity: "CreativeTemplate", entityId: input.id ?? null, meta: { name: input.name } });
    return { ok: true, message: input.id ? "Modèle mis à jour." : "Modèle créé." };
  },
);

export async function deleteTemplateAction(id: string) {
  return safeAction(async () => {
    const actor = await assertPermission("template.manage");
    await db.creativeTemplate.deleteMany({ where: { id } });
    await audit({ actorId: actor.id, action: "template.deleted", entity: "CreativeTemplate", entityId: id });
  });
}

// ─────────────────────────── Réclamations ───────────────────────────

export async function updateTicketAction(ticketId: string, status: "IN_PROGRESS" | "RESOLVED" | "CLOSED", resolution: string) {
  return safeAction(async () => {
    const actor = await assertPermission("ticket.manage");
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new UserError("Réclamation introuvable.");
    if (!["IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) throw new UserError("Statut inconnu.");
    const text = (resolution ?? "").trim().slice(0, 2000);
    if (status === "RESOLVED" && text.length < 10) throw new UserError("Rédigez la réponse apportée au client.");
    await db.ticket.update({ where: { id: ticketId }, data: { status, resolution: text || ticket.resolution, assigneeId: ticket.assigneeId ?? actor.id } });
    await audit({ actorId: actor.id, action: `ticket.${status.toLowerCase()}`, entity: "Ticket", entityId: ticketId });
    if (status === "RESOLVED") await notify({ userId: ticket.userId, type: "ticket.resolved", title: `Réponse à votre demande ${ticket.reference}`, body: truncate(text, 300), link: "/app/compte?onglet=support", email: true, whatsapp: true });
  });
}

// ─────────────────────────── Notifications ───────────────────────────

export const sendNotificationAction = formAction(
  z.object({
    audience: z.enum(["all", "active", "one"]), email: z.string().trim().toLowerCase().optional(), title: z.string().trim().min(4, "Titre trop court.").max(90), body: z.string().trim().min(10, "Message trop court.").max(600),
    link: z.string().trim().max(200).optional(), viaEmail: z.string().optional(), viaWhatsapp: z.string().optional(),
  }),
  async (input) => {
    const actor = await assertPermission("notification.send");
    if (!(await rateLimit(`broadcast:${actor.id}`, 10, 3600))) throw new UserError("Trop d'envois en peu de temps.");
    if (input.link && !/^\/app(\/|$)/.test(input.link)) return { ok: false, error: "Le lien doit pointer vers une page de l'espace client.", fieldErrors: { link: "Exemple : /app/creer" } };
    let ids: string[];
    if (input.audience === "one") {
      const u = input.email ? await db.user.findUnique({ where: { email: input.email }, select: { id: true, role: true } }) : null;
      if (!u || u.role !== "CLIENT") return { ok: false, error: "Aucun client ne correspond à cette adresse.", fieldErrors: { email: "Client introuvable" } };
      ids = [u.id];
    } else {
      const since = new Date(Date.now() - 90 * 86_400_000);
      ids = (await db.user.findMany({ where: { role: "CLIENT", status: "ACTIVE", ...(input.audience === "active" ? { orders: { some: { status: "PAID", paidAt: { gte: since } } } } : {}) }, select: { id: true }, take: 2000 })).map((u) => u.id);
    }
    if (!ids.length) throw new UserError("Aucun destinataire pour cette audience.");
    // Envoi par petits lots pour ne pas saturer les canaux externes.
    for (let i = 0; i < ids.length; i += 20) {
      await Promise.allSettled(ids.slice(i, i + 20).map((userId) => notify({ userId, type: "broadcast", title: input.title, body: input.body, link: input.link || undefined, email: input.viaEmail === "on", whatsapp: input.viaWhatsapp === "on" })));
    }
    await audit({ actorId: actor.id, action: "notification.broadcast", entity: "Notification", meta: { audience: input.audience, recipients: ids.length, email: input.viaEmail === "on", whatsapp: input.viaWhatsapp === "on" } });
    return { ok: true, message: `Notification envoyée à ${ids.length} destinataire${ids.length > 1 ? "s" : ""}.` };
  },
);

// ─────────────────────────── Paramètres ───────────────────────────

export const saveSettingsAction = formAction(z.record(z.string(), z.string()), async (input) => {
  const actor = await assertPermission("settings.manage");
  const current = await loadSettings();
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(current) as (keyof PlatformSettings)[]) if (key in input) patch[key] = typeof current[key] === "number" ? Number(String(input[key]).replace(",", ".")) : input[key];
  const next = sanitizeSettings({ ...current, ...patch });
  if (next.minAdBudget > next.maxAdBudget) return { ok: false, error: "Le budget minimal dépasse le budget maximal.", fieldErrors: { minAdBudget: "Valeur incohérente" } };
  if (next.supportWhatsapp && !normalizeAnyPhone(next.supportWhatsapp)) return { ok: false, error: "Numéro WhatsApp du support invalide.", fieldErrors: { supportWhatsapp: "Numéro invalide" } };
  const changed = (Object.keys(patch) as (keyof PlatformSettings)[]).filter((k) => next[k] !== current[k]);
  if (!changed.length) return { ok: true, message: "Aucun changement." };
  await saveSettings(Object.fromEntries(changed.map((k) => [k, next[k]])) as Partial<PlatformSettings>, actor.id);
  await audit({ actorId: actor.id, action: "settings.updated", entity: "Setting", meta: Object.fromEntries(changed.map((k) => [k, { from: current[k], to: next[k] }])) });
  return { ok: true, message: "Paramètres enregistrés. Ils s'appliquent aux prochains devis." };
});
