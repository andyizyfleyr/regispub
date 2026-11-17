# Mise en ligne : Neon, Vercel, Cloudflare R2

Ce guide décrit la mise en ligne telle qu'elle est prévue par le code. Aucune clé ne doit être écrite dans le dépôt : tout passe par les variables d'environnement du projet Vercel.

## 1. Base de données (Neon)

Dans Neon, le bouton **Connect** donne deux adresses pour la même base :

| Variable | Adresse | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | « Pooled connection » (l'hôte contient `-pooler`) | Utilisée par le site |
| `DIRECT_URL` | Connexion directe (même hôte sans `-pooler`) | Utilisée pour les migrations |

Les tables sont créées automatiquement au premier déploiement (voir § 2).

## 2. Projet Vercel

Le dépôt contient `vercel.json` : framework Next.js, commande de build `npm run vercel-build`, région `cle1` (la plus proche d'une base Neon `us-east-2` ; à adapter si la base est ailleurs), tâche planifiée quotidienne.

`npm run vercel-build` enchaîne :

1. `prisma generate` ;
2. `scripts/deploy-db.ts` : migrations SQL puis données initiales (prestations, modèles, compte super administrateur). Rejouable : rien d'existant n'est écrasé, et un verrou empêche deux déploiements simultanés d'appliquer la même migration. Ignoré pour les déploiements de prévisualisation ;
3. `scripts/check-storage.ts` : si un bucket est configuré, écrit, relit et supprime un objet témoin, puis teste les adresses signées et la règle CORS du site. Le résultat (« Stockage : opérationnel » ou la liste des contrôles en échec) apparaît dans le journal de build ; un échec ne bloque pas la mise en ligne ;
4. `next build`.

Variables à définir pour l'environnement **Production** :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Voir § 1 |
| `APP_SECRET` | 64 caractères hexadécimaux aléatoires (`openssl rand -hex 32`). Le changer déconnecte tout le monde |
| `CRON_SECRET` | Chaîne aléatoire : Vercel l'envoie à la tâche planifiée |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Identifiants du premier super administrateur (créé une seule fois) |
| `PAYMENT_PROVIDER` | `sandbox` tant que FedaPay n'est pas branché, puis `fedapay` |
| `APP_URL` | Facultatif sur Vercel. À renseigner avec votre propre domaine dès qu'il est branché (liens des e-mails, webhook) |

Seule la branche de production du projet (par défaut `main`) est déployée en production automatiquement. Les autres branches donnent des déploiements de prévisualisation, protégés par la connexion Vercel et sans accès à la base.

## 3. Stockage des fichiers (Cloudflare R2)

Le bucket reste **privé**. Les fichiers ne sont jamais publics : le site vérifie les droits de la personne connectée, puis sert le fichier lui-même ou, pour les fichiers lourds, redirige vers une adresse signée valable cinq minutes.

### Créer le bucket

1. Sur [dash.cloudflare.com](https://dash.cloudflare.com), menu **R2 Object Storage**. À la première utilisation, Cloudflare demande d'activer R2 (offre gratuite : 10 Go, un moyen de paiement est en général demandé).
2. **Create bucket** : nom `regispub`, emplacement **Automatic** (ou l'indication « Western Europe », la plus proche du Bénin), classe **Standard**. Ne pas choisir de juridiction particulière, ne pas activer l'accès public.

### Créer les clés d'accès

1. Page d'accueil R2, **Manage API Tokens** (ou **API → Manage API Tokens**).
2. **Create Account API Token** (à défaut, « User API Token »).
3. Permission **Object Read & Write**, puis **Apply to specific buckets only** → `regispub`. Laisser le reste tel quel et créer.
4. Copier tout de suite les trois valeurs affichées : **Access Key ID**, **Secret Access Key** (elle n'est montrée qu'une fois) et l'adresse S3 `https://<identifiant-du-compte>.r2.cloudflarestorage.com`.

### Autoriser le site à envoyer les gros fichiers (CORS)

Bucket `regispub` → **Settings** → **CORS Policy** → **Add CORS policy** → onglet **JSON**, coller puis **Save** (remplacer l'adresse par celle du site, sans barre oblique finale ; ajouter une ligne par domaine) :

```json
[
  {
    "AllowedOrigins": ["https://votre-site.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Sans cette règle, les photos légères passent, mais les vidéos et les fichiers de plus de 4 Mo sont refusés par le navigateur.

### Variables Vercel

| Variable | Valeur |
| --- | --- |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `https://<identifiant-du-compte>.r2.cloudflarestorage.com` (sans le nom du bucket) |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `regispub` |
| `S3_ACCESS_KEY_ID` | Access Key ID |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key |

Un nouveau déploiement est nécessaire pour qu'elles soient prises en compte. Son journal de build se termine par « Stockage : opérationnel » si les clés, le nom du bucket et la règle CORS sont corrects.

### Comment circulent les fichiers

Les fonctions Vercel refusent les requêtes de plus de 4,5 Mo. Le site s'y adapte :

- les photos de plus de 1,5 Mo sont réduites dans le navigateur avant l'envoi (2 560 px au plus, JPEG) ;
- jusqu'à 4 Mo, le fichier passe par le site (`POST /api/files`) ;
- au-delà (vidéos surtout), le navigateur demande une adresse signée (`POST /api/files/direct`), envoie le fichier directement au bucket, puis le site relit l'objet reçu : taille réelle et signature binaire sont vérifiées avant de créer la fiche, et un fichier non conforme est supprimé.

## 4. Paiements (FedaPay)

1. Créer le compte marchand FedaPay et récupérer la clé secrète.
2. Dans FedaPay, déclarer le webhook `https://votre-domaine/api/webhooks/payments/fedapay` et copier son secret de signature.
3. Variables : `PAYMENT_PROVIDER=fedapay`, `FEDAPAY_ENV` (`sandbox` puis `live`), `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`.
4. Supprimer `ALLOW_SANDBOX_PAYMENTS` s'il avait été défini pour la recette.

## 5. Vérifier après chaque mise en ligne

- `https://votre-domaine/api/health` répond `{"status":"ok"}` ;
- `https://votre-domaine/api/health?controle=<clé>` rejoue chaque étape d'un envoi de fichier depuis le serveur en service (écriture, relecture, adresse signée, fiche en base) et nomme celle qui échoue. La clé se calcule à partir de `APP_SECRET` : `node -e 'console.log(require("crypto").createHmac("sha256", process.env.APP_SECRET).update("health:storage").digest("hex").slice(0,24))'`. Le contrôle fait au moment de la construction ne suffit pas : il ne tourne pas dans le serveur Next.js ;
- connexion avec le compte super administrateur ;
- **Gestion → Intégrations** : chaque ligne reflète ce qui est réellement configuré.
