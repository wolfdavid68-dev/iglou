# Iglou

Inventaire partagé du frigo et du congélateur, par « maisons » : chaque membre voit en direct ce qu'il reste, ce qui manque, et la liste de courses qui en découle.

- **Stack** : Expo SDK 57 · React Native 0.86 · Expo Router · Uniwind (Tailwind 4) · **Convex** pour tout le reste : base de données temps réel, comptes (Convex Auth), hébergement du site web.
- **Cahier des charges** : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).
- **Sécurité** : l'app ne contient que l'adresse publique du serveur. Aucun identifiant admin. Toutes les autorisations sont vérifiées côté serveur, dans [`convex/`](convex/) (voir `convex/lib.ts`).

## Démarrer

```bash
npm install
npx convex dev      # 1re fois : connexion, création du projet Convex (choisir la région Europe)
npm run cles       # 1re fois : clés de connexion (JWT_PRIVATE_KEY, JWKS) du déploiement de dev
npx expo start      # dans un autre terminal
```

`npx convex dev` envoie le dossier `convex/` sur le déploiement de dev et écrit `EXPO_PUBLIC_CONVEX_URL` et `EXPO_PUBLIC_CONVEX_SITE_URL` dans `.env.local` (lus par Expo). Laisser tourner pendant le développement.

- **Aperçu web** (le plus rapide) : touche `w`, puis http://localhost:8081.
  Pour entrer directement dans l'app, ajouter dans `.env.local` un compte **de test** : `EXPO_PUBLIC_DEV_EMAIL=…` et `EXPO_PUBLIC_DEV_MDP=…`.
- **Téléphone Android** : l'app utilise des modules natifs (stockage sécurisé, SQLite), elle ne tourne donc pas dans Expo Go. Il faut un *development build* :

  ```bash
  npx eas-cli@latest build -p android --profile development
  ```

  Installer l'APK obtenu, puis `npx expo start` et scanner le QR code.

- **Mot de passe oublié en développement** : sans clé Resend, le code à 8 chiffres apparaît dans les journaux Convex (`npx convex logs`).

## Vérifications

```bash
npx tsc --noEmit        # typage
npx expo lint           # lint
npm test                # logique métier (Jest)
npm run test:serveur    # règles d'accès, comptes, mots de passe, transfert (Vitest + convex-test, sans réseau)
```

## Mise en production

### 1. Serveur et site web

```bash
npx convex deploy             # 1re fois : crée le déploiement de production (région Europe)
npm run cles -- --prod        # 1re fois : clés de connexion de production
npm run deploy                # serveur + site web (PWA et pages publiques), en une commande
```

Le site est alors servi par Convex à l'adresse `https://<deploiement>.convex.site` :
`/` (PWA), `/confidentialite`, `/suppression-compte`, `/presentation`. **Mettre à jour ces deux liens dans la Play Console** (politique de confidentialité et suppression de compte) : l'ancienne adresse `iglou.web.app` disparaîtra avec Firebase.

### 2. Variables du déploiement Convex de production

Dans le tableau de bord Convex (*Settings → Environment variables*) ou avec `npx convex env set --prod NOM valeur` :

| Variable | Rôle |
| --- | --- |
| `JWT_PRIVATE_KEY`, `JWKS` | Clés de connexion (posées par `npm run cles -- --prod`). |
| `AUTH_RESEND_KEY` | Clé API [Resend](https://resend.com) pour envoyer les codes « mot de passe oublié ». |
| `AUTH_EMAIL_FROM` | Expéditeur, ex. `Iglou <noreply@iglou.biz>` (domaine à vérifier dans Resend). |
| `FIREBASE_SCRYPT_SIGNER_KEY`, `FIREBASE_SCRYPT_SALT_SEPARATOR`, `FIREBASE_SCRYPT_ROUNDS`, `FIREBASE_SCRYPT_MEM_COST` | Paramètres de hachage des mots de passe Firebase, pour que les comptes transférés gardent leur mot de passe. Console Firebase → Authentication → ⋮ (au-dessus de la liste des utilisateurs) → *Paramètres de hachage du mot de passe*. |

### 3. Builds Android (EAS)

Les builds ont besoin de l'adresse du déploiement de **production** (le fichier `.env.local` n'est pas envoyé à EAS) :

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_CONVEX_URL --value https://<deploiement>.convex.cloud --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_CONVEX_SITE_URL --value https://<deploiement>.convex.site --environment production --visibility plaintext
```

Faire de même pour `preview` et `development` (ou depuis expo.dev → projet → *Environment variables*).

| Profil | Résultat | Commande |
| --- | --- | --- |
| `development` | APK avec dev client | `npx eas-cli@latest build -p android --profile development` |
| `preview` | APK installable directement | `npx eas-cli@latest build -p android --profile preview` |
| `production` | AAB pour le Play Store | `npx eas-cli@latest build -p android --profile production` |

Le nom de paquet `biz.iglou` est **provisoire** : à changer dans `app.json` avant la première publication (il ne pourra plus changer ensuite sur le Play Store).

## Transfert depuis Firebase (une fois)

Le script [`scripts/transfert-convex.mts`](scripts/transfert-convex.mts) lit tout Firebase **sans rien y modifier** et le copie dans Convex :

- toutes les données Firestore (maisons, membres, inventaire, courses, historique, profils, signalements), avec leurs ids ;
- tous les comptes Firebase Authentication (e-mail, prénom, empreinte du mot de passe), avec leur uid.

Chacun se reconnecte donc avec **son e-mail et son mot de passe habituels**, et retrouve ses maisons. Node 22.18 ou plus récent.

1. Console Firebase → Paramètres du projet → **Comptes de service** → *Générer une nouvelle clé privée*. Garder le fichier **hors du dépôt**.
2. Poser les variables `FIREBASE_SCRYPT_*` (tableau ci-dessus) sur le déploiement visé.
3. Essai sur le déploiement de dev :

   ```bash
   npm run transfert -- --cle ../cle-firebase.json --importer
   ```

   Le script écrit `transfert/*.jsonl` (ignoré par git), importe chaque table avec `npx convex import --replace`, puis crée les comptes (`transfert:creerComptes`). Relancer recommence proprement : les données sont remplacées, les comptes déjà créés sont gardés.
4. Production : après `npm run deploy`, la même commande avec `--prod` en plus. À faire juste avant de publier la nouvelle version de l'app : ce qui serait écrit dans Firebase après coup ne serait pas transféré.
5. Vérifier, puis supprimer la clé de compte de service (fichier et clé dans la console) et, quand tout va bien, le projet Firebase.

À la première connexion de chaque utilisateur, son ancien mot de passe Firebase est ré-enregistré au format Convex. `npx convex run --prod transfert:restantsAConvertir` indique combien de comptes ne se sont pas encore reconnectés. Une fois le transfert fait, on peut retirer le script, `firebase-admin` et la table de transit ; le code de vérification des anciens mots de passe (`convex/motsDePasse.ts`) peut partir quand ce nombre est à 0 (les retardataires utiliseront « Mot de passe oublié »).

### Faire faire le transfert par Claude (session cloud)

Ajouter ces variables dans les réglages de l'environnement cloud (menu de l'environnement dans la barre de titre de la session → *Edit* → variables / secrets), puis ouvrir une nouvelle session et demander « fais le transfert vers Convex » :

| Variable | Où la trouver |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | Tableau de bord Convex → projet → déploiement de **production** → *Settings* → *Deploy keys* (créer le projet en région Europe d'abord). |
| `FIREBASE_SERVICE_ACCOUNT` | Contenu complet du fichier JSON de clé de compte de service Firebase (étape 1 ci-dessus). |
| `FIREBASE_SCRYPT_SIGNER_KEY`, `FIREBASE_SCRYPT_SALT_SEPARATOR`, `FIREBASE_SCRYPT_ROUNDS`, `FIREBASE_SCRYPT_MEM_COST` | Console Firebase → Authentication → ⋮ → *Paramètres de hachage du mot de passe*. |
| `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` (facultatif) | Compte Resend, pour « Mot de passe oublié ». |

Ne jamais coller ces valeurs dans la conversation.

## Organisation du code

```
src/
  app/          routes Expo Router (un fichier = un écran)
    (auth)/       connexion, inscription, mot de passe oublié
    (maisons)/    choisir, créer, rejoindre une maison
    (app)/        onglets Maison / Courses / Recherche / Réglages, fiches appareil et aliment
  composants/   composants d'interface réutilisables
  domaine/      logique métier pure, testée (quantités, courses, import/export…)
  services/     session (Convex Auth), maisons, inventaire, dialogues, fichiers
convex/        serveur : schéma, comptes, règles d'accès, requêtes, mutations, site web (http.ts)
public/        pages publiques et fichiers de la PWA
scripts/       build du site, transfert unique depuis Firebase
tests/serveur/ tests du serveur Convex et du transfert
```

## À tester à la main sur téléphone

- Glisser-déposer d'une carte entre tiroirs et vers la corbeille (vibrations, défilement automatique).
- Feuille de partage Android (code d'invitation, liste de courses, export JSON).
- Mode hors ligne : couper le réseau, modifier, puis le rétablir. Les modifications faites hors ligne s'affichent tout de suite et partent au retour du réseau **tant que l'app reste ouverte**. Au démarrage sans réseau, l'app affiche le dernier état connu.
- Connexion d'un compte transféré avec son ancien mot de passe ; « Mot de passe oublié » (réception du code).
