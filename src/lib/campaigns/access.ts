// Accès aux comptes des clients : lecture et effacement des identifiants. Module serveur.
import "server-only";
import { ACTIVE_STATUSES } from "@/lib/campaigns/status";
import type { AccessMethod } from "@/lib/catalog/access";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";

/** Lignes d'accès d'une entreprise, sans aucun secret (affichage client et équipe). */
export async function loadAccessRows(businessId: string | null) {
  if (!businessId) return [];
  const rows = await db.accountAccess.findMany({ where: { businessId }, select: { platform: true, method: true, status: true, campaignId: true, note: true, updatedAt: true, loginEnc: true } });
  // `hasSecret` dit seulement qu'un identifiant ou un code existe : le texte chiffré ne quitte pas ce module.
  return rows.map(({ loginEnc, ...r }) => ({ ...r, platform: r.platform as PlatformCode, method: (r.method === "LOGIN" ? "LOGIN" : "INVITE") as AccessMethod, hasSecret: Boolean(loginEnc) }));
}

/**
 * Efface les identifiants confiés (option « Je donne mes identifiants ») dès que l'entreprise n'a plus de campagne active.
 * Les ajouts à la page (option « Je vous ajoute ») restent : l'accès continue d'exister sur le réseau.
 */
export async function purgeIdleLogins(businessId?: string | null): Promise<number> {
  if (businessId === null) return 0;
  const res = await db.accountAccess.deleteMany({
    where: { method: "LOGIN", ...(businessId ? { businessId } : {}), business: { campaigns: { none: { status: { in: ACTIVE_STATUSES } } } } },
  });
  return res.count;
}
