export type PlatformCode = "FACEBOOK" | "INSTAGRAM" | "TIKTOK";

export const PLATFORMS: Record<PlatformCode, { label: string; family: "META" | "TIKTOK"; color: string }> = {
  FACEBOOK: { label: "Facebook", family: "META", color: "#1877F2" },
  INSTAGRAM: { label: "Instagram", family: "META", color: "#D62976" },
  TIKTOK: { label: "TikTok", family: "TIKTOK", color: "#111111" },
};

export const PLATFORM_CODES = Object.keys(PLATFORMS) as PlatformCode[];

export const PLATFORM_CHOICES: { id: string; label: string; description: string; platforms: PlatformCode[] }[] = [
  { id: "facebook", label: "Facebook", description: "Le réseau le plus utilisé pour vendre et se faire connaître localement.", platforms: ["FACEBOOK"] },
  { id: "instagram", label: "Instagram", description: "Idéal pour la mode, la beauté, la restauration et les produits visuels.", platforms: ["INSTAGRAM"] },
  { id: "tiktok", label: "TikTok", description: "Vidéos courtes, audience jeune et forte viralité.", platforms: ["TIKTOK"] },
  { id: "meta", label: "Facebook + Instagram", description: "Une seule campagne diffusée sur les deux réseaux de Meta.", platforms: ["FACEBOOK", "INSTAGRAM"] },
  { id: "all", label: "Les trois plateformes", description: "Présence maximale : Facebook, Instagram et TikTok en parallèle.", platforms: ["FACEBOOK", "INSTAGRAM", "TIKTOK"] },
];

export function platformFamilies(platforms: PlatformCode[]) {
  return Array.from(new Set(platforms.map((p) => PLATFORMS[p].family)));
}

export function platformLabel(platforms: PlatformCode[]) {
  return platforms.map((p) => PLATFORMS[p].label).join(" + ") || "—";
}

/** Répartition égale par défaut, en pourcentages entiers dont la somme vaut 100. */
export function defaultSplit(platforms: PlatformCode[]): Record<string, number> {
  if (!platforms.length) return {};
  const base = Math.floor(100 / platforms.length);
  const split: Record<string, number> = {};
  platforms.forEach((p, i) => (split[p] = base + (i === 0 ? 100 - base * platforms.length : 0)));
  return split;
}

export function normalizeSplit(platforms: PlatformCode[], raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return defaultSplit(platforms);
  const input = raw as Record<string, unknown>;
  const values = platforms.map((p) => Math.max(0, Math.round(Number(input[p]) || 0)));
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum !== 100 || values.some((v) => v === 0)) return defaultSplit(platforms);
  return Object.fromEntries(platforms.map((p, i) => [p, values[i]!]));
}

export type AdFormat = { id: string; label: string; width: number; height: number; ratio: string; usage: string; platforms: PlatformCode[] };

export const AD_FORMATS: AdFormat[] = [
  { id: "square", label: "Publication carrée", width: 1080, height: 1080, ratio: "1:1", usage: "Fil d'actualité Facebook et Instagram", platforms: ["FACEBOOK", "INSTAGRAM"] },
  { id: "portrait", label: "Publication verticale", width: 1080, height: 1350, ratio: "4:5", usage: "Fil Instagram et Facebook, occupe plus d'écran", platforms: ["FACEBOOK", "INSTAGRAM"] },
  { id: "story", label: "Story / Reel / TikTok", width: 1080, height: 1920, ratio: "9:16", usage: "Stories, Reels et vidéos TikTok plein écran", platforms: ["FACEBOOK", "INSTAGRAM", "TIKTOK"] },
  { id: "landscape", label: "Bannière paysage", width: 1200, height: 628, ratio: "1,91:1", usage: "Publicités avec lien sur Facebook", platforms: ["FACEBOOK"] },
  { id: "banner", label: "Bannière promotionnelle", width: 1640, height: 624, ratio: "2,63:1", usage: "Couverture de page et bandeaux promotionnels", platforms: ["FACEBOOK"] },
];

export const formatById = (id: string) => AD_FORMATS.find((f) => f.id === id) ?? AD_FORMATS[0]!;
