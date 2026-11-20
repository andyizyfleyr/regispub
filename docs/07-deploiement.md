# Mise en ligne : Neon, Vercel, Cloudflare R2

Ce guide décrit la mise en ligne telle qu'elle est prévue par le code. Aucune clé ne doit être écrite dans le dépôt.

Seules quelques variables sont à définir dans le projet Vercel (§ 2). Toutes les autres clés (paiement, stockage, e-mails, WhatsApp, API publicitaires) se saisissent ensuite dans le site : **Gestion → Paramètres → Clés et connexions** (§ 3).

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
| `APP_URL` | Facultatif sur Vercel. À renseigner avec votre propre domaine dès qu'il est branché (liens des e-mails, webhook) |

Seule la branche de production du projet (par défaut `main`) est déployée en production automatiquement. Les autres branches donnent des déploiements de prévisualisation, protégés par la connexion Vercel et sans accès à la base.

## 3. Clés et connexions (dans le site)

Page **Gestion → Paramètres → Clés et connexions**, réservée au super administrateur. Une carte par service : paiement Mobile Money, stockage des fichiers, e-mails, messages WhatsApp, statistiques publicitaires.

- Une valeur enregistrée est prise en compte en quelques secondes, sans nouveau déploiement.
- Les clés sont chiffrées en base (AES-256-GCM, clé dérivée de `APP_SECRET`) et ne sont plus jamais affichées : seuls leurs quatre derniers caractères sont rappelés. Pour en changer, coller la nouvelle ; pour la retirer, cocher « Effacer cette clé ».
- Une valeur saisie dans le site passe avant la variable Vercel du même nom. Les variables déjà définies chez Vercel restent donc valables tant que rien n'est saisi (mention « Valeur de Vercel »), et reprennent la main si la clé est effacée.
- Un enregistrement qui couperait un service est refusé : FedaPay sans clé secrète, clé de test en mode réel, stockage S3 incomplet, e-mails activés sans clé.
- Chaque enregistrement est inscrit au journal d'audit (`keys.updated`) avec le nom des clés modifiées, jamais leur valeur.

Restent obligatoirement chez Vercel : `DATABASE_URL` / `DIRECT_URL` (les clés sont rangées dans cette base), `APP_SECRET` (il sert à les chiffrer : s'il change, les clés enregistrées deviennent illisibles et sont à ressaisir) et `CRON_SECRET` (envoyé par Vercel avec les tâches planifiées).

## 4. Stockage des fichiers (Cloudflare R2)

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

### Saisir les valeurs

Carte **Stockage des fichiers** de la page Clés et connexions :

| Champ | Valeur |
| --- | --- |
| Stockage utilisé | Espace compatible S3 |
| Adresse du service | `https://<identifiant-du-compte>.r2.cloudflarestorage.com` (sans le nom du bucket) |
| Région | `auto` |
| Nom de l'espace | `regispub` |
| Identifiant de clé d'accès | Access Key ID |
| Clé d'accès secrète | Secret Access Key |

Pour vérifier que les clés, le nom du bucket et la règle CORS sont corrects : contrôle `/api/health?controle=<clé>` (§ 6), ou journal de build du déploiement suivant, qui se termine par « Stockage : opérationnel ».

Changer d'espace ne déplace pas les fichiers déjà envoyés : ils restent dans l'ancien.

### Comment circulent les fichiers

Les fonctions Vercel refusent les requêtes de plus de 4,5 Mo. Le site s'y adapte :

- les photos de plus de 1,5 Mo sont réduites dans le navigateur avant l'envoi (2 560 px au plus, JPEG) ;
- jusqu'à 4 Mo, le fichier passe par le site (`POST /api/files`) ;
- au-delà (vidéos surtout), le navigateur demande une adresse signée (`POST /api/files/direct`), envoie le fichier directement au bucket, puis le site relit l'objet reçu : taille réelle et signature binaire sont vérifiées avant de créer la fiche, et un fichier non conforme est supprimé.

## 5. Paiements (FedaPay)

1. Créer le compte marchand FedaPay et récupérer la clé secrète.
2. Dans FedaPay, déclarer le webhook `https://votre-domaine/api/webhooks/payments/fedapay` et copier son secret de signature.
3. Carte **Paiement Mobile Money** de la page Clés et connexions : prestataire « FedaPay », mode « Test » puis « Réel », clé secrète, secret du webhook.
4. Dans la même carte, remettre « Simulation sur le site en ligne » sur « Interdite ».

## 6. Vérifier après chaque mise en ligne

- `https://votre-domaine/api/health` répond `{"status":"ok"}` ;
- `https://votre-domaine/api/health?controle=<clé>` rejoue chaque étape d'un envoi de fichier depuis le serveur en service (écriture, relecture, adresse signée, fiche en base) et nomme celle qui échoue. La clé se calcule à partir de `APP_SECRET` : `node -e 'console.log(require("crypto").createHmac("sha256", process.env.APP_SECRET).update("health:storage").digest("hex").slice(0,24))'`. Le contrôle fait au moment de la construction ne suffit pas : il ne tourne pas dans le serveur Next.js ;
- connexion avec le compte super administrateur ;
- **Gestion → Intégrations** : chaque ligne reflète ce qui est réellement configuré.
