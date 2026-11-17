import { describe, expect, it } from "vitest";
import { accessState, accessToGive, FACEBOOK_PAGE_ACCESS_URL, inviteSteps, type AccessRow } from "@/lib/catalog/access";
import { can } from "@/lib/auth/permissions";
import { sanitizeSettings } from "@/lib/settings-schema";
import { seal, unseal } from "@/lib/vault";

describe("coffre des identifiants", () => {
  it("chiffre puis déchiffre, sans laisser le texte en clair", () => {
    const sealed = seal("awa@exemple.bj / Mot2passe!é");
    expect(sealed).not.toContain("awa");
    expect(sealed).not.toContain("Mot2passe");
    expect(unseal(sealed)).toBe("awa@exemple.bj / Mot2passe!é");
  });
  it("produit un résultat différent à chaque fois", () => {
    expect(seal("secret")).not.toBe(seal("secret"));
  });
  it("refuse une donnée altérée ou étrangère", () => {
    const parts = seal("secret").split(".");
    const data = Buffer.from(parts[3], "base64url"); data[0] ^= 1;
    expect(unseal([parts[0], parts[1], parts[2], data.toString("base64url")].join("."))).toBeNull();
    expect(unseal("texte en clair")).toBeNull();
    expect(unseal("v0.a.b.c")).toBeNull();
    expect(unseal(null)).toBeNull();
  });
  it("devient illisible si APP_SECRET change", () => {
    const sealed = seal("secret");
    const before = process.env.APP_SECRET;
    process.env.APP_SECRET = "une-autre-cle-0123456789abcdef0123456789";
    try { expect(unseal(sealed)).toBeNull(); } finally { process.env.APP_SECRET = before; }
    expect(unseal(sealed)).toBe("secret");
  });
});

describe("état des accès", () => {
  const row = (r: Partial<AccessRow> & Pick<AccessRow, "platform">): AccessRow => ({ method: "INVITE", status: "SENT", campaignId: null, ...r });
  it("demande l'accès tant que rien n'est donné", () => {
    expect(accessState([], "FACEBOOK", "c1")).toBe("TODO");
    expect(accessToGive([], ["FACEBOOK", "INSTAGRAM"], "c1")).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });
  it("garde un accès donné pour les campagnes suivantes", () => {
    const rows = [row({ platform: "FACEBOOK", status: "VERIFIED" }), row({ platform: "INSTAGRAM", method: "LOGIN" })];
    expect(accessState(rows, "FACEBOOK", "c2")).toBe("VERIFIED");
    expect(accessState(rows, "INSTAGRAM", "c2")).toBe("SENT");
    expect(accessToGive(rows, ["FACEBOOK", "INSTAGRAM"], "c2")).toEqual([]);
  });
  it("redemande l'accès signalé en problème", () => {
    expect(accessToGive([row({ platform: "FACEBOOK", status: "PROBLEM" })], ["FACEBOOK"], "c1")).toEqual(["FACEBOOK"]);
  });
  it("ne réutilise pas un code de vidéo TikTok pour une autre campagne", () => {
    const rows = [row({ platform: "TIKTOK", campaignId: "c1" })];
    expect(accessState(rows, "TIKTOK", "c1")).toBe("SENT");
    expect(accessState(rows, "TIKTOK", "c2")).toBe("TODO");
    expect(accessState([row({ platform: "TIKTOK", method: "LOGIN" })], "TIKTOK", "c2")).toBe("SENT");
  });
  it("cite le nom de l'agence dans les étapes", () => {
    const facebook = inviteSteps("FACEBOOK", "Régis Pub");
    expect(facebook.map((s) => s.text).join(" ")).toContain("«\u00a0Régis Pub\u00a0»");
    expect(inviteSteps("TIKTOK", "Régis Pub")).toHaveLength(3);
  });
  it("donne un lien direct vers « Accès à la Page » pour Facebook et Instagram, aucun pour TikTok", () => {
    const links = (p: "FACEBOOK" | "INSTAGRAM" | "TIKTOK") => inviteSteps(p, "Régis Pub").flatMap((s) => (s.link ? [s.link.href] : []));
    expect(links("FACEBOOK")).toEqual([FACEBOOK_PAGE_ACCESS_URL]);
    expect(links("INSTAGRAM")).toEqual([FACEBOOK_PAGE_ACCESS_URL]);
    expect(links("TIKTOK")).toEqual([]);
    expect(FACEBOOK_PAGE_ACCESS_URL).toMatch(/^https:\/\/www\.facebook\.com\//);
  });
});

describe("droits et réglages liés aux accès", () => {
  it("réserve la lecture des identifiants", () => {
    expect(can("SUPER_ADMIN", "access.reveal")).toBe(true);
    expect(can("AD_MANAGER", "access.reveal")).toBe(true);
    expect(can("DESIGNER", "access.reveal")).toBe(false);
    expect(can("SUPPORT", "access.reveal")).toBe(false);
    expect(can("CLIENT", "access.reveal")).toBe(false);
  });
  it("conserve le nom du profil Facebook de l'agence", () => {
    expect(sanitizeSettings({ agencyFacebookName: "  Régis Pub  " }).agencyFacebookName).toBe("Régis Pub");
    expect(sanitizeSettings({}).agencyFacebookName).toBe("");
  });
});
