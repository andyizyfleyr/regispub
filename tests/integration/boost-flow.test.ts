// Commande d'abonnés, de J'aime, de commentaires ou de vues, de bout en bout sur une vraie base (prestataire : simulateur).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { changeBoostStatus, createBoostOrder, loadBoostProducts } from "@/lib/boost/service";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { applyVerification, startPayment } from "@/lib/payments/service";

let userId = "", admin = {} as SessionUser;
const ids: Record<string, string> = {};

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: "client@regispub.local" } })).id;
  const a = await db.user.findUniqueOrThrow({ where: { email: "admin@regispub.local" } });
  admin = { id: a.id, role: a.role, name: a.name, email: a.email } as SessionUser;
  for (const p of await loadBoostProducts()) ids[`${p.platform}.${p.kind}`] = p.id;
  // Tarifs connus pour ces tests, quels que soient les tarifs d'exemple.
  await db.boostProduct.update({ where: { id: ids["INSTAGRAM.FOLLOWERS"]! }, data: { pricePer1000: 4000, minQuantity: 100, maxQuantity: 50_000, packs: [{ quantity: 1000, price: 3600 }], active: true } });
  await db.boostProduct.update({ where: { id: ids["TIKTOK.COMMENTS"]! }, data: { pricePer1000: 50_000, minQuantity: 5, maxQuantity: 500, packs: [{ quantity: 10, price: 500 }], active: true } });
});
afterAll(async () => { await db.$disconnect(); });

async function pay(orderId: string) {
  const started = await startPayment({ orderId, userId, operator: "MTN", phoneInput: "0197000001", idempotencyKey: randomUUID() });
  if (!started.ok) throw new Error(started.error);
  const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
  const ok = { providerRef: payment.providerRef!, status: "SUCCEEDED" as const, amount: payment.amount, providerStatus: "approved", merchantReference: payment.id };
  await applyVerification(payment.id, ok);
  await applyVerification(payment.id, ok); // une confirmation rejouée ne change rien
  return payment;
}

async function order(input: { product: string; quantity: number; link: string; comments?: string }) {
  const res = await createBoostOrder(userId, { productId: ids[input.product]!, quantity: input.quantity, link: input.link, comments: input.comments });
  if (!res.ok) throw new Error(res.error);
  return res.orderId;
}

describe("commande d'abonnés, de J'aime, de commentaires et de vues", () => {
  it("installe les quatre produits sur les trois réseaux", async () => {
    expect(Object.keys(ids)).toHaveLength(12);
  });

  it("crée la commande au prix du serveur : pack, puis quantité libre", async () => {
    const packId = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 1000, link: "@maboutique" });
    const pack = await db.order.findUniqueOrThrow({ where: { id: packId }, include: { boost: true } });
    expect(pack).toMatchObject({ status: "PENDING", serviceCode: "boost_instagram_followers", adBudget: 0, serviceFee: 3600, discount: 0, paymentFee: 65, total: 3665, campaignId: null, subscriptionId: null });
    expect(pack.boost).toMatchObject({ status: "AWAITING_PAYMENT", platform: "INSTAGRAM", kind: "FOLLOWERS", quantity: 1000, link: "https://www.instagram.com/maboutique/", comments: [] });

    const freeId = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 250, link: "https://instagram.com/maboutique" });
    expect(await db.order.findUniqueOrThrow({ where: { id: freeId } })).toMatchObject({ serviceFee: 1000, paymentFee: 18, total: 1018 });
  });

  it("refuse une quantité hors bornes, un mauvais lien, un produit masqué ou inconnu, sans rien créer", async () => {
    const before = await db.order.count({ where: { userId } });
    const product = ids["INSTAGRAM.FOLLOWERS"]!;
    expect(await createBoostOrder(userId, { productId: product, quantity: 50, link: "@maboutique" })).toMatchObject({ ok: false, field: "quantity" });
    expect(await createBoostOrder(userId, { productId: product, quantity: 100_000, link: "@maboutique" })).toMatchObject({ ok: false, field: "quantity" });
    expect(await createBoostOrder(userId, { productId: product, quantity: 1000, link: "https://www.tiktok.com/@autre" })).toMatchObject({ ok: false, field: "link" });
    expect(await createBoostOrder(userId, { productId: "inconnu", quantity: 1000, link: "@maboutique" })).toMatchObject({ ok: false });
    await db.boostProduct.update({ where: { id: product }, data: { active: false } });
    expect(await createBoostOrder(userId, { productId: product, quantity: 1000, link: "@maboutique" })).toMatchObject({ ok: false });
    await db.boostProduct.update({ where: { id: product }, data: { active: true } });
    expect(await db.order.count({ where: { userId } })).toBe(before);
  });

  it("garde les commentaires écrits par le client et en exige au moins un", async () => {
    const link = "https://www.tiktok.com/@maboutique/video/7300000000000000000";
    expect(await createBoostOrder(userId, { productId: ids["TIKTOK.COMMENTS"]!, quantity: 10, link, comments: "  \n " })).toMatchObject({ ok: false, field: "comments" });
    expect(await createBoostOrder(userId, { productId: ids["TIKTOK.COMMENTS"]!, quantity: 5, link, comments: "a\nb\nc\nd\ne\nf" })).toMatchObject({ ok: false, field: "comments" });
    const id = await order({ product: "TIKTOK.COMMENTS", quantity: 10, link, comments: "Très beau !\n\n  Où commander ?  \nBravo" });
    const created = await db.order.findUniqueOrThrow({ where: { id }, include: { boost: true } });
    expect(created.serviceFee).toBe(500);
    expect(created.boost!.comments).toEqual(["Très beau !", "Où commander ?", "Bravo"]);
  });

  it("ne se livre pas tant qu'elle n'est pas payée", async () => {
    const id = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 1000, link: "@maboutique" });
    const boost = await db.boostOrder.findUniqueOrThrow({ where: { orderId: id } });
    await expect(changeBoostStatus({ boostId: boost.id, to: "DELIVERED", actor: admin })).rejects.toBeInstanceOf(DomainError);
    expect((await db.boostOrder.findUniqueOrThrow({ where: { id: boost.id } })).status).toBe("AWAITING_PAYMENT");
  });

  it("passe « à livrer » au paiement, prévient l'équipe, puis « livrée » prévient le client", async () => {
    const id = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 1000, link: "@maboutique" });
    const staffBefore = await db.notification.count({ where: { userId: admin.id, type: "boost.paid" } });
    const rewardsBefore = await db.referralReward.count();
    await pay(id);
    const paid = await db.order.findUniqueOrThrow({ where: { id }, include: { boost: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.invoiceNumber).toBeTruthy();
    expect(paid.boost!.status).toBe("TO_DELIVER");
    expect(await db.notification.count({ where: { userId: admin.id, type: "boost.paid" } })).toBe(staffBefore + 1);
    expect(await db.referralReward.count()).toBe(rewardsBefore);

    await changeBoostStatus({ boostId: paid.boost!.id, to: "IN_PROGRESS", actor: admin, note: "Fournisseur n° 4521" });
    const delivered = await changeBoostStatus({ boostId: paid.boost!.id, to: "DELIVERED", actor: admin });
    const done = await db.boostOrder.findUniqueOrThrow({ where: { id: delivered.id } });
    expect(done).toMatchObject({ status: "DELIVERED", staffNote: "Fournisseur n° 4521", handledById: admin.id });
    expect(done.startedAt).toBeTruthy();
    expect(done.deliveredAt).toBeTruthy();
    expect(await db.notification.count({ where: { userId, type: "boost.delivered", link: `/app/paiements/${id}` } })).toBe(1);
    // Une commande livrée ne revient pas en arrière.
    await expect(changeBoostStatus({ boostId: done.id, to: "CANCELLED", actor: admin, reason: "Erreur" })).rejects.toBeInstanceOf(DomainError);
  });

  it("une annulation après paiement exige un motif et ouvre le remboursement du montant payé", async () => {
    const id = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 250, link: "@maboutique" });
    const payment = await pay(id);
    const boost = await db.boostOrder.findUniqueOrThrow({ where: { orderId: id } });
    await expect(changeBoostStatus({ boostId: boost.id, to: "CANCELLED", actor: admin, reason: "  " })).rejects.toBeInstanceOf(DomainError);
    await changeBoostStatus({ boostId: boost.id, to: "CANCELLED", actor: admin, reason: "Compte privé." });
    expect(await db.boostOrder.findUniqueOrThrow({ where: { id: boost.id } })).toMatchObject({ status: "CANCELLED", cancelReason: "Compte privé." });
    const refunds = await db.refund.findMany({ where: { orderId: id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ paymentId: payment.id, amount: 1018, status: "REQUESTED" });
    expect(await db.notification.count({ where: { userId, type: "boost.cancelled", link: `/app/paiements/${id}` } })).toBe(1);
  });

  it("un changement de tarif ne modifie pas une commande déjà passée", async () => {
    const id = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 1000, link: "@maboutique" });
    await db.boostProduct.update({ where: { id: ids["INSTAGRAM.FOLLOWERS"]! }, data: { packs: [{ quantity: 1000, price: 9000 }] } });
    expect((await db.order.findUniqueOrThrow({ where: { id } })).total).toBe(3665);
    const next = await order({ product: "INSTAGRAM.FOLLOWERS", quantity: 1000, link: "@maboutique" });
    expect((await db.order.findUniqueOrThrow({ where: { id: next } })).serviceFee).toBe(9000);
  });
});
