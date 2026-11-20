// Clés saisies dans l'administration : ordre de priorité, contrôles de saisie, cohérence d'ensemble.
import { describe, expect, it } from "vitest";
import { buildConfig, checkValue, configIssues, HOST_ONLY_KEYS, keyDef, KEYS, KEY_GROUPS, makeLookup, maskSecret, s3Complete } from "@/lib/config/keys";
import { can } from "@/lib/auth/permissions";

const config = (saved: Record<string, string>, host: Record<string, string> = {}) => buildConfig(makeLookup(new Map(Object.entries(saved)), host));
const check = (name: string, raw: string) => checkValue(keyDef(name)!, raw);

describe("registre des clés", () => {
  it("range chaque clé dans un groupe connu, sans doublon", () => {
    const groups = new Set(KEY_GROUPS.map((g) => g.id));
    expect(KEYS.every((k) => groups.has(k.group))).toBe(true);
    expect(new Set(KEYS.map((k) => k.name)).size).toBe(KEYS.length);
  });
  it("ne propose jamais à la saisie ce dont le site a besoin pour lire les clés", () => {
    for (const name of ["DATABASE_URL", "DIRECT_URL", "APP_SECRET", "CRON_SECRET", "APP_URL"]) expect(keyDef(name)).toBeUndefined();
    expect(HOST_ONLY_KEYS.map((k) => k.name)).toEqual(expect.arrayContaining(["DATABASE_URL", "APP_SECRET", "CRON_SECRET"]));
  });
  it("traite comme confidentiels tous les jetons et clés secrètes", () => {
    const secrets = KEYS.filter((k) => k.secret).map((k) => k.name).sort();
    expect(secrets).toEqual(["FEDAPAY_SECRET_KEY", "FEDAPAY_WEBHOOK_SECRET", "META_ACCESS_TOKEN", "RESEND_API_KEY", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "TIKTOK_ACCESS_TOKEN", "WHATSAPP_ACCESS_TOKEN"]);
  });
  it("réserve la saisie des clés au super administrateur", () => {
    expect(can("SUPER_ADMIN", "keys.manage")).toBe(true);
    for (const role of ["ADMIN", "AD_MANAGER", "DESIGNER", "SUPPORT", "CLIENT"] as const) expect(can(role, "keys.manage")).toBe(false);
  });
});

describe("ordre de priorité", () => {
  it("prend la valeur de l'administration, sinon celle de l'hébergeur, sinon la valeur par défaut", () => {
    expect(config({ PAYMENT_PROVIDER: "fedapay" }, { PAYMENT_PROVIDER: "sandbox" }).paymentProvider).toBe("fedapay");
    expect(config({}, { PAYMENT_PROVIDER: "fedapay" }).paymentProvider).toBe("fedapay");
    expect(config({}).paymentProvider).toBe("sandbox");
    expect(config({}).emailProvider).toBe("none");
    expect(config({}).s3.region).toBe("auto");
  });
  it("laisse une valeur vidée dans l'administration masquer celle de l'hébergeur", () => {
    expect(config({ S3_BUCKET: "" }, { S3_BUCKET: "ancien" }).s3.bucket).toBe("");
  });
  it("considère une variable d'hébergeur vide comme absente", () => {
    expect(config({}, { EMAIL_PROVIDER: "", STORAGE_DRIVER: "" }).emailProvider).toBe("none");
  });
  it("ne déclare le stockage complet qu'avec les quatre valeurs", () => {
    const full = { STORAGE_DRIVER: "s3", S3_ENDPOINT: "https://a.r2.cloudflarestorage.com", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "secret" };
    expect(s3Complete(config(full))).toBe(true);
    expect(s3Complete(config({ ...full, S3_SECRET_ACCESS_KEY: "" }))).toBe(false);
  });
});

describe("contrôle d'une valeur saisie", () => {
  it("retire les espaces de début et de fin d'un copier-coller", () => {
    expect(check("RESEND_API_KEY", "  re_abc123  ")).toEqual({ ok: true, value: "re_abc123" });
  });
  it("refuse une clé coupée par un espace ou un retour à la ligne", () => {
    expect(check("RESEND_API_KEY", "re_abc 123").ok).toBe(false);
    expect(check("META_ACCESS_TOKEN", "EAAG\nsuite").ok).toBe(false);
  });
  it("refuse un choix absent de la liste", () => {
    expect(check("PAYMENT_PROVIDER", "paypal").ok).toBe(false);
    expect(check("PAYMENT_PROVIDER", "fedapay").ok).toBe(true);
    expect(check("EMAIL_PROVIDER", "none").ok).toBe(true);
  });
  it("vérifie le format des valeurs techniques", () => {
    expect(check("S3_ENDPOINT", "r2.example.com").ok).toBe(false);
    expect(check("S3_ENDPOINT", "http://r2.example.com").ok).toBe(false);
    expect(check("S3_ENDPOINT", "https://compte.r2.cloudflarestorage.com").ok).toBe(true);
    expect(check("META_API_VERSION", "23").ok).toBe(false);
    expect(check("META_API_VERSION", "v23.0").ok).toBe(true);
    expect(check("TIKTOK_ACCOUNT_CURRENCY", "usd")).toEqual({ ok: true, value: "USD" });
    expect(check("WHATSAPP_PHONE_NUMBER_ID", "+229 97 00 00 00").ok).toBe(false);
    expect(check("FX_RATES_TO_XOF", "USD=600").ok).toBe(false);
    expect(check("FX_RATES_TO_XOF", '{"USD":-1}').ok).toBe(false);
    expect(check("FX_RATES_TO_XOF", '{"USD":610}').ok).toBe(true);
    expect(check("EMAIL_FROM", "RegisPub").ok).toBe(false);
    expect(check("EMAIL_FROM", "RegisPub <contact@regispub.bj>").ok).toBe(true);
  });
  it("refuse une clé FedaPay collée dans le mauvais champ", () => {
    // La clé publique est affichée en clair : une clé secrète ne doit jamais y être enregistrée.
    expect(check("FEDAPAY_PUBLIC_KEY", "sk_live_0123456789")).toMatchObject({ ok: false });
    expect(check("FEDAPAY_SECRET_KEY", "pk_live_0123456789")).toMatchObject({ ok: false });
    expect(check("FEDAPAY_PUBLIC_KEY", " pk_sandbox_0123456789 ")).toEqual({ ok: true, value: "pk_sandbox_0123456789" });
    expect(check("FEDAPAY_SECRET_KEY", "sk_sandbox_0123456789")).toEqual({ ok: true, value: "sk_sandbox_0123456789" });
    expect(check("FEDAPAY_PUBLIC_KEY", "")).toEqual({ ok: true, value: "" });
  });
  it("accepte de vider une valeur non obligatoire", () => {
    expect(check("TIKTOK_ADVERTISER_ID", "")).toEqual({ ok: true, value: "" });
  });
});

describe("cohérence d'ensemble", () => {
  it("n'a rien à redire à la configuration par défaut", () => {
    expect(configIssues(config({}))).toEqual({});
  });
  it("refuse FedaPay sans clé secrète", () => {
    expect(configIssues(config({ PAYMENT_PROVIDER: "fedapay" }))).toHaveProperty("FEDAPAY_SECRET_KEY");
  });
  it("refuse une clé de test en mode réel, et l'inverse", () => {
    expect(configIssues(config({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "live", FEDAPAY_SECRET_KEY: "sk_sandbox_abc" }))).toHaveProperty("FEDAPAY_ENV");
    expect(configIssues(config({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_SECRET_KEY: "sk_live_abc" }))).toHaveProperty("FEDAPAY_ENV");
    expect(configIssues(config({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "live", FEDAPAY_SECRET_KEY: "sk_live_abc" }))).toEqual({});
  });
  it("refuse une clé publique FedaPay d'un autre mode, mais ne l'exige pas", () => {
    const base = { PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_SECRET_KEY: "sk_sandbox_abc" };
    expect(configIssues(config(base))).toEqual({});
    expect(configIssues(config({ ...base, FEDAPAY_PUBLIC_KEY: "pk_sandbox_abc" }))).toEqual({});
    expect(Object.keys(configIssues(config({ ...base, FEDAPAY_PUBLIC_KEY: "pk_live_abc" })))).toEqual(["FEDAPAY_PUBLIC_KEY"]);
    expect(Object.keys(configIssues(config({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "live", FEDAPAY_SECRET_KEY: "sk_live_abc", FEDAPAY_PUBLIC_KEY: "pk_sandbox_abc" })))).toEqual(["FEDAPAY_PUBLIC_KEY"]);
    expect(config({ ...base, FEDAPAY_PUBLIC_KEY: "pk_sandbox_abc" }).fedapayPublicKey).toBe("pk_sandbox_abc");
  });
  it("signale chaque valeur S3 manquante", () => {
    expect(Object.keys(configIssues(config({ STORAGE_DRIVER: "s3" }))).sort()).toEqual(["S3_ACCESS_KEY_ID", "S3_BUCKET", "S3_ENDPOINT", "S3_SECRET_ACCESS_KEY"]);
  });
  it("refuse d'activer les e-mails sans clé ou avec l'expéditeur d'exemple", () => {
    expect(Object.keys(configIssues(config({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "RegisPub <no-reply@example.com>" }))).sort()).toEqual(["EMAIL_FROM", "RESEND_API_KEY"]);
    expect(configIssues(config({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "RegisPub <contact@regispub.bj>", RESEND_API_KEY: "re_abc" }))).toEqual({});
  });
});

describe("rappel d'une clé enregistrée", () => {
  it("ne montre que les quatre derniers caractères, et rien d'une clé courte", () => {
    expect(maskSecret("sk_live_0123456789abcd")).toBe("••••abcd");
    expect(maskSecret("court")).toBe("••••");
  });
});
