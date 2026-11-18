# 1. Analyse du besoin

## Objectif

Permettre à une entreprise béninoise, même sans connaissance du marketing digital, de commander une publicité Facebook, Instagram ou TikTok, de la payer par Mobile Money et d'en suivre l'exécution et les résultats au même endroit.

## Utilisateurs

| Profil | Besoin principal |
| --- | --- |
| Client (commerçant, PME, créateur, association) | Commander simplement, payer en confiance, savoir où en est sa campagne, comprendre ses résultats |
| Gestionnaire publicitaire | Traiter les commandes payées, lancer les campagnes, publier les statistiques |
| Designer | Produire les créations des campagnes qui lui sont confiées |
| Support | Répondre aux clients, suivre les paiements et les réclamations |
| Administrateur / super administrateur | Tarifs, promotions, équipe, remboursements, paramètres, audit |

## Deux parcours de commande

- **« Je crée ma publicité »** : une seule page (où la montrer, que vendez-vous, budget), le reste est déjà réglé et reste modifiable. Le brouillon est enregistré quand le client quitte la page.
- **« Je confie ma publicité à un expert »** : un brief d'une page, des fichiers, un budget. L'équipe prépare tout et soumet les créations.

Dans les deux cas, l'équipe vérifie la campagne avant diffusion.

## Règles métier retenues

1. **Le budget publicitaire et la prestation sont deux lignes distinctes.** Le budget est reversé aux plateformes ; la prestation rémunère RegisPub. Les remises ne portent que sur la prestation.
2. **Aucune prestation sous 10 000 FCFA**, quel que soit le réglage, le tarif saisi ou le code promotionnel (plancher codé en dur, vérifié par les tests).
3. **Le serveur recalcule toujours le prix.** Un montant envoyé par le navigateur n'est jamais utilisé.
4. **Une commande n'est payée qu'après vérification auprès du prestataire de paiement**, de serveur à serveur, avec contrôle du montant. Le webhook et le retour du navigateur ne sont que des signaux.
5. **Personne ne peut déclarer une commande payée à la main**, y compris un super administrateur.
6. **Le client ne voit que des statistiques validées** par un gestionnaire. Un indicateur sans donnée affiche « — », jamais une estimation.
7. **Aucune promesse de résultat** : pas de nombre garanti de vues, d'abonnés ou de ventes dans l'interface ni dans les conditions.
8. **Le client modifie ou annule librement avant paiement.** Après paiement, il passe par une demande de modification traitée par l'équipe.
9. **Un remboursement est un transfert Mobile Money manuel**, tracé avec sa référence ; le total remboursé ne dépasse jamais le montant encaissé.
10. **Les actions sensibles sont journalisées** (paiements, statuts, tarifs, rôles, paramètres).

## Hors périmètre de cette version

- Création automatique des campagnes sur Meta et TikTok (autorisations à obtenir, voir `04-contraintes-api.md`).
- Remboursement automatique, renouvellement automatique des abonnements (le Mobile Money ne permet pas le prélèvement récurrent sans mandat).
- Assistance par intelligence artificielle (retirée en novembre 2026 : textes, audience et idées ne sont plus générés), application mobile native, autres pays que le Bénin.
