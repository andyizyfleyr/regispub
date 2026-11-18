// Vente d'abonnés, de J'aime, de commentaires et de vues : prix, lien, commentaires, étapes de livraison.
import { describe, expect, it } from "vitest";
import {
  BOOST_DEFAULTS, BOOST_KIND_CODES, BOOST_MIN_PRICE, BoostError, boostFromPrice, boostLabel, boostPrice, canMoveBoost, computeBoostQuote, freePrice, normalizeTarget, parseComments,
  parsePacks, validateComments, type BoostProductData,
} from "@/lib/boost/catalog";
import { can } from "@/lib/auth/permissions";
import { PLATFORM_CODES } from "@/lib/catalog/platforms";

const product = (over: Partial<BoostProductData> = {}): BoostProductData => ({
  id: "p1", platform: "INSTAGRAM", kind: "FOLLOWERS", pricePer1000: 4000, minQuantity: 100, maxQuantity: 50_000,
  packs: [{ quantity: 100, price: 400 }, { quantity: 1000, price: 3600 }], delay: "24 à 72 heures", active: true, ...over,
});
const fees = { paymentFeePercent: 1.8, paymentFeePayer: "CLIENT" as const };

describe("prix d'une commande", () => {
  it("applique le prix du pack quand la quantité correspond à un pack", () => {
    expect(boostPrice(product(), 1000)).toEqual({ price: 3600, pack: true });
  });

  it("applique le tarif pour 1 000 aux autres quantités, arrondi aux 5 F supérieurs", () => {
    expect(boostPrice(product(), 250)).toEqual({ price: 1000, pack: false });
    expect(freePrice(333, 4000)).toBe(1335); // 1 332 F → 1 335 F
    expect(freePrice(101, 500)).toBe(55);
  });

  it("refuse une quantité hors des bornes, nulle ou non entière", () => {
    expect(() => boostPrice(product(), 99)).toThrow(/minimale est de 100/);
    expect(() => boostPrice(product(), 50_001)).toThrow(/maximale/);
    expect(() => boostPrice(product(), 0)).toThrow(BoostError);
    expect(() => boostPrice(product(), 150.5)).toThrow(BoostError);
    expect(() => boostPrice(product(), Number.NaN)).toThrow(BoostError);
  });

  it("un pack reste vendable même en dehors des bornes des quantités libres", () => {
    expect(boostPrice(product({ minQuantity: 500, packs: [{ quantity: 100, price: 400 }] }), 100).price).toBe(400);
  });

  it("refuse un produit masqué et une commande sous le montant minimal", () => {
    expect(() => boostPrice(product({ active: false }), 1000)).toThrow(/plus proposé/);
    expect(() => boostPrice(product({ pricePer1000: 100, minQuantity: 10, packs: [] }), 10)).toThrow(/montant minimal/);
  });

  it("construit un devis sans budget publicitaire, avec les frais Mobile Money", () => {
    const q = computeBoostQuote(product(), 1000, fees);
    expect(q).toMatchObject({ serviceCode: "boost_instagram_followers", adBudget: 0, serviceFee: 3600, discount: 0, paymentFee: 65, total: 3665, promoCodeId: null });
    expect(q.serviceLabel).toMatch(/^1.000 abonnés Instagram$/);
    expect(q.lines.map((l) => l.kind)).toEqual(["SERVICE_FEE", "PAYMENT_FEE"]);
    expect(computeBoostQuote(product(), 1000, { paymentFeePercent: 1.8, paymentFeePayer: "PLATFORM" }).total).toBe(3600);
  });

  it("écrit le libellé au singulier et au pluriel", () => {
    expect(boostLabel("TIKTOK", "VIEWS", 1)).toBe("1 vue TikTok");
    expect(boostLabel("FACEBOOK", "COMMENTS", 20)).toBe("20 commentaires Facebook");
  });

  it("annonce le prix d'appel le plus bas", () => {
    expect(boostFromPrice(product())).toBe(400);
    expect(boostFromPrice(product({ packs: [] }))).toBe(400);
  });
});

describe("packs enregistrés", () => {
  it("ignore les lignes invalides et les doublons, puis trie par quantité", () => {
    expect(parsePacks([{ quantity: 1000, price: 3600 }, { quantity: 100, price: 400 }, { quantity: 100, price: 1 }, { quantity: -5, price: 10 }, { quantity: 10, price: 0 }, "x", null, { quantity: 1.5, price: 10 }]))
      .toEqual([{ quantity: 100, price: 400 }, { quantity: 1000, price: 3600 }]);
    expect(parsePacks("non")).toEqual([]);
    expect(parsePacks(undefined)).toEqual([]);
  });
});

describe("tarifs d'exemple", () => {
  it("couvrent les quatre produits sur les trois réseaux, avec des prix vendables", () => {
    for (const platform of PLATFORM_CODES) {
      for (const kind of BOOST_KIND_CODES) {
        const d = BOOST_DEFAULTS[platform][kind];
        const p = product({ platform, kind, ...d });
        expect(d.packs.length).toBeGreaterThan(0);
        expect(parsePacks(d.packs)).toEqual(d.packs);
        for (const pack of d.packs) expect(pack.price).toBeGreaterThanOrEqual(BOOST_MIN_PRICE);
        expect(boostPrice(p, d.minQuantity).price).toBeGreaterThanOrEqual(BOOST_MIN_PRICE);
        expect(boostPrice(p, d.maxQuantity).price).toBeGreaterThan(0);
      }
    }
  });
});

describe("lien du compte ou de la publication", () => {
  it("accepte un nom de compte pour des abonnés Instagram ou TikTok", () => {
    expect(normalizeTarget("INSTAGRAM", "FOLLOWERS", " @ma.boutique ")).toEqual({ ok: true, link: "https://www.instagram.com/ma.boutique/" });
    expect(normalizeTarget("TIKTOK", "FOLLOWERS", "maboutique")).toEqual({ ok: true, link: "https://www.tiktok.com/@maboutique" });
  });

  it("exige un lien pour une page Facebook et pour une publication", () => {
    expect(normalizeTarget("FACEBOOK", "FOLLOWERS", "@mapage").ok).toBe(false);
    expect(normalizeTarget("INSTAGRAM", "LIKES", "@ma.boutique").ok).toBe(false);
    expect(normalizeTarget("FACEBOOK", "FOLLOWERS", "facebook.com/mapage")).toEqual({ ok: true, link: "https://facebook.com/mapage" });
  });

  it("complète le protocole, passe en https et retire l'ancre", () => {
    expect(normalizeTarget("TIKTOK", "VIEWS", "http://vm.tiktok.com/ZM123abc/#x")).toEqual({ ok: true, link: "https://vm.tiktok.com/ZM123abc/" });
    expect(normalizeTarget("INSTAGRAM", "LIKES", "www.instagram.com/p/Cabc123/")).toEqual({ ok: true, link: "https://www.instagram.com/p/Cabc123/" });
  });

  it("refuse un lien d'un autre réseau, un faux domaine ou une adresse sans publication", () => {
    expect(normalizeTarget("INSTAGRAM", "LIKES", "https://www.tiktok.com/@a/video/1")).toMatchObject({ ok: false, error: expect.stringMatching(/ne vient pas de Instagram/) });
    expect(normalizeTarget("INSTAGRAM", "LIKES", "https://instagram.com.evil.example/p/1").ok).toBe(false);
    expect(normalizeTarget("INSTAGRAM", "LIKES", "https://evilinstagram.com/p/1").ok).toBe(false);
    expect(normalizeTarget("INSTAGRAM", "LIKES", "https://user:pass@instagram.com/p/1").ok).toBe(false);
    expect(normalizeTarget("FACEBOOK", "LIKES", "https://www.facebook.com/").ok).toBe(false);
    expect(normalizeTarget("FACEBOOK", "LIKES", "javascript:alert(1)").ok).toBe(false);
    expect(normalizeTarget("FACEBOOK", "LIKES", "   ").ok).toBe(false);
    expect(normalizeTarget("FACEBOOK", "LIKES", `https://facebook.com/${"a".repeat(500)}`).ok).toBe(false);
  });
});

describe("commentaires écrits par le client", () => {
  it("lit une ligne par commentaire et ignore les lignes vides", () => {
    expect(parseComments("Super !\r\n\n  Très   beau travail  \n")).toEqual(["Super !", "Très beau travail"]);
  });

  it("en demande au moins un, pas plus que la quantité commandée, et limite la longueur", () => {
    expect(validateComments([], 10)).toMatch(/au moins un/);
    expect(validateComments(["a", "b"], 10)).toBeNull();
    expect(validateComments(["a", "b", "c"], 2)).toMatch(/3 commentaires pour 2/);
    expect(validateComments(["x".repeat(201)], 10)).toMatch(/n° 1 est trop long/);
  });
});

describe("étapes de livraison", () => {
  it("ne livre jamais une commande non payée", () => {
    expect(canMoveBoost("AWAITING_PAYMENT", "DELIVERED")).toBe(false);
    expect(canMoveBoost("AWAITING_PAYMENT", "IN_PROGRESS")).toBe(false);
  });

  it("permet « en cours », « livrée » ou « annulée » après paiement, et rien après la fin", () => {
    expect(canMoveBoost("TO_DELIVER", "IN_PROGRESS")).toBe(true);
    expect(canMoveBoost("TO_DELIVER", "DELIVERED")).toBe(true);
    expect(canMoveBoost("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canMoveBoost("IN_PROGRESS", "TO_DELIVER")).toBe(false);
    expect(canMoveBoost("DELIVERED", "CANCELLED")).toBe(false);
    expect(canMoveBoost("CANCELLED", "DELIVERED")).toBe(false);
  });

  it("réserve la livraison à l'équipe concernée et les tarifs aux administrateurs", () => {
    expect(can("AD_MANAGER", "boost.manage")).toBe(true);
    expect(can("SUPPORT", "boost.manage")).toBe(true);
    expect(can("DESIGNER", "boost.manage")).toBe(false);
    expect(can("CLIENT", "boost.manage")).toBe(false);
    expect(can("SUPPORT", "pricing.manage")).toBe(false);
  });
});
