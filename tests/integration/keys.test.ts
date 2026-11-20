// Clés saisies dans l'administration : enregistrées chiffrées, prioritaires sur l'hébergeur, jamais renvoyées en clair (vraie base PostgreSQL).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getConfig, keysOverview, KeysError, resetConfigCache, saveKeys } from "@/lib/config";
import { db } from "@/lib/db";
import { getActiveProvider } from "@/lib/payments/registry";

const SECRET = "sk_sandbox_cleDeTest0123456789";
let adminId = "";
const save = (values: Record<string, string>, clear: string[] = []) => saveKeys({ values, clear }, adminId);
const errorsOf = async (run: Promise<unknown>) => run.then(() => null, (e) => (e instanceof KeysError ? e.fieldErrors : Promise.reject(e)));

beforeEach(async () => {
  adminId ||= (await db.user.findUniqueOrThrow({ where: { email: "admin@regispub.local" } })).id;
  await db.appKey.deleteMany();
  resetConfigCache();
});
afterAll(async () => {
  await db.appKey.deleteMany();
  resetConfigCache();
  await db.$disconnect();
});

describe("clés saisies dans l'administration", () => {
  it("part de la configuration de l'hébergeur tant que rien n'est saisi", async () => {
    expect((await getConfig()).paymentProvider).toBe("sandbox");
    expect((await getActiveProvider())?.id).toBe("sandbox");
    expect((await keysOverview()).find((k) => k.name === "PAYMENT_PROVIDER")).toMatchObject({ source: "host", value: "sandbox" });
  });

  it("enregistre une clé chiffrée, l'utilise aussitôt et ne la renvoie jamais en clair", async () => {
    expect(await save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_SECRET_KEY: `  ${SECRET}  `, FEDAPAY_WEBHOOK_SECRET: "" })).toEqual(["FEDAPAY_SECRET_KEY", "PAYMENT_PROVIDER"]);
    const rows = await db.appKey.findMany();
    expect(rows.map((r) => r.name).sort()).toEqual(["FEDAPAY_SECRET_KEY", "PAYMENT_PROVIDER"]);
    expect(JSON.stringify(rows)).not.toContain(SECRET);
    expect(rows.every((r) => r.updatedById === adminId)).toBe(true);

    const config = await getConfig();
    expect(config.paymentProvider).toBe("fedapay");
    expect(config.fedapaySecretKey).toBe(SECRET);
    expect((await getActiveProvider())?.id).toBe("fedapay");

    const view = await keysOverview();
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(view.find((k) => k.name === "FEDAPAY_SECRET_KEY")).toMatchObject({ source: "admin", masked: "••••6789" });
    expect(view.find((k) => k.name === "FEDAPAY_SECRET_KEY")).not.toHaveProperty("value", SECRET);
  });

  it("laisse une clé confidentielle en place quand son champ est renvoyé vide", async () => {
    await save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_SECRET_KEY: SECRET });
    expect(await save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_SECRET_KEY: "", FEDAPAY_WEBHOOK_SECRET: "" })).toEqual([]);
    expect((await getConfig()).fedapaySecretKey).toBe(SECRET);
  });

  it("refuse une configuration qui couperait les paiements, sans rien enregistrer", async () => {
    expect(await errorsOf(save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_SECRET_KEY: "" }))).toHaveProperty("FEDAPAY_SECRET_KEY");
    expect(await errorsOf(save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "live", FEDAPAY_SECRET_KEY: SECRET }))).toHaveProperty("FEDAPAY_ENV");
    expect(await db.appKey.count()).toBe(0);
    expect((await getConfig()).paymentProvider).toBe("sandbox");
  });

  it("enregistre la clé publique FedaPay, et refuse une clé secrète collée à sa place", async () => {
    const PUBLIC = "pk_sandbox_cleDeTest0123456789";
    // Le champ de la clé publique est affiché en clair : la clé secrète ne doit pas y être rangée.
    expect(await errorsOf(save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_PUBLIC_KEY: SECRET, FEDAPAY_SECRET_KEY: SECRET }))).toHaveProperty("FEDAPAY_PUBLIC_KEY");
    expect(await errorsOf(save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_PUBLIC_KEY: PUBLIC, FEDAPAY_SECRET_KEY: PUBLIC }))).toHaveProperty("FEDAPAY_SECRET_KEY");
    expect(await errorsOf(save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_PUBLIC_KEY: "pk_live_cleReelle0123456789", FEDAPAY_SECRET_KEY: SECRET }))).toHaveProperty("FEDAPAY_PUBLIC_KEY");
    expect(await db.appKey.count()).toBe(0);

    expect(await save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_ENV: "sandbox", FEDAPAY_PUBLIC_KEY: PUBLIC, FEDAPAY_SECRET_KEY: SECRET })).toEqual(["FEDAPAY_PUBLIC_KEY", "FEDAPAY_SECRET_KEY", "PAYMENT_PROVIDER"]);
    expect((await getConfig()).fedapayPublicKey).toBe(PUBLIC);
    expect((await keysOverview()).find((k) => k.name === "FEDAPAY_PUBLIC_KEY")).toMatchObject({ source: "admin", value: PUBLIC });
    // Elle reste facultative : la vider ne coupe pas les paiements.
    expect(await save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_PUBLIC_KEY: "" })).toEqual(["FEDAPAY_PUBLIC_KEY"]);
    expect((await getActiveProvider())?.id).toBe("fedapay");
  });

  it("refuse d'effacer la clé d'un service encore activé", async () => {
    await save({ PAYMENT_PROVIDER: "fedapay", FEDAPAY_SECRET_KEY: SECRET });
    expect(await errorsOf(save({ PAYMENT_PROVIDER: "fedapay" }, ["FEDAPAY_SECRET_KEY"]))).toHaveProperty("FEDAPAY_SECRET_KEY");
    expect((await getConfig()).fedapaySecretKey).toBe(SECRET);
    expect(await save({ PAYMENT_PROVIDER: "sandbox" }, ["FEDAPAY_SECRET_KEY"])).toEqual(["FEDAPAY_SECRET_KEY", "PAYMENT_PROVIDER"]);
    expect(await db.appKey.count()).toBe(0);
  });

  it("n'empêche pas d'enregistrer un service à cause d'un défaut d'un autre", async () => {
    // E-mails activés sans clé, déjà en base (par exemple après un changement chez l'hébergeur).
    const { seal } = await import("@/lib/vault");
    await db.appKey.create({ data: { name: "EMAIL_PROVIDER", value: seal("resend") } });
    resetConfigCache();
    expect(await save({ META_ACCESS_TOKEN: "EAAGjetonDeTest0123456789" })).toEqual(["META_ACCESS_TOKEN"]);
    expect(await errorsOf(save({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "RegisPub <contact@regispub.bj>", RESEND_API_KEY: "" }))).toHaveProperty("RESEND_API_KEY");
  });

  it("ne stocke pas une valeur identique à celle de l'hébergeur, et ignore les noms inconnus", async () => {
    expect(await save({ PAYMENT_PROVIDER: "sandbox", APP_SECRET: "x", DATABASE_URL: "postgresql://ailleurs", INCONNUE: "y" })).toEqual([]);
    expect(await db.appKey.count()).toBe(0);
  });

  it("retombe sur l'hébergeur quand une valeur enregistrée est devenue illisible", async () => {
    await db.appKey.create({ data: { name: "PAYMENT_PROVIDER", value: "v1.illisible" } });
    resetConfigCache();
    expect((await getConfig()).paymentProvider).toBe("sandbox");
    expect((await keysOverview()).find((k) => k.name === "PAYMENT_PROVIDER")).toMatchObject({ source: "unreadable" });
  });
});
