/**
 * Construit le site web (PWA + pages publiques) dans dist/.
 * Lancé par `npm run deploy` (@convex-dev/static-hosting), qui fournit
 * l'adresse du déploiement visé dans VITE_CONVEX_URL : on la passe à Expo.
 */
import { spawnSync } from 'node:child_process';

const url = process.env.VITE_CONVEX_URL || process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) {
  console.error('Adresse Convex inconnue : lancer via `npm run deploy`, ou définir EXPO_PUBLIC_CONVEX_URL.');
  process.exit(1);
}
const env = {
  ...process.env,
  EXPO_PUBLIC_CONVEX_URL: url,
  // Les pages publiques sont servies par le même déploiement, sur son domaine « .convex.site ».
  EXPO_PUBLIC_CONVEX_SITE_URL: process.env.VITE_CONVEX_URL
    ? url.replace(/\.convex\.cloud\/?$/, '.convex.site')
    : (process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? url.replace(/\.convex\.cloud\/?$/, '.convex.site')),
};
// --clear : sinon le cache de Metro peut garder l'adresse d'un autre déploiement.
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--clear'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
