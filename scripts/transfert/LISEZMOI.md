# Transfert Firebase → Convex

Ces étapes recopient **toutes** les données de Firebase vers Convex :

- les maisons ;
- leurs membres, appareils, tiroirs et aliments ;
- les courses, l'historique des sorties et les signalements ;
- les **comptes**, avec leurs mots de passe actuels.

Chacun se reconnecte ensuite avec son e-mail et son mot de passe habituels.

Firebase n'est que lu : rien n'y est modifié ni supprimé. Vous pourrez le
supprimer vous-même plus tard, une fois Convex vérifié.

Toutes les commandes se lancent dans un terminal ouvert à la racine du projet,
sauf mention contraire.

---

## 1. Créer le projet Convex

```bash
npx convex dev
```

La première fois, la commande :

- vous connecte à Convex ;
- crée le projet ;
- écrit l'adresse du serveur dans `.env.local` (`EXPO_PUBLIC_CONVEX_URL`) ;
- envoie les fonctions du dossier `convex/`.

Laissez-la tourner pendant le développement.

Pour la production (la PWA en ligne), ouvrez le tableau de bord Convex
(`npx convex dashboard`) et notez l'adresse du déploiement **Production**.
Envoyez les fonctions vers la production avec `npx convex deploy`.

## 2. Configurer la connexion (Convex Auth)

```bash
npx @convex-dev/auth
```

Répondez `https://iglou.web.app` quand l'adresse du site (`SITE_URL`) est
demandée. La commande génère les clés de session (`JWT_PRIVATE_KEY`, `JWKS`).

**E-mails « Mot de passe oublié »** : ils partent d'une adresse Gmail. Activez
la validation en deux étapes sur ce compte Google, créez un mot de passe
d'application sur https://myaccount.google.com/apppasswords, puis :

```bash
npx convex env set GMAIL_ADRESSE votre-adresse@gmail.com
npx convex env set GMAIL_MOT_DE_PASSE_APP "abcd efgh ijkl mnop"
```

## 3. Reprendre les paramètres de hachage des mots de passe

Firebase chiffre les mots de passe avec des paramètres propres à votre projet.
Convex en a besoin pour reconnaître les mots de passe actuels.

1. Console Firebase → **Authentication** → onglet **Users**.
2. Menu **⋮** au-dessus de la liste → **Password hash parameters**.
3. Recopiez les quatre valeurs :

```bash
npx convex env set FIREBASE_SIGNER_KEY "valeur base64_signer_key"
npx convex env set FIREBASE_SALT_SEPARATOR "valeur base64_salt_separator"
npx convex env set FIREBASE_ROUNDS 8
npx convex env set FIREBASE_MEM_COST 14
```

`8` et `14` sont des exemples : prenez `rounds` et `mem_cost` tels qu'affichés.

## 4. Exporter Firebase

1. Console Firebase → **Paramètres du projet** (roue dentée) → **Comptes de
   service** → **Générer une nouvelle clé privée**.
2. Enregistrez le fichier dans `scripts/transfert/cle-service.json`. Il est
   ignoré par git : **ne le partagez jamais**.

Puis :

```bash
cd scripts/transfert
npm install
node exporter.mjs cle-service.json
```

Les fichiers apparaissent dans `scripts/transfert/export/`, un par table. Ils
contiennent des données personnelles et sont ignorés par git.

## 5. Importer dans Convex

Toujours dans `scripts/transfert` :

```bash
node importer.mjs
```

Ajoutez `--prod` pour la production : `node importer.mjs --prod`. Pour la
production, les étapes 2 et 3 doivent aussi être faites avec `--prod` (par
exemple `npx convex env set --prod GMAIL_ADRESSE …`).

Le script fait trois choses :

1. Il importe chaque table.
2. Il crée les comptes, 200 par passage, jusqu'au dernier.
3. Il affiche le nombre de documents par table.

Comparez ce bilan avec les chiffres donnés par l'export. La table
`transfertComptes` doit finir à 0.

Le script se relance sans risque : chaque table est remplacée, et un compte
déjà créé n'est pas recréé.

Les mêmes opérations à la main :

```bash
npx convex import --table maisons --replace -y export/maisons.jsonl
npx convex run transfert:finaliserComptes
npx convex run transfert:bilan
```

Pour l'import, répétez la commande pour chaque fichier de `export/`.
Relancez `transfert:finaliserComptes` tant qu'il répond « relancer ».

## 6. Vérifier

1. Lancez l'app (`npx expo start`).
2. Connectez-vous avec un compte existant et son mot de passe habituel.
3. Vérifiez que les maisons, les aliments et les courses sont là.

**Comptes sans mot de passe** : ils passent par « Mot de passe oublié ». Il
s'agit des comptes créés autrement qu'avec e-mail et mot de passe ; l'export
indique leur nombre.

**Pendant le transfert** : ce qui est saisi dans l'ancienne version de l'app
après l'export n'est pas recopié. Faites l'export juste avant de publier la
nouvelle version, ou relancez les étapes 4 et 5 juste avant.
