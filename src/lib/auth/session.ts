import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { can, isStaff, type Permission, type RoleName } from "./permissions";

const COOKIE = "rp_session";
const TTL_DAYS = 30;

export type SessionUser = {
  id: string; email: string; name: string; phone: string | null; role: RoleName;
  referralCode: string; loyaltyPoints: number; accountType: string;
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000);
  const h = await headers();
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 250) ?? null, ip: await clientIp() },
  });
  const sameSite = env.cookieSameSite;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, path: "/", expires: expiresAt, sameSite,
    secure: env.isProd || sameSite === "none",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

/** Utilisateur de la requête courante (mémoïsé par requête). Seul le hachage du jeton est stocké en base. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, phone: true, role: true, status: true, referralCode: true, loyaltyPoints: true, accountType: true } },
    },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const { status: _status, ...user } = session.user;
  return user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role) || !can(user.role, "backoffice.access")) redirect("/app");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireStaff();
  if (!can(user.role, permission)) redirect("/gestion?refus=1");
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "Vous n'avez pas les droits nécessaires pour cette action.") { super(message); }
}

/** Variante pour les Server Actions : lève une erreur au lieu de rediriger. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("Votre session a expiré. Reconnectez-vous.");
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("Votre session a expiré. Reconnectez-vous.");
  return user;
}
