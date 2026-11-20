// Lecture centralisée de la configuration. Rien n'est lu côté navigateur :
// ce module ne doit être importé que par du code serveur.
function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  get isProd() { return process.env.NODE_ENV === "production"; },
  /** Adresse publique du site. Sur Vercel, le domaine de production est utilisé si APP_URL n'est pas défini. */
  get appUrl() {
    const vercel = str("VERCEL_PROJECT_PRODUCTION_URL") || str("VERCEL_URL");
    return str("APP_URL", vercel ? `https://${vercel}` : "http://localhost:3000").replace(/\/$/, "");
  },
  /** Système de fichiers en lecture seule (Vercel, AWS Lambda) : le stockage local n'y est pas utilisable. */
  get readOnlyFs() { return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME); },
  get appSecret() {
    const s = str("APP_SECRET");
    if (!s && process.env.NODE_ENV === "production") throw new Error("APP_SECRET est obligatoire en production");
    return s || "dev-only-secret-do-not-use-in-production";
  },
  get cronSecret() { return str("CRON_SECRET"); },
  get databaseUrl() { return str("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/regispub"); },

  /** Dossier du stockage sur disque (développement). Les clés des services externes se lisent avec getConfig() de lib/config. */
  get storageLocalDir() { return str("STORAGE_LOCAL_DIR", ".data/uploads"); },

  get cookieSameSite() { return str("SESSION_COOKIE_SAMESITE", "lax") === "none" ? "none" as const : "lax" as const; },
};
