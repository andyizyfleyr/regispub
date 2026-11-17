# Design system

Règles : icônes linéaires (lucide), peu de texte, coins arrondis, beaucoup d'espace, une seule grille de tuiles par page. Couleurs et animations : `src/app/globals.css`.

| Besoin | Composant | Fichier |
| --- | --- | --- |
| Interrupteur, case à cocher, ligne de réglage | `Switch`, `Checkbox`, `ToggleRow` | `src/components/ui/controls.tsx` |
| Curseur | `Slider` | `src/components/ui/controls.tsx` |
| Calendrier | `DatePicker` | `src/components/ui/controls.tsx` |
| Infobulle | `Tip`, `InfoTip` | `src/components/ui/controls.tsx` |
| Menu déroulant (s'écrit comme un `<select>`) | `Select` | `src/components/ui/select.tsx` |
| Champ, saisie | `Field`, `Input`, `Textarea` | `src/components/ui/form.tsx` |
| Étiquette de statut | `Badge`, `CampaignStatusBadge` | `src/components/ui/badge.tsx` |
| Carte, tuile, chiffre clé, bandeau | `Card`, `Tile`, `StatTile`, `Banner` | `src/components/ui/card.tsx`, `tile.tsx` |
| Liste | `List`, `ListRow` | `src/components/ui/list.tsx` |
| Ligne de campagne | `CampaignRow` | `src/components/app/campaign-row.tsx` |
| Tableau (fiches sur téléphone) | `Table` | `src/components/ui/misc.tsx` |
| Chiffre clé du back-office | `Stat` | `src/components/ui/misc.tsx` |
| Carrousel | `Carousel` | `src/components/ui/carousel.tsx` |
| Fil chronologique | `Timeline` | `src/components/ui/timeline.tsx` |
| Étapes | `Stepper`, `StepTile` | `src/components/wizard/parts.tsx`, `tile.tsx` |
| Fenêtre (panneau du bas sur téléphone) | `Dialog`, `DialogContent` | `src/components/ui/dialog.tsx` |
| Message temporaire | `toast` (sonner) | `src/app/layout.tsx` |
| Chargement | `loading.tsx` (squelettes), classe `skeleton` | `src/app/app/loading.tsx` |
| Écran vide illustré | `EmptyState` (`art`) | `src/components/ui/misc.tsx` |
| Tirer pour actualiser | `PullToRefresh` | `src/components/ui/pull-to-refresh.tsx` |
| Écrans de bienvenue | `Onboarding` | `src/components/app/onboarding.tsx` |

Illustrations 3D : `public/img/3d/*.webp` (fond blanc, à afficher avec `mix-blend-multiply`).

## Alignement sur téléphone

Dans une même section, chaque ligne a la même forme : titre sous titre, précision sous précision, état sous état.

- `ListRow` : pictogramme de largeur fixe, puis deux lignes. À gauche le titre (`title`) et la précision (`subtitle`), sur une ligne chacun, coupés par « … » s'ils sont trop longs. À droite `value` (montant) en face du titre et `meta` (état) en face de la précision. Ne rien placer avant le titre dont la largeur change d'une ligne à l'autre.
- `CampaignRow` : nom et état sur la première ligne, objectif, budget et réseaux sur la seconde. L'état utilise le libellé court (`STATUS_META[...].short`).
- `Table` : sous 640 px, une fiche par ligne. La première colonne fait le titre, les autres s'empilent « libellé à gauche, valeur à droite ». Options : `mobileCorner={n}` place la colonne d'état en haut à droite ; `mobileHide={[n]}` masque des colonnes ; une colonne sans en-tête (boutons) se cale en bas à droite ; `data-empty` sur une cellule la masque ; `mobile="fit"` garde un vrai tableau resserré (série de chiffres par jour) ; `mobile="scroll"` garde le tableau à faire défiler. Les règles sont dans `globals.css` (`.table-stack`, `.table-fit`).
- `Stat`, `StatTile` : libellé, valeur et précision sur une ligne chacun, pour que les cartes d'une grille aient la même hauteur. Les grilles de tuiles portent `auto-rows-fr`.
- Marges intérieures des cartes : `px-4` sur téléphone, `sm:px-5` au-delà, pour l'en-tête comme pour les lignes.


## Aspect général (refonte de novembre 2026)

Règles à garder pour que toutes les pages se ressemblent.

- **Fond et surfaces.** Les espaces connectés sont posés sur `bg-canvas` (gris-vert très clair). Tout contenu vit dans une surface blanche (`bg-surface`) : `Card`, `List`, `Tile`, `StatTile`, `EmptyState`. Bordure très légère (`border-line/70`) et ombre douce (`shadow-card`) ; pas de trait gris épais, pas de bordure en pointillés.
- **Rayons.** 20 px pour les cartes et listes (`rounded-lg` / `rounded-xl`), 28 px pour les bandeaux de marque, 14 px pour les vignettes d'icône, pilule (`rounded-full`) pour les boutons, filtres, onglets et badges.
- **Boutons.** Toujours en pilule. Tailles `sm` 36 px, `md` 44 px, `lg` 52 px. Une seule action `accent` (orange) par écran ; les autres en `primary`, `outline` ou `soft`.
- **Champs.** 48 px de haut. Les couleurs viennent de `--field-bg` / `--field-line` : blanc avec un trait sur le fond de page, gris clair sans trait à l'intérieur d'une surface blanche. Ne pas remettre de `border` à la main.
- **Lignes de liste.** Une vignette de 44 px à gauche (`ListRow icon` ou `PlatformAvatar` pour une campagne), titre en gras, description en gris dessous, valeur et badge à droite. Tons de vignette : `green`, `marigold`, `sky`, `violet`, `rose`, `clay`, `forest`, `neutral`.
- **Titres.** Titre de page 28 px (34 px sur ordinateur), titre de section 18 px, tous en police d'affichage.
- **Bandeau de marque.** Fond vert profond (`bg-brand` + `bg-grid`), un seul par page : accueil, total payé, « Un expert s'en charge », pages de connexion.
- **Navigation client sur téléphone.** Barre flottante en pilule, bouton « + » orange au centre, onglet actif en pilule vert foncé. Le contenu garde `pb-32` pour ne pas passer dessous.
- **Filtres et onglets.** `TabsNav` et `FilterChips` : pilules blanches, l'élément actif en vert foncé.
