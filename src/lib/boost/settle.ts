// Encaissement d'une commande d'abonnés, de J'aime, de commentaires ou de vues.
// Fichier séparé du reste du service pour que le module de paiement puisse l'importer sans boucle.
import "server-only";
import type { PlatformCode } from "@/lib/catalog/platforms";
import type { Tx } from "@/lib/db";
import { notifyStaff } from "@/lib/notifications/service";
import { boostLabel, type BoostKindCode } from "./catalog";

/** Appelée dans la transaction d'encaissement : la commande payée passe dans la file « À livrer ». */
export async function markBoostPaid(tx: Tx, orderId: string) {
  const boost = await tx.boostOrder.findUnique({ where: { orderId } });
  if (!boost) return null;
  if (boost.status === "AWAITING_PAYMENT") await tx.boostOrder.update({ where: { id: boost.id }, data: { status: "TO_DELIVER" } });
  return boost;
}

/** Après l'encaissement : prévient l'équipe qu'une commande est à passer chez le fournisseur. */
export async function announceBoostPaid(boost: { platform: string; kind: string; quantity: number }, reference: string) {
  await notifyStaff("boost.manage", {
    type: "boost.paid", title: "Commande à livrer", body: `${boostLabel(boost.platform as PlatformCode, boost.kind as BoostKindCode, boost.quantity)} — commande ${reference}.`,
    link: "/gestion/boosts?statut=TO_DELIVER", email: true,
  });
}
