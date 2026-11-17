-- Accès donné par le client à ses comptes (ajout de l'agence à la page, ou identifiants chiffrés).
CREATE TABLE "AccountAccess" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "loginEnc" TEXT,
    "secretEnc" TEXT,
    "campaignId" TEXT,
    "note" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountAccess_businessId_platform_key" ON "AccountAccess"("businessId", "platform");

ALTER TABLE "AccountAccess" ADD CONSTRAINT "AccountAccess_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
