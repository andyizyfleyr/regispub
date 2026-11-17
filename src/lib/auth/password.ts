import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt (N=2^15, r=8, p=1) : sans dépendance native, adapté aux environnements serverless.
const N = 32768, R = 8, P = 1, KEYLEN = 32;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, len: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, len, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p), expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function passwordIssues(password: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (password.length > 128) return "Le mot de passe est trop long.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  return null;
}
