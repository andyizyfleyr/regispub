# RegisPub

Plateforme de publicité digitale pour les entreprises du Bénin : le client configure une campagne Facebook, Instagram ou TikTok (ou la confie à un expert), paie par Mobile Money, puis suit sa commande, ses créations et ses résultats. L'équipe RegisPub traite les commandes depuis un espace de gestion.

- Interface en français, montants en FCFA, conçue d'abord pour le téléphone.
- Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, PostgreSQL, Prisma 7.

## État réel des intégrations

L'application n'affiche jamais une intégration comme active si elle ne l'est pas. La page `/gestion/integrations` lit la configuration du serveur et donne cet état en direct.

| Domaine | État | Ce qu'il faut pour l'activer |
| --- | --- | --- |
| Comptes, rôles, commandes, devis, suivi, messagerie, validation des créations, réclamations, reçus, fidélité, parrainage, journal d'audit | **Opérationnel** | Rien |
| Statistiques par import CSV ou saisie, validées avant publication | **Opérationnel** | Rien |
| Paiement Mobile Money MTN / Moov / Celtiis via FedaPay | **Implémenté, non testé avec un vrai compte** | Compte marchand FedaPay, `PAYMENT_PROVIDER=fedapay`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET` |
| Simulateur de paiement | **Simulation** (aucun argent ne circule) | Actif par défaut en développement, refusé en production |
| Lecture des statistiques Meta et TikTok par API | **Implémenté, non testé** ; autorisation requise | Jetons `ads_read` (Meta) et Reporting API (TikTok) |
| Création de campagnes par API Meta / TikTok | **Non implémenté** | Accès avancé `ads_management` (App Review Meta), application TikTok approuvée |
| E-mails (Resend), WhatsApp Cloud API | **Implémenté, non testé** | Clés, domaine vérifié, modèle WhatsApp approuvé |
| Stockage S3 / R2 | **Implémenté, non testé** ; disque local par défaut | `STORAGE_DRIVER=s3` + variables `S3_*` |
| Remboursement automatique, génération de vidéos, autres pays | **En attente** | Voir `docs/06-plan-par-phases.md` |

Tant que les API publicitaires ne sont pas autorisées, les campagnes sont **lancées manuellement** par un gestionnaire dans le Gestionnaire de publicités Meta ou TikTok Ads Manager, puis rattachées à la commande par leur identifiant. Détails : `docs/04-contraintes-api.md`.

## Démarrage

Prérequis : Node.js 26 (la même version que sur Vercel ; champ `engines` de `package.json`). Aucune installation de PostgreSQL ni de Docker n'est nécessaire en local.

```bash
npm install
cp .env.example .env                 # puis définir APP_SECRET (openssl rand -hex 32)

# Terminal 1 : PostgreSQL embarqué sur le port 5433, migrations et données initiales
SEED_DEMO=true SEED_ADMIN_PASSWORD='Admin1234!' npm run db:local

# Terminal 2
npm run dev                          # http://localhost:3000
```

Comptes créés avec `SEED_DEMO=true` (données fictives, à ne jamais utiliser en production) :

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Super administrateur | `admin@regispub.local` | valeur de `SEED_ADMIN_PASSWORD` |
| Gestionnaire publicitaire | `gestionnaire@regispub.local` | `Demo1234!` |
| Designer | `designer@regispub.local` | `Demo1234!` |
| Support | `support@regispub.local` | `Demo1234!` |
| Client | `client@regispub.local` | `Demo1234!` |

Sans `SEED_ADMIN_PASSWORD`, un mot de passe est généré et affiché une seule fois dans le terminal.

Simulateur de paiement : un numéro se terminant par `00` est refusé, par `99` reste sans réponse, tout autre numéro est accepté après quelques secondes.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Développement, compilation, production |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires et d'intégration (PostgreSQL embarqué, port 5544) |
| `npm run db:local` | Base locale embarquée + migrations + données initiales |
| `npm run db:migrate` | Applique les migrations avec Prisma (`prisma migrate deploy`) |
| `npm run db:migrate:sql` | Applique les mêmes migrations sans le moteur Prisma |
| `npm run db:seed` | Prestations, modèles et compte administrateur |

## Mise en production (Vercel)

Le guide pas à pas (Neon, Vercel, Cloudflare R2, FedaPay) est dans [`docs/07-deploiement.md`](docs/07-deploiement.md). En résumé :

1. **Base de données** : une base PostgreSQL (Neon, Supabase…). `DATABASE_URL` = URL « pooled », `DIRECT_URL` = URL directe (migrations).
2. **Variables minimales** : `DATABASE_URL`, `APP_SECRET`, `CRON_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. `APP_URL` est facultatif sur Vercel (le domaine de production est utilisé par défaut) ; renseignez-le dès que vous branchez votre propre domaine.
3. **Migrations et données initiales** : rien à lancer à la main. La commande de build (`npm run vercel-build`, déclarée dans `vercel.json`) applique les migrations puis crée les prestations, les modèles et le compte super administrateur à chaque déploiement de production. Les déploiements de prévisualisation ne touchent jamais à la base.
4. **Stockage** : un bucket compatible S3 (Cloudflare R2 recommandé) et les variables `STORAGE_DRIVER=s3`, `S3_*`. Sans stockage, le site fonctionne mais l'envoi de fichiers est désactivé. Les fichiers de plus de 4 Mo partent directement du navigateur vers le bucket (URL signée) : le bucket doit donc porter une règle CORS pour le domaine du site.
5. **Paiements** : configurer FedaPay et déclarer le webhook `https://votre-domaine/api/webhooks/payments/fedapay`. Sans prestataire, les clients ne peuvent pas payer. `ALLOW_SANDBOX_PAYMENTS=true` autorise le simulateur en production pour une phase de recette : à retirer avant d'ouvrir le site au public, car une commande « payée » au simulateur n'a rien encaissé.
6. **Tâche planifiée** : `vercel.json` planifie `/api/cron/quotidien` (vérification des paiements en attente, synchronisation des statistiques, entretien).

## Organisation du code

```
prisma/               schéma, migration initiale, données initiales
scripts/              base locale embarquée, application des migrations
src/app/(marketing)   site public          src/app/(auth)   connexion, inscription
src/app/app           espace client        src/app/gestion  espace de gestion
src/app/api           fichiers, webhooks de paiement, reçus, tâches planifiées
src/server/actions    Server Actions (validation Zod, contrôle des droits)
src/lib               logique métier : pricing, payments, campaigns, ads, ai, auth, notifications, storage
tests/                unit (tarification, statuts, droits, CSV, signatures) et integration (paiement, remboursement)
docs/                 analyse, architecture, modèle de données, contraintes API, parcours, phases
```

## Documentation

1. [Analyse du besoin](docs/01-analyse.md)
2. [Architecture](docs/02-architecture.md)
3. [Modèle de données](docs/03-modele-de-donnees.md)
4. [Contraintes d'accès aux API](docs/04-contraintes-api.md)
5. [Parcours client](docs/05-parcours-client.md)
6. [Plan par phases](docs/06-plan-par-phases.md)
- [`docs/07-deploiement.md`](docs/07-deploiement.md) : mise en ligne pas à pas (Neon, Vercel, Cloudflare R2, FedaPay).
