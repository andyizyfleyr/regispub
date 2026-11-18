import { describe, expect, it } from "vitest";
import { parseMetricsCsv } from "@/lib/ads/csv";
import { derive, totalize, variation, type MetricRow } from "@/lib/ads/metrics";
import { hashPassword, passwordIssues, verifyPassword } from "@/lib/auth/password";
import { assignableRoles, can, canManageAccount, canViewCampaign } from "@/lib/auth/permissions";
import { canTransition, clientCanCancel, clientCanEdit, staffTransitions } from "@/lib/campaigns/status";
import { guessBeninOperator, maskPhone, normalizeBeninPhone, toWhatsappLink } from "@/lib/phone";

describe("numéros béninois", () => {
  it("normalise les formats courants vers +229 01XXXXXXXX", () => {
    for (const input of ["01 97 00 00 01", "+229 0197000001", "00229 0197000001", "2290197000001", "97000001"]) {
      expect(normalizeBeninPhone(input)?.e164).toBe("+2290197000001");
    }
  });
  it("rejette les numéros incomplets ou étrangers", () => {
    for (const input of ["", "0197", "0297000001", "+33612345678", "abcdefgh"]) expect(normalizeBeninPhone(input)).toBeNull();
  });
  it("masque le numéro sur les reçus et l'historique", () => {
    expect(maskPhone("+2290197000001")).toBe("+229 01 97 •• •• 01");
  });
  it("produit un lien WhatsApp sans jamais renvoyer une valeur arbitraire", () => {
    expect(toWhatsappLink("01 97 00 00 01")).toBe("https://wa.me/2290197000001");
    expect(toWhatsappLink("https://wa.me/2290197000001")).toBe("https://wa.me/2290197000001");
    expect(toWhatsappLink("javascript:alert(1)")).toBeNull();
    expect(toWhatsappLink("http://exemple.com")).toBeNull();
  });
  it("ne devine un opérateur qu'à partir du préfixe, sans l'imposer", () => {
    const op = guessBeninOperator("0197000001");
    expect(op === null || ["MTN", "MOOV", "CELTIIS"].includes(op)).toBe(true);
  });
});

describe("statuts de campagne", () => {
  it("n'autorise jamais l'équipe à déclarer une campagne payée à la main", () => {
    for (const from of ["DRAFT", "PENDING_PAYMENT", "AWAITING_INFO", "CANCELLED"] as const) expect(staffTransitions(from)).not.toContain("PAID");
    expect(canTransition("PENDING_PAYMENT", "PAID", "SUPER_ADMIN")).toBe(false);
  });
  it("impose le passage par « prête à lancer » avant la diffusion", () => {
    expect(canTransition("IN_PREPARATION", "RUNNING", "AD_MANAGER")).toBe(false);
    expect(canTransition("READY_TO_LAUNCH", "RUNNING", "AD_MANAGER")).toBe(true);
    expect(canTransition("RUNNING", "CANCELLED", "ADMIN")).toBe(false);
  });
  it("réserve le changement de statut aux rôles habilités", () => {
    expect(canTransition("PAID", "IN_PREPARATION", "DESIGNER")).toBe(false);
    expect(canTransition("PAID", "IN_PREPARATION", "CLIENT")).toBe(false);
    expect(canTransition("PAID", "IN_PREPARATION", "AD_MANAGER")).toBe(true);
  });
  it("le client ne modifie ou n'annule qu'avant paiement", () => {
    expect(clientCanEdit("DRAFT") && clientCanCancel("PENDING_PAYMENT")).toBe(true);
    for (const s of ["PAID", "IN_PREPARATION", "RUNNING", "COMPLETED"] as const) { expect(clientCanEdit(s)).toBe(false); expect(clientCanCancel(s)).toBe(false); }
  });
});

describe("rôles et permissions", () => {
  it("un client n'a aucune permission de gestion", () => {
    for (const p of ["campaign.view_all", "payment.view", "user.view", "settings.manage"] as const) expect(can("CLIENT", p)).toBe(false);
  });
  it("seul le super administrateur gère les administrateurs", () => {
    expect(assignableRoles("SUPER_ADMIN")).toContain("ADMIN");
    expect(assignableRoles("ADMIN")).not.toContain("ADMIN");
    expect(assignableRoles("ADMIN")).not.toContain("SUPER_ADMIN");
    expect(canManageAccount("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(assignableRoles("SUPPORT")).toEqual([]);
  });
  it("le support ne rembourse pas et ne touche pas aux tarifs", () => {
    expect(can("SUPPORT", "payment.refund")).toBe(false);
    expect(can("SUPPORT", "pricing.manage")).toBe(false);
    expect(can("SUPPORT", "ticket.manage")).toBe(true);
  });
  it("un designer ne voit que les campagnes qui lui sont confiées ; un client que les siennes", () => {
    const c = { userId: "client1", managerId: "m1", designerId: "d1" };
    expect(canViewCampaign({ id: "d1", role: "DESIGNER" }, c)).toBe(true);
    expect(canViewCampaign({ id: "d2", role: "DESIGNER" }, c)).toBe(false);
    expect(canViewCampaign({ id: "client1", role: "CLIENT" }, c)).toBe(true);
    expect(canViewCampaign({ id: "client2", role: "CLIENT" }, c)).toBe(false);
    expect(canViewCampaign({ id: "x", role: "AD_MANAGER" }, c)).toBe(true);
  });
});

describe("mots de passe", () => {
  it("hache avec un sel unique et vérifie", async () => {
    const a = await hashPassword("Cotonou2026!"), b = await hashPassword("Cotonou2026!");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Cotonou2026!", a)).toBe(true);
    expect(await verifyPassword("cotonou2026!", a)).toBe(false);
    expect(await verifyPassword("x", "format-invalide")).toBe(false);
  });
  it("refuse les mots de passe trop faibles", () => {
    expect(passwordIssues("court")).toBeTruthy();
    expect(passwordIssues("Cotonou2026!")).toBeNull();
  });
});

describe("statistiques", () => {
  const rows: MetricRow[] = [
    { date: "2026-11-16", platform: "FACEBOOK", impressions: 12_000, reach: 8_400, clicks: 300, engagements: 500, videoViews: 0, conversions: 12, leads: 8, spend: 2_500, revenue: null },
    { date: "2026-11-16", platform: "INSTAGRAM", impressions: 8_000, reach: 6_000, clicks: 200, engagements: 600, videoViews: 0, conversions: 8, leads: 2, spend: 2_500, revenue: null },
  ];
  it("calcule CTR, CPC, CPM à partir des totaux, jamais par moyenne de ratios", () => {
    const t = totalize(rows);
    const d = derive(t);
    expect(t.days).toBe(1);
    expect(d.ctr).toBeCloseTo(500 / 20_000);
    expect(d.cpc).toBe(10);
    expect(d.cpm).toBe(250);
    expect(d.costPerLead).toBe(500);
  });
  it("n'invente aucun chiffre : ratio nul sans données, ROI nul sans chiffre d'affaires", () => {
    const d = derive({ impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0, revenue: null });
    expect(d).toEqual({ ctr: null, cpc: null, cpm: null, costPerLead: null, costPerConversion: null, roi: null });
    expect(derive({ ...totalize(rows), revenue: 15_000 }).roi).toBe(2);
    expect(variation(10, 0)).toBeNull();
    expect(variation(15, 10)).toBe(0.5);
  });
});

describe("import CSV de rapports publicitaires", () => {
  it("lit un export au format français (point-virgule, dates JJ/MM/AAAA, accents)", () => {
    const { rows, errors } = parseMetricsCsv("Date;Plateforme;Impressions;Portée;Clics;Dépenses\n16/11/2026;Facebook;12 000;8400;310;2 500\n17/11/2026;ig;9000;6100;190;2400", null);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2026-11-16", platform: "FACEBOOK", impressions: 12_000, reach: 8_400, clicks: 310, spend: 2_500, revenue: null });
    expect(rows[1]!.platform).toBe("INSTAGRAM");
  });
  it("exige une plateforme quand le fichier n'en contient pas", () => {
    expect(parseMetricsCsv("date,impressions\n2026-11-16,100", null).errors[0]).toMatch(/plateforme/i);
    expect(parseMetricsCsv("date,impressions\n2026-11-16,100", "TIKTOK").rows[0]!.platform).toBe("TIKTOK");
  });
  it("écarte les lignes incohérentes au lieu de les corriger en silence", () => {
    const { rows, errors } = parseMetricsCsv("date;plateforme;impressions;clics\n2026-11-16;facebook;100;500\n2026-11-17;snapchat;100;5\n31/02/2026;facebook;1;0\n2026-11-18;facebook;abc;1\n2026-11-19;facebook;100;5\n2026-11-19;facebook;100;5", null);
    expect(rows.map((r) => r.date)).toEqual(["2026-11-19"]);
    expect(errors).toHaveLength(5);
    expect(errors.join(" ")).toMatch(/doublon/);
  });
  it("refuse un fichier vide ou sans colonne date", () => {
    expect(parseMetricsCsv("", null).rows).toEqual([]);
    expect(parseMetricsCsv("jourx;impressions\n1;2", "FACEBOOK").errors[0]).toMatch(/date/);
  });
});

describe("comptes du client sur les réseaux", () => {
  it("accepte un lien, un domaine sans https ou un @nom", async () => {
    const { normalizeAccount } = await import("@/lib/catalog/accounts");
    expect(normalizeAccount("FACEBOOK", "https://www.facebook.com/atelierawa")).toBe("https://www.facebook.com/atelierawa");
    expect(normalizeAccount("FACEBOOK", "facebook.com/atelierawa")).toBe("https://facebook.com/atelierawa");
    expect(normalizeAccount("FACEBOOK", "m.facebook.com/profile.php?id=100012345")).toBe("https://m.facebook.com/profile.php?id=100012345");
    expect(normalizeAccount("INSTAGRAM", "@atelier.awa")).toBe("https://www.instagram.com/atelier.awa");
    expect(normalizeAccount("TIKTOK", "atelier_awa")).toBe("https://www.tiktok.com/@atelier_awa");
    expect(normalizeAccount("TIKTOK", "  ")).toBe("");
  });

  it("refuse un texte qui n'est ni un lien ni un nom de compte", async () => {
    const { normalizeAccount } = await import("@/lib/catalog/accounts");
    expect(normalizeAccount("FACEBOOK", "Atelier Awa Couture")).toBeNull();
    expect(normalizeAccount("INSTAGRAM", "https://")).toBeNull();
    expect(normalizeAccount("TIKTOK", "@")).toBeNull();
  });

  it("signale les réseaux choisis sans compte", async () => {
    const { accountsOf, missingAccounts } = await import("@/lib/catalog/accounts");
    const accounts = accountsOf({ facebookUrl: "https://www.facebook.com/awa", instagramUrl: null, tiktokUrl: " " });
    expect(missingAccounts(["FACEBOOK", "INSTAGRAM", "TIKTOK"], accounts)).toEqual(["INSTAGRAM", "TIKTOK"]);
    expect(missingAccounts(["FACEBOOK"], accounts)).toEqual([]);
    expect(missingAccounts(["FACEBOOK"], null)).toEqual(["FACEBOOK"]);
  });
});

describe("ce que le client remplit lui-même", () => {
  const base = {
    name: "Ma campagne", platforms: ["FACEBOOK"] as ("FACEBOOK" | "INSTAGRAM" | "TIKTOK")[], objective: "notoriete", serviceCode: null, adBudget: 20000,
    durationDays: 5, startDate: new Date(Date.now() + 3 * 86_400_000), mode: "SELF_SERVICE" as const, brief: null,
    adCopy: { headline: "Robes en wax sur mesure", body: "Des robes cousues main, livrées à Cotonou en 48 h.", cta: "" } as unknown,
  };

  it("accepte une publicité complète sur un seul réseau", async () => {
    const { campaignMissing } = await import("@/lib/campaigns/missing");
    const { getObjective, OBJECTIVES } = await import("@/lib/catalog/objectives");
    const objective = OBJECTIVES.find((o) => o.platforms.includes("FACEBOOK"))!;
    expect(getObjective(objective.code)).toBeTruthy();
    expect(campaignMissing({ ...base, objective: objective.code })).toEqual([]);
  });

  it("refuse deux réseaux à la fois, et aucun réseau", async () => {
    const { campaignMissing, ONE_NETWORK } = await import("@/lib/campaigns/missing");
    const { OBJECTIVES } = await import("@/lib/catalog/objectives");
    const objective = OBJECTIVES.find((o) => o.platforms.includes("FACEBOOK") && o.platforms.includes("INSTAGRAM"))!;
    expect(campaignMissing({ ...base, objective: objective.code, platforms: ["FACEBOOK", "INSTAGRAM"] })).toContain(ONE_NETWORK);
    expect(campaignMissing({ ...base, objective: objective.code, platforms: [] })).toContain("Choisissez le réseau de votre publicité.");
  });

  it("demande le titre puis le texte, sans description du produit", async () => {
    const { adCopyIssue, campaignMissing } = await import("@/lib/campaigns/missing");
    expect(adCopyIssue(null)).toBe("Écrivez le titre de votre annonce.");
    expect(adCopyIssue({ headline: "  ", body: "Un texte assez long pour passer." })).toBe("Écrivez le titre de votre annonce.");
    expect(adCopyIssue({ headline: "Robes en wax", body: "Trop court" })).toMatch(/texte de votre annonce/);
    expect(adCopyIssue(base.adCopy)).toBeNull();
    const { OBJECTIVES } = await import("@/lib/catalog/objectives");
    const objective = OBJECTIVES.find((o) => o.platforms.includes("FACEBOOK"))!;
    expect(campaignMissing({ ...base, objective: objective.code, adCopy: null })).toEqual(["Écrivez le titre de votre annonce."]);
    // En mode expert, c'est l'équipe qui écrit : seul le besoin est demandé.
    expect(campaignMissing({ ...base, objective: objective.code, adCopy: null, mode: "EXPERT", brief: "Je veux plus de clients pour ma boutique." })).toEqual([]);
  });

  it("ne remplit rien à la place du client", async () => {
    const { campaignMissing } = await import("@/lib/campaigns/missing");
    const { EMPTY_TARGETING } = await import("@/lib/catalog/targeting");
    const { PLATFORM_CHOICES } = await import("@/lib/catalog/platforms");
    expect(EMPTY_TARGETING.countries).toEqual([]);
    expect(EMPTY_TARGETING.interests).toEqual([]);
    expect(PLATFORM_CHOICES.every((c) => c.platforms.length === 1)).toBe(true);
    const missing = campaignMissing({ ...base, objective: null, platforms: [], adCopy: null, adBudget: 0, durationDays: null, startDate: null });
    expect(missing).toHaveLength(6);
  });
});

describe("garde-fous (sans IA)", () => {
  it("signale les formulations refusées par les plateformes", async () => {
    const { policyWarnings } = await import("@/lib/campaigns/policy");
    expect(policyWarnings("Résultat garanti à 100 %")).toHaveLength(1);
    expect(policyWarnings("Robes en wax cousues main, livraison à Cotonou.")).toEqual([]);
  });
});
