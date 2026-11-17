// Jeu de données initial : catalogue de prestations, modèles de création et premier compte administrateur.
// SEED_DEMO=true ajoute des comptes et une campagne de DÉMONSTRATION (données fictives, signalées comme telles).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const SERVICES = [
  { code: "campaign_creation", name: "Création de campagne", kind: "CAMPAIGN", fee: 10_000, description: "Paramétrage et lancement d'une campagne pour promouvoir un produit ou un service.", features: ["Configuration de la campagne", "Ciblage de base", "Lancement et suivi"] },
  { code: "visibility", name: "Campagne de visibilité", kind: "CAMPAIGN", fee: 10_000, description: "Faire connaître votre entreprise, une publication ou un événement au plus grand nombre.", features: ["Optimisation pour la portée", "Ciblage géographique", "Bilan de diffusion"] },
  { code: "engagement", name: "Campagne d'engagement", kind: "CAMPAIGN", fee: 10_000, description: "Obtenir davantage de réactions, de commentaires et de partages.", features: ["Optimisation pour l'engagement", "Conseils de publication", "Bilan de campagne"] },
  { code: "followers", name: "Campagne d'abonnés", kind: "CAMPAIGN", fee: 10_000, description: "Développer l'audience de votre page Facebook, Instagram ou TikTok.", features: ["Ciblage par centres d'intérêt", "Suivi de la croissance", "Bilan de campagne"] },
  { code: "video_views", name: "Campagne de vues vidéo", kind: "CAMPAIGN", fee: 10_000, description: "Faire regarder vos vidéos par une audience qualifiée.", features: ["Optimisation pour les vues", "Conseils de montage", "Bilan de campagne"] },
  { code: "leads", name: "Campagne de génération de prospects", kind: "CAMPAIGN", fee: 15_000, description: "Collecter des contacts, des appels et des demandes de devis.", features: ["Formulaire ou bouton d'appel", "Ciblage affiné", "Export des prospects"] },
  { code: "sales", name: "Campagne de ventes", kind: "CAMPAIGN", fee: 20_000, description: "Générer des commandes, notamment par WhatsApp.", features: ["Redirection WhatsApp", "Plusieurs variantes d'annonce", "Optimisation en cours de campagne"] },
  { code: "pack_creative_ads", name: "Pack création visuels + publicité", kind: "PACK", fee: 20_000, description: "Notre équipe conçoit vos visuels et gère la campagne.", features: ["2 visuels sur mesure", "Rédaction des textes", "Une série de retouches", "Lancement et suivi"] },
  { code: "full_management", name: "Gestion publicitaire complète", kind: "MANAGEMENT", fee: 30_000, description: "Un expert dédié s'occupe de tout, de la stratégie au bilan.", features: ["Gestionnaire dédié", "Stratégie et ciblage", "Visuels et textes", "Optimisation continue", "Rapport détaillé"] },
  { code: "monthly_support", name: "Accompagnement marketing mensuel", kind: "SUBSCRIPTION", fee: 50_000, periodDays: 30, description: "Un partenaire marketing toute l'année : campagnes, contenus et conseils.", features: ["Jusqu'à 2 campagnes gérées par mois (hors budget publicitaire)", "Calendrier éditorial mensuel", "8 visuels par mois", "Point mensuel avec votre gestionnaire", "Gestion de plusieurs entreprises"] },
] as const;

export async function seed(opts: { onlyIfEmpty?: boolean } = {}) {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (opts.onlyIfEmpty && (await db.service.count()) > 0) return;

    for (const [i, s] of SERVICES.entries()) {
      // Les tarifs déjà modifiés dans l'administration ne sont pas écrasés.
      await db.service.upsert({
        where: { code: s.code }, update: {},
        create: { code: s.code, name: s.name, kind: s.kind, fee: s.fee, description: s.description, features: [...s.features], periodDays: "periodDays" in s ? s.periodDays : null, sortOrder: i },
      });
    }

    const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@regispub.local").toLowerCase();
    if (!(await db.user.findUnique({ where: { email: adminEmail } }))) {
      const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
      await db.user.create({ data: { email: adminEmail, name: "Administrateur", role: "SUPER_ADMIN", passwordHash: await hashPassword(password), referralCode: `ADMIN${randomBytes(3).toString("hex").toUpperCase()}` } });
      console.log(`Compte super administrateur créé : ${adminEmail}${process.env.SEED_ADMIN_PASSWORD ? "" : ` — mot de passe généré : ${password} (notez-le, il ne sera plus affiché)`}`);
    }

    if (process.env.SEED_DEMO === "true") await seedDemo(db);
    console.log("Jeu de données initial en place.");
  } finally {
    await db.$disconnect();
  }
}

async function seedDemo(db: PrismaClient) {
  const passwordHash = await hashPassword("Demo1234!");
  const people = [
    { email: "gestionnaire@regispub.local", name: "Aïcha Gestionnaire", role: "AD_MANAGER" },
    { email: "designer@regispub.local", name: "Koffi Designer", role: "DESIGNER" },
    { email: "support@regispub.local", name: "Mireille Support", role: "SUPPORT" },
    { email: "client@regispub.local", name: "Rodrigue Client", role: "CLIENT" },
  ] as const;
  const ids: Record<string, string> = {};
  for (const p of people) {
    const user = await db.user.upsert({
      where: { email: p.email }, update: {},
      create: { ...p, passwordHash, phone: p.role === "CLIENT" ? "+2290197000001" : null, referralCode: `DEMO${p.role.slice(0, 3)}${randomBytes(2).toString("hex").toUpperCase()}` },
    });
    ids[p.role] = user.id;
  }
  await db.promoCode.upsert({ where: { code: "BIENVENUE10" }, update: {}, create: { code: "BIENVENUE10", description: "10 % sur les frais de prestation (démo)", type: "PERCENT", value: 10, perUserLimit: 1 } });

  const clientId = ids.CLIENT!;
  if (await db.campaign.count({ where: { userId: clientId } })) return;
  const business = await db.business.create({ data: { ownerId: clientId, name: "Boutique Démo", sector: "Mode et habillement", city: "Cotonou", description: "Boutique de démonstration — données fictives.", whatsapp: "+2290197000001" } });
  const start = new Date(Date.now() - 10 * 86_400_000);
  const day = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const campaign = await db.campaign.create({
    data: {
      reference: "CMP-DEMO-000001", userId: clientId, businessId: business.id, managerId: ids.AD_MANAGER, designerId: ids.DESIGNER, status: "RUNNING",
      name: "Démonstration — données fictives", platforms: ["FACEBOOK", "INSTAGRAM"], objective: "whatsapp_orders", serviceCode: "sales",
      productName: "Robe en pagne (exemple)", productDescription: "Campagne d'exemple créée par le jeu de données de démonstration. Les statistiques affichées sont fictives.", productPrice: 15_000,
      adBudget: 30_000, durationDays: 14, startDate: day(start), endDate: day(new Date(start.getTime() + 13 * 86_400_000)), launchedAt: start, wizardStep: 7,
      budgetSplit: { FACEBOOK: 60, INSTAGRAM: 40 },
      targeting: { countries: ["BJ"], cities: ["Cotonou", "Abomey-Calavi"], zoneNote: "", ageMin: 18, ageMax: 45, gender: "FEMALE", interests: ["Mode", "Pagne et tissus"], categories: ["Jeunes actifs"], languages: ["fr"], customAudience: { requested: false, note: "" } },
      adCopy: { headline: "Robe en pagne — exemple", body: "Texte d'exemple pour la démonstration.", cta: "Envoyer un message WhatsApp" },
      statusEvents: { create: [{ toStatus: "PAID", note: "Démonstration" }, { fromStatus: "PAID", toStatus: "RUNNING", note: "Démonstration" }] },
    },
  });
  await db.order.create({
    data: {
      reference: "CMD-DEMO-000001", userId: clientId, campaignId: campaign.id, serviceCode: "sales", serviceLabel: "Campagne de ventes", adBudget: 30_000, serviceFee: 20_000, paymentFee: 900, total: 50_900,
      status: "PAID", paidAt: start, invoiceNumber: "FAC-DEMO-000001",
      quote: { lines: [{ kind: "AD_BUDGET", label: "Budget publicitaire", amount: 30_000 }, { kind: "SERVICE_FEE", label: "Prestation — Campagne de ventes", amount: 20_000 }, { kind: "PAYMENT_FEE", label: "Frais de paiement Mobile Money (1,8 %)", amount: 900 }], notes: [] },
      payments: { create: { userId: clientId, provider: "sandbox", operator: "MTN", phone: "+2290197000001", amount: 50_900, status: "SUCCEEDED", idempotencyKey: `demo-${randomBytes(8).toString("hex")}`, verifiedAt: start, expiresAt: start, createdAt: start, providerRef: "sim_demo" } },
    },
  });
  // Statistiques FICTIVES, uniquement pour visualiser les tableaux de bord en démonstration.
  const rows = [];
  for (let i = 0; i < 9; i++) {
    const date = day(new Date(start.getTime() + i * 86_400_000));
    const wave = 1 + Math.sin(i / 1.4) * 0.25 + i * 0.04;
    for (const [platform, share] of [["FACEBOOK", 0.6], ["INSTAGRAM", 0.4]] as const) {
      const impressions = Math.round(5200 * wave * share);
      const clicks = Math.round(impressions * 0.021);
      rows.push({ campaignId: campaign.id, platform, date, impressions, reach: Math.round(impressions * 0.72), clicks, engagements: Math.round(impressions * 0.035), videoViews: 0, conversions: Math.round(clicks * 0.11), leads: 0, spend: Math.round(2140 * share), source: "MANUAL" as const, validated: true, validatedAt: new Date(), validatedById: ids.AD_MANAGER });
    }
  }
  await db.metricSnapshot.createMany({ data: rows });
  console.log("Comptes de démonstration créés (mot de passe : Demo1234!) : gestionnaire@, designer@, support@, client@regispub.local");
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  seed().catch((error) => { console.error(error); process.exit(1); });
}
