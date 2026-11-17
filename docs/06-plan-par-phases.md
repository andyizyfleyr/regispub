# 6. Plan par phases

## Phase 1 — Socle (livrée dans ce dépôt)

- Site public, inscription, connexion, réinitialisation du mot de passe.
- Espace client : assistant de création, brief expert, devis, paiement, suivi, créations, messagerie, résultats, rapport, studio, assistant, compte.
- Espace de gestion : campagnes, commandes, paiements, remboursements, réclamations, rapports, clients, équipe, tarifs, promotions, modèles, notifications, intégrations, paramètres, journal d'audit.
- Paiement : contrat de prestataire, adaptateur FedaPay, simulateur, webhook, vérification, idempotence.
- Tests : tarification, statuts, droits, import CSV, signatures, parcours de paiement et de remboursement sur une vraie base.

## Phase 2 — Mise en service (avant d'ouvrir au public)

| Action | Qui | Bloquant |
| --- | --- | --- |
| Compte marchand FedaPay, clés, webhook, paiements réels de test sur les trois opérateurs | Vous + technique | Oui |
| Base PostgreSQL managée, stockage S3, domaine, variables d'environnement | Technique | Oui |
| Conditions générales et politique de confidentialité relues par un juriste (loi béninoise sur le numérique, APDP) | Vous | Oui |
| Domaine d'envoi d'e-mails vérifié | Technique | Recommandé |
| Mot de passe du super administrateur changé, comptes de démonstration absents | Vous | Oui |
| Sauvegardes de la base et supervision des erreurs | Technique | Recommandé |
| Politique CSP stricte, test d'intrusion léger | Technique | Recommandé |

## Phase 3 — Automatisation de la lecture

- Jeton Meta `ads_read` et accès TikTok Reporting : synchronisation quotidienne des statistiques, puis validation par un gestionnaire.
- Notifications WhatsApp avec un modèle approuvé.
- Clé d'IA pour les textes et les images.

## Phase 4 — Automatisation du lancement

- App Review Meta pour `ads_management`, approbation TikTok.
- Création des campagnes en brouillon par API à partir de la commande, relecture humaine avant diffusion.
- Rapprochement automatique des dépenses réelles et du budget payé.

## Phase 5 — Extension

- Autres agrégateurs et autres pays (Togo, Côte d'Ivoire, Sénégal) : opérateurs par pays, devise, règles fiscales.
- Remboursement automatique si le prestataire le permet.
- Application mobile, facturation avec TVA selon le statut fiscal, espace agence multi-utilisateurs.

## Ce qui a été exercé dans un navigateur, et ce qui ne l'a pas été

Exercé de bout en bout sur la base locale avec le simulateur de paiement : création d'une campagne en 7 étapes sur téléphone, paiement et reçu, prise en charge, ajout d'une création, validation par le client, refus du lancement sans identifiant de campagne externe, lancement, import CSV, publication des statistiques, remboursement (refus sans référence de transfert, puis clôture), réclamation et réponse, création d'un code promotionnel (préfixes réservés refusés), création d'un collaborateur, enregistrement des paramètres (plancher de 10 000 F conservé), export d'une création du studio, restrictions d'accès par rôle.

Écrit et compilé, mais pas exercé un à un : brief « expert » jusqu'au paiement, demande de modification après paiement, conversion des points de fidélité, souscription à l'accompagnement mensuel, édition d'un tarif et d'un modèle, envoi d'une notification groupée, suspension d'un compte, réinitialisation du mot de passe (l'e-mail n'est pas envoyé sans fournisseur configuré), génération par IA (aucune clé disponible).
