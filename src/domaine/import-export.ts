import { estDateISO, versDateISO } from './dates';
import { normaliser } from './texte';
import { TYPES_APPAREIL, UNITES, type Aliment, type Appareil, type CourseLibre, type Tiroir, type TypeAppareil, type Unite } from './types';

export const FORMAT_EXPORT = 'congelateur-inventaire';
export const VERSION_EXPORT = 1;

export interface AlimentExporte {
  nom: string;
  quantite: number;
  quantiteMax: number;
  unite: Unite;
  datePeremption: string | null;
  note: string | null;
}

export interface TiroirExporte {
  nom: string;
  aliments: AlimentExporte[];
}

export interface AppareilExporte {
  nom: string;
  type: TypeAppareil;
  tiroirs: TiroirExporte[];
}

export interface LibreExporte {
  nom: string;
  quantite: number;
  unite: Unite;
}

export interface FichierExport {
  format: typeof FORMAT_EXPORT;
  version: typeof VERSION_EXPORT;
  exporteLe: string;
  maison: string;
  appareils: AppareilExporte[];
  coursesLibres: LibreExporte[];
}

export interface Inventaire {
  appareils: Appareil[];
  tiroirs: Tiroir[];
  aliments: Aliment[];
  libres: CourseLibre[];
}

export function construireExport(nomMaison: string, inv: Inventaire, maintenant = new Date()): FichierExport {
  const appareils = [...inv.appareils].sort((a, b) => a.ordre - b.ordre);
  return {
    format: FORMAT_EXPORT,
    version: VERSION_EXPORT,
    exporteLe: maintenant.toISOString(),
    maison: nomMaison,
    appareils: appareils.map((appareil) => ({
      nom: appareil.nom,
      type: appareil.type,
      tiroirs: inv.tiroirs
        .filter((t) => t.appareilId === appareil.id)
        .sort((a, b) => a.ordre - b.ordre)
        .map((tiroir) => ({
          nom: tiroir.nom,
          aliments: inv.aliments
            .filter((a) => a.tiroirId === tiroir.id)
            .map((a) => ({
              nom: a.nom,
              quantite: a.quantite,
              quantiteMax: a.quantiteMax,
              unite: a.unite,
              datePeremption: a.datePeremption,
              note: a.note,
            })),
        })),
    })),
    coursesLibres: inv.libres.map((l) => ({ nom: l.nom, quantite: l.quantite, unite: l.unite })),
  };
}

/** `inventaire-chez-nous-2026-10-07.json` */
export function nomFichierExport(nomMaison: string, maintenant = new Date()): string {
  const slug =
    normaliser(nomMaison)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'maison';
  return `inventaire-${slug}-${versDateISO(maintenant)}.json`;
}

export type ResultatValidation = { ok: true; fichier: FichierExport } | { ok: false; erreurs: string[] };

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const estTexte = (v: unknown, max = 200): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valide un fichier importé sans jamais faire confiance à son contenu. */
export function validerImport(brut: unknown): ResultatValidation {
  const erreurs: string[] = [];
  if (!estObjet(brut)) return { ok: false, erreurs: ["Le fichier n'est pas un export valide."] };
  if (brut.format !== FORMAT_EXPORT) erreurs.push("Ce fichier n'est pas un export de l'application.");
  if (brut.version !== VERSION_EXPORT) erreurs.push(`Version de fichier non prise en charge (${String(brut.version)}).`);
  if (!Array.isArray(brut.appareils)) erreurs.push('La liste des appareils est manquante.');
  if (brut.coursesLibres !== undefined && !Array.isArray(brut.coursesLibres)) erreurs.push('La liste des articles libres est invalide.');
  if (erreurs.length) return { ok: false, erreurs };

  const appareils: AppareilExporte[] = [];
  (brut.appareils as unknown[]).forEach((a, i) => {
    const ou = `Appareil n°${i + 1}`;
    if (!estObjet(a)) return erreurs.push(`${ou} : format invalide.`);
    if (!estTexte(a.nom, 60)) erreurs.push(`${ou} : nom manquant ou trop long.`);
    if (!TYPES_APPAREIL.includes(a.type as TypeAppareil)) erreurs.push(`${ou} : type inconnu.`);
    if (!Array.isArray(a.tiroirs) || a.tiroirs.length < 1 || a.tiroirs.length > 20)
      return erreurs.push(`${ou} : il faut entre 1 et 20 tiroirs.`);
    const tiroirs: TiroirExporte[] = [];
    (a.tiroirs as unknown[]).forEach((t, j) => {
      const ouT = `${ou}, tiroir n°${j + 1}`;
      if (!estObjet(t) || !estTexte(t.nom, 60)) return erreurs.push(`${ouT} : nom manquant.`);
      if (!Array.isArray(t.aliments)) return erreurs.push(`${ouT} : liste d'aliments manquante.`);
      const aliments: AlimentExporte[] = [];
      (t.aliments as unknown[]).forEach((al, k) => {
        const ouA = `${ouT}, aliment n°${k + 1}`;
        if (!estObjet(al)) return erreurs.push(`${ouA} : format invalide.`);
        if (!estTexte(al.nom, 80)) erreurs.push(`${ouA} : nom manquant ou trop long.`);
        if (!estNombre(al.quantite) || al.quantite < 0) erreurs.push(`${ouA} : quantité invalide.`);
        if (!estNombre(al.quantiteMax) || al.quantiteMax <= 0) erreurs.push(`${ouA} : maximum invalide.`);
        if (!UNITES.includes(al.unite as Unite)) erreurs.push(`${ouA} : unité inconnue.`);
        if (al.datePeremption != null && !(typeof al.datePeremption === 'string' && estDateISO(al.datePeremption)))
          erreurs.push(`${ouA} : date de péremption invalide.`);
        if (al.note != null && !(typeof al.note === 'string' && al.note.length <= 500)) erreurs.push(`${ouA} : note invalide.`);
        if (estTexte(al.nom, 80) && estNombre(al.quantite) && estNombre(al.quantiteMax)) {
          aliments.push({
            nom: al.nom.trim(),
            quantite: Math.max(0, al.quantite),
            // La règle du maximum est garantie même sur un fichier modifié à la main.
            quantiteMax: Math.max(al.quantiteMax, al.quantite),
            unite: al.unite as Unite,
            datePeremption: (al.datePeremption as string | null) ?? null,
            note: (al.note as string | null) ?? null,
          });
        }
      });
      tiroirs.push({ nom: t.nom.trim(), aliments });
    });
    if (estTexte(a.nom, 60)) appareils.push({ nom: a.nom.trim(), type: a.type as TypeAppareil, tiroirs });
  });

  const coursesLibres: LibreExporte[] = [];
  ((brut.coursesLibres as unknown[] | undefined) ?? []).forEach((l, i) => {
    const ou = `Article libre n°${i + 1}`;
    if (!estObjet(l) || !estTexte(l.nom, 80)) return erreurs.push(`${ou} : nom manquant.`);
    if (!estNombre(l.quantite) || l.quantite <= 0) return erreurs.push(`${ou} : quantité invalide.`);
    if (!UNITES.includes(l.unite as Unite)) return erreurs.push(`${ou} : unité inconnue.`);
    coursesLibres.push({ nom: l.nom.trim(), quantite: l.quantite, unite: l.unite as Unite });
  });

  if (erreurs.length) return { ok: false, erreurs };
  return {
    ok: true,
    fichier: {
      format: FORMAT_EXPORT,
      version: VERSION_EXPORT,
      exporteLe: typeof brut.exporteLe === 'string' ? brut.exporteLe : '',
      maison: typeof brut.maison === 'string' ? brut.maison : '',
      appareils,
      coursesLibres,
    },
  };
}

export function resumeFichier(f: FichierExport): { appareils: number; tiroirs: number; aliments: number; libres: number } {
  const tiroirs = f.appareils.flatMap((a) => a.tiroirs);
  return {
    appareils: f.appareils.length,
    tiroirs: tiroirs.length,
    aliments: tiroirs.reduce((n, t) => n + t.aliments.length, 0),
    libres: f.coursesLibres.length,
  };
}

/* ----------------------------------------------------------------------------
 * Plan d'import : liste d'opérations indépendante de la base, appliquée
 * ensuite par lots. Les identifiants des nouveaux documents sont fournis par
 * `nouvelId` (ids aléatoires côté app, compteur dans les tests).
 * -------------------------------------------------------------------------- */

export type ModeImport = 'remplacer' | 'fusionner';

export type Operation =
  | { op: 'supprimer'; collection: 'appareils' | 'tiroirs' | 'aliments' | 'coursesLibres'; id: string }
  | { op: 'creerAppareil'; id: string; nom: string; type: TypeAppareil; ordre: number }
  | { op: 'creerTiroir'; id: string; appareilId: string; nom: string; ordre: number }
  | { op: 'creerAliment'; id: string; appareilId: string; tiroirId: string; aliment: AlimentExporte }
  | { op: 'majMaxAliment'; id: string; quantiteMax: number }
  | { op: 'creerLibre'; id: string; nom: string; quantite: number; unite: Unite };

export function planImport(mode: ModeImport, actuel: Inventaire, fichier: FichierExport, nouvelId: () => string): Operation[] {
  const ops: Operation[] = [];

  if (mode === 'remplacer') {
    actuel.aliments.forEach((a) => ops.push({ op: 'supprimer', collection: 'aliments', id: a.id }));
    actuel.tiroirs.forEach((t) => ops.push({ op: 'supprimer', collection: 'tiroirs', id: t.id }));
    actuel.appareils.forEach((a) => ops.push({ op: 'supprimer', collection: 'appareils', id: a.id }));
    actuel.libres.forEach((l) => ops.push({ op: 'supprimer', collection: 'coursesLibres', id: l.id }));
  }

  const garder = mode === 'fusionner';
  const appareilsExistants = garder ? actuel.appareils : [];
  const tiroirsExistants = garder ? actuel.tiroirs : [];
  const alimentsExistants = garder ? actuel.aliments : [];
  let ordreAppareil = appareilsExistants.reduce((m, a) => Math.max(m, a.ordre + 1), 0);

  for (const appareilImporte of fichier.appareils) {
    let appareilId = appareilsExistants.find(
      (a) => a.type === appareilImporte.type && normaliser(a.nom) === normaliser(appareilImporte.nom),
    )?.id;
    if (!appareilId) {
      appareilId = nouvelId();
      ops.push({ op: 'creerAppareil', id: appareilId, nom: appareilImporte.nom, type: appareilImporte.type, ordre: ordreAppareil++ });
    }
    const tiroirsAppareil = tiroirsExistants.filter((t) => t.appareilId === appareilId);
    let ordreTiroir = tiroirsAppareil.reduce((m, t) => Math.max(m, t.ordre + 1), 0);

    for (const tiroirImporte of appareilImporte.tiroirs) {
      let tiroirId = tiroirsAppareil.find((t) => normaliser(t.nom) === normaliser(tiroirImporte.nom))?.id;
      if (!tiroirId) {
        tiroirId = nouvelId();
        ops.push({ op: 'creerTiroir', id: tiroirId, appareilId, nom: tiroirImporte.nom, ordre: ordreTiroir++ });
      }
      for (const alimentImporte of tiroirImporte.aliments) {
        const existant = alimentsExistants.find(
          (a) => a.tiroirId === tiroirId && normaliser(a.nom) === normaliser(alimentImporte.nom),
        );
        if (!existant) {
          ops.push({ op: 'creerAliment', id: nouvelId(), appareilId, tiroirId, aliment: alimentImporte });
        } else if (alimentImporte.quantiteMax > existant.quantiteMax) {
          // Fusion : l'inventaire actuel garde ses quantités, seul un maximum plus grand est repris.
          ops.push({ op: 'majMaxAliment', id: existant.id, quantiteMax: alimentImporte.quantiteMax });
        }
      }
    }
  }

  const libresExistants = garder ? actuel.libres : [];
  for (const libre of fichier.coursesLibres) {
    if (libresExistants.some((l) => normaliser(l.nom) === normaliser(libre.nom))) continue;
    ops.push({ op: 'creerLibre', id: nouvelId(), nom: libre.nom, quantite: libre.quantite, unite: libre.unite });
  }

  return ops;
}

/** Découpe en lots (une mutation Convex reste bornée en écritures). */
export function enLots<T>(elements: T[], taille = 450): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) lots.push(elements.slice(i, i + taille));
  return lots;
}
