/**
 * Export de Firebase (Firestore + comptes Auth) vers des fichiers JSONL,
 * un par table Convex, prêts pour `npx convex import`.
 *
 *   node exporter.mjs chemin/vers/cle-service.json
 *
 * Lecture seule : rien n'est modifié ni supprimé côté Firebase.
 * Voir LISEZMOI.md pour la marche à suivre complète.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ici = dirname(fileURLToPath(import.meta.url));
const cheminCle = process.argv[2] ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!cheminCle || !existsSync(cheminCle)) {
  console.error('Usage : node exporter.mjs chemin/vers/cle-service.json');
  console.error('(clé de compte de service : console Firebase > Paramètres du projet > Comptes de service)');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(cheminCle), 'utf8'))) });
const db = getFirestore();
const auth = getAuth();

const SORTIE = join(ici, 'export');
mkdirSync(SORTIE, { recursive: true });
const maintenant = Date.now();

/* ---------- Conversions (mêmes valeurs par défaut que l'ancienne app) ---------- */

const texte = (v, defaut = '') => (typeof v === 'string' ? v : defaut);
const nombre = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut);
const ouNull = (v, type) => (typeof v === type ? v : null);
const UNITES = ['pièce', 'g', 'kg', 'L', 'portion'];
const unite = (v) => (UNITES.includes(v) ? v : 'pièce');
/** Horodatage Firestore → millisecondes (date de l'export si absent). */
function ms(v, defaut = maintenant) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return typeof v === 'number' && Number.isFinite(v) ? v : defaut;
}

/* ---------- Écriture JSONL ---------- */

const fichiers = new Map();
const compteurs = new Map();
function ecrire(table, doc) {
  if (!fichiers.has(table)) fichiers.set(table, createWriteStream(join(SORTIE, `${table}.jsonl`), 'utf8'));
  fichiers.get(table).write(JSON.stringify(doc) + '\n');
  compteurs.set(table, (compteurs.get(table) ?? 0) + 1);
}

/* ---------- Maisons et leur contenu ---------- */

const prenoms = new Map(); // uid → prénom (profils, sinon adhésions)

const maisons = await db.collection('maisons').get();
for (const m of maisons.docs) {
  const d = m.data();
  const maison = m.id;
  ecrire('maisons', {
    cle: maison,
    nom: texte(d.nom),
    codeInvitation: texte(d.codeInvitation),
    createdBy: texte(d.createdBy),
    createdAt: ms(d.createdAt),
  });

  const [membres, appareils, tiroirs, aliments, libres, consommations] = await Promise.all(
    ['membres', 'appareils', 'tiroirs', 'aliments', 'coursesLibres', 'consommations'].map((c) => m.ref.collection(c).get()),
  );

  for (const s of membres.docs) {
    const x = s.data();
    const uid = texte(x.uid, s.id);
    const prenom = texte(x.prenom);
    if (prenom && !prenoms.has(uid)) prenoms.set(uid, prenom);
    ecrire('membres', {
      maison,
      uid,
      prenom,
      role: x.role === 'proprietaire' ? 'proprietaire' : 'membre',
      joinedAt: ms(x.joinedAt),
    });
  }

  for (const s of appareils.docs) {
    const x = s.data();
    ecrire('appareils', {
      maison,
      cle: s.id,
      nom: texte(x.nom),
      type: x.type === 'congelateur' ? 'congelateur' : 'frigo',
      ordre: nombre(x.ordre),
      createdAt: ms(x.createdAt),
    });
  }

  for (const s of tiroirs.docs) {
    const x = s.data();
    ecrire('tiroirs', { maison, cle: s.id, appareilId: texte(x.appareilId), nom: texte(x.nom), ordre: nombre(x.ordre) });
  }

  for (const s of aliments.docs) {
    const x = s.data();
    const quantite = nombre(x.quantite);
    const createdAt = ms(x.createdAt);
    ecrire('aliments', {
      maison,
      cle: s.id,
      tiroirId: texte(x.tiroirId),
      appareilId: texte(x.appareilId),
      nom: texte(x.nom),
      quantite,
      quantiteMax: Math.max(nombre(x.quantiteMax, quantite), quantite),
      unite: unite(x.unite),
      datePeremption: ouNull(x.datePeremption, 'string'),
      note: ouNull(x.note, 'string'),
      dansPanier: x.dansPanier === true,
      achatQuantite: ouNull(x.achatQuantite, 'number'),
      ajoutePar: texte(x.ajoutePar),
      ajouteParPrenom: texte(x.ajouteParPrenom),
      modifiePar: texte(x.modifiePar, texte(x.ajoutePar)),
      createdAt,
      updatedAt: ms(x.updatedAt, createdAt),
    });
  }

  for (const s of libres.docs) {
    const x = s.data();
    ecrire('coursesLibres', {
      maison,
      cle: s.id,
      nom: texte(x.nom),
      quantite: nombre(x.quantite, 1),
      unite: unite(x.unite),
      dansPanier: x.dansPanier === true,
      ajoutePar: texte(x.ajoutePar),
      createdAt: ms(x.createdAt),
    });
  }

  for (const s of consommations.docs) {
    const x = s.data();
    ecrire('consommations', {
      maison,
      cle: s.id,
      nom: texte(x.nom),
      quantite: nombre(x.quantite),
      unite: unite(x.unite),
      appareilId: texte(x.appareilId),
      par: texte(x.par),
      at: ms(x.at),
    });
  }
}

/* ---------- Signalements ---------- */

for (const s of (await db.collection('signalements').get()).docs) {
  const x = s.data();
  ecrire('signalements', {
    uid: texte(x.uid),
    email: texte(x.email),
    prenom: ouNull(x.prenom, 'string'),
    maisonId: texte(x.maisonId),
    message: texte(x.message),
    appareil: ouNull(x.appareil, 'string'),
    systeme: ouNull(x.systeme, 'string'),
    versionApp: ouNull(x.versionApp, 'string'),
    createdAt: ms(x.createdAt),
  });
}

/* ---------- Comptes (Firebase Auth) ---------- */

for (const s of (await db.collection('profils').get()).docs) {
  const prenom = texte(s.data().prenom);
  if (prenom) prenoms.set(s.id, prenom); // le profil prime sur les adhésions
}

let sansEmail = 0;
let sansMotDePasse = 0;
let page;
do {
  const r = await auth.listUsers(1000, page);
  for (const u of r.users) {
    if (!u.email) {
      sansEmail++;
      continue;
    }
    if (!u.passwordHash || !u.passwordSalt) sansMotDePasse++;
    ecrire('transfertComptes', {
      uid: u.uid,
      email: u.email,
      ...(prenoms.has(u.uid) ? { prenom: prenoms.get(u.uid) } : {}),
      emailVerifie: u.emailVerified === true,
      ...(u.passwordHash && u.passwordSalt ? { hash: u.passwordHash, sel: u.passwordSalt } : {}),
    });
  }
  page = r.pageToken;
} while (page);

/* ---------- Bilan ---------- */

await Promise.all([...fichiers.values()].map((f) => new Promise((ok) => f.end(ok))));

console.log(`\nExport terminé dans ${SORTIE}\n`);
for (const [table, n] of [...compteurs].sort()) console.log(`  ${table.padEnd(18)} ${n}`);
if (sansEmail) console.log(`\n  ${sansEmail} compte(s) sans e-mail ignoré(s).`);
if (sansMotDePasse) {
  console.log(`  ${sansMotDePasse} compte(s) sans hash de mot de passe : ils devront passer par « Mot de passe oublié ».`);
}
console.log('\nÉtape suivante : node importer.mjs (voir LISEZMOI.md).');
