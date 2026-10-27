# Iglou

Inventaire partagé du frigo et du congélateur, par « maisons » : chaque membre voit en direct ce qu'il reste, ce qui manque, et la liste de courses qui en découle.

- **Stack** : Expo SDK 57 · React Native 0.86 · Expo Router · Uniwind (Tailwind 4) · **Convex** (base de données temps réel) · Firebase Authentication (comptes).
- **Cahier des charges** : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).
- **Sécurité** : l'app ne contient que des configurations publiques (adresse Convex, config Firebase). Aucun identifiant admin. Toutes les autorisations sont vérifiées côté serveur, dans [`convex/`](convex/) (voir `convex/lib.ts`).

Les comptes restent sur Firebase Authentication : Convex accepte directement les jetons d'identité Firebase (`convex/auth.config.ts`). Les utilisateurs gardent donc leur e-mail et leur mot de passe.

## Démarrer

```bash
npm install
npx convex dev      # 1re fois : connexion, création du projet Convex (choisir la région Europe)
npx expo start      # dans un autre terminal
```

`npx convex dev` envoie les fonctions du dossier `convex/` sur le déploiement de dev et écrit `EXPO_PUBLIC_CONVEX_URL` dans `.env.local` (lu par Expo). Laisser tourner pendant le développement.

- **Aperçu web** (le plus rapide) : touche `w`, puis http://localhost:8081.
  Pour entrer directement dans l'app sans passer par la connexion, copier `.env.example` en `.env.local` et y mettre un compte **de test**.
- **Téléphone Android** : l'app utilise des modules natifs (React Native Firebase), elle ne tourne donc pas dans Expo Go. Il faut un *development build* :

  ```bash
  npx eas-cli@latest build -p android --profile development
  ```

  Installer l'APK obtenu, puis `npx expo start` et scanner le QR code.

## Vérifications

```bash
npx tsc --noEmit        # typage
npx expo lint           # lint
npm test                # logique métier (Jest)
npm run test:serveur    # règles d'accès et fonctions Convex (Vitest + convex-test, sans réseau)
```

## Builds

Les builds ont besoin de l'adresse du déploiement Convex de **production** (une fois, après `npx convex deploy`) :

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_CONVEX_URL --value https://<deploiement>.convex.cloud --environment production --visibility plaintext
```

Faire de même pour les environnements `preview` et `development` (ou depuis expo.dev → projet → *Environment variables*). Le fichier `.env.local` n'est pas envoyé aux builds EAS.

| Profil | Résultat | Commande |
| --- | --- | --- |
| `development` | APK avec dev client | `npx eas-cli@latest build -p android --profile development` |
| `preview` | APK installable directement | `npx eas-cli@latest build -p android --profile preview` |
| `production` | AAB pour le Play Store | `npx eas-cli@latest build -p android --profile production` |

## Mettre en production le serveur Convex

```bash
npx convex deploy   # envoie schéma + fonctions sur le déploiement de production
```

Pour le site web (PWA, Firebase Hosting) : `EXPO_PUBLIC_CONVEX_URL=https://<deploiement>.convex.cloud npx expo export -p web`, puis `npx firebase-tools deploy --only hosting`.

## Transfert des données Firestore → Convex (une fois)

Le script [`scripts/transfert-convex.mts`](scripts/transfert-convex.mts) lit toute la base Firestore (sans rien y modifier) et la copie dans Convex. Les ids et les uid sont conservés : comptes, liens et maison mémorisée sur chaque téléphone restent valides. Node 22.18 ou plus récent.

1. Console Firebase → Paramètres du projet → **Comptes de service** → *Générer une nouvelle clé privée*. Garder le fichier **hors du dépôt**.
2. Essai sur le déploiement de dev :

   ```bash
   npm run transfert -- --cle ../cle-firebase.json --importer
   ```

   Le script écrit d'abord `transfert/*.jsonl` (ignoré par git), puis importe chaque table avec `npx convex import --replace`. Relancer remplace tout à nouveau.
3. Production : `npx convex deploy`, puis la même commande avec `--prod` en plus. À faire juste avant de publier la version Convex de l'app : ce qui serait écrit dans Firestore après coup ne serait pas transféré.
4. Supprimer la clé de compte de service (fichier et clé dans la console Firebase).

Firestore n'est plus utilisé par l'app : une fois le transfert vérifié, la base peut être supprimée dans la console Firebase.

## À configurer dans Firebase (une fois)

1. **Authentication** → Méthodes de connexion → activer **E-mail/Mot de passe**.
2. **Android** : le fichier `google-services.json` doit correspondre au paquet `biz.iglou`.
   Le nom de paquet est **provisoire** : à changer dans `app.json` *et* dans Firebase avant la première publication (il ne pourra plus changer ensuite sur le Play Store).
3. **Empreintes SHA** : après le premier build EAS, ajouter les SHA-1/SHA-256 (`npx eas-cli@latest credentials`) dans les paramètres du projet Firebase.

## Organisation du code

```
src/
  app/          routes Expo Router (un fichier = un écran)
    (auth)/       connexion, inscription, mot de passe oublié
    (maisons)/    choisir, créer, rejoindre une maison
    (app)/        onglets Maison / Courses / Recherche / Réglages, fiches appareil et aliment
  composants/   composants d'interface réutilisables
  domaine/      logique métier pure, testée (quantités, courses, import/export…)
  services/     session (Firebase Auth + Convex), maisons, inventaire, dialogues, fichiers
convex/        serveur : schéma, règles d'accès, requêtes et mutations
scripts/       transfert unique Firestore → Convex
tests/serveur/ tests du serveur Convex et du transfert
```

## À tester à la main sur téléphone

- Glisser-déposer d'une carte entre tiroirs et vers la corbeille (vibrations, défilement automatique).
- Feuille de partage Android (code d'invitation, liste de courses, export JSON).
- Mode hors ligne : couper le réseau, modifier, puis le rétablir. Les modifications faites hors ligne s'affichent tout de suite et partent au retour du réseau **tant que l'app reste ouverte** (Convex ne les garde pas sur le disque, contrairement à Firestore). Au démarrage sans réseau, l'app affiche le dernier état connu.
