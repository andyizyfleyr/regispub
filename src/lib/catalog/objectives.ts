import type { PlatformCode } from "./platforms";

export type ObjectiveCategory = "community" | "business" | "awareness";

export type Objective = {
  code: string;
  category: ObjectiveCategory;
  label: string;
  description: string;
  icon: string; // nom d'icône lucide, résolu dans components/icons
  serviceCode: string; // prestation du catalogue qui fixe les frais de service
  platforms: PlatformCode[];
  /** Configuration publicitaire appliquée par le gestionnaire lors du lancement. */
  config: {
    metaObjective?: string;
    metaOptimization?: string;
    tiktokObjective?: string;
    tiktokOptimization?: string;
    kpis: MetricKey[];
    formats: string[];
    ctas: string[];
    recommendedDays: number;
    recommendedDailyBudget: number;
    requires: ("whatsapp" | "page" | "phone" | "address" | "video")[];
  };
  recommendation: string;
};

export type MetricKey = "impressions" | "reach" | "clicks" | "ctr" | "cpc" | "cpm" | "engagements" | "videoViews" | "conversions" | "leads" | "spend" | "roi";

export const OBJECTIVE_CATEGORIES: Record<ObjectiveCategory, { label: string; description: string }> = {
  community: { label: "Communauté", description: "Gagner des abonnés et faire vivre vos pages." },
  business: { label: "Ventes", description: "Obtenir des commandes, des prospects et des clients." },
  awareness: { label: "Visibilité", description: "Faire connaître votre marque, un produit ou un événement." },
};

const ALL: PlatformCode[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK"];
const META: PlatformCode[] = ["FACEBOOK", "INSTAGRAM"];

export const OBJECTIVES: Objective[] = [
  // ── Communauté
  {
    code: "fb_followers", category: "community", label: "Gagner des abonnés et des J'aime Facebook", icon: "UserPlus", serviceCode: "followers", platforms: ["FACEBOOK"],
    description: "Montrer votre page Facebook aux personnes susceptibles de l'aimer et de la suivre.",
    config: { metaObjective: "OUTCOME_ENGAGEMENT", metaOptimization: "PAGE_LIKES", kpis: ["engagements", "reach", "impressions", "spend"], formats: ["square", "portrait", "story"], ctas: ["S'abonner", "J'aime la Page"], recommendedDays: 14, recommendedDailyBudget: 1500, requires: ["page"] },
    recommendation: "Publiez régulièrement pendant la campagne : les nouveaux abonnés restent s'ils trouvent du contenu récent.",
  },
  {
    code: "ig_followers", category: "community", label: "Gagner des abonnés Instagram", icon: "AtSign", serviceCode: "followers", platforms: ["INSTAGRAM"],
    description: "Diriger les bonnes personnes vers votre profil Instagram.",
    config: { metaObjective: "OUTCOME_TRAFFIC", metaOptimization: "VISIT_INSTAGRAM_PROFILE", kpis: ["clicks", "reach", "ctr", "spend"], formats: ["portrait", "story"], ctas: ["Voir le profil"], recommendedDays: 14, recommendedDailyBudget: 1500, requires: ["page"] },
    recommendation: "Soignez votre bio et vos 9 dernières publications avant de lancer : c'est ce que verront les visiteurs.",
  },
  {
    code: "tiktok_growth", category: "community", label: "Développer un compte TikTok", icon: "Music2", serviceCode: "followers", platforms: ["TIKTOK"],
    description: "Promouvoir vos vidéos auprès de nouveaux abonnés potentiels.",
    config: { tiktokObjective: "ENGAGEMENT", tiktokOptimization: "FOLLOWERS", kpis: ["videoViews", "engagements", "reach", "spend"], formats: ["story"], ctas: ["Suivre"], recommendedDays: 10, recommendedDailyBudget: 2000, requires: ["page", "video"] },
    recommendation: "TikTok exige une vidéo verticale. Les 3 premières secondes décident de tout : commencez par le résultat ou le produit en action.",
  },
  {
    code: "engagement", category: "community", label: "Augmenter l'engagement", icon: "MessagesSquare", serviceCode: "engagement", platforms: ALL,
    description: "Obtenir plus de réactions, commentaires et partages sur une publication.",
    config: { metaObjective: "OUTCOME_ENGAGEMENT", metaOptimization: "POST_ENGAGEMENT", tiktokObjective: "ENGAGEMENT", tiktokOptimization: "ENGAGED_VIEW", kpis: ["engagements", "reach", "impressions", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus", "Envoyer un message"], recommendedDays: 7, recommendedDailyBudget: 1500, requires: ["page"] },
    recommendation: "Posez une question ou proposez un choix dans votre texte : les publications qui invitent à répondre coûtent moins cher à diffuser.",
  },
  // ── Commercial
  {
    code: "sales", category: "business", label: "Augmenter les ventes", icon: "ShoppingBag", serviceCode: "sales", platforms: ALL,
    description: "Toucher les personnes les plus susceptibles d'acheter votre produit.",
    config: { metaObjective: "OUTCOME_SALES", metaOptimization: "CONVERSATIONS", tiktokObjective: "TRAFFIC", tiktokOptimization: "CLICK", kpis: ["conversions", "clicks", "ctr", "cpc", "spend", "roi"], formats: ["square", "portrait", "story"], ctas: ["Acheter", "Commander", "Envoyer un message WhatsApp"], recommendedDays: 14, recommendedDailyBudget: 3000, requires: ["whatsapp"] },
    recommendation: "Affichez le prix et le mode de livraison dans le visuel : cela filtre les curieux et améliore le taux de commande.",
  },
  {
    code: "whatsapp_orders", category: "business", label: "Obtenir des commandes WhatsApp", icon: "MessageCircle", serviceCode: "sales", platforms: META,
    description: "Un bouton ouvre directement une conversation WhatsApp avec vous.",
    config: { metaObjective: "OUTCOME_ENGAGEMENT", metaOptimization: "CONVERSATIONS", kpis: ["conversions", "clicks", "ctr", "cpc", "spend"], formats: ["square", "portrait", "story"], ctas: ["Envoyer un message WhatsApp"], recommendedDays: 10, recommendedDailyBudget: 2500, requires: ["whatsapp"] },
    recommendation: "Répondez en moins de 10 minutes pendant la campagne. Préparez un message d'accueil et vos tarifs à l'avance.",
  },
  {
    code: "leads", category: "business", label: "Obtenir des prospects et des demandes de devis", icon: "ClipboardList", serviceCode: "leads", platforms: ALL,
    description: "Collecter les coordonnées et les demandes de personnes intéressées par votre offre.",
    config: { metaObjective: "OUTCOME_LEADS", metaOptimization: "LEAD_GENERATION", tiktokObjective: "LEAD_GENERATION", tiktokOptimization: "LEAD_GENERATION", kpis: ["leads", "clicks", "ctr", "cpc", "spend"], formats: ["square", "portrait", "story"], ctas: ["S'inscrire", "Obtenir une offre", "Demander un devis"], recommendedDays: 14, recommendedDailyBudget: 3000, requires: ["page"] },
    recommendation: "Limitez le formulaire à 3 champs. Offrez quelque chose en échange : devis gratuit, diagnostic, remise de bienvenue.",
  },
  {
    code: "calls", category: "business", label: "Recevoir davantage d'appels", icon: "PhoneCall", serviceCode: "leads", platforms: META,
    description: "Un bouton « Appeler » affiché aux personnes proches de vous.",
    config: { metaObjective: "OUTCOME_LEADS", metaOptimization: "QUALITY_CALL", kpis: ["clicks", "ctr", "cpc", "reach", "spend"], formats: ["square", "portrait"], ctas: ["Appeler"], recommendedDays: 10, recommendedDailyBudget: 2500, requires: ["phone"] },
    recommendation: "Diffusez uniquement pendant vos heures d'ouverture : un appel manqué est un budget perdu.",
  },
  {
    code: "store_visits", category: "business", label: "Attirer des clients en boutique", icon: "Store", serviceCode: "leads", platforms: ALL,
    description: "Cibler les personnes situées autour de votre point de vente.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "clicks", "cpm", "spend"], formats: ["square", "story"], ctas: ["Itinéraire", "En savoir plus"], recommendedDays: 14, recommendedDailyBudget: 2000, requires: ["address"] },
    recommendation: "Indiquez un repère connu (carrefour, pharmacie, marché) : au Bénin, c'est plus efficace qu'une adresse postale.",
  },
  {
    code: "product_promo", category: "business", label: "Promouvoir ou lancer un produit ou un service", icon: "Tag", serviceCode: "campaign_creation", platforms: ALL,
    description: "Mettre en avant une offre précise ou une nouveauté auprès d'une audience ciblée.",
    config: { metaObjective: "OUTCOME_TRAFFIC", metaOptimization: "LINK_CLICKS", tiktokObjective: "TRAFFIC", tiktokOptimization: "CLICK", kpis: ["clicks", "ctr", "cpc", "reach", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus", "Commander", "Envoyer un message WhatsApp"], recommendedDays: 7, recommendedDailyBudget: 2000, requires: [] },
    recommendation: "Une publicité = un produit = un bénéfice. Évitez de présenter tout votre catalogue dans le même visuel.",
  },
  // ── Visibilité
  {
    code: "page_awareness", category: "awareness", label: "Faire connaître votre page, votre entreprise ou votre marque", icon: "Megaphone", serviceCode: "visibility", platforms: ALL,
    description: "Présenter votre activité au plus grand nombre de personnes de votre zone.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "cpm", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus"], recommendedDays: 14, recommendedDailyBudget: 1500, requires: [] },
    recommendation: "Un message simple, répété plusieurs jours avec les mêmes couleurs et le même logo, marque davantage qu'une diffusion massive sur 48 heures.",
  },
  {
    code: "post_reach", category: "awareness", label: "Augmenter la portée des publications", icon: "Radio", serviceCode: "visibility", platforms: ALL,
    description: "Montrer une publication existante à beaucoup plus de personnes.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "cpm", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus"], recommendedDays: 5, recommendedDailyBudget: 1500, requires: ["page"] },
    recommendation: "Choisissez une publication qui a déjà bien fonctionné sans publicité : elle sera moins chère à amplifier.",
  },
  {
    code: "video_views", category: "awareness", label: "Augmenter les vues vidéo", icon: "PlayCircle", serviceCode: "video_views", platforms: ALL,
    description: "Faire regarder votre vidéo par les personnes qui regardent le plus longtemps.",
    config: { metaObjective: "OUTCOME_ENGAGEMENT", metaOptimization: "THRUPLAY", tiktokObjective: "VIDEO_VIEWS", tiktokOptimization: "ENGAGED_VIEW", kpis: ["videoViews", "impressions", "reach", "spend"], formats: ["story", "square"], ctas: ["Regarder la suite"], recommendedDays: 7, recommendedDailyBudget: 1500, requires: ["video"] },
    recommendation: "Ajoutez des sous-titres : la majorité des vidéos sont regardées sans le son.",
  },
  {
    code: "event_promo", category: "awareness", label: "Promouvoir un événement", icon: "CalendarDays", serviceCode: "visibility", platforms: ALL,
    description: "Annoncer une date, un lieu et donner envie de venir.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "clicks", "spend"], formats: ["square", "story"], ctas: ["En savoir plus", "Réserver"], recommendedDays: 10, recommendedDailyBudget: 2000, requires: [] },
    recommendation: "Démarrez 10 à 14 jours avant la date et augmentez le budget sur les 3 derniers jours.",
  },
];

const byCode = new Map(OBJECTIVES.map((o) => [o.code, o]));

/**
 * Objectifs qui disaient la même chose, regroupés en un seul. L'ancien code reste compris : une campagne créée avant
 * le regroupement garde son objectif, sous son nouveau nom.
 */
export const MERGED_OBJECTIVES: Record<string, string> = {
  page_likes: "fb_followers",
  company_awareness: "page_awareness", brand_building: "page_awareness",
  quote_requests: "leads",
  product_launch: "product_promo",
};

/** Libellés courts pour les tuiles et les choix : le résultat obtenu, en deux ou trois mots. */
const SHORT_LABELS: Record<string, string> = {
  fb_followers: "Abonnés et J'aime Facebook", ig_followers: "Abonnés Instagram", tiktok_growth: "Abonnés TikTok", engagement: "Réactions et partages",
  sales: "Ventes", whatsapp_orders: "Commandes WhatsApp", leads: "Prospects et devis", calls: "Appels", store_visits: "Clients en boutique",
  product_promo: "Promotion d'un produit",
  page_awareness: "Se faire connaître", post_reach: "Portée des publications", video_views: "Vues vidéo", event_promo: "Événement",
};
export const objectiveShort = (o: { code: string; label: string }) => SHORT_LABELS[o.code] ?? o.label;
export const getObjective = (code: string | null | undefined) => (code ? byCode.get(MERGED_OBJECTIVES[code] ?? code) ?? null : null);

export function objectivesFor(platforms: PlatformCode[]) {
  return OBJECTIVES.filter((o) => platforms.length === 0 || platforms.some((p) => o.platforms.includes(p)));
}

/** Plateformes sélectionnées non compatibles avec l'objectif (à signaler au client). */
export function unsupportedPlatforms(objective: Objective, platforms: PlatformCode[]) {
  return platforms.filter((p) => !objective.platforms.includes(p));
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  impressions: "Affichages", reach: "Personnes touchées", clicks: "Clics", ctr: "Taux de clic", cpc: "Coût par clic", cpm: "Coût pour 1 000 affichages",
  engagements: "Réactions et commentaires", videoViews: "Vues vidéo", conversions: "Résultats obtenus", leads: "Prospects", spend: "Dépenses", roi: "Retour sur investissement",
};
