// Identifiants confiés par les clients : stockés chiffrés, effacés quand il n'y a plus de campagne active (vraie base PostgreSQL).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadAccessRows, purgeIdleLogins } from "@/lib/campaigns/access";
import { changeCampaignStatus } from "@/lib/campaigns/service";
import { db } from "@/lib/db";
import { seal, unseal } from "@/lib/vault";

let businessId = "", campaignId = "", adminId = "";

beforeAll(async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email: "client@regispub.local" } });
  adminId = (await db.user.findUniqueOrThrow({ where: { email: "admin@regispub.local" } })).id;
  await db.business.deleteMany({ where: { ownerId: user.id, name: "Essai accès" } });
  const business = await db.business.create({ data: { ownerId: user.id, name: "Essai accès", sector: "mode", city: "Cotonou", facebookUrl: "https://www.facebook.com/essaiacces" } });
  businessId = business.id;
  const model = await db.campaign.findFirstOrThrow({ where: { userId: user.id } });
  const { id: _id, createdAt: _c, updatedAt: _u, ...copy } = model;
  campaignId = (await db.campaign.create({ data: { ...(copy as object), businessId, managerId: null, designerId: null, name: "Essai accès", reference: `ESSAI-${Date.now()}`, status: "RUNNING", platforms: ["FACEBOOK", "TIKTOK"] } as never })).id;
});
afterAll(async () => {
  await db.campaign.deleteMany({ where: { businessId } });
  await db.business.deleteMany({ where: { id: businessId } });
  await db.$disconnect();
});

describe("accès aux comptes du client", () => {
  it("ne stocke et ne renvoie jamais les identifiants en clair", async () => {
    await db.accountAccess.create({ data: { businessId, platform: "FACEBOOK", method: "LOGIN", loginEnc: seal("awa@exemple.bj"), secretEnc: seal("Mot2passe!") } });
    await db.accountAccess.create({ data: { businessId, platform: "TIKTOK", method: "INVITE", loginEnc: seal("#code-video"), campaignId } });
    const stored = await db.accountAccess.findFirstOrThrow({ where: { businessId, platform: "FACEBOOK" } });
    expect(JSON.stringify(stored)).not.toMatch(/awa@exemple|Mot2passe/);
    expect(unseal(stored.secretEnc)).toBe("Mot2passe!");
    const rows = await loadAccessRows(businessId);
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toMatch(/Enc|v1\./);
    expect(rows.find((r) => r.platform === "FACEBOOK")).toMatchObject({ method: "LOGIN", status: "SENT", hasSecret: true });
  });

  it("garde les identifiants tant qu'une campagne est active", async () => {
    await purgeIdleLogins(businessId);
    await purgeIdleLogins();
    expect(await db.accountAccess.count({ where: { businessId } })).toBe(2);
  });

  it("efface les identifiants à la fin de la dernière campagne, pas les ajouts à la page", async () => {
    const admin = await db.user.findUniqueOrThrow({ where: { id: adminId } });
    await changeCampaignStatus({ campaignId, to: "COMPLETED", actor: admin as never, note: "" });
    const left = await db.accountAccess.findMany({ where: { businessId } });
    expect(left.map((r) => `${r.platform}:${r.method}`)).toEqual(["TIKTOK:INVITE"]);
    expect(await db.auditLog.count({ where: { action: "access.purged", entityId: businessId } })).toBe(1);
  });
});
