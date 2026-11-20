-- Paiement sur la page du prestataire (FedaPay) : le client n'y saisit plus son numéro ni son opérateur chez nous,
-- ces deux colonnes ne sont donc plus obligatoires.
ALTER TABLE "Payment" ALTER COLUMN "operator" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "phone" DROP NOT NULL;
