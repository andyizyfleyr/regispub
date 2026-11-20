// Liste des clés et réglages des services externes que l'on peut saisir dans l'administration.
// Aucune dépendance serveur : ce fichier décrit les champs, il ne lit ni la base ni les variables d'environnement.

export type KeyGroupId = "payments" | "storage" | "email" | "whatsapp" | "ads";

export type KeyDef = {
  /** Nom de la variable (identique à celui de l'hébergeur, qui sert de valeur de secours). */
  name: string;
  group: KeyGroupId;
  label: string;
  hint?: string;
  placeholder?: string;
  /** Valeur confidentielle : jamais renvoyée au navigateur, seule sa fin est rappelée. */
  secret?: boolean;
  /** Liste fermée de valeurs. */
  options?: { value: string; label: string }[];
  /** Valeur utilisée quand rien n'est saisi, ni ici ni chez l'hébergeur. */
  fallback?: string;
};

export const KEY_GROUPS: { id: KeyGroupId; title: string; description: string }[] = [
  { id: "payments", title: "Paiement Mobile Money", description: "FedaPay encaisse les paiements MTN, Moov et Celtiis. Les clés se trouvent dans votre compte FedaPay, menu « API »." },
  { id: "storage", title: "Stockage des fichiers", description: "Photos, vidéos et créations sont rangées dans un espace compatible S3 (Cloudflare R2, Backblaze, Amazon S3…)." },
  { id: "email", title: "E-mails", description: "Les e-mails (confirmation, mot de passe oublié, reçus) partent avec Resend." },
  { id: "whatsapp", title: "Messages WhatsApp", description: "WhatsApp Cloud API de Meta. Il faut un numéro WhatsApp Business et un modèle de message approuvé." },
  { id: "ads", title: "Statistiques publicitaires", description: "Jetons de lecture des statistiques Meta (Facebook, Instagram) et TikTok." },
];

export const KEYS: KeyDef[] = [
  // ── Paiement
  { name: "PAYMENT_PROVIDER", group: "payments", label: "Prestataire de paiement", fallback: "sandbox",
    options: [{ value: "fedapay", label: "FedaPay" }, { value: "sandbox", label: "Simulation (aucun argent ne circule)" }] },
  { name: "ALLOW_SANDBOX_PAYMENTS", group: "payments", label: "Simulation sur le site en ligne", fallback: "false",
    hint: "À laisser sur « Interdite » dès que vous encaissez de vrais paiements.",
    options: [{ value: "false", label: "Interdite" }, { value: "true", label: "Autorisée (démonstration)" }] },
  { name: "FEDAPAY_ENV", group: "payments", label: "Mode FedaPay", fallback: "sandbox",
    hint: "Les clés et le secret du webhook doivent venir du même mode. En test, la page de paiement FedaPay n'accepte que les numéros 01 64 00 00 01 et 01 66 00 00 01.",
    options: [{ value: "live", label: "Réel" }, { value: "sandbox", label: "Test" }] },
  { name: "FEDAPAY_PUBLIC_KEY", group: "payments", label: "Clé publique FedaPay", placeholder: "pk_live_…",
    hint: "Facultative : le paiement se fait sur la page de FedaPay, qui n'utilise que la clé secrète. Le site vérifie seulement qu'elle vient du même mode." },
  { name: "FEDAPAY_SECRET_KEY", group: "payments", label: "Clé secrète FedaPay", secret: true, placeholder: "sk_live_…" },
  { name: "FEDAPAY_WEBHOOK_SECRET", group: "payments", label: "Secret du webhook FedaPay", secret: true, placeholder: "wh_live_…",
    hint: "Donné par FedaPay quand vous créez le webhook. L'adresse à lui indiquer est dans « Intégrations ». Événements à cocher : transaction.approved, declined, canceled, transferred." },

  // ── Stockage
  { name: "STORAGE_DRIVER", group: "storage", label: "Stockage utilisé", fallback: "local",
    hint: "Si vous changez d'espace, les fichiers déjà envoyés restent dans l'ancien.",
    options: [{ value: "s3", label: "Espace compatible S3" }, { value: "local", label: "Aucun (envoi de fichiers désactivé en ligne)" }] },
  { name: "S3_ENDPOINT", group: "storage", label: "Adresse du service (endpoint)", placeholder: "https://<compte>.r2.cloudflarestorage.com" },
  { name: "S3_REGION", group: "storage", label: "Région", fallback: "auto", placeholder: "auto" },
  { name: "S3_BUCKET", group: "storage", label: "Nom de l'espace (bucket)", placeholder: "regispub" },
  { name: "S3_ACCESS_KEY_ID", group: "storage", label: "Identifiant de clé d'accès", secret: true },
  { name: "S3_SECRET_ACCESS_KEY", group: "storage", label: "Clé d'accès secrète", secret: true },

  // ── E-mails
  { name: "EMAIL_PROVIDER", group: "email", label: "Envoi des e-mails", fallback: "none",
    options: [{ value: "resend", label: "Resend" }, { value: "none", label: "Désactivé" }] },
  { name: "EMAIL_FROM", group: "email", label: "Expéditeur", fallback: "RegisPub <no-reply@example.com>", placeholder: "RegisPub <contact@votre-domaine.com>",
    hint: "L'adresse doit appartenir à un domaine vérifié dans Resend." },
  { name: "RESEND_API_KEY", group: "email", label: "Clé API Resend", secret: true, placeholder: "re_…" },

  // ── WhatsApp
  { name: "WHATSAPP_PHONE_NUMBER_ID", group: "whatsapp", label: "Identifiant du numéro", hint: "« Phone number ID » dans Meta for Developers, pas le numéro lui-même." },
  { name: "WHATSAPP_ACCESS_TOKEN", group: "whatsapp", label: "Jeton d'accès WhatsApp", secret: true },
  { name: "WHATSAPP_TEMPLATE_NAME", group: "whatsapp", label: "Nom du modèle de message", hint: "Modèle approuvé par Meta, avec une seule variable dans le corps." },
  { name: "WHATSAPP_TEMPLATE_LANG", group: "whatsapp", label: "Langue du modèle", fallback: "fr", placeholder: "fr" },

  // ── Publicité
  { name: "META_ACCESS_TOKEN", group: "ads", label: "Jeton Meta", secret: true, hint: "Jeton d'utilisateur système avec l'autorisation ads_read." },
  { name: "META_API_VERSION", group: "ads", label: "Version de l'API Meta", fallback: "v23.0", placeholder: "v23.0" },
  { name: "TIKTOK_ACCESS_TOKEN", group: "ads", label: "Jeton TikTok", secret: true },
  { name: "TIKTOK_ADVERTISER_ID", group: "ads", label: "Identifiant annonceur TikTok" },
  { name: "TIKTOK_ACCOUNT_CURRENCY", group: "ads", label: "Devise du compte TikTok", fallback: "USD", placeholder: "USD" },
  { name: "FX_RATES_TO_XOF", group: "ads", label: "Taux de change vers le franc CFA", fallback: "{}", placeholder: '{"USD":600}',
    hint: "Sert à convertir les dépenses d'un compte publicitaire en dollars. L'euro est déjà connu." },
];

export const KEY_NAMES = KEYS.map((k) => k.name);
const BY_NAME = new Map(KEYS.map((k) => [k.name, k]));
export const keyDef = (name: string) => BY_NAME.get(name);

/**
 * Réglages qui restent chez l'hébergeur : l'application en a besoin avant de pouvoir lire la base
 * (ou c'est l'hébergeur lui-même qui les utilise). Affichés pour information dans l'administration.
 */
export const HOST_ONLY_KEYS: { name: string; why: string }[] = [
  { name: "DATABASE_URL", why: "Adresse de la base de données. Les clés saisies ici sont rangées dans cette base : il faut donc la connaître avant." },
  { name: "APP_SECRET", why: "Sert à chiffrer les clés saisies ici et à signer les sessions. Si elle change, les clés enregistrées sont à ressaisir." },
  { name: "CRON_SECRET", why: "L'hébergeur l'envoie lui-même avec les tâches planifiées (vérification des paiements, rappels)." },
];

export type Lookup = (name: string) => string;

/** Lecture d'une clé : la valeur saisie dans l'administration passe avant celle de l'hébergeur. */
export function makeLookup(saved: ReadonlyMap<string, string>, hostEnv: Record<string, string | undefined>): Lookup {
  return (name) => {
    const value = saved.has(name) ? saved.get(name)! : hostEnv[name] ?? "";
    return value === "" ? keyDef(name)?.fallback ?? "" : value;
  };
}

export type RuntimeConfig = ReturnType<typeof buildConfig>;

/** Configuration des services externes, prête à l'emploi. */
export function buildConfig(get: Lookup) {
  let fxRates: Record<string, number> = {};
  try {
    const parsed: unknown = JSON.parse(get("FX_RATES_TO_XOF") || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      fxRates = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "number" && v > 0).map(([k, v]) => [k.toUpperCase(), v as number]));
    }
  } catch { /* valeur illisible : aucun taux */ }
  return {
    paymentProvider: get("PAYMENT_PROVIDER").toLowerCase(),
    allowSandboxPayments: get("ALLOW_SANDBOX_PAYMENTS") === "true",
    fedapayEnv: get("FEDAPAY_ENV") === "live" ? ("live" as const) : ("sandbox" as const),
    fedapayPublicKey: get("FEDAPAY_PUBLIC_KEY"),
    fedapaySecretKey: get("FEDAPAY_SECRET_KEY"),
    fedapayWebhookSecret: get("FEDAPAY_WEBHOOK_SECRET"),
    storageDriver: get("STORAGE_DRIVER").toLowerCase(),
    s3: {
      endpoint: get("S3_ENDPOINT").replace(/\/$/, ""),
      region: get("S3_REGION"),
      bucket: get("S3_BUCKET"),
      accessKeyId: get("S3_ACCESS_KEY_ID"),
      secretAccessKey: get("S3_SECRET_ACCESS_KEY"),
    },
    emailProvider: get("EMAIL_PROVIDER").toLowerCase(),
    emailFrom: get("EMAIL_FROM"),
    resendKey: get("RESEND_API_KEY"),
    whatsapp: {
      phoneNumberId: get("WHATSAPP_PHONE_NUMBER_ID"),
      accessToken: get("WHATSAPP_ACCESS_TOKEN"),
      templateName: get("WHATSAPP_TEMPLATE_NAME"),
      templateLang: get("WHATSAPP_TEMPLATE_LANG"),
    },
    meta: { accessToken: get("META_ACCESS_TOKEN"), apiVersion: get("META_API_VERSION") },
    tiktok: { accessToken: get("TIKTOK_ACCESS_TOKEN"), advertiserId: get("TIKTOK_ADVERTISER_ID"), accountCurrency: get("TIKTOK_ACCOUNT_CURRENCY").toUpperCase() },
    fxRates,
  };
}

export const s3Complete = (c: RuntimeConfig) => Boolean(c.s3.endpoint && c.s3.bucket && c.s3.accessKeyId && c.s3.secretAccessKey);

/** Fin d'une valeur confidentielle, pour la reconnaître sans la montrer. Rien n'est rappelé d'une valeur courte. */
export function maskSecret(value: string): string {
  return value.length >= 12 ? `••••${value.slice(-4)}` : "••••";
}

const MAX_LENGTH = 2000;

/** Nettoie une valeur saisie. Renvoie un message d'erreur si elle ne peut pas être enregistrée. */
export function checkValue(def: KeyDef, raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (value.length > MAX_LENGTH) return { ok: false, error: "Valeur trop longue." };
  if (/[\r\n\0]/.test(value)) return { ok: false, error: "Une clé tient sur une seule ligne : vérifiez le copier-coller." };
  if (def.options && !def.options.some((o) => o.value === value)) return { ok: false, error: "Choix inconnu." };
  if (value === "") return { ok: true, value };
  if (def.secret && /\s/.test(value)) return { ok: false, error: "Une clé ne contient pas d'espace : vérifiez le copier-coller." };
  switch (def.name) {
    case "FEDAPAY_PUBLIC_KEY":
      // Ce champ est affiché en clair : une clé secrète n'a rien à y faire.
      if (/^sk_/i.test(value)) return { ok: false, error: "C'est une clé secrète : collez-la dans « Clé secrète FedaPay ». Ici, il faut la clé publique, qui commence par « pk_ »." };
      break;
    case "FEDAPAY_SECRET_KEY":
      if (/^pk_/i.test(value)) return { ok: false, error: "C'est la clé publique. Collez ici la clé secrète, qui commence par « sk_ »." };
      break;
    case "S3_ENDPOINT":
      if (!/^https:\/\/[^\s/]+\.[^\s/]+(\/[^\s]*)?$/i.test(value)) return { ok: false, error: "L'adresse doit commencer par https://" };
      break;
    case "EMAIL_FROM":
      if (!/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(value)) return { ok: false, error: "Indiquez une adresse e-mail, par exemple RegisPub <contact@votre-domaine.com>." };
      break;
    case "META_API_VERSION":
      if (!/^v\d{1,2}\.\d$/.test(value)) return { ok: false, error: "Format attendu : v23.0" };
      break;
    case "TIKTOK_ACCOUNT_CURRENCY":
      if (!/^[A-Za-z]{3}$/.test(value)) return { ok: false, error: "Code de devise à trois lettres, par exemple USD." };
      return { ok: true, value: value.toUpperCase() };
    case "WHATSAPP_TEMPLATE_LANG":
      if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(value)) return { ok: false, error: "Code de langue, par exemple fr ou en_US." };
      break;
    case "WHATSAPP_PHONE_NUMBER_ID":
    case "TIKTOK_ADVERTISER_ID":
      if (!/^\d{5,30}$/.test(value)) return { ok: false, error: "Chiffres uniquement." };
      break;
    case "FX_RATES_TO_XOF": {
      let parsed: unknown;
      try { parsed = JSON.parse(value); } catch { return { ok: false, error: 'Format attendu : {"USD":600}' }; }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.entries(parsed).some(([k, v]) => !/^[A-Za-z]{3}$/.test(k) || typeof v !== "number" || !(v > 0))) return { ok: false, error: 'Format attendu : {"USD":600}' };
      break;
    }
  }
  return { ok: true, value };
}

/** Incohérences d'une configuration complète : une erreur par champ à corriger (objet vide = cohérente). */
export function configIssues(c: RuntimeConfig): Record<string, string> {
  const issues: Record<string, string> = {};
  if (c.paymentProvider === "fedapay" && c.fedapayPublicKey) {
    const kind = /^pk_live_/.test(c.fedapayPublicKey) ? "live" : /^pk_sandbox_/.test(c.fedapayPublicKey) ? "sandbox" : null;
    if (kind && kind !== c.fedapayEnv) issues.FEDAPAY_PUBLIC_KEY = kind === "live" ? "Cette clé publique est une clé réelle, alors que le mode choisi est « Test »." : "Cette clé publique est une clé de test, alors que le mode choisi est « Réel ».";
  }
  if (c.paymentProvider === "fedapay" && !c.fedapaySecretKey) issues.FEDAPAY_SECRET_KEY = "Ajoutez la clé secrète FedaPay, ou choisissez « Simulation ».";
  if (c.paymentProvider === "fedapay" && c.fedapaySecretKey) {
    // Une clé de test en mode réel (ou l'inverse) est refusée par FedaPay à chaque paiement.
    const kind = /^sk_live_/.test(c.fedapaySecretKey) ? "live" : /^sk_sandbox_/.test(c.fedapaySecretKey) ? "sandbox" : null;
    if (kind && kind !== c.fedapayEnv) issues.FEDAPAY_ENV = kind === "live" ? "Cette clé secrète est une clé réelle : choisissez le mode « Réel »." : "Cette clé secrète est une clé de test : choisissez le mode « Test ».";
  }
  if (c.storageDriver === "s3") {
    if (!c.s3.endpoint) issues.S3_ENDPOINT = "Indiquez l'adresse du service.";
    if (!c.s3.bucket) issues.S3_BUCKET = "Indiquez le nom de l'espace.";
    if (!c.s3.accessKeyId) issues.S3_ACCESS_KEY_ID = "Indiquez l'identifiant de clé d'accès.";
    if (!c.s3.secretAccessKey) issues.S3_SECRET_ACCESS_KEY = "Indiquez la clé d'accès secrète.";
  }
  if (c.emailProvider === "resend") {
    if (!c.resendKey) issues.RESEND_API_KEY = "Ajoutez la clé API Resend, ou choisissez « Désactivé ».";
    if (/@example\.com/i.test(c.emailFrom)) issues.EMAIL_FROM = "Indiquez l'adresse d'expédition de votre domaine.";
  }
  return issues;
}
