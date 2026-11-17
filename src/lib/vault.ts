import "server-only";
// Chiffrement des secrets confiés par les clients (identifiants de leurs comptes).
// AES-256-GCM, clé dérivée de APP_SECRET. Module serveur uniquement : rien n'est déchiffré côté navigateur.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const VERSION = "v1";
let cached: { secret: string; key: Buffer } | null = null;

function key(): Buffer {
  const secret = env.appSecret;
  if (cached?.secret !== secret) cached = { secret, key: Buffer.from(hkdfSync("sha256", secret, "regispub", "account-access.v1", 32)) };
  return cached.key;
}

/** Chiffre un texte. Le résultat (« v1.iv.sceau.données ») peut être stocké tel quel en base. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Déchiffre un texte produit par `seal`. Renvoie null s'il est illisible (clé changée, donnée altérée). */
export function unseal(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
