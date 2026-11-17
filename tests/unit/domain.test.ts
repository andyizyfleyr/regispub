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
