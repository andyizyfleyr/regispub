// Lecture centralisée de la configuration. Rien n'est lu côté navigateur :
// ce module ne doit être importé que par du code serveur.
function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  get isProd() { return process.env.NODE_ENV === "production"; },
  get appUrl() { return str("APP_URL", "http://localhost:3000").replace(/\/$/, ""); },
  get appSecret() {
    const s = str("APP_SECRET");
    if (!s && process.env.NODE_ENV === "production") throw new Error("APP_SECRET est obligatoire en production");
    return s || "dev-only-secret-do-not-use-in-production";
  },
  get cronSecret() { return str("CRON_SECRET"); },
  get databaseUrl() { return str("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/regispub"); },

  get paymentProvider() { return str("PAYMENT_PROVIDER", "sandbox").toLowerCase(); },
  get allowSandboxPayments() { return str("ALLOW_SANDBOX_PAYMENTS") === "true"; },
  get fedapayEnv() { return str("FEDAPAY_ENV", "sandbox") === "live" ? "live" as const : "sandbox" as const; },
  get fedapaySecretKey() { return str("FEDAPAY_SECRET_KEY"); },
  get fedapayWebhookSecret() { return str("FEDAPAY_WEBHOOK_SECRET"); },

  get aiTextProvider() { return str("AI_TEXT_PROVIDER").toLowerCase(); },
  get aiTextModel() { return str("AI_TEXT_MODEL"); },
  get openaiKey() { return str("OPENAI_API_KEY"); },
  get openaiBaseUrl() { return str("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, ""); },
  get anthropicKey() { return str("ANTHROPIC_API_KEY"); },
  get geminiKey() { return str("GEMINI_API_KEY"); },
  get aiImageProvider() { return str("AI_IMAGE_PROVIDER").toLowerCase(); },
  get aiImageModel() { return str("AI_IMAGE_MODEL"); },

  get storageDriver() { return str("STORAGE_DRIVER", "local").toLowerCase(); },
  get storageLocalDir() { return str("STORAGE_LOCAL_DIR", ".data/uploads"); },
  get s3() {
    return {
      endpoint: str("S3_ENDPOINT").replace(/\/$/, ""),
      region: str("S3_REGION", "auto"),
      bucket: str("S3_BUCKET"),
      accessKeyId: str("S3_ACCESS_KEY_ID"),
      secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    };
  },

  get emailProvider() { return str("EMAIL_PROVIDER").toLowerCase(); },
  get emailFrom() { return str("EMAIL_FROM", "RegisPub <no-reply@example.com>"); },
  get resendKey() { return str("RESEND_API_KEY"); },
  get whatsapp() {
    return {
      phoneNumberId: str("WHATSAPP_PHONE_NUMBER_ID"),
      accessToken: str("WHATSAPP_ACCESS_TOKEN"),
      templateName: str("WHATSAPP_TEMPLATE_NAME"),
      templateLang: str("WHATSAPP_TEMPLATE_LANG", "fr"),
    };
  },

  get meta() { return { accessToken: str("META_ACCESS_TOKEN"), apiVersion: str("META_API_VERSION", "v23.0") }; },
  get tiktok() { return { accessToken: str("TIKTOK_ACCESS_TOKEN"), advertiserId: str("TIKTOK_ADVERTISER_ID") }; },

  get cookieSameSite() { return str("SESSION_COOKIE_SAMESITE", "lax") === "none" ? "none" as const : "lax" as const; },
};
