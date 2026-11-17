-- Retrait complet de l'assistance par IA : historique des générations, calendrier éditorial
-- (accessible uniquement depuis l'assistant) et stratégie proposée sur les campagnes.
-- Le texte de l'annonce ("adCopy") est conservé.

-- DropForeignKey
ALTER TABLE "AiGeneration" DROP CONSTRAINT "AiGeneration_userId_fkey";

-- DropForeignKey
ALTER TABLE "CalendarEntry" DROP CONSTRAINT "CalendarEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "CalendarEntry" DROP CONSTRAINT "CalendarEntry_businessId_fkey";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "strategy";

-- DropTable
DROP TABLE "AiGeneration";

-- DropTable
DROP TABLE "CalendarEntry";
