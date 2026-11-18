"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertPermission, assertUser, clientIp } from "@/lib/auth/session";
import {
  BOOST_KINDS, BOOST_MAX_PACKS, BOOST_MAX_QUANTITY, BOOST_MIN_PRICE, freePrice, isBoostKind, type BoostPack, type BoostStatusName,
} from "@/lib/boost/catalog";
import { changeBoostStatus, createBoostOrder } from "@/lib/boost/service";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { formatFcfa, formatNumber } from "@/lib/utils";
import { formAction, safeAction, UserError } from "@/server/action";

/** Commande passée par le client : renvoie la commande à régler. Le prix est recalculé côté serveur. */
export async function createBoostOrderAction(input: { productId: string; quantity: number; link: string; comments?: string }): Promise<{ ok: true; orderId: string } | { ok: false; error: string; field?: string }> {
  const res = await safeAction(async () => {
    const user = await assertUser();
    if (!(await rateLimit(`boost:${user.id}`, 20, 600))) throw new UserError("Trop de commandes en peu de temps. Réessayez dans quelques minutes.");
    const created = await createBoostOrder(user.id, {
      productId: String(input.productId ?? ""), quantity: Math.floor(Number(input.quantity)), link: String(input.link ?? ""), comments: String(input.comments ?? "").slice(0, 120_000),
    });
    if (created.ok) await audit({ actorId: user.id, action: "order.created", entity: "Order", entityId: created.orderId, meta: { boost: true }, ip: await clientIp() });
    return { created };
  });
  if (!res.ok) return res;
  const { created } = res.data;
  return created.ok ? { ok: true, orderId: created.orderId } : { ok: false, error: created.error, field: created.field };
}

const MOVES: BoostStatusName[] = ["IN_PROGRESS", "DELIVERED", "CANCELLED"];

/** Avancement d'une livraison par l'équipe : « en cours », « livrée » ou « annulée ». */
export async function updateBoostAction(boostId: string, to: string, note: string, reason: string) {
  return safeAction(async () => {
    const actor = await assertPermission("boost.manage");
    if (!MOVES.includes(to as BoostStatusName)) throw new UserError("Action inconnue.");
    await changeBoostStatus({ boostId: String(boostId ?? ""), to: to as BoostStatusName, actor, note: String(note ?? ""), reason: String(reason ?? "") });
  });
}

/** Note interne (référence chez le fournisseur…), sans changer l'état. */
export async function saveBoostNoteAction(boostId: string, note: string) {
  return safeAction(async () => {
    const actor = await assertPermission("boost.manage");
    const res = await db.boostOrder.updateMany({ where: { id: String(boostId ?? "") }, data: { staffNote: String(note ?? "").trim().slice(0, 500) || null } });
    if (!res.count) throw new UserError("Commande introuvable.");
    await audit({ actorId: actor.id, action: "boost.note", entity: "BoostOrder", entityId: boostId });
  });
}

const int = (label: string, min: number, max: number) => z.coerce.number({ error: `${label} : nombre attendu.` }).int(`${label} : nombre entier attendu.`).min(min, `${label} : minimum ${formatNumber(min)}.`).max(max, `${label} : maximum ${formatNumber(max)}.`);

/** Tarifs d'un produit : prix pour 1 000, quantités minimale et maximale, packs à prix fixe. */
export const saveBoostProductAction = formAction(
  z.object({
    id: z.string().min(1), pricePer1000: int("Prix pour 1 000", 1, 50_000_000), minQuantity: int("Quantité minimale", 1, BOOST_MAX_QUANTITY),
    maxQuantity: int("Quantité maximale", 1, BOOST_MAX_QUANTITY), delay: z.string().trim().max(60).optional(), active: z.string().optional(),
  }),
  async (input, formData) => {
    const actor = await assertPermission("pricing.manage");
    const before = await db.boostProduct.findUnique({ where: { id: input.id } });
    if (!before || !isBoostKind(before.kind)) throw new UserError("Produit introuvable.");
    const many = BOOST_KINDS[before.kind].many;
    if (input.maxQuantity < input.minQuantity) return { ok: false, error: "La quantité maximale doit être supérieure à la quantité minimale.", fieldErrors: { maxQuantity: "Inférieure au minimum" } };
    if (freePrice(input.minQuantity, input.pricePer1000) < BOOST_MIN_PRICE) {
      return { ok: false, error: `Avec ce tarif, la plus petite commande coûterait moins de ${formatFcfa(BOOST_MIN_PRICE)}. Augmentez la quantité minimale ou le prix.`, fieldErrors: { minQuantity: `Commande minimale : ${formatFcfa(BOOST_MIN_PRICE)}` } };
    }

    // Packs : les champs arrivent par paires (quantité, prix) ; une ligne entièrement vide est ignorée.
    const quantities = formData.getAll("packQuantity").map((v) => String(v).trim());
    const prices = formData.getAll("packPrice").map((v) => String(v).trim());
    const packs: BoostPack[] = [];
    for (let i = 0; i < Math.max(quantities.length, prices.length); i++) {
      const q = quantities[i] ?? "", p = prices[i] ?? "";
      if (!q && !p) continue;
      const quantity = Number(q), price = Number(p);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > BOOST_MAX_QUANTITY) return { ok: false, error: `Pack n° ${i + 1} : indiquez une quantité entière.` };
      if (!Number.isInteger(price) || price < BOOST_MIN_PRICE || price > 100_000_000) return { ok: false, error: `Pack de ${formatNumber(quantity)} ${many} : le prix doit être d'au moins ${formatFcfa(BOOST_MIN_PRICE)}.` };
      if (packs.some((x) => x.quantity === quantity)) return { ok: false, error: `Il y a deux packs de ${formatNumber(quantity)} ${many}.` };
      packs.push({ quantity, price });
    }
    if (packs.length > BOOST_MAX_PACKS) return { ok: false, error: `${BOOST_MAX_PACKS} packs au maximum.` };
    packs.sort((a, b) => a.quantity - b.quantity);

    await db.boostProduct.update({
      where: { id: input.id },
      data: { pricePer1000: input.pricePer1000, minQuantity: input.minQuantity, maxQuantity: input.maxQuantity, packs, delay: input.delay ?? "", active: input.active === "on" },
    });
    await audit({ actorId: actor.id, action: "boost_product.updated", entity: "BoostProduct", entityId: input.id, meta: { before: { pricePer1000: before.pricePer1000, packs: before.packs, active: before.active }, after: { pricePer1000: input.pricePer1000, packs, active: input.active === "on" } } });
    return { ok: true, message: "Tarifs enregistrés. Les commandes déjà passées gardent leur prix." };
  },
);
