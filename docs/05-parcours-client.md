# 5. Parcours client

## Commander

1. **Arrivée** sur la page d'accueil : promesse, fonctionnement en trois temps, tarifs de départ, moyens de paiement.
2. **Inscription** : nom, e-mail, téléphone, mot de passe. Un lien de parrainage est reconnu.
3. **Choix du parcours** sur `/app/creer` : créer soi-même ou confier à un expert.

### Je crée ma publicité (4 étapes)

| Étape | Contenu | Aide apportée |
| --- | --- | --- |
| 1. Objectif | Plateformes (Facebook et Instagram présélectionnés) et résultat attendu | Objectifs classés par famille, tarif de la prestation affiché, conseil et repère de budget |
| 2. Votre annonce | Entreprise, offre, photo ou vidéo, texte de l'annonce | Aperçu en direct sur chaque plateforme ; le client écrit son texte ou le laisse à notre équipe |
| 3. Audience | Zone, profil, centres d'intérêt | Audience de départ remplie selon le secteur et la ville (table fixe `lib/catalog/audience-defaults`, sans IA) ; réglages détaillés repliés |
| 4. Budget | Budget, durée, date de début, niveau d'accompagnement, code promotionnel, récapitulatif | Montants et durées prédéfinis ; devis recalculé par le serveur à chaque changement |

### Je confie ma publicité à un expert

Un brief d'une page : objectif en clair, description, public visé, budget, durée, fichiers. Le reste est préparé par l'équipe.

## Payer

1. Récapitulatif : budget publicitaire, prestation, frais Mobile Money, total.
2. Choix de l'opérateur (MTN, Moov, Celtiis) et du numéro ; l'opérateur est suggéré d'après le préfixe.
3. Confirmation du numéro et du montant avant l'envoi.
4. Validation sur le téléphone. La page suit l'état et propose « Vérifier maintenant ».
5. Paiement confirmé : reçu téléchargeable, campagne « Payée ». Paiement refusé ou expiré : motif affiché, nouvelle tentative possible, rien n'est encaissé.

## Donner l'accès aux comptes

L'équipe lance la publicité sur les comptes du client : il doit donc lui en ouvrir l'accès. Dès le paiement, la fiche de la campagne affiche « Donnez-nous l'accès », avec une ligne par réseau choisi et deux options :

1. **Je vous ajoute** (conseillé) : le client ajoute le profil Facebook de l'agence à sa page (Instagram passe par la page Facebook liée) ; sur TikTok, il colle le code de la vidéo à promouvoir. Il garde son mot de passe. Il termine par « C'est fait ».
2. **Je donne mes identifiants** : identifiant et mot de passe du compte. Ils sont chiffrés (AES-256-GCM, clé dérivée de `APP_SECRET`), lisibles par les seuls rôles ayant le droit `access.reveal`, chaque lecture étant journalisée, et effacés dès que le client n'a plus de campagne active (à la clôture ou à l'annulation, plus un contrôle quotidien). Le client peut les effacer lui-même à tout moment.

L'équipe est prévenue, vérifie l'accès dans « Comptes du client » puis marque « Accès OK » ou « Problème » avec un message, que le client reçoit. Un accès donné reste valable pour les campagnes suivantes (sauf le code de vidéo TikTok, propre à une campagne).

Le nom du profil Facebook à ajouter se règle dans Gestion → Paramètres (« Votre profil Facebook »). Pour Facebook et Instagram, un bouton ouvre directement l'écran « Accès à la Page » (`FACEBOOK_PAGE_ACCESS_URL`) ; il ne fonctionne que si le client utilise Facebook en tant que sa page, ce que demande l'étape précédente. Le texte des étapes et ce lien sont dans `src/lib/catalog/access.ts` : les menus des réseaux changent, il faut le relire de temps en temps.

## Suivre

- **Fil d'avancement** : En attente de paiement → Payé → En préparation → À valider → Prête → En cours → Terminée.
- **Créations** : le client valide chaque visuel ou demande une correction avec un commentaire.
- **Messages** : échanges avec le gestionnaire, avec pièces jointes.
- **Demande de modification** : budget, ciblage, texte, visuel ou dates, après paiement.
- **Notifications** à chaque étape, dans l'application et, une fois configurés, par e-mail et WhatsApp.

## Résultats

- Indicateurs adaptés à l'objectif en tête, puis portée, impressions, clics, CTR, CPC, CPM, engagement, prospects, dépenses.
- Courbe quotidienne, répartition par plateforme, budget consommé.
- Rapport imprimable.
- Le retour sur investissement n'apparaît que si le chiffre d'affaires a été communiqué.

## Autour de la campagne

Historique des paiements et reçus, fidélité, parrainage, accompagnement mensuel, support par ticket.
