# 5. Parcours client

## Commander

1. **Arrivée** sur la page d'accueil : promesse, fonctionnement en trois temps, tarifs de départ, moyens de paiement.
2. **Inscription** : nom, e-mail, téléphone, mot de passe. Un lien de parrainage est reconnu.
3. **Choix du parcours** sur `/app/creer` : créer soi-même ou confier à un expert.

### Je crée ma publicité (quatre étapes)

Le client touche un objectif sur `/app/creer` : la page de création `/app/creer/<id>` s'ouvre à l'étape 1. Rien n'est rempli ni coché d'avance : le client choisit et écrit tout lui-même. « Continuer » vérifie l'étape, l'enregistre et passe à la suivante ; « Retour » revient en arrière ; « Quitter » enregistre le brouillon. Le brouillon se rouvre à la première étape encore incomplète (`?etape=2` ouvre une étape déjà atteinte).

| Étape | Ce que le client fait |
| --- | --- |
| 1. Réseau | Choisit **un seul** réseau (Facebook, Instagram ou TikTok), puis le nom, le secteur et le compte de son activité sur ce réseau. Le numéro WhatsApp est demandé si l'objectif en a besoin |
| 2. Annonce | Dans un même bloc et dans cet ordre : photo ou vidéo, titre (3 caractères au moins), texte (20 caractères au moins) |
| 3. Audience | Choisit au moins un pays ; villes, genre, âges et centres d'intérêt s'il veut les restreindre |
| 4. Budget | Choisit le montant, la durée, la date de début et la formule ; le total s'affiche, puis « Payer » crée la commande et ouvre le paiement |

Règles :

- **Un réseau par publicité.** Le serveur refuse tout enregistrement avec deux réseaux (`ONE_NETWORK` dans `lib/campaigns/missing.ts`), y compris pour une campagne confiée à un expert. Un ancien brouillon à plusieurs réseaux s'ouvre sans réseau coché.
- **Aucun préremplissage.** À la création : pas de réseau, pas de budget, pas de durée, pas de date, pas d'audience, pas de numéro WhatsApp repris de l'inscription. Seules les informations que le client a déjà enregistrées lui-même (son activité et ses comptes) sont reprises. Le montant et la durée conseillés pour l'objectif sont signalés par la mention « conseillé », sans être sélectionnés.
- **Plus de champ « Que vendez-vous ? ».** L'annonce se décrit par son titre et son texte ; la colonne `productDescription` reste en base pour les anciennes campagnes.
- **Aperçu en direct.** Sur ordinateur et tablette, l'aperçu de l'annonce reste affiché à droite pendant les quatre étapes et suit chaque frappe, le visuel importé et le réseau choisi. Sur téléphone, où il n'y a pas de place à droite, il s'affiche sous les champs de l'étape « Annonce ».

### Paiement

Le numéro du client est déjà rempli et l'opérateur reconnu d'après ce numéro : il touche « Payer », puis valide sur son téléphone. Il n'y a pas de seconde confirmation à l'écran. Le détail du prix et le code promo sont repliés sous le bouton.

### Je confie ma publicité à un expert

Un brief d'une page : objectif en clair, description, public visé, budget, durée, fichiers. Le reste est préparé par l'équipe.

### J'achète des abonnés, des J'aime, des commentaires ou des vues

Page `/app/booster` (menu « Abonnés et J'aime », aussi proposée depuis l'accueil et depuis « Créer une publicité »).

1. Réseau : Facebook, Instagram ou TikTok.
2. Produit : abonnés, J'aime, commentaires ou vues, avec le prix d'appel.
3. Quantité : un pack à prix fixe, ou « Autre quantité » au tarif pour 1 000.
4. Lien : le compte pour des abonnés (un simple `@nom` suffit sur Instagram et TikTok), la publication pour le reste. Le lien doit venir du réseau choisi.
5. Commentaires : le client les écrit, un par ligne. Il peut en écrire moins que la quantité commandée ; ils sont alors repris plusieurs fois.
6. Paiement Mobile Money, comme pour une publicité (sans code promo).

Après le paiement, la commande passe « À livrer ». L'équipe la traite dans `/gestion/boosts` : elle copie le lien (et les commentaires) chez son fournisseur, peut la marquer « En cours », puis « Livrée ». Le client suit l'avancement sur la page de sa commande et reçoit une notification à la livraison. Si l'équipe annule (compte privé, lien introuvable…), elle saisit un motif envoyé au client et une demande de remboursement du montant payé s'ouvre dans `/gestion/paiements`.

Aucun mot de passe n'est demandé au client. Le compte ou la publication doit rester public pendant la livraison.

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
