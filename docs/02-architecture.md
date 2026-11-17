# 2. Architecture

## Vue d'ensemble

Une seule application Next.js (App Router) : pages rendues côté serveur, mutations par Server Actions, quelques routes d'API pour ce qui doit être appelé de l'extérieur (webhooks, tâches planifiées, fichiers, reçus).

```
Navigateur ──► Pages serveur (lecture directe en base, droits vérifiés à chaque page)
           ──► Server Actions (validation Zod → contrôle des droits → logique métier src/lib)
Prestataire de paiement ──► /api/webhooks/payments/{provider} ──► re-vérification chez le prestataire
Vercel Cron ──► /api/cron/quotidien ──► paiements en attente, statistiques, entretien
src/lib ──► PostgreSQL (Prisma) · stockage (disque ou S3) · IA · e-mail / WhatsApp · API publicitaires
```

## Couches

| Dossier | Rôle | Règle |
| --- | --- | --- |
| `src/app` | Pages et routes | Aucune règle métier ; chaque page appelle `requireUser`, `requireStaff` ou `requirePermission` |
| `src/server/actions` | Mutations | Valide l'entrée, vérifie le droit, appelle `src/lib`, journalise, renvoie `{ ok, error }` |
| `src/lib` | Logique métier | Indépendante de React ; les modules de calcul (devis, statuts, CSV, indicateurs) sont purs et testés |
| `src/components` | Interface | `ui/` (briques), `app/` (client), `staff/` (gestion), `wizard/` |

## Intégrations interchangeables

Chaque service externe est derrière une interface ; l'absence de configuration désactive la fonction sans casser l'application.

| Interface | Implémentations | Sans configuration |
| --- | --- | --- |
| `PaymentProvider` (`lib/payments`) | FedaPay, simulateur | Paiement indisponible en production ; simulateur en développement |
| Fournisseur de texte (`lib/ai`) | OpenAI (et compatibles), Anthropic, Gemini | Suggestions guidées, marquées `engine: "rules"` |
| Fournisseur d'images | OpenAI | Bouton masqué |
| Stockage (`lib/storage`) | Disque local, S3 | Disque local |
| Canaux de notification | In-app, Resend, WhatsApp Cloud API | In-app seul ; les envois externes sont consignés « non envoyés » |
| Adaptateurs publicitaires (`lib/ads`) | Meta Insights, TikTok Reporting (lecture) | Import CSV et saisie manuelle |

Ajouter un agrégateur de paiement (KKiaPay, CinetPay…) revient à implémenter `PaymentProvider` et à l'enregistrer dans `lib/payments/registry.ts`.

## Paiement

1. Le client choisit un opérateur et un numéro. Le serveur verrouille la commande, relit le montant en base et crée un `Payment` (clé d'idempotence : deux clics ne créent qu'un paiement ; un paiement en cours bloque le suivant).
2. Le prestataire envoie la demande de validation sur le téléphone.
3. L'état est relu chez le prestataire par trois chemins : interrogation depuis la page de paiement, webhook signé, tâche planifiée.
4. `applyVerification` contrôle le montant et la référence. En cas d'écart, le paiement passe en échec et l'équipe est alertée.
5. La validation est transactionnelle et idempotente : commande payée, numéro de reçu, campagne « Payée », points de fidélité, récompense de parrainage, notifications — une seule fois, même si la confirmation arrive plusieurs fois.
6. Un second encaissement sur une commande déjà payée est marqué en double et ouvre un remboursement à traiter.

## Sécurité

- Mots de passe hachés avec scrypt ; session par cookie `httpOnly`, `SameSite=Lax`, stockée hachée en base, révoquée à la suspension et au changement de rôle.
- Droits par permission (`lib/auth/permissions.ts`), vérifiés côté serveur dans chaque page et chaque action ; un designer ne voit que les campagnes qui lui sont confiées.
- Limitation du nombre de tentatives (connexion, inscription, réinitialisation, envois).
- Webhooks : signature HMAC, tolérance de 5 minutes, dédoublonnage par identifiant d'événement.
- Fichiers : type vérifié sur le contenu, taille plafonnée, accès contrôlé par propriétaire ou par campagne.
- En-têtes de sécurité (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) dans `next.config.ts`. Une politique CSP stricte reste à ajouter (phase 2).
- Le numéro Mobile Money est masqué à l'affichage ; aucun code secret ni donnée bancaire n'est demandé ni stocké.

## Exploitation

- `GET /api/health` : état de la base ; avec `?controle=<clé>`, contrôle complet du stockage (voir `07-deploiement.md`).
- `/api/cron/{paiements|statistiques|entretien|quotidien}` avec `Authorization: Bearer CRON_SECRET`.
- Journaux JSON sur la sortie standard (`LOG_LEVEL`).
- Migrations SQL versionnées dans `prisma/migrations`.
