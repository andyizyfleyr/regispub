-- Objectifs qui disaient la même chose : regroupés en un seul (voir MERGED_OBJECTIVES dans src/lib/catalog/objectives.ts).
-- Les campagnes déjà créées prennent le code conservé ; aucune autre colonne n'est modifiée.
UPDATE "Campaign" SET "objective" = 'fb_followers' WHERE "objective" = 'page_likes';
UPDATE "Campaign" SET "objective" = 'page_awareness' WHERE "objective" IN ('company_awareness', 'brand_building');
UPDATE "Campaign" SET "objective" = 'leads' WHERE "objective" = 'quote_requests';
UPDATE "Campaign" SET "objective" = 'product_promo' WHERE "objective" = 'product_launch';
