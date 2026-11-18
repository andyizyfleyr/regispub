# 5. Parcours client

## Commander

1. **Arrivée** sur la page d'accueil : promesse, fonctionnement en trois temps, tarifs de départ, moyens de paiement.
2. **Inscription** : nom, e-mail, téléphone, mot de passe. Un lien de parrainage est reconnu.
3. **Choix du parcours** sur `/app/creer` : créer soi-même ou confier à un expert.

### Je crée ma publicité (une seule page)

Le client touche un objectif sur `/app/creer` : la page de création s'ouvre, déjà remplie. Il lui reste trois blocs numérotés, puis un seul bouton « Payer ».

| Bloc | Ce que le client fait | Ce qui est déjà fait pour lui |
| --- | --- | --- |
| 1. Où la montrer ? | Garde ou change les réseaux | Facebook et Instagram cochés ; ses comptes ne sont demandés qu'une fois, ensuite ils sont repris ; le numéro WhatsApp vient de son inscription |
| 2. Que vendez-vous ? | Écrit une ou deux phrases ; photo ou vidéo facultative | Le nom et le secteur de l'activité ne sont demandés qu'à la première publicité |
| 3. Votre budget | Touche un montant et une durée | Le montant et la durée conseillés pour l'objectif sont déjà choisis |

Sous ces blocs, la liste « Déjà réglé pour vous » montre l'audience (remplie selon le secteur et la ville, table fixe `lib/catalog/audience-defaults`, sans IA), le texte de l'annonce (écrit par l'équipe si le client ne l'écrit pas), la date de début, la formule, l'activité et l'aperçu. Chaque ligne s'ouvre pour être changée ; aucune n'est obligatoire.

Le bouton « Payer » vérifie la page, enregistre tout, crée la commande et ouvre le paiement. Une erreur s'affiche dans le bloc concerné, vers lequel l'écran défile. La flèche de retour enregistre le brouillon.

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
