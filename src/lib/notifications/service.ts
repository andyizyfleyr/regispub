import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { permissionsOf, STAFF_ROLES, type Permission } from "@/lib/auth/permissions";
import { resendEmail, whatsappCloud, type ChannelResult } from "./channels";

const log = createLogger("notifications");

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  /** Canaux externes à tenter en plus de la notification dans l'application. */
  email?: boolean;
  whatsapp?: boolean;
  /**
   * Une seule notification non lue par sujet. Si le destinataire en a déjà une non lue du même type pour le même lien,
   * elle est remplacée au lieu d'en ajouter une, sans nouvel e-mail ni WhatsApp.
   * Un tableau cite d'autres types à traiter comme le même sujet. À réserver aux textes génériques : un texte écrit à la main serait écrasé.
   */
  group?: boolean | string[];
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderEmail(title: string, body: string, link?: string) {
  const url = link ? `${env.appUrl}${link}` : null;
  const text = `${title}\n\n${body}${url ? `\n\n${url}` : ""}\n\n— RegisPub`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#15201b">
<p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5e6a63;margin:0 0 16px">RegisPub</p>
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
<p style="font-size:15px;line-height:1.55;margin:0 0 20px;white-space:pre-line">${escapeHtml(body)}</p>
${url ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0e2a20;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:14px">Ouvrir dans RegisPub</a>` : ""}
</div>`;
  return { text, html };
}

async function record(notificationId: string | null, channel: "EMAIL" | "WHATSAPP", recipient: string, result: ChannelResult) {
  await db.notificationDelivery.create({
    data: { notificationId, channel, recipient, status: result.status, detail: result.detail?.slice(0, 500) ?? null, providerRef: result.providerRef ?? null },
  });
}

/**
 * Règle de la maison : on ne prévient quelqu'un que s'il doit agir ou si un cap est franchi (paiement reçu, publicité lancée, terminée…).
 * Le résultat d'un geste que la personne vient de faire à l'écran ne donne pas lieu à une notification.
 *
 * Crée la notification dans l'application puis tente les canaux externes.
 * Chaque tentative (envoyée, échouée ou ignorée faute de configuration) est tracée dans NotificationDelivery.
 * Ne lève jamais : une notification ne doit pas faire échouer l'opération métier qui la déclenche.
 */
export async function notify(input: NotifyInput) {
  try {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, phone: true, notifyEmail: true, notifyWhatsapp: true, status: true } });
    if (!user) return;
    if (input.group && input.link) {
      const types = [input.type, ...(Array.isArray(input.group) ? input.group : [])];
      const pending = await db.notification.findFirst({ where: { userId: input.userId, readAt: null, link: input.link, type: { in: types } }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (pending) {
        await db.notification.update({ where: { id: pending.id }, data: { type: input.type, title: input.title, body: input.body, createdAt: new Date() } });
        return;
      }
    }
    const notification = await db.notification.create({
      data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link ?? null },
    });
    if (user.status !== "ACTIVE") return;
    const jobs: Promise<void>[] = [];
    if (input.email && user.notifyEmail) {
      const { text, html } = renderEmail(input.title, input.body, input.link);
      jobs.push(resendEmail.send(user.email, input.title, text, html).then((r) => record(notification.id, "EMAIL", user.email, r)));
    }
    if (input.whatsapp && user.notifyWhatsapp && user.phone) {
      const text = `${input.title} — ${input.body}${input.link ? ` ${env.appUrl}${input.link}` : ""}`;
      jobs.push(whatsappCloud.send(user.phone, text).then((r) => record(notification.id, "WHATSAPP", user.phone!, r)));
    }
    await Promise.allSettled(jobs);
  } catch (error) {
    log.error("notification non délivrée", { error, type: input.type, userId: input.userId });
  }
}

/** Notifie tous les collaborateurs actifs disposant d'une permission donnée. */
export async function notifyStaff(permission: Permission, input: Omit<NotifyInput, "userId">, opts: { exceptUserId?: string } = {}) {
  const roles = STAFF_ROLES.filter((r) => permissionsOf(r).includes(permission));
  const staff = await db.user.findMany({ where: { role: { in: roles }, status: "ACTIVE", ...(opts.exceptUserId ? { id: { not: opts.exceptUserId } } : {}) }, select: { id: true } });
  await Promise.allSettled(staff.map((s) => notify({ ...input, userId: s.id })));
}

/**
 * Prévient les personnes chargées d'une campagne (gestionnaire, designer).
 * Tant que personne n'est désigné, ce sont les collaborateurs ayant la permission qui sont prévenus.
 */
export async function notifyCampaignTeam(campaign: { managerId: string | null; designerId?: string | null }, fallback: Permission, input: Omit<NotifyInput, "userId">) {
  const targets = [...new Set([campaign.managerId, campaign.designerId].filter((v): v is string => Boolean(v)))];
  if (!targets.length) return notifyStaff(fallback, input);
  await Promise.allSettled(targets.map((userId) => notify({ ...input, userId })));
}

export async function notificationChannelsStatus() {
  const [email, whatsapp] = await Promise.all([resendEmail.isConfigured(), whatsappCloud.isConfigured()]);
  return { email, whatsapp };
}
