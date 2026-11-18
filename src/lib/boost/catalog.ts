// Vente d'abonnés, de J'aime, de commentaires et de vues. Module pur (aucun accès serveur) :
// libellés, contrôle du lien, lecture des packs et calcul du prix. Tout le tarif passe par ici.
import type { PlatformCode } from "@/lib/catalog/platforms";
import { PLATFORMS } from "@/lib/catalog/platforms";
import { computePaymentFee, type Quote, type QuoteLine } from "@/lib/pricing/quote";
import type { PlatformSettings } from "@/lib/settings-schema";
import { formatFcfa, formatNumber } from "@/lib/utils";

export type BoostKindCode = "FOLLOWERS" | "LIKES" | "COMMENTS" | "VIEWS";
export type BoostStatusName = "AWAITING_PAYMENT" | "TO_DELIVER" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED";

export const BOOST_KIND_CODES: BoostKindCode[] = ["FOLLOWERS", "LIKES", "COMMENTS", "VIEWS"];

type KindMeta = {
  label: string; one: string; many: string;
  /** Ce que le client doit coller : son compte, ou une publication. */
  target: "account" | "post";
};

export const BOOST_KINDS: Record<BoostKindCode, KindMeta> = {
  FOLLOWERS: { label: "Abonnés", one: "abonné", many: "abonnés", target: "account" },
  LIKES: { label: "J'aime", one: "J'aime", many: "J'aime", target: "post" },
  COMMENTS: { label: "Commentaires", one: "commentaire", many: "commentaires", target: "post" },
  VIEWS: { label: "Vues", one: "vue", many: "vues", target: "post" },
};

/** Montant minimal d'une commande : en dessous, un paiement Mobile Money n'a pas de sens. */
export const BOOST_MIN_PRICE = 100;
export const BOOST_MAX_PACKS = 8;
export const BOOST_MAX_QUANTITY = 10_000_000;
export const BOOST_COMMENT_MAX_LENGTH = 200;
/** Au-delà, on ne demande plus au client d'écrire chaque commentaire : ses textes sont répétés. */
export const BOOST_COMMENT_MAX_LINES = 500;

export type BoostPack = { quantity: number; price: number };

export type BoostProductData = {
  id: string; platform: PlatformCode; kind: BoostKindCode; pricePer1000: number; minQuantity: number; maxQuantity: number;
  packs: BoostPack[]; delay: string; active: boolean;
};

export class BoostError extends Error {}

export function isBoostKind(v: unknown): v is BoostKindCode {
  return typeof v === "string" && (BOOST_KIND_CODES as string[]).includes(v);
}

/** « 1 000 abonnés Instagram » */
export function boostLabel(platform: PlatformCode, kind: BoostKindCode, quantity: number) {
  const k = BOOST_KINDS[kind];
  return `${formatNumber(quantity)} ${quantity > 1 ? k.many : k.one} ${PLATFORMS[platform].label}`;
}

/** Lit les packs enregistrés (JSON) : entiers positifs, sans doublon de quantité, triés. */
export function parsePacks(raw: unknown): BoostPack[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const packs: BoostPack[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const quantity = Number((item as Record<string, unknown>).quantity);
    const price = Number((item as Record<string, unknown>).price);
    if (!Number.isInteger(quantity) || !Number.isInteger(price) || quantity <= 0 || price <= 0 || seen.has(quantity)) continue;
    seen.add(quantity);
    packs.push({ quantity, price });
  }
  return packs.sort((a, b) => a.quantity - b.quantity).slice(0, BOOST_MAX_PACKS);
}

/** Prix d'une quantité libre : au tarif pour 1 000, arrondi aux 5 F supérieurs. */
export function freePrice(quantity: number, pricePer1000: number) {
  return Math.ceil((quantity * pricePer1000) / 1000 / 5) * 5;
}

/**
 * Prix d'une quantité. Si elle correspond à un pack, c'est le prix du pack ; sinon le tarif pour 1 000.
 * Lève BoostError si la quantité n'est pas vendable.
 */
export function boostPrice(product: Pick<BoostProductData, "pricePer1000" | "minQuantity" | "maxQuantity" | "packs" | "active" | "kind">, quantity: number): { price: number; pack: boolean } {
  if (!product.active) throw new BoostError("Ce produit n'est plus proposé pour le moment.");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new BoostError("Indiquez une quantité.");
  const pack = product.packs.find((p) => p.quantity === quantity);
  if (pack) return { price: pack.price, pack: true };
  const many = BOOST_KINDS[product.kind].many;
  if (quantity < product.minQuantity) throw new BoostError(`La quantité minimale est de ${formatNumber(product.minQuantity)} ${many}.`);
  if (quantity > product.maxQuantity) throw new BoostError(`La quantité maximale en ligne est de ${formatNumber(product.maxQuantity)} ${many}. Contactez-nous pour davantage.`);
  const price = freePrice(quantity, product.pricePer1000);
  if (price < BOOST_MIN_PRICE) throw new BoostError(`Le montant minimal d'une commande est de ${formatFcfa(BOOST_MIN_PRICE)}. Augmentez la quantité.`);
  return { price, pack: false };
}

/** Tarif des quantités libres, dit simplement : « 50 F l'unité » pour les petites quantités, sinon « 4 000 F les 1 000 ». */
export function unitPriceLabel(product: Pick<BoostProductData, "pricePer1000" | "maxQuantity">) {
  return product.maxQuantity <= 1000 && product.pricePer1000 % 1000 === 0 ? `${formatFcfa(product.pricePer1000 / 1000)} l'unité` : `${formatFcfa(product.pricePer1000)} les 1 000`;
}

/** Prix d'appel d'un produit (« dès … »). */
export function boostFromPrice(product: Pick<BoostProductData, "pricePer1000" | "minQuantity" | "packs">) {
  const prices = [...product.packs.map((p) => p.price), Math.max(BOOST_MIN_PRICE, freePrice(product.minQuantity, product.pricePer1000))];
  return Math.min(...prices);
}

/** Devis d'une commande : mêmes lignes que les autres commandes, pour le paiement et le reçu. */
export function computeBoostQuote(product: BoostProductData, quantity: number, settings: Pick<PlatformSettings, "paymentFeePercent" | "paymentFeePayer">): Quote {
  const { price } = boostPrice(product, quantity);
  const label = boostLabel(product.platform, product.kind, quantity);
  const paymentFee = computePaymentFee(price, settings);
  const lines: QuoteLine[] = [{ kind: "SERVICE_FEE", label, amount: price }];
  if (paymentFee > 0) lines.push({ kind: "PAYMENT_FEE", label: `Frais de paiement Mobile Money (${String(settings.paymentFeePercent).replace(".", ",")} %)`, amount: paymentFee });
  return {
    serviceCode: boostServiceCode(product.platform, product.kind), serviceLabel: label, adBudget: 0, serviceFee: price, discount: 0, netServiceFee: price,
    paymentFee, total: price + paymentFee, lines, notes: [], promoCodeId: null,
  };
}

export function boostServiceCode(platform: PlatformCode, kind: BoostKindCode) {
  return `boost_${platform.toLowerCase()}_${kind.toLowerCase()}`;
}

// ─────────────────────────── Lien du compte ou de la publication ───────────────────────────

const HOSTS: Record<PlatformCode, RegExp> = {
  FACEBOOK: /(^|\.)(facebook\.com|fb\.com|fb\.watch|fb\.me)$/,
  INSTAGRAM: /(^|\.)(instagram\.com|instagr\.am)$/,
  TIKTOK: /(^|\.)tiktok\.com$/,
};

const HANDLE = /^@?([a-zA-Z0-9._]{2,30})$/;

export function targetHint(platform: PlatformCode, kind: BoostKindCode) {
  const name = PLATFORMS[platform].label;
  if (BOOST_KINDS[kind].target === "account") {
    return platform === "FACEBOOK" ? { label: "Lien de votre page Facebook", placeholder: "https://www.facebook.com/votrepage" } : { label: `Lien ou nom de votre compte ${name}`, placeholder: "@votrecompte" };
  }
  const what = platform === "TIKTOK" ? "de la vidéo" : "de la publication";
  return { label: `Lien ${what} ${name}`, placeholder: platform === "TIKTOK" ? "https://www.tiktok.com/@compte/video/…" : platform === "INSTAGRAM" ? "https://www.instagram.com/p/…" : "https://www.facebook.com/…" };
}

/**
 * Contrôle et remet en forme ce que le client a collé. Pour des abonnés Instagram ou TikTok,
 * un simple nom de compte (« @maboutique ») suffit. Renvoie le lien, ou un message d'erreur.
 */
export function normalizeTarget(platform: PlatformCode, kind: BoostKindCode, input: string): { ok: true; link: string } | { ok: false; error: string } {
  const raw = input.trim();
  const name = PLATFORMS[platform].label;
  if (!raw) return { ok: false, error: BOOST_KINDS[kind].target === "account" ? `Indiquez votre compte ${name}.` : `Collez le lien de la publication ${name}.` };
  if (raw.length > 400) return { ok: false, error: "Ce lien est trop long." };
  if (BOOST_KINDS[kind].target === "account" && platform !== "FACEBOOK") {
    const handle = HANDLE.exec(raw);
    if (handle) return { ok: true, link: platform === "TIKTOK" ? `https://www.tiktok.com/@${handle[1]}` : `https://www.instagram.com/${handle[1]}/` };
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: `Ce lien n'est pas valide. Copiez-le depuis ${name} (bouton « Partager », puis « Copier le lien »).` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Ce lien n'est pas valide." };
  if (url.username || url.password) return { ok: false, error: "Ce lien n'est pas valide." };
  const host = url.hostname.toLowerCase();
  if (!HOSTS[platform].test(host)) return { ok: false, error: `Ce lien ne vient pas de ${name}. Vérifiez le réseau choisi.` };
  if (url.pathname.replace(/\/+$/, "") === "") return { ok: false, error: BOOST_KINDS[kind].target === "account" ? `Ce lien ne mène pas à un compte. Collez le lien de votre compte ${name}.` : "Ce lien ne mène pas à une publication. Collez le lien de la publication elle-même." };
  url.protocol = "https:";
  url.hash = "";
  return { ok: true, link: url.toString() };
}

/** Commentaires écrits par le client : une ligne par commentaire, lignes vides ignorées. */
export function parseComments(raw: string): string[] {
  return raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function validateComments(lines: string[], quantity: number): string | null {
  if (!lines.length) return "Écrivez au moins un commentaire, un par ligne.";
  if (lines.length > Math.min(quantity, BOOST_COMMENT_MAX_LINES)) return `Vous avez écrit ${lines.length} commentaires pour ${formatNumber(quantity)} commandés. Retirez-en ou augmentez la quantité.`;
  const long = lines.findIndex((l) => l.length > BOOST_COMMENT_MAX_LENGTH);
  if (long >= 0) return `Le commentaire n° ${long + 1} est trop long (${BOOST_COMMENT_MAX_LENGTH} caractères au maximum).`;
  return null;
}

// ─────────────────────────── États de livraison ───────────────────────────

export const BOOST_STATUS: Record<BoostStatusName, { label: string; clientHint: string }> = {
  AWAITING_PAYMENT: { label: "À régler", clientHint: "Réglez la commande pour la lancer." },
  TO_DELIVER: { label: "Payée, à livrer", clientHint: "Paiement reçu. Notre équipe lance votre commande." },
  IN_PROGRESS: { label: "Livraison en cours", clientHint: "Votre commande est en cours de livraison." },
  DELIVERED: { label: "Livrée", clientHint: "Commande livrée." },
  CANCELLED: { label: "Annulée", clientHint: "Commande annulée." },
};

/** Étapes que l'équipe peut franchir à la main. Une commande non payée ne se livre pas. */
export const BOOST_TRANSITIONS: Record<BoostStatusName, BoostStatusName[]> = {
  AWAITING_PAYMENT: [],
  TO_DELIVER: ["IN_PROGRESS", "DELIVERED", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canMoveBoost(from: BoostStatusName, to: BoostStatusName) {
  return BOOST_TRANSITIONS[from].includes(to);
}

// ─────────────────────────── Tarifs d'exemple (modifiables dans Gestion) ───────────────────────────

type Defaults = { pricePer1000: number; minQuantity: number; maxQuantity: number; packs: BoostPack[]; delay: string };

const followers = (per1000: number): Defaults => ({
  pricePer1000: per1000, minQuantity: 100, maxQuantity: 50_000, delay: "24 à 72 heures",
  packs: [{ quantity: 100, price: per1000 / 10 }, { quantity: 500, price: Math.round((per1000 * 0.48) / 50) * 50 }, { quantity: 1000, price: Math.round((per1000 * 0.9) / 100) * 100 }, { quantity: 5000, price: Math.round((per1000 * 4.25) / 500) * 500 }],
});
const likes = (per1000: number): Defaults => ({
  pricePer1000: per1000, minQuantity: 50, maxQuantity: 50_000, delay: "24 à 48 heures",
  packs: [{ quantity: 100, price: per1000 / 10 }, { quantity: 500, price: Math.round((per1000 * 0.48) / 50) * 50 }, { quantity: 1000, price: Math.round((per1000 * 0.9) / 100) * 100 }, { quantity: 5000, price: Math.round((per1000 * 4.25) / 500) * 500 }],
});
const views = (per1000: number): Defaults => ({
  pricePer1000: per1000, minQuantity: 500, maxQuantity: 1_000_000, delay: "24 heures",
  packs: [{ quantity: 1000, price: per1000 }, { quantity: 5000, price: Math.round((per1000 * 4.5) / 50) * 50 }, { quantity: 10_000, price: Math.round((per1000 * 8.5) / 100) * 100 }, { quantity: 50_000, price: Math.round((per1000 * 40) / 500) * 500 }],
});
const comments = (each: number): Defaults => ({
  pricePer1000: each * 1000, minQuantity: 5, maxQuantity: 500, delay: "24 à 72 heures",
  packs: [{ quantity: 10, price: each * 10 }, { quantity: 20, price: Math.round((each * 19) / 50) * 50 }, { quantity: 50, price: Math.round((each * 45) / 50) * 50 }, { quantity: 100, price: Math.round((each * 85) / 100) * 100 }],
});

/** Tarifs d'exemple créés à l'installation. Ce ne sont pas des prix de marché : à ajuster dans Gestion. */
export const BOOST_DEFAULTS: Record<PlatformCode, Record<BoostKindCode, Defaults>> = {
  FACEBOOK: { FOLLOWERS: followers(6000), LIKES: likes(3000), COMMENTS: comments(60), VIEWS: views(1000) },
  INSTAGRAM: { FOLLOWERS: followers(4000), LIKES: likes(2000), COMMENTS: comments(50), VIEWS: views(500) },
  TIKTOK: { FOLLOWERS: followers(5000), LIKES: likes(2000), COMMENTS: comments(50), VIEWS: views(500) },
};
