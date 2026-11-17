# 4. Contraintes d'accès aux API

Ce document distingue ce qui fonctionne aujourd'hui, ce qui est écrit mais n'a pas pu être testé sans identifiants, et ce qui dépend d'une autorisation d'un tiers.

## Paiement Mobile Money — FedaPay

- **Écrit** : création de transaction, envoi de la demande sur le téléphone (MTN `mtn_open`, Moov `moov`, Celtiis `sbin`), relecture de l'état, webhook signé (`X-FEDAPAY-SIGNATURE`, HMAC-SHA256 sur `horodatage.corps`).
- **Non testé avec un vrai compte.** Le parcours complet est testé avec le simulateur, qui respecte le même contrat.
- **À fournir** : compte marchand FedaPay validé (pièce d'identité, IFU, RCCM), clé secrète, secret de webhook, URL du webhook déclarée dans le tableau de bord FedaPay.
- **À vérifier avant ouverture** : un paiement réel de petit montant sur chacun des trois opérateurs, les noms de mode exacts acceptés par votre compte, la réception du webhook.
- **Limite connue** : pas de remboursement automatique d'un paiement Mobile Money. Le transfert se fait depuis le compte marchand ; l'application en garde la trace.
- **Frais** : le taux affiché au client (`1,8 %` par défaut) est un paramètre. Il doit correspondre à votre contrat.

## Meta (Facebook et Instagram)

| Usage | État | Autorisation |
| --- | --- | --- |
| Lire les statistiques d'une campagne (Insights API) | Écrit, non testé | Application Meta, vérification de l'entreprise, autorisation `ads_read`, jeton d'utilisateur système |
| Créer et piloter des campagnes par API | Non écrit | Accès avancé `ads_management` après App Review, compte publicitaire de l'agence, moyen de paiement accepté par Meta |
| Diffuser pour le compte d'un client | Procédure manuelle | Accès partenaire à la page du client depuis Meta Business Suite |

Conséquence : le gestionnaire crée la campagne dans le Gestionnaire de publicités, puis saisit son identifiant dans la fiche de la commande. L'application refuse de déclarer une campagne « en cours » sans cet identifiant.

## TikTok

| Usage | État | Autorisation |
| --- | --- | --- |
| Lire les statistiques (Reporting API v1.3) | Écrit, non testé | Compte TikTok for Business, application développeur approuvée, jeton et identifiant d'annonceur |
| Créer des campagnes par API | Non écrit | Approbation de l'application pour la gestion des publicités |

À vérifier au préalable : la disponibilité de TikTok Ads Manager pour un annonceur établi au Bénin. À défaut, il faut passer par un compte d'agence partenaire.

## Devise des comptes publicitaires

Les comptes publicitaires sont souvent facturés en dollars ou en euros. Les dépenses lues par API sont converties en FCFA avec `FX_RATES_TO_XOF`. Sans taux pour la devise du compte, la synchronisation échoue avec un message explicite plutôt que d'afficher un montant faux.

## Statistiques sans API

L'import d'un export CSV et la saisie d'une journée sont opérationnels. Les lignes restent invisibles pour le client jusqu'à leur validation et ne remplacent jamais une ligne venue d'une API.

## Intelligence artificielle

Aucune. L'assistance par IA a été retirée en novembre 2026 : l'application n'appelle aucun service de génération de texte, d'image ou de vidéo, et aucune clé n'est à fournir.

## Notifications

- **Dans l'application** : opérationnel.
- **E-mail (Resend)** : écrit, non testé. Domaine expéditeur à vérifier.
- **WhatsApp Cloud API** : écrit, non testé. Compte WhatsApp Business vérifié, numéro dédié et modèle de message approuvé par Meta ; hors fenêtre de 24 heures, seuls les modèles approuvés sont acceptés.
- **SMS** : non écrit.

## Stockage

Le disque local convient au développement. Sur un hébergement serverless, les fichiers ne sont pas conservés : il faut un stockage S3 (S3, Cloudflare R2, MinIO). Écrit, non testé sans bucket.
