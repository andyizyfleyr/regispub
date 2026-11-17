// Audience de départ selon le secteur d'activité. Simple table tenue par notre équipe : aucune génération automatique.
// Le client peut tout modifier ; le ciblage réel est appliqué par le gestionnaire.
import { INTEREST_GROUPS } from "@/lib/catalog/targeting";

const SECTOR_PROFILES: { match: RegExp; interests: string[]; categories: string[]; gender: "ALL" | "FEMALE" | "MALE"; ages: [number, number] }[] = [
  { match: /mode|habillement|pagne|couture/i, interests: ["Mode", "Vêtements pour femmes", "Pagne et tissus", "Chaussures", "Mariage"], categories: ["Jeunes actifs", "Étudiants", "Futurs mariés"], gender: "ALL", ages: [18, 45] },
  { match: /beaut|cosm|coiff|perruque/i, interests: ["Cosmétiques", "Coiffure", "Perruques et mèches", "Mode", "Santé et bien-être"], categories: ["Jeunes actifs", "Étudiants"], gender: "FEMALE", ages: [18, 45] },
  { match: /restau|aliment|pâtiss|traiteur|cuisine/i, interests: ["Restauration", "Fast-food", "Livraison de repas", "Cuisine", "Pâtisserie"], categories: ["Jeunes actifs", "Étudiants", "Parents"], gender: "ALL", ages: [18, 45] },
  { match: /télé|électro|informatique|phone/i, interests: ["Smartphones", "Informatique", "Accessoires téléphone", "Jeux vidéo"], categories: ["Jeunes actifs", "Étudiants", "Commerçants et revendeurs"], gender: "ALL", ages: [18, 45] },
  { match: /immobili/i, interests: ["Immobilier", "Ameublement", "Finance personnelle", "Décoration"], categories: ["Diaspora", "Fonctionnaires", "Entrepreneurs et dirigeants"], gender: "ALL", ages: [25, 55] },
  { match: /formation|éducation|école/i, interests: ["Formation professionnelle", "Études supérieures", "Entrepreneuriat", "Marketing digital"], categories: ["Étudiants", "Jeunes actifs", "Parents"], gender: "ALL", ages: [18, 35] },
  { match: /santé|bien-être|pharma|sport/i, interests: ["Santé et bien-être", "Sport et fitness", "Produits bio"], categories: ["Particuliers", "Parents"], gender: "ALL", ages: [25, 55] },
  { match: /événement|mariage|décor/i, interests: ["Événementiel", "Mariage", "Musique", "Décoration"], categories: ["Futurs mariés", "Professionnels et entreprises"], gender: "ALL", ages: [25, 45] },
  { match: /entreprise|b2b|service|finance|assurance/i, interests: ["Petites entreprises", "Entrepreneuriat", "Finance personnelle", "Marketing digital"], categories: ["Entrepreneurs et dirigeants", "Professionnels et entreprises", "Commerçants et revendeurs"], gender: "ALL", ages: [25, 55] },
  { match: /agri|agro/i, interests: ["Agriculture", "Produits bio", "Petites entreprises", "Cuisine"], categories: ["Commerçants et revendeurs", "Particuliers"], gender: "ALL", ages: [25, 55] },
  { match: /auto|moto|transport|logisti/i, interests: ["Automobile", "Moto", "Transport et livraison"], categories: ["Jeunes actifs", "Commerçants et revendeurs"], gender: "MALE", ages: [25, 55] },
];
const DEFAULT_PROFILE = { interests: ["Petites entreprises", "Entrepreneuriat", "Mode", "Restauration"], categories: ["Particuliers", "Jeunes actifs"], gender: "ALL" as const, ages: [18, 45] as [number, number] };
const KNOWN_INTERESTS = new Set(INTEREST_GROUPS.flatMap((g) => g.items));

export type AudienceDefaults = { cities: string[]; ageMin: number; ageMax: number; gender: "ALL" | "FEMALE" | "MALE"; interests: string[]; categories: string[] };

/** Réglage de départ : la ville de l'entreprise, puis la tranche d'âge et quelques centres d'intérêt habituels du secteur. */
export function defaultAudience(business: { sector?: string; city?: string }): AudienceDefaults {
  const p = SECTOR_PROFILES.find((s) => s.match.test(business.sector ?? "")) ?? DEFAULT_PROFILE;
  const city = business.city?.trim();
  return {
    cities: city ? [city] : [], ageMin: p.ages[0], ageMax: p.ages[1], gender: p.gender,
    interests: p.interests.filter((i) => KNOWN_INTERESTS.has(i)).slice(0, 5), categories: p.categories.slice(0, 3),
  };
}
