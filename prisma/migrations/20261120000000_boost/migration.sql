-- Vente d'abonnés, de J'aime, de commentaires et de vues (Facebook, Instagram, TikTok).
CREATE TYPE "BoostKind" AS ENUM ('FOLLOWERS', 'LIKES', 'COMMENTS', 'VIEWS');
CREATE TYPE "BoostStatus" AS ENUM ('AWAITING_PAYMENT', 'TO_DELIVER', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED');

CREATE TABLE "BoostProduct" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "kind" "BoostKind" NOT NULL,
    "pricePer1000" INTEGER NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER NOT NULL,
    "packs" JSONB NOT NULL DEFAULT '[]',
    "delay" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoostProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoostProduct_platform_kind_key" ON "BoostProduct"("platform", "kind");

CREATE TABLE "BoostOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "platform" "Platform" NOT NULL,
    "kind" "BoostKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "link" TEXT NOT NULL,
    "comments" TEXT[],
    "status" "BoostStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "staffNote" TEXT,
    "cancelReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoostOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoostOrder_orderId_key" ON "BoostOrder"("orderId");
CREATE INDEX "BoostOrder_status_createdAt_idx" ON "BoostOrder"("status", "createdAt");
CREATE INDEX "BoostOrder_userId_createdAt_idx" ON "BoostOrder"("userId", "createdAt");

ALTER TABLE "BoostOrder" ADD CONSTRAINT "BoostOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoostOrder" ADD CONSTRAINT "BoostOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoostOrder" ADD CONSTRAINT "BoostOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BoostProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoostOrder" ADD CONSTRAINT "BoostOrder_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
