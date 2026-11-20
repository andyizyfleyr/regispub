-- Clés des services externes (paiement, stockage, e-mails, WhatsApp, API publicitaires) saisies dans l'administration.
-- Chaque valeur est chiffrée (AES-256-GCM, clé dérivée de APP_SECRET) : la base ne contient jamais une clé en clair.
CREATE TABLE "AppKey" (
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppKey_pkey" PRIMARY KEY ("name")
);
