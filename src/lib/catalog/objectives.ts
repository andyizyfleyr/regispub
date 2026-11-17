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
  community: { label: "Développer ma communauté", description: "Gagner des abonnés et faire vivre vos pages." },
  business: { label: "Développer mes ventes", description: "Obtenir des commandes, des prospects et des clients." },
  awareness: { label: "Gagner en visibilité", description: "Faire connaître votre marque, un produit ou un événement." },
};

const ALL: PlatformCode[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK"];
const META: PlatformCode[] = ["FACEBOOK", "INSTAGRAM"];

export const OBJECTIVES: Objective[] = [
  // ── Communauté
  {
    code: "page_likes", category: "community", label: "Obtenir plus de mentions J'aime", icon: "ThumbsUp", serviceCode: "followers", platforms: ["FACEBOOK"],
    description: "Montrer votre page Facebook aux personnes susceptibles de l'aimer.",
    config: { metaObjective: "OUTCOME_ENGAGEMENT", metaOptimization: "PAGE_LIKES", kpis: ["engagements", "reach", "impressions", "spend"], formats: ["square", "portrait"], ctas: ["J'aime la Page"], recommendedDays: 10, recommendedDailyBudget: 1500, requires: ["page"] },
    recommendation: "Utile pour crédibiliser une page récente. Privilégiez une image claire de votre activité plutôt qu'une promotion.",
  },
  {
    code: "fb_followers", category: "community", label: "Gagner des abonnés Facebook", icon: "UserPlus", serviceCode: "followers", platforms: ["FACEBOOK"],
    description: "Faire grandir l'audience qui suit vos publications Facebook.",
    config: { metaObjective: "OUTCOME_ENGAGEMENT", metaOptimization: "PAGE_LIKES", kpis: ["engagements", "reach", "impressions", "spend"], formats: ["square", "portrait", "story"], ctas: ["S'abonner"], recommendedDays: 14, recommendedDailyBudget: 1500, requires: ["page"] },
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
  {
    code: "page_awareness", category: "community", label: "Faire connaître une page ou une marque", icon: "Megaphone", serviceCode: "visibility", platforms: ALL,
    description: "Présenter votre page au plus grand nombre de personnes de votre zone.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "cpm", "spend"], formats: ["square", "story"], ctas: ["En savoir plus"], recommendedDays: 10, recommendedDailyBudget: 1500, requires: ["page"] },
    recommendation: "Un message simple, répété plusieurs jours, marque davantage qu'une diffusion massive sur 48 heures.",
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
    code: "leads", category: "business", label: "Générer des prospects", icon: "ClipboardList", serviceCode: "leads", platforms: ALL,
    description: "Collecter les coordonnées de personnes intéressées par votre offre.",
    config: { metaObjective: "OUTCOME_LEADS", metaOptimization: "LEAD_GENERATION", tiktokObjective: "LEAD_GENERATION", tiktokOptimization: "LEAD_GENERATION", kpis: ["leads", "clicks", "ctr", "cpc", "spend"], formats: ["square", "portrait", "story"], ctas: ["S'inscrire", "Obtenir une offre"], recommendedDays: 14, recommendedDailyBudget: 3000, requires: ["page"] },
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
    code: "product_promo", category: "business", label: "Promouvoir un produit ou un service", icon: "Tag", serviceCode: "campaign_creation", platforms: ALL,
    description: "Mettre en avant une offre précise auprès d'une audience ciblée.",
    config: { metaObjective: "OUTCOME_TRAFFIC", metaOptimization: "LINK_CLICKS", tiktokObjective: "TRAFFIC", tiktokOptimization: "CLICK", kpis: ["clicks", "ctr", "cpc", "reach", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus", "Envoyer un message WhatsApp"], recommendedDays: 7, recommendedDailyBudget: 2000, requires: [] },
    recommendation: "Une publicité = un produit = un bénéfice. Évitez de présenter tout votre catalogue dans le même visuel.",
  },
  {
    code: "quote_requests", category: "business", label: "Générer des demandes de devis", icon: "FileText", serviceCode: "leads", platforms: ALL,
    description: "Recevoir des demandes qualifiées pour vos prestations sur mesure.",
    config: { metaObjective: "OUTCOME_LEADS", metaOptimization: "LEAD_GENERATION", tiktokObjective: "LEAD_GENERATION", tiktokOptimization: "LEAD_GENERATION", kpis: ["leads", "clicks", "ctr", "cpc", "spend"], formats: ["square", "portrait"], ctas: ["Demander un devis"], recommendedDays: 14, recommendedDailyBudget: 3000, requires: ["page"] },
    recommendation: "Montrez une réalisation concrète et une fourchette de prix : vous recevrez moins de demandes, mais plus sérieuses.",
  },
  // ── Visibilité
  {
    code: "company_awareness", category: "awareness", label: "Faire connaître une entreprise", icon: "Building2", serviceCode: "visibility", platforms: ALL,
    description: "Installer le nom de votre entreprise dans l'esprit de votre zone de chalandise.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "cpm", "spend"], formats: ["square", "story"], ctas: ["En savoir plus"], recommendedDays: 14, recommendedDailyBudget: 1500, requires: [] },
    recommendation: "Répétez les mêmes couleurs et le même logo sur tous vos visuels pour être reconnu d'une publicité à l'autre.",
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
  {
    code: "product_launch", category: "awareness", label: "Lancer un nouveau produit", icon: "Rocket", serviceCode: "visibility", platforms: ALL,
    description: "Créer l'attente puis révéler votre nouveauté à la bonne audience.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "REACH", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "clicks", "engagements", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus", "Commander"], recommendedDays: 14, recommendedDailyBudget: 2500, requires: [] },
    recommendation: "Prévoyez deux visuels : un teaser avant la sortie, puis une présentation avec le prix le jour du lancement.",
  },
  {
    code: "brand_building", category: "awareness", label: "Développer une marque", icon: "Gem", serviceCode: "visibility", platforms: ALL,
    description: "Construire dans la durée une image reconnaissable et appréciée.",
    config: { metaObjective: "OUTCOME_AWARENESS", metaOptimization: "AD_RECALL_LIFT", tiktokObjective: "REACH", tiktokOptimization: "REACH", kpis: ["reach", "impressions", "engagements", "cpm", "spend"], formats: ["square", "portrait", "story"], ctas: ["En savoir plus"], recommendedDays: 30, recommendedDailyBudget: 1500, requires: [] },
    recommendation: "La régularité prime : mieux vaut un petit budget chaque mois qu'une grosse dépense ponctuelle.",
  },
];

const byCode = new Map(OBJECTIVES.map((o) => [o.code, o]));
export const getObjective = (code: string | null | undefined) => (code ? byCode.get(code) ?? null : null);

export function objectivesFor(platforms: PlatformCode[]) {
  return OBJECTIVES.filter((o) => platforms.length === 0 || platforms.some((p) => o.platforms.includes(p)));
}

/** Plateformes sélectionnées non compatibles avec l'objectif (à signaler au client). */
export function unsupportedPlatforms(objective: Objective, platforms: PlatformCode[]) {
  return platforms.filter((p) => !objective.platforms.includes(p));
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  impressions: "Impressions", reach: "Portée", clicks: "Clics", ctr: "CTR", cpc: "CPC", cpm: "CPM",
  engagements: "Engagement", videoViews: "Vues vidéo", conversions: "Conversions", leads: "Prospects", spend: "Dépenses", roi: "Retour sur investissement",
};
