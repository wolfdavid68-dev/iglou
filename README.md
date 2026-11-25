# Iglou

Inventaire partagé du frigo et du congélateur, par « maisons » : chaque membre voit en direct ce qu'il reste, ce qui manque, et la liste de courses qui en découle.

- **Stack** : Expo SDK 57 · React Native 0.86 · Expo Router · Uniwind (Tailwind 4) · Convex (base de données temps réel + Convex Auth) · PWA hébergée sur un VPS Hostinger (Caddy).
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

## Publication

La GitHub Action [`publier-pwa.yml`](.github/workflows/publier-pwa.yml) (« Publier iglou ») publie tout à chaque fusion sur `master` : vérifications (types, lint, tests), serveur Convex de production (`npx convex deploy`, si le secret `CONVEX_DEPLOY_KEY` existe), puis la PWA. Elle se relance à la main depuis l'onglet **Actions** → *Publier iglou* → *Run workflow*, et une session Claude Code peut la lancer de la même façon (voir `AGENTS.md`).

### Site web sur le VPS Hostinger

La PWA et les pages publiques sont servies par le VPS (`2.25.12.11`) à l'adresse **https://iglou.mediurg.systems**, par [Caddy](https://caddyserver.com) (HTTPS automatique) :

1. L'action construit le site (`npx expo export -p web`, puis [`scripts/paquet-web.sh`](scripts/paquet-web.sh)) et le dépose dans la release **`site-web`** du dépôt (ne pas la supprimer).
2. Sur le VPS, `iglou-maj` vérifie toutes les 2 minutes si la version a changé, contrôle l'empreinte, installe la nouvelle version et bascule d'un coup (les 3 dernières sont gardées).

Aucune clé n'est nécessaire : ni clé du VPS dans GitHub, ni clé GitHub sur le VPS.

**Installation (une fois)** : dans hPanel → VPS → *Terminal* (ou en SSH, en root) :

```bash
curl -fsSL https://raw.githubusercontent.com/wolfdavid68-dev/iglou/master/deploy/vps/installer.sh | bash -s -- iglou.mediurg.systems
```

Le script ([`deploy/vps/installer.sh`](deploy/vps/installer.sh)) installe Caddy, sa configuration (adresses sans `.html`, fiches `/aliment/…`, `/appareil/…`, `/recette/…`, page 404) et la mise à jour automatique. Le relancer est sans danger. Si Tailscale tourne sur le VPS, Caddy n'écoute que sur les adresses publiques (Tailscale garde son port 443) ; `IGLOU_ECOUTE="…"` permet de forcer les adresses. Le DNS `iglou.mediurg.systems` → `2.25.12.11` est géré dans hPanel (zone DNS de `mediurg.systems`).

Sur le VPS : `systemctl status iglou-maj.timer` (mises à jour), `journalctl -u iglou-maj` (journal), `sudo iglou-maj` (forcer une vérification).

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
