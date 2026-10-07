# Iglou

Inventaire partagé du frigo et du congélateur, par « maisons » : chaque membre voit en direct ce qu'il reste, ce qui manque, et la liste de courses qui en découle.

- **Stack** : Expo SDK 57 · React Native 0.86 · Expo Router · Uniwind (Tailwind 4) · Firebase (Auth + Firestore, cache hors ligne).
- **Cahier des charges** : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).
- **Sécurité** : l'app ne contient que la configuration publique Firebase. Aucun identifiant admin / compte de service. Toutes les autorisations sont dans [`firestore.rules`](firestore.rules).

## Démarrer

```bash
npm install
npx expo start
```

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
npm run test:regles     # règles Firestore sur l'émulateur (Java 21 requis)
```

## Builds

| Profil | Résultat | Commande |
| --- | --- | --- |
| `development` | APK avec dev client | `npx eas-cli@latest build -p android --profile development` |
| `preview` | APK installable directement | `npx eas-cli@latest build -p android --profile preview` |
| `production` | AAB pour le Play Store | `npx eas-cli@latest build -p android --profile production` |

## À configurer dans Firebase (une fois)

1. **Authentication** → Méthodes de connexion → activer **E-mail/Mot de passe**.
2. **Firestore** : créer la base (région `eur3`), puis déployer règles et index :

   ```bash
   npx firebase-tools deploy --only firestore
   ```

3. **Android** : le fichier `google-services.json` doit correspondre au paquet `biz.iglou`.
   Le nom de paquet est **provisoire** : à changer dans `app.json` *et* dans Firebase avant la première publication (il ne pourra plus changer ensuite sur le Play Store).
4. **Empreintes SHA** : après le premier build EAS, ajouter les SHA-1/SHA-256 (`npx eas-cli@latest credentials`) dans les paramètres du projet Firebase.

## Organisation du code

```
src/
  app/          routes Expo Router (un fichier = un écran)
    (auth)/       connexion, inscription, mot de passe oublié
    (maisons)/    choisir, créer, rejoindre une maison
    (app)/        onglets Maison / Courses / Recherche / Réglages, fiches appareil et aliment
  composants/   composants d'interface réutilisables
  domaine/      logique métier pure, testée (quantités, courses, import/export…)
  services/     Firebase, session, maisons, inventaire, dialogues, fichiers
tests/regles/  tests des règles Firestore (émulateur)
```

## À tester à la main sur téléphone

- Glisser-déposer d'une carte entre tiroirs et vers la corbeille (vibrations, défilement automatique).
- Feuille de partage Android (code d'invitation, liste de courses, export JSON).
- Mode hors ligne : couper le réseau, modifier, puis le rétablir.
