// Étape « base de données » d'un déploiement : applique les migrations puis le jeu de données initial
// (services, modèles, compte super administrateur). Rejouable sans risque : rien d'existant n'est écrasé.
import "dotenv/config";
import { seed } from "../prisma/seed";
import { applyMigrations } from "./lib/migrations";

async function main() {
  const stage = process.env.VERCEL_ENV;
  // Les déploiements de prévisualisation (une branche, une pull request) ne touchent jamais à la base.
  if (stage && stage !== "production") { console.log(`Déploiement « ${stage} » : base de données laissée telle quelle.`); return; }
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis pour déployer (variable d'environnement du projet).");
  await applyMigrations(url);
  await seed();
}

main().catch((error) => { console.error(`Préparation de la base en échec : ${(error as Error).message}`); process.exit(1); });
