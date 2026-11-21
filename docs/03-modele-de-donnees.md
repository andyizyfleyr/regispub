# 3. Modèle de données

Source de vérité : `prisma/schema.prisma` (PostgreSQL). Les montants sont des entiers en FCFA.

## Comptes

| Modèle | Contenu |
| --- | --- |
| `User` | Identité, rôle (`SUPER_ADMIN`, `ADMIN`, `AD_MANAGER`, `DESIGNER`, `SUPPORT`, `CLIENT`), statut, code de parrainage |
| `Session`, `PasswordResetToken` | Jetons stockés hachés, avec expiration |
| `Business` | Entreprises d'un client (secteur, ville, liens) |

## Catalogue

| Modèle | Contenu |
| --- | --- |
| `Service` | Prestation et tarif (`CAMPAIGN`, `PACK`, `MANAGEMENT`, `SUBSCRIPTION`) |
| `PromoCode`, `PromoRedemption` | Codes, bons de fidélité (`FID-`) et de parrainage (`PAR-`), une utilisation par commande |
| `CreativeTemplate` | Table héritée de l'ancien studio créatif (retiré), conservée pour éviter une migration |
| `Setting` | Paramètres modifiables (planchers, frais, fidélité, coordonnées) |

## Campagnes

| Modèle | Contenu |
| --- | --- |
| `AccountAccess` | Accès à un compte social d'une entreprise (un par réseau) : option choisie (ajout à la page ou identifiants), état (envoyé, vérifié, problème), identifiants chiffrés, message de l'équipe. |
| `Campaign` | Mode (libre-service ou expert), plateformes, objectif, produit, textes, ciblage, budget, dates, statut, gestionnaire et designer, identifiants externes Meta / TikTok |
| `CampaignStatusEvent` | Historique des statuts (auteur, note) |
| `Asset`, `CampaignAsset` | Fichiers et leur rôle dans une campagne (média produit, pièce du brief, création) avec l'état de validation par le client |
| `Message`, `CampaignRead` | Ancienne messagerie client ↔ équipe et ses marqueurs de lecture. La messagerie est retirée du site : ces tables ne sont plus lues ni écrites, elles gardent seulement les anciens échanges |
| `RevisionRequest` | Demandes de modification après paiement |

Statuts : `DRAFT` → `PENDING_PAYMENT` → `PAID` → `AWAITING_INFO` / `IN_PREPARATION` → `CLIENT_REVIEW` → `READY_TO_LAUNCH` → `RUNNING` ↔ `PAUSED` → `COMPLETED`, et `CANCELLED`. Le passage à `PAID` n'existe que par un paiement vérifié.

## Commandes et paiements

| Modèle | Contenu |
| --- | --- |
| `Order` | Devis figé : budget publicitaire, prestation, remise, frais de paiement, total, numéro de reçu |
| `Payment` | Tentative de paiement : opérateur, numéro, montant, prestataire, référence, statut, clé d'idempotence, marqueur de doublon |
| `PaymentEvent` | Notifications reçues des prestataires (dédoublonnées, signature valide ou non) |
| `Refund` | Demande, décision, référence du transfert |
| `Subscription` | Accompagnement mensuel, payé période par période |
| `Counter` | Numérotation continue des reçus |

## Abonnés, J'aime, commentaires, vues

| Modèle | Contenu |
| --- | --- |
| `BoostProduct` | Un produit par réseau (`Platform`) et par type (`BoostKind` : `FOLLOWERS`, `LIKES`, `COMMENTS`, `VIEWS`) : prix pour 1 000, quantités minimale et maximale, packs à prix fixe (`packs`, JSON `[{ quantity, price }]`), délai annoncé, actif ou masqué |
| `BoostOrder` | Détail d'une commande, rattaché à un `Order` qui porte le paiement : réseau, type, quantité, lien du compte ou de la publication, commentaires écrits par le client, état de livraison (`BoostStatus`), note interne, motif d'annulation, collaborateur qui a traité |

États de livraison : `AWAITING_PAYMENT` → `TO_DELIVER` (au paiement, automatiquement) → `IN_PROGRESS` → `DELIVERED`, ou `CANCELLED`. Seuls les passages après paiement sont manuels (`BOOST_TRANSITIONS` dans `src/lib/boost/catalog.ts`).

Règles de prix (`src/lib/boost/catalog.ts`, module pur partagé par le navigateur et le serveur ; le serveur recalcule toujours) :

- une quantité égale à un pack coûte le prix du pack ; toute autre quantité coûte `quantité × prix pour 1 000 / 1 000`, arrondi aux 5 F supérieurs, entre le minimum et le maximum du produit ;
- une commande coûte au moins 100 F ;
- le plancher des prestations (10 000 F) ne s'applique pas : ce ne sont pas des frais de prestation ;
- pas de code promo sur ces commandes, et pas de récompense de parrainage (elle reste due à la première publicité) ; les points de fidélité sont comptés comme pour toute commande ;
- les frais Mobile Money suivent le réglage général.

## Résultats

| Modèle | Contenu |
| --- | --- |
| `MetricSnapshot` | Une ligne par campagne, plateforme et jour ; source (`API`, `IMPORT`, `MANUAL`) ; publiée seulement si validée |
| `MetricImport` | Trace de chaque fichier importé |

Les ratios (CTR, CPC, CPM, coût par résultat, ROI) ne sont pas stockés : ils sont calculés à partir des totaux.

## Relation client et exploitation

`LoyaltyEntry`, `ReferralReward`, `Ticket`, `Notification`, `NotificationDelivery` (un enregistrement par canal, avec le motif en cas d'échec), `AuditLog`, `RateLimit`.

La migration `20261119000000_remove_ai` a supprimé les tables `AiGeneration` et `CalendarEntry` ainsi que la colonne `Campaign.strategy` (retrait de l'assistance par IA). Le texte de l'annonce reste dans `Campaign.adCopy`.
