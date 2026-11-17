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
| `Message`, `CampaignRead` | Messagerie client ↔ équipe et marqueurs de lecture |
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

## Résultats

| Modèle | Contenu |
| --- | --- |
| `MetricSnapshot` | Une ligne par campagne, plateforme et jour ; source (`API`, `IMPORT`, `MANUAL`) ; publiée seulement si validée |
| `MetricImport` | Trace de chaque fichier importé |

Les ratios (CTR, CPC, CPM, coût par résultat, ROI) ne sont pas stockés : ils sont calculés à partir des totaux.

## Relation client et exploitation

`LoyaltyEntry`, `ReferralReward`, `Ticket`, `Notification`, `NotificationDelivery` (un enregistrement par canal, avec le motif en cas d'échec), `AiGeneration` (historique et quota), `CalendarEntry`, `AuditLog`, `RateLimit`.
