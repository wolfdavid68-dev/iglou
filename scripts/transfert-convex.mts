/**
 * Transfert unique des données Firestore vers Convex.
 *
 *   node scripts/transfert-convex.mts --cle chemin/vers/cle-firebase.json            → lit Firestore, écrit transfert/*.jsonl
 *   node scripts/transfert-convex.mts --cle chemin/vers/cle-firebase.json --importer → … puis importe dans Convex (dev)
 *   … --importer --prod                                                             → … dans le déploiement de production
 *
 * La clé est un compte de service Firebase (console Firebase → Paramètres du
 * projet → Comptes de service → Générer une nouvelle clé privée). À garder
 * hors du dépôt et à supprimer après le transfert. Firestore n'est que lu.
 *
 * Les ids Firestore sont conservés (champ `id`) et les uid Firebase aussi :
 * comptes, liens et maison active mémorisée restent valides.
 */

import type { CollectionReference } from 'firebase-admin/firestore';

export const PROJET_FIREBASE = 'congelateur-v91vd';

/** Document Firestore lu, horodatages déjà convertis en millisecondes. */
export interface DocSource {
  id: string;
  data: Record<string, unknown>;
}

export interface MaisonSource extends DocSource {
  membres: DocSource[];
  appareils: DocSource[];
  tiroirs: DocSource[];
  aliments: DocSource[];
  coursesLibres: DocSource[];
  consommations: DocSource[];
}

export interface SourceFirestore {
  profils: DocSource[];
  maisons: MaisonSource[];
  signalements: DocSource[];
}

export const TABLES = ['profils', 'maisons', 'membres', 'appareils', 'tiroirs', 'aliments', 'coursesLibres', 'consommations', 'signalements'] as const;
export type Table = (typeof TABLES)[number];
export type Tables = Record<Table, Record<string, unknown>[]>;

const UNITES = ['pièce', 'g', 'kg', 'L', 'portion'];

/* ---------- Lecture prudente : les documents respectent le schéma Convex ---------- */

const texte = (v: unknown, defaut: string, max: number) => {
  const t = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return t || defaut;
};
const texteOuNul = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
const nombre = (v: unknown, defaut: number) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut);
const positif = (v: unknown, defaut: number) => Math.max(0, nombre(v, defaut));
const entier = (v: unknown) => Math.max(0, Math.round(nombre(v, 0)));
const date = (v: unknown, defaut: number) => nombre(v, defaut);
const unite = (v: unknown) => (typeof v === 'string' && UNITES.includes(v) ? v : 'pièce');
const idValide = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);

/** Convertit tout Firestore en lignes de tables Convex. `maintenant` sert de date par défaut. */
export function convertir(src: SourceFirestore, maintenant: number): { tables: Tables; ignores: string[] } {
  const tables: Tables = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Tables;
  const ignores: string[] = [];
  const codes = new Set<string>();

  for (const p of src.profils) {
    tables.profils.push({ uid: p.id, prenom: texte(p.data.prenom, 'Moi', 40), createdAt: date(p.data.createdAt, maintenant) });
  }

  for (const m of src.maisons) {
    if (!idValide(m.id)) {
      ignores.push(`maisons/${m.id} (id invalide)`);
      continue;
    }
    const d = m.data;
    let code = typeof d.codeInvitation === 'string' && /^[A-Z0-9]{6}$/.test(d.codeInvitation) ? d.codeInvitation : '';
    // Code absent ou en double : la maison en reçoit un neuf (le propriétaire pourra le partager à nouveau).
    while (!code || codes.has(code)) code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    codes.add(code);
    const createdAt = date(d.createdAt, maintenant);
    tables.maisons.push({ id: m.id, nom: texte(d.nom, 'Maison', 60), codeInvitation: code, createdBy: texte(d.createdBy, '', 128), createdAt });

    for (const x of m.membres) {
      tables.membres.push({
        maisonId: m.id,
        uid: texte(x.data.uid, x.id, 128),
        prenom: texte(x.data.prenom, 'Moi', 40),
        role: x.data.role === 'proprietaire' ? 'proprietaire' : 'membre',
        joinedAt: date(x.data.joinedAt, createdAt),
      });
    }

    const garder = (collection: string, x: DocSource) => {
      if (idValide(x.id)) return true;
      ignores.push(`maisons/${m.id}/${collection}/${x.id} (id invalide)`);
      return false;
    };

    for (const x of m.appareils.filter((x) => garder('appareils', x))) {
      tables.appareils.push({
        maisonId: m.id,
        id: x.id,
        nom: texte(x.data.nom, 'Appareil', 60),
        type: x.data.type === 'congelateur' ? 'congelateur' : 'frigo',
        ordre: entier(x.data.ordre),
        createdAt: date(x.data.createdAt, createdAt),
      });
    }

    for (const x of m.tiroirs.filter((x) => garder('tiroirs', x))) {
      tables.tiroirs.push({ maisonId: m.id, id: x.id, appareilId: texte(x.data.appareilId, '', 64), nom: texte(x.data.nom, 'Tiroir', 60), ordre: entier(x.data.ordre) });
    }

    for (const x of m.aliments.filter((x) => garder('aliments', x))) {
      const a = x.data;
      const quantite = positif(a.quantite, 0);
      const ajout = date(a.createdAt, createdAt);
      const achat = nombre(a.achatQuantite, 0);
      tables.aliments.push({
        maisonId: m.id,
        id: x.id,
        tiroirId: texte(a.tiroirId, '', 64),
        appareilId: texte(a.appareilId, '', 64),
        nom: texte(a.nom, 'Aliment', 80),
        quantite,
        // Règle du maximum : jamais inférieur à la quantité, toujours > 0.
        quantiteMax: Math.max(positif(a.quantiteMax, quantite), quantite) || 1,
        unite: unite(a.unite),
        datePeremption: texteOuNul(a.datePeremption, 10),
        note: texteOuNul(a.note, 500),
        dansPanier: a.dansPanier === true,
        achatQuantite: achat > 0 ? achat : null,
        ajoutePar: texte(a.ajoutePar, '', 128),
        ajouteParPrenom: texte(a.ajouteParPrenom, 'Moi', 40),
        modifiePar: texte(a.modifiePar, '', 128),
        createdAt: ajout,
        updatedAt: date(a.updatedAt, ajout),
      });
    }

    for (const x of m.coursesLibres.filter((x) => garder('coursesLibres', x))) {
      tables.coursesLibres.push({
        maisonId: m.id,
        id: x.id,
        nom: texte(x.data.nom, 'Article', 80),
        quantite: positif(x.data.quantite, 1) || 1,
        unite: unite(x.data.unite),
        dansPanier: x.data.dansPanier === true,
        ajoutePar: texte(x.data.ajoutePar, '', 128),
        createdAt: date(x.data.createdAt, createdAt),
      });
    }

    for (const x of m.consommations.filter((x) => garder('consommations', x))) {
      const quantite = positif(x.data.quantite, 0);
      if (!(quantite > 0)) continue;
      tables.consommations.push({
        maisonId: m.id,
        id: x.id,
        nom: texte(x.data.nom, 'Aliment', 80),
        quantite,
        unite: unite(x.data.unite),
        appareilId: texte(x.data.appareilId, '', 64),
        par: texte(x.data.par, '', 128),
        at: date(x.data.at, maintenant),
      });
    }
  }

  for (const s of src.signalements) {
    tables.signalements.push({
      uid: texte(s.data.uid, '', 128),
      email: texte(s.data.email, '', 320),
      prenom: texteOuNul(s.data.prenom, 40),
      maisonId: texte(s.data.maisonId, '', 64),
      message: texte(s.data.message, '(vide)', 2000),
      appareil: texteOuNul(s.data.appareil, 100),
      systeme: texteOuNul(s.data.systeme, 60),
      versionApp: texteOuNul(s.data.versionApp, 30),
      createdAt: date(s.data.createdAt, maintenant),
    });
  }

  return { tables, ignores };
}

/** Horodatages Firestore → millisecondes, partout dans le document. */
export function versMs(v: unknown): unknown {
  if (v && typeof v === 'object') {
    if (typeof (v as { toMillis?: unknown }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
    if (Array.isArray(v)) return v.map(versMs);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, versMs(x)]));
  }
  return v;
}

/* ---------------------------------------------------------------------------
 * Exécution
 * ------------------------------------------------------------------------- */

async function lireFirestore(cle: string | undefined): Promise<SourceFirestore> {
  const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { readFileSync } = await import('node:fs');
  initializeApp({ credential: cle ? cert(JSON.parse(readFileSync(cle, 'utf8'))) : applicationDefault(), projectId: PROJET_FIREBASE });
  const db = getFirestore();
  const lire = async (ref: CollectionReference): Promise<DocSource[]> =>
    (await ref.get()).docs.map((d) => ({ id: d.id, data: versMs(d.data()) as Record<string, unknown> }));

  const maisons: MaisonSource[] = [];
  for (const m of await lire(db.collection('maisons'))) {
    const ref = db.collection('maisons').doc(m.id);
    maisons.push({
      ...m,
      membres: await lire(ref.collection('membres')),
      appareils: await lire(ref.collection('appareils')),
      tiroirs: await lire(ref.collection('tiroirs')),
      aliments: await lire(ref.collection('aliments')),
      coursesLibres: await lire(ref.collection('coursesLibres')),
      consommations: await lire(ref.collection('consommations')),
    });
  }
  return { profils: await lire(db.collection('profils')), maisons, signalements: await lire(db.collection('signalements')) };
}

async function principal(args: string[]) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');

  const i = args.indexOf('--cle');
  const cle = i >= 0 ? args[i + 1] : undefined;
  if (!cle && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Clé de compte de service Firebase manquante : --cle chemin/vers/cle.json (voir en tête du script).');
    process.exit(1);
  }

  console.log(`Lecture de Firestore (projet ${PROJET_FIREBASE})…`);
  const { tables, ignores } = convertir(await lireFirestore(cle), Date.now());

  const dossier = 'transfert';
  mkdirSync(dossier, { recursive: true });
  for (const t of TABLES) {
    writeFileSync(join(dossier, `${t}.jsonl`), tables[t].map((l) => JSON.stringify(l)).join('\n') + (tables[t].length ? '\n' : ''));
    console.log(`  ${t.padEnd(14)} ${tables[t].length}`);
  }
  for (const x of ignores) console.warn(`  ignoré : ${x}`);
  console.log(`Fichiers écrits dans ${dossier}/.`);

  if (!args.includes('--importer')) {
    console.log('Relance avec --importer (et --prod pour la production) pour les envoyer dans Convex.');
    return;
  }
  const cible = args.includes('--prod') ? ['--prod'] : [];
  for (const t of TABLES) {
    console.log(`Import de ${t}…`);
    const r = spawnSync('npx', ['convex', 'import', '--table', t, '--replace', '-y', ...cible, join(dossier, `${t}.jsonl`)], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) {
      console.error(`Échec de l'import de ${t}. Les tables précédentes sont importées ; relancer remplace tout à nouveau.`);
      process.exit(1);
    }
  }
  console.log('Transfert terminé ✔');
}

const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal(process.argv.slice(2));
}
