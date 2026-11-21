// Notifications : on ne dérange quelqu'un que s'il doit agir ou qu'un cap est franchi, et jamais deux fois pour le même sujet (vraie base PostgreSQL).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeCampaignStatus } from "@/lib/campaigns/service";
import { db } from "@/lib/db";
import { notify, notifyCampaignTeam } from "@/lib/notifications/service";

let userId = "", adminId = "", managerId = "", campaignId = "", link = "";
const mine = (where: object = {}) => db.notification.findMany({ where: { userId, link, ...where }, orderBy: { createdAt: "asc" } });
const moveTo = async (to: string, note = "") => changeCampaignStatus({ campaignId, to: to as never, actor: (await db.user.findUniqueOrThrow({ where: { id: adminId } })) as never, note });

beforeAll(async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email: "client@regispub.local" } });
  userId = user.id;
  adminId = (await db.user.findUniqueOrThrow({ where: { email: "admin@regispub.local" } })).id;
  managerId = (await db.user.findUniqueOrThrow({ where: { email: "gestionnaire@regispub.local" } })).id;
  const model = await db.campaign.findFirstOrThrow({ where: { userId } });
  const { id: _id, createdAt: _c, updatedAt: _u, ...copy } = model;
  campaignId = (await db.campaign.create({ data: { ...(copy as object), managerId: null, designerId: null, name: "Essai notifications", reference: `ESSAI-N-${Date.now()}`, status: "PAID", launchedAt: null } as never })).id;
  link = `/app/campagnes/${campaignId}`;
});
afterAll(async () => {
  await db.notification.deleteMany({ where: { link: { contains: campaignId } } });
  await db.campaign.deleteMany({ where: { id: campaignId } });
  await db.$disconnect();
});

describe("étapes d'une campagne", () => {
  it("ne prévient pas le client d'une étape interne", async () => {
    await moveTo("IN_PREPARATION");
    expect(await mine()).toHaveLength(0);
    // L'étape reste inscrite dans l'historique de la campagne.
    expect(await db.campaignStatusEvent.count({ where: { campaignId, toStatus: "IN_PREPARATION" } })).toBe(1);
  });

  it("le prévient d'une étape interne si l'équipe lui écrit une note", async () => {
    await moveTo("READY_TO_LAUNCH", "Lancement prévu lundi matin.");
    const rows = await mine();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "campaign.ready_to_launch" });
    expect(rows[0]!.body).toContain("Lancement prévu lundi matin.");
  });

  it("le prévient quand la publicité est lancée", async () => {
    await moveTo("RUNNING");
    expect(await mine({ type: "campaign.running" })).toHaveLength(1);
  });
});

describe("une seule notification non lue par sujet", () => {
  it("remplace la notification non lue au lieu d'en ajouter une", async () => {
    const results = `${link}?onglet=resultats`;
    const send = (body: string) => notify({ userId, type: "metrics.updated", title: "Nouveaux résultats", body, link: results, group: true });
    await send("Premier envoi.");
    await send("Deuxième envoi.");
    const unread = await db.notification.findMany({ where: { userId, link: results } });
    expect(unread).toHaveLength(1);
    expect(unread[0]!.body).toBe("Deuxième envoi.");

    // Une fois lue, la suivante est une nouvelle notification.
    await db.notification.updateMany({ where: { userId, link: results }, data: { readAt: new Date() } });
    await send("Troisième envoi.");
    expect(await db.notification.count({ where: { userId, link: results } })).toBe(2);
  });

  it("ne regroupe pas sans le demander : un texte écrit à la main n'est jamais écrasé", async () => {
    const other = `${link}?essai=libre`;
    await notify({ userId, type: "access.problem", title: "Accès Facebook à refaire", body: "Le mot de passe est refusé.", link: other });
    await notify({ userId, type: "access.problem", title: "Accès TikTok à refaire", body: "Le code a expiré.", link: other });
    expect(await db.notification.count({ where: { userId, link: other } })).toBe(2);
  });

  it("n'annonce qu'une fois « création à valider », que le visuel ou le statut arrive en premier", async () => {
    await db.notification.updateMany({ where: { userId, link }, data: { readAt: new Date() } });
    await notify({ userId, type: "creative.submitted", title: "Création à valider", body: "Notre équipe vous soumet une création.", link, group: true });
    await notify({ userId, type: "creative.submitted", title: "Création à valider", body: "Notre équipe vous soumet une création.", link, group: true });
    await notify({ userId, type: "campaign.client_review", title: "Essai : validation", body: "Une création attend votre accord.", link, group: ["creative.submitted"] });
    const unread = await mine({ readAt: null });
    expect(unread).toHaveLength(1);
    expect(unread[0]).toMatchObject({ type: "campaign.client_review" });
  });
});

describe("avis à l'équipe", () => {
  it("va au gestionnaire de la campagne quand il y en a un, sinon aux collaborateurs autorisés", async () => {
    const staffLink = `/gestion/campagnes/${campaignId}`;
    const input = { type: "access.given", title: "Accès reçu : Essai", body: "Facebook. À vérifier avant de lancer.", link: staffLink, group: true };

    await notifyCampaignTeam({ managerId: null }, "campaign.update_status", input);
    expect(await db.notification.count({ where: { link: staffLink, userId: adminId } })).toBe(1);
    await db.notification.deleteMany({ where: { link: staffLink } });

    // Trois accès donnés à la suite : le gestionnaire reçoit un seul avis, les autres aucun.
    for (const body of ["Facebook.", "Facebook, Instagram.", "Facebook, Instagram, TikTok."]) await notifyCampaignTeam({ managerId }, "campaign.update_status", { ...input, body });
    const rows = await db.notification.findMany({ where: { link: staffLink } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: managerId, body: "Facebook, Instagram, TikTok." });
  });
});
