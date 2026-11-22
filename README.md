# Iglou

Inventaire partagé du frigo et du congélateur, par « maisons » : chaque membre voit en direct ce qu'il reste, ce qui manque, et la liste de courses qui en découle.

- **Stack** : Expo SDK 57 · React Native 0.86 · Expo Router · Uniwind (Tailwind 4) · Convex (base de données temps réel + Convex Auth) · PWA hébergée sur Firebase Hosting.
- **Cahier des charges** : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).
- **Sécurité** : l'app ne contient que l'adresse publique du serveur Convex. Toutes les autorisations sont vérifiées côté serveur, dans les fonctions du dossier [`convex/`](convex/) (voir `convex/acces.ts`).

## Démarrer

```bash
npm install
npx convex dev      # serveur Convex (1re fois : connexion + création du projet)
npx expo start      # dans un second terminal
```

- **Aperçu web** (le plus rapide) : touche `w`, puis http://localhost:8081.
  Pour entrer directement dans l'app sans passer par la connexion, copier `.env.example` en `.env.local` et y mettre un compte **de test**.
- **Téléphone Android** : l'app utilise des modules natifs, elle ne tourne donc pas dans Expo Go. Il faut un *development build* (à refaire depuis le passage à Convex : les modules Firebase natifs ont été retirés) :

  ```bash
  npx eas-cli@latest build -p android --profile development
  ```

  Installer l'APK obtenu, puis `npx expo start` et scanner le QR code.

## Vérifications

```bash
npx tsc --noEmit        # typage
npx expo lint           # lint
npm test                # logique métier (Jest)
```

## Builds

| Profil | Résultat | Commande |
| --- | --- | --- |
| `development` | APK avec dev client | `npx eas-cli@latest build -p android --profile development` |
| `preview` | APK installable directement | `npx eas-cli@latest build -p android --profile preview` |
| `production` | AAB pour le Play Store | `npx eas-cli@latest build -p android --profile production` |

## À configurer dans Convex (une fois)

1. `npx convex dev` : crée le projet et écrit `EXPO_PUBLIC_CONVEX_URL` dans `.env.local`.
2. `npx @convex-dev/auth` : clés de session de Convex Auth (`SITE_URL` = `https://iglou.web.app`).
3. `npx convex env set GMAIL_ADRESSE …` et `npx convex env set GMAIL_MOT_DE_PASSE_APP …` : envoi des codes « Mot de passe oublié » depuis une adresse Gmail ([mot de passe d'application](https://myaccount.google.com/apppasswords), validation en deux étapes requise).
4. Production : `npx convex deploy`, et la même configuration avec `--prod`.
5. **Reprise des données Firebase** (comptes compris) : suivre [`scripts/transfert/LISEZMOI.md`](scripts/transfert/LISEZMOI.md).

Le nom de paquet Android `biz.iglou` est **provisoire** : à changer dans `app.json` avant la première publication (il ne pourra plus changer ensuite sur le Play Store).

La PWA est hébergée sur Firebase Hosting (https://iglou.web.app). Elle se publie **automatiquement** à chaque fusion sur `master` (GitHub Action [`publier-pwa.yml`](.github/workflows/publier-pwa.yml) : vérifications, `npx expo export -p web`, puis déploiement). Elle peut aussi se relancer à la main depuis l'onglet Actions. Secret requis : `FIREBASE_SERVICE_ACCOUNT_CONGELATEUR_V91VD`. Publication manuelle possible : `npx expo export -p web` puis `npx firebase-tools deploy --only hosting`.

## Organisation du code

```
src/
  app/          routes Expo Router (un fichier = un écran)
    (auth)/       connexion, inscription, mot de passe oublié
    (maisons)/    choisir, créer, rejoindre une maison
    (app)/        onglets Maison / Courses / Recherche / Réglages, fiches appareil et aliment
  composants/   composants d'interface réutilisables
  domaine/      logique métier pure, testée (quantités, courses, import/export…)
  services/     Convex, session, maisons, inventaire, dialogues, fichiers
convex/         serveur : schéma, fonctions, autorisations, Convex Auth
scripts/transfert/  reprise unique des données Firebase
```

## À tester à la main sur téléphone

- Glisser-déposer d'une carte entre tiroirs et vers la corbeille (vibrations, défilement automatique).
- Feuille de partage Android (code d'invitation, liste de courses, export JSON).
- Mode hors ligne : couper le réseau, modifier, puis le rétablir.
