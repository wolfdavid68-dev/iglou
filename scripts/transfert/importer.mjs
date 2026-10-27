/**
 * Envoie l'export (dossier export/) vers Convex, puis crée les comptes.
 *
 *   node importer.mjs          → déploiement de développement
 *   node importer.mjs --prod   → déploiement de production
 *
 * Relançable sans risque : chaque table est remplacée, et les comptes déjà
 * créés sont ignorés.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..', '..');
const options = process.argv.includes('--prod') ? ['--prod'] : [];

const TABLES = ['maisons', 'membres', 'appareils', 'tiroirs', 'aliments', 'coursesLibres', 'consommations', 'signalements', 'transfertComptes'];

function convex(args, { capturer = false } = {}) {
  const r = spawnSync('npx', ['convex', ...args, ...options], {
    cwd: racine,
    shell: true,
    encoding: 'utf8',
    stdio: capturer ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  });
  if (r.status !== 0) {
    console.error(`\nÉchec : npx convex ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
  return r.stdout ?? '';
}

for (const table of TABLES) {
  const fichier = join(ici, 'export', `${table}.jsonl`);
  if (!existsSync(fichier)) {
    console.log(`(${table} : rien à importer)`);
    continue;
  }
  console.log(`\n→ ${table}`);
  convex(['import', '--table', table, '--replace', '-y', `"${fichier}"`]);
}

console.log('\n→ Création des comptes');
for (let passage = 1; passage <= 1000; passage++) {
  const sortie = convex(['run', 'transfert:finaliserComptes'], { capturer: true });
  process.stdout.write(sortie);
  if (!sortie.includes('relancer')) break;
}

console.log('\n→ Bilan');
convex(['run', 'transfert:bilan']);
