# Charte visuelle d'Iglou : « électroménager haut de gamme »

Iglou doit avoir l'allure d'un bel appareil de cuisine : calme, précis, agréable
au toucher. Les **appareils illustrés** (frigo, congélateur, post-it) sont la
pièce forte de l'appli ; tout le reste se tient en retrait autour d'eux.

Skills utiles (dans `.claude/skills/`) : `expo-design-system` (jetons, composants,
« native slop »), `expo-native-ui`, `expo-animation`, `frontend-design`.
Les règles du projet l'emportent sur les skills : styles en **classes Tailwind
(Uniwind, `className`)**, jamais `StyleSheet` ; `boxShadow` passe par `style`.

## Couleurs

Jetons dans `src/global.css` (classes) **et** `src/theme/index.ts` (JS) : toujours
les deux, alignés. Aucune couleur en dur dans un écran.

| Rôle | Jeton | Usage |
|---|---|---|
| Fond | `bg-fond` (porcelaine froide / bleu nuit) | fond de tous les écrans |
| Surface | `bg-carte` + `border-contour` | cartes, listes groupées |
| Creux | `bg-carte-enfoncee` | rails, champs secondaires, tuiles d'icône |
| Encre | `text-encre`, `-2`, `-3` (ou `ton` de `Texte`) | textes |
| **Signature** | `bg-frigo-fort`, `text-frigo-texte` | actions principales, éléments actifs |
| Congélateur | `congelateur-*` | uniquement ce qui concerne le congélateur |
| États | `vert`, `orange`, `rouge` (`-texte`, `-pale`) | fraîcheur : bon, à surveiller, périmé |
| Courses | `courses-*` | quantités à racheter, badge ; plus de couleur d'écran |

- **Une seule couleur d'action** : le vert sapin. Plus d'orange ou d'ambre pour
  « habiller » un écran (onglets, en-têtes, boutons).
- Texte coloré : variantes `-texte`. Texte blanc : seulement sur `-fort`.
- Jamais de texte blanc sur le fond ou le voile d'en-tête (ils sont clairs en clair).

## Typographie

- **Bricolage Grotesque** (`poids="titre"` / `"titre-gras"` de `Texte`) : titres
  d'écran, titres de section, **grands chiffres** (compteurs, quantités clés).
- **Inter** (`normal`, `moyen`, `demi`, `gras`) : tout le reste.
- Pas de libellés en MAJUSCULES espacées ; phrases en minuscules.
- Chiffres alignés : `tabular-nums` (`style={{ fontVariant: ['tabular-nums'] }}`).

## Surfaces et relief

- Rayons hiérarchisés : grands panneaux 28 px, cartes 20 px (`rounded-[20px]`),
  contrôles 14–18 px, puces et boutons ronds `rounded-full`.
- Carte = `Carte` de `ui.tsx` (filet `border-contour` + ombre `c.ombre.carte` ;
  en sombre, filet seul). Relief marqué (`c.ombre.relief`) : modales, éléments
  flottants seulement.
- Pas de « tout est une carte » : regrouper les lignes dans **une** carte avec
  séparateurs (`Separateur`), plutôt qu'une carte par ligne.
- En-têtes : `EnTeteDegrade` = voile givré (`c.hero`, `c.heroFrigo`…) qui se fond
  dans le fond, titre à l'encre en Bricolage 34 px. Son contenu (`children`) est
  posé sur un fond **clair en mode clair** : utiliser les tons du thème, des
  tuiles `bg-carte` (avec `c.ombre.carte`) ou `bg-carte/80`.

## Toucher et mouvement

- Tout élément touchable a un retour visuel (`active:scale-[0.98]`,
  `active:bg-carte-enfoncee`, `active:opacity-…`).
- Retour haptique léger (`tic()` de `@/services/haptique`) sur les actions
  principales et les choix ; `choc()` réservé aux confirmations fortes.
- Mouvement seulement en réponse à un geste (ouvrir, cocher, retirer) ; pas
  d'animations d'entrée décoratives en cascade.

## Contrôles

- Cible tactile ≥ 48 dp (`CIBLE`).
- Choix exclusif : `Segments` (rail enfoncé, option en relief).
- Filtres : `Puce` ; compteurs : `PastilleCompte`.
- Les emoji restent pour les **aliments** (c'est le contenu) ; pour l'interface,
  des icônes (Ionicons / MaterialCommunityIcons).
