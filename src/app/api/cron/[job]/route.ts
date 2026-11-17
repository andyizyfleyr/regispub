import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncCampaignMetrics, readExternalRefs } from "@/lib/ads/sync";
import { purgeIdleLogins } from "@/lib/campaigns/access";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { notify, notifyStaff } from "@/lib/notifications/service";
import { reconcileOpenPayments } from "@/lib/payments/service";
import { addDays, formatPureDate, todayUtc } from "@/lib/utils";

const log = createLogger("cron");
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = env.cronSecret;
  if (!secret) return false; // sans secret configuré, les tâches planifiées restent fermées
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function alreadyNotified(userId: string, type: string, link: string, since: Date) {
  return (await db.notification.count({ where: { userId, type, link, createdAt: { gte: since } } })) > 0;
}

/** Alertes de fin de campagne, échéances d'abonnement et nettoyage des données techniques. */
async function housekeeping() {
  const today = todayUtc();
  const now = new Date();
  let alerts = 0;

  const ending = await db.campaign.findMany({ where: { status: "RUNNING", endDate: { gte: today, lte: addDays(today, 2) } }, select: { id: true, name: true, userId: true, endDate: true } });
  for (const c of ending) {
    const link = `/app/campagnes/${c.id}`;
    if (await alreadyNotified(c.userId, "campaign.ending", link, addDays(today, -5))) continue;
    await notify({ userId: c.userId, type: "campaign.ending", title: `${c.name} se termine bientôt`, body: `Votre campagne prend fin le ${formatPureDate(c.endDate!)}. Pour la prolonger ou la renouveler, créez une nouvelle campagne ou écrivez à votre gestionnaire.`, link, email: true, whatsapp: true });
    alerts++;
  }

  const overdue = await db.campaign.findMany({ where: { status: "RUNNING", endDate: { lt: today } }, select: { id: true, name: true, reference: true } });
  for (const c of overdue) {
    const link = `/gestion/campagnes/${c.id}`;
    if ((await db.notification.count({ where: { type: "campaign.overdue", link, createdAt: { gte: addDays(today, -1) } } })) > 0) continue;
    await notifyStaff("campaign.update_status", { type: "campaign.overdue", title: `Campagne à clôturer : ${c.reference}`, body: `La date de fin de « ${c.name} » est dépassée. Vérifiez la diffusion, ajoutez le bilan puis passez la campagne à « Terminé ».`, link });
    alerts++;
  }

  const expiring = await db.subscription.findMany({ where: { status: "ACTIVE", periodEnd: { gte: now, lte: addDays(now, 3) } }, select: { id: true, userId: true, periodEnd: true } });
  for (const s of expiring) {
    if (await alreadyNotified(s.userId, "subscription.expiring", "/app/compte?onglet=abonnement", addDays(today, -6))) continue;
    await notify({ userId: s.userId, type: "subscription.expiring", title: "Votre accompagnement mensuel arrive à échéance", body: `La période en cours se termine le ${formatPureDate(s.periodEnd!)}. Renouvelez par Mobile Money pour ne pas interrompre le suivi.`, link: "/app/compte?onglet=abonnement", email: true, whatsapp: true });
    alerts++;
  }
  const expired = await db.subscription.updateMany({ where: { status: "ACTIVE", periodEnd: { lt: now } }, data: { status: "EXPIRED" } });

  const [sessions, limits, tokens] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { windowStart: { lt: addDays(now, -2) } } }),
    db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: addDays(now, -1) } } }),
  ]);
  // Filet de sécurité : identifiants confiés par des clients qui n'ont plus aucune campagne active.
  const logins = await purgeIdleLogins();
  return { alerts, subscriptionsExpired: expired.count, cleaned: sessions.count + limits.count + tokens.count, loginsPurged: logins };
}

async function syncMetrics() {
  const campaigns = await db.campaign.findMany({ where: { status: { in: ["RUNNING", "PAUSED"] } }, select: { id: true, externalRefs: true }, take: 100 });
  let synced = 0;
  const messages: string[] = [];
  for (const c of campaigns) {
    if (!Object.keys(readExternalRefs(c.externalRefs)).length) continue;
    const res = await syncCampaignMetrics(c.id);
    synced += res.synced;
    messages.push(...res.messages);
  }
  return { synced, messages: messages.slice(0, 20) };
}

async function run(request: Request, job: string) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    if (job === "paiements") return NextResponse.json({ ok: true, checked: await reconcileOpenPayments() });
    if (job === "statistiques") return NextResponse.json({ ok: true, ...(await syncMetrics()) });
    if (job === "entretien") return NextResponse.json({ ok: true, ...(await housekeeping()) });
    if (job === "quotidien") {
      const checked = await reconcileOpenPayments();
      return NextResponse.json({ ok: true, checked, ...(await syncMetrics()), ...(await housekeeping()) });
    }
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  } catch (error) {
    log.error("tâche planifiée en échec", { error, job });
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) { return run(request, (await params).job); }
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) { return run(request, (await params).job); }
