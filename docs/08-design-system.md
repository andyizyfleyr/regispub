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
