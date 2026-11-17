// Référentiels de ciblage proposés dans l'assistant. Le ciblage réel est appliqué par le gestionnaire
// dans les limites autorisées par Meta et TikTok (âge minimum 18 ans pour nos campagnes).
export const TARGET_COUNTRIES = [
  { code: "BJ", name: "Bénin" }, { code: "TG", name: "Togo" }, { code: "CI", name: "Côte d'Ivoire" }, { code: "SN", name: "Sénégal" },
  { code: "BF", name: "Burkina Faso" }, { code: "NE", name: "Niger" }, { code: "ML", name: "Mali" }, { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" }, { code: "CM", name: "Cameroun" }, { code: "GA", name: "Gabon" }, { code: "CG", name: "Congo" }, { code: "FR", name: "France (diaspora)" },
];

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  BJ: ["Cotonou", "Abomey-Calavi", "Porto-Novo", "Parakou", "Sèmè-Podji", "Ouidah", "Bohicon", "Abomey", "Djougou", "Natitingou", "Lokossa", "Kandi", "Comè", "Pobè", "Savalou", "Dassa-Zoumè", "Malanville", "Allada"],
  TG: ["Lomé", "Kara", "Sokodé", "Kpalimé", "Atakpamé"],
  CI: ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo"],
  SN: ["Dakar", "Thiès", "Saint-Louis", "Touba", "Mbour"],
  BF: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou"],
  NE: ["Niamey", "Maradi", "Zinder"],
  ML: ["Bamako", "Sikasso", "Ségou"],
  NG: ["Lagos", "Abuja", "Ibadan"],
  GH: ["Accra", "Kumasi"],
  CM: ["Douala", "Yaoundé"],
  GA: ["Libreville", "Port-Gentil"],
  CG: ["Brazzaville", "Pointe-Noire"],
  FR: ["Paris", "Lyon", "Marseille"],
};

export const AGE_BOUNDS = [18, 25, 35, 45, 55, 65] as const; // 65 = « 65 ans et plus »
export const MIN_AGE = 18;
export const MAX_AGE = 65;

export const GENDERS = [
  { id: "ALL", label: "Tout le monde" }, { id: "FEMALE", label: "Femmes" }, { id: "MALE", label: "Hommes" },
] as const;

export const LANGUAGES = [
  { id: "fr", label: "Français" }, { id: "en", label: "Anglais" }, { id: "all", label: "Toutes les langues" },
];

export const INTEREST_GROUPS: { group: string; items: string[] }[] = [
  { group: "Mode & beauté", items: ["Mode", "Vêtements pour femmes", "Vêtements pour hommes", "Chaussures", "Cosmétiques", "Coiffure", "Perruques et mèches", "Bijoux", "Pagne et tissus"] },
  { group: "Alimentation", items: ["Restauration", "Cuisine", "Fast-food", "Pâtisserie", "Boissons", "Produits bio", "Livraison de repas"] },
  { group: "Maison & famille", items: ["Décoration", "Ameublement", "Immobilier", "Parents", "Bébés et enfants", "Mariage", "Électroménager"] },
  { group: "Technologie", items: ["Smartphones", "Informatique", "Jeux vidéo", "Accessoires téléphone", "Énergie solaire"] },
  { group: "Affaires & formation", items: ["Entrepreneuriat", "Petites entreprises", "Formation professionnelle", "Études supérieures", "Marketing digital", "Finance personnelle", "Agriculture"] },
  { group: "Loisirs & services", items: ["Voyage", "Événementiel", "Musique", "Sport et fitness", "Football", "Automobile", "Moto", "Santé et bien-être", "Transport et livraison"] },
];

export const CUSTOMER_CATEGORIES = [
  "Particuliers", "Étudiants", "Jeunes actifs", "Parents", "Commerçants et revendeurs", "Entrepreneurs et dirigeants",
  "Professionnels et entreprises", "Fonctionnaires", "Diaspora", "Futurs mariés",
];

export const SECTORS = [
  "Mode et habillement", "Beauté et cosmétiques", "Restauration et alimentation", "Commerce général", "Téléphonie et électronique",
  "Immobilier", "Formation et éducation", "Santé et bien-être", "Événementiel", "Services aux entreprises", "Transport et logistique",
  "Agriculture et agroalimentaire", "Artisanat", "Tourisme et hôtellerie", "Automobile et moto", "Finance et assurance", "Association ou ONG", "Autre",
];

export type Targeting = {
  countries: string[];
  cities: string[];
  zoneNote: string;
  ageMin: number;
  ageMax: number;
  gender: "ALL" | "FEMALE" | "MALE";
  interests: string[];
  categories: string[];
  languages: string[];
  customAudience: { requested: boolean; note: string };
};

export const DEFAULT_TARGETING: Targeting = {
  countries: ["BJ"], cities: [], zoneNote: "", ageMin: 18, ageMax: 45, gender: "ALL",
  interests: [], categories: [], languages: ["fr"], customAudience: { requested: false, note: "" },
};
