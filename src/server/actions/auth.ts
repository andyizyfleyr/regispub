"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, passwordIssues, verifyPassword } from "@/lib/auth/password";
import { isStaff } from "@/lib/auth/permissions";
import { clientIp, createSession, destroySession } from "@/lib/auth/session";
import { resendEmail } from "@/lib/notifications/channels";
import { notify, renderEmail } from "@/lib/notifications/service";
import { normalizeAnyPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { randomCode } from "@/lib/utils";
import { formAction, UserError } from "@/server/action";

const email = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));

function safeNext(next: string | undefined, fallback: string) {
  return next && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : fallback;
}

export const registerAction = formAction(
  z.object({
    name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
    email,
    phone: z.string().trim().min(1, "Indiquez votre numéro WhatsApp ou Mobile Money."),
    password: z.string(),
    accountType: z.enum(["INDIVIDUAL", "PROFESSIONAL"]).default("INDIVIDUAL"),
    referral: z.string().trim().toUpperCase().max(20).optional(),
    terms: z.literal("on", { error: "Vous devez accepter les conditions d'utilisation." }),
    next: z.string().optional(),
  }),
  async (input) => {
    if (!(await rateLimit(`register:${(await clientIp()) ?? "?"}`, 10, 3600))) throw new UserError("Trop de créations de compte depuis cette connexion. Réessayez plus tard.");
    const issue = passwordIssues(input.password);
    if (issue) return { ok: false, error: issue, fieldErrors: { password: issue } };
    const phone = normalizeAnyPhone(input.phone);
    if (!phone) return { ok: false, error: "Numéro de téléphone invalide.", fieldErrors: { phone: "Exemple : 01 97 00 00 00 (Bénin) ou +228 90 00 00 00." } };
    if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      return { ok: false, error: "Un compte existe déjà avec cette adresse.", fieldErrors: { email: "Adresse déjà utilisée. Connectez-vous." } };
    }
    const referrer = input.referral ? await db.user.findUnique({ where: { referralCode: input.referral }, select: { id: true } }) : null;
    if (input.referral && !referrer) return { ok: false, error: "Code de parrainage inconnu.", fieldErrors: { referral: "Vérifiez le code ou laissez ce champ vide." } };
    const user = await db.user.create({
      data: {
        name: input.name, email: input.email, phone, accountType: input.accountType, passwordHash: await hashPassword(input.password),
        referralCode: randomCode(7), referredById: referrer?.id ?? null,
      },
    });
    await createSession(user.id);
    await audit({ actorId: user.id, action: "user.registered", entity: "User", entityId: user.id, ip: await clientIp() });
    await notify({ userId: user.id, type: "welcome", title: "Bienvenue sur RegisPub", body: "Votre compte est prêt. Créez votre première publicité en quelques minutes, ou confiez-la à un expert.", link: "/app/creer", email: true });
    redirect(safeNext(input.next, "/app"));
  },
);

export const loginAction = formAction(
  z.object({ email, password: z.string().min(1, "Saisissez votre mot de passe."), next: z.string().optional() }),
  async (input) => {
    const ip = (await clientIp()) ?? "?";
    if (!(await rateLimit(`login:${input.email}:${ip}`, 8, 900))) throw new UserError("Trop de tentatives. Réessayez dans 15 minutes.");
    const user = await db.user.findUnique({ where: { email: input.email } });
    // Même message que l'utilisateur existe ou non, pour ne pas révéler les comptes enregistrés.
    const valid = user ? await verifyPassword(input.password, user.passwordHash) : (await hashPassword("x"), false);
    if (!user || !valid) return { ok: false, error: "E-mail ou mot de passe incorrect." };
    if (user.status !== "ACTIVE") return { ok: false, error: "Ce compte est suspendu. Contactez le support." };
    await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ actorId: user.id, action: "user.login", entity: "User", entityId: user.id, ip });
    redirect(safeNext(input.next, isStaff(user.role) ? "/gestion" : "/app"));
  },
);

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const requestPasswordResetAction = formAction(z.object({ email }), async (input) => {
  if (!(await rateLimit(`reset:${input.email}`, 3, 3600))) throw new UserError("Trop de demandes. Réessayez dans une heure.");
  if (!resendEmail.isConfigured()) {
    return { ok: false, error: "L'envoi d'e-mails n'est pas encore activé sur cette plateforme. Contactez le support pour réinitialiser votre mot de passe." };
  }
  const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, email: true, status: true } });
  if (user && user.status === "ACTIVE") {
    const token = randomBytes(32).toString("base64url");
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
    const { text, html } = renderEmail("Réinitialisation de votre mot de passe", "Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.", `/reinitialiser?jeton=${token}`);
    await resendEmail.send(user.email, "Réinitialisation de votre mot de passe", text, html);
  }
  return { ok: true, message: "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé." };
});

export const resetPasswordAction = formAction(z.object({ token: z.string().min(20), password: z.string() }), async (input) => {
  const issue = passwordIssues(input.password);
  if (issue) return { ok: false, error: issue };
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(input.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return { ok: false, error: "Ce lien est invalide ou a expiré. Faites une nouvelle demande." };
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(input.password) } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit({ actorId: record.userId, action: "user.password_reset", entity: "User", entityId: record.userId });
  redirect("/connexion?reinitialise=1");
});
