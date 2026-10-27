/**
 * Génère les clés qui signent les jetons de connexion (Convex Auth) et les
 * pose sur le déploiement Convex : JWT_PRIVATE_KEY et JWKS.
 *
 *   npm run cles               → déploiement de dev
 *   npm run cles -- --prod     → production
 *
 * À faire une fois par déploiement. Les refaire déconnecte tout le monde.
 */
import { spawnSync } from 'node:child_process';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const cible = process.argv.includes('--prod') ? ['--prod'] : [];
const cles = await generateKeyPair('RS256', { extractable: true });
const privee = (await exportPKCS8(cles.privateKey)).trimEnd().replace(/\n/g, ' ');
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(cles.publicKey)) }] });

for (const [nom, valeur] of [
  ['JWT_PRIVATE_KEY', privee],
  ['JWKS', jwks],
]) {
  // Valeur passée par l'entrée standard : rien dans l'historique du terminal.
  const r = spawnSync('npx', ['convex', 'env', 'set', nom, ...cible], {
    input: valeur,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log('Clés de connexion posées ✔');
