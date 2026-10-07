import { Timestamp, getDoc, serverTimestamp, writeBatch, type DocumentReference } from './firestore';

import { restaurerSiAbsent, type ResultatRestauration } from '@/domaine/annulation';
import { planRangement } from '@/domaine/courses';
import { enLots, type Operation } from '@/domaine/import-export';
import { nomsTiroirsParDefaut } from '@/domaine/inventaire';
import { arrondir } from '@/domaine/texte';
import type { Aliment, Appareil, CourseLibre, Tiroir, TypeAppareil, Unite } from '@/domaine/types';
import { db, nouvelId, refDoc } from './firebase';

/** Qui écrit : obligatoire, les règles vérifient `modifiePar`. */
export interface Auteur {
  uid: string;
  prenom: string;
}

type Ecriture = (lot: ReturnType<typeof writeBatch>) => void;

/**
 * Applique des écritures en lots de 450 au plus (limite Firestore : 500).
 * Tous les lots sont confiés à Firestore d'un coup : hors ligne, ils sont
 * mis en file et partent dans l'ordre au retour du réseau.
 */
function appliquer(ecritures: Ecriture[]) {
  return Promise.all(
    enLots(ecritures).map((lot) => {
      const b = writeBatch(db);
      lot.forEach((e) => e(b));
      return b.commit();
    }),
  );
}

const supprimer = (ref: DocumentReference) => (b: ReturnType<typeof writeBatch>) => b.delete(ref);

/* ---------------- Appareils ---------------- */

export function creerAppareil(maisonId: string, nom: string, type: TypeAppareil, nombreTiroirs: number, ordre: number) {
  const appareilId = nouvelId(maisonId, 'appareils');
  const b = writeBatch(db);
  b.set(refDoc(maisonId, 'appareils', appareilId), { nom: nom.trim(), type, ordre, createdAt: serverTimestamp() });
  nomsTiroirsParDefaut(nombreTiroirs).forEach((nomTiroir, i) => {
    b.set(refDoc(maisonId, 'tiroirs', nouvelId(maisonId, 'tiroirs')), { appareilId, nom: nomTiroir, ordre: i });
  });
  return { appareilId, ecriture: b.commit() };
}

export function modifierAppareil(maisonId: string, appareil: Appareil, champs: Partial<Pick<Appareil, 'nom' | 'type' | 'ordre'>>) {
  const b = writeBatch(db);
  b.update(refDoc(maisonId, 'appareils', appareil.id), champs);
  return b.commit();
}

export function reordonnerAppareils(maisonId: string, appareils: Appareil[]) {
  const b = writeBatch(db);
  appareils.forEach((a, i) => {
    if (a.ordre !== i) b.update(refDoc(maisonId, 'appareils', a.id), { ordre: i });
  });
  return b.commit();
}

export function supprimerAppareil(maisonId: string, appareil: Appareil, tiroirs: Tiroir[], aliments: Aliment[]) {
  return appliquer([
    ...aliments.filter((a) => a.appareilId === appareil.id).map((a) => supprimer(refDoc(maisonId, 'aliments', a.id))),
    ...tiroirs.filter((t) => t.appareilId === appareil.id).map((t) => supprimer(refDoc(maisonId, 'tiroirs', t.id))),
    supprimer(refDoc(maisonId, 'appareils', appareil.id)),
  ]);
}

/* ---------------- Tiroirs ---------------- */

export function ajouterTiroir(maisonId: string, appareilId: string, nom: string, ordre: number) {
  const b = writeBatch(db);
  b.set(refDoc(maisonId, 'tiroirs', nouvelId(maisonId, 'tiroirs')), { appareilId, nom: nom.trim(), ordre });
  return b.commit();
}

export function renommerTiroir(maisonId: string, tiroirId: string, nom: string) {
  const b = writeBatch(db);
  b.update(refDoc(maisonId, 'tiroirs', tiroirId), { nom: nom.trim() });
  return b.commit();
}

export function reordonnerTiroirs(maisonId: string, tiroirs: Tiroir[]) {
  const b = writeBatch(db);
  tiroirs.forEach((t, i) => {
    if (t.ordre !== i) b.update(refDoc(maisonId, 'tiroirs', t.id), { ordre: i });
  });
  return b.commit();
}

/**
 * Supprime un tiroir. Son contenu est soit déplacé vers `destination`, soit
 * supprimé (`destination` nul).
 */
export function supprimerTiroir(maisonId: string, tiroir: Tiroir, contenu: Aliment[], destination: Tiroir | null, auteur: Auteur) {
  const ecritures: Ecriture[] = contenu.map((a) =>
    destination
      ? (b) =>
          b.update(refDoc(maisonId, 'aliments', a.id), {
            tiroirId: destination.id,
            appareilId: destination.appareilId,
            modifiePar: auteur.uid,
            updatedAt: serverTimestamp(),
          })
      : supprimer(refDoc(maisonId, 'aliments', a.id)),
  );
  ecritures.push(supprimer(refDoc(maisonId, 'tiroirs', tiroir.id)));
  return appliquer(ecritures);
}

/* ---------------- Aliments ---------------- */

export interface NouvelAliment {
  tiroirId: string;
  appareilId: string;
  nom: string;
  quantite: number;
  quantiteMax: number;
  unite: Unite;
  datePeremption: string | null;
  note: string | null;
}

export function creerAliment(maisonId: string, a: NouvelAliment, auteur: Auteur) {
  const id = nouvelId(maisonId, 'aliments');
  const b = writeBatch(db);
  b.set(refDoc(maisonId, 'aliments', id), {
    ...a,
    nom: a.nom.trim(),
    dansPanier: false,
    achatQuantite: null,
    ajoutePar: auteur.uid,
    ajouteParPrenom: auteur.prenom.slice(0, 40) || 'Moi',
    modifiePar: auteur.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id, ecriture: b.commit() };
}

export type ChampsAliment = Partial<
  Pick<Aliment, 'tiroirId' | 'appareilId' | 'nom' | 'quantite' | 'quantiteMax' | 'unite' | 'datePeremption' | 'note' | 'dansPanier' | 'achatQuantite'>
>;

/**
 * Mise à jour partielle : l'auteur et la date d'ajout ne sont jamais réécrits.
 * Quantité et maximum doivent être fournis ensemble quand l'un change
 * (voir `fixerQuantite` / `modifierMaximum`).
 */
export function modifierAliment(maisonId: string, id: string, champs: ChampsAliment, auteur: Auteur) {
  const b = writeBatch(db);
  b.update(refDoc(maisonId, 'aliments', id), { ...champs, modifiePar: auteur.uid, updatedAt: serverTimestamp() });
  return b.commit();
}

/**
 * Baisse de stock (« − » ou « épuisé ») : met à jour l'aliment et note la
 * sortie dans l'historique (statistiques), dans le même lot.
 */
export function consommerAliment(maisonId: string, a: Aliment, nouvelleQuantite: number, auteur: Auteur) {
  const b = writeBatch(db);
  b.update(refDoc(maisonId, 'aliments', a.id), { quantite: nouvelleQuantite, quantiteMax: a.quantiteMax, modifiePar: auteur.uid, updatedAt: serverTimestamp() });
  const sortie = arrondir(a.quantite - nouvelleQuantite);
  if (sortie > 0) {
    b.set(refDoc(maisonId, 'consommations', nouvelId(maisonId, 'consommations')), {
      nom: a.nom,
      quantite: sortie,
      unite: a.unite,
      appareilId: a.appareilId,
      par: auteur.uid,
      at: serverTimestamp(),
    });
  }
  return b.commit();
}

export function deplacerAliment(maisonId: string, aliment: Aliment, cible: Tiroir, auteur: Auteur) {
  return modifierAliment(maisonId, aliment.id, { tiroirId: cible.id, appareilId: cible.appareilId }, auteur);
}

export function supprimerAliment(maisonId: string, id: string) {
  const b = writeBatch(db);
  b.delete(refDoc(maisonId, 'aliments', id));
  return b.commit();
}

/** Réinsère un aliment supprimé avec le même id et les mêmes données. */
export function restaurerAliment(maisonId: string, a: Aliment, auteur: Auteur): Promise<ResultatRestauration> {
  const ref = refDoc(maisonId, 'aliments', a.id);
  return restaurerSiAbsent(
    async () => (await getDoc(ref).catch(() => null))?.exists() ?? false,
    async () => {
      const b = writeBatch(db);
      b.set(ref, {
        tiroirId: a.tiroirId,
        appareilId: a.appareilId,
        nom: a.nom,
        quantite: a.quantite,
        quantiteMax: a.quantiteMax,
        unite: a.unite,
        datePeremption: a.datePeremption,
        note: a.note,
        dansPanier: a.dansPanier,
        achatQuantite: a.achatQuantite,
        ajoutePar: a.ajoutePar,
        ajouteParPrenom: a.ajouteParPrenom || auteur.prenom,
        modifiePar: auteur.uid,
        createdAt: a.createdAt != null ? Timestamp.fromMillis(a.createdAt) : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Pas d'attente du serveur : la restauration apparaît tout de suite, même hors ligne.
      b.commit().catch(() => {});
    },
  );
}

/* ---------------- Courses ---------------- */

export function ajouterLibre(maisonId: string, nom: string, quantite: number, unite: Unite, auteur: Auteur) {
  const b = writeBatch(db);
  b.set(refDoc(maisonId, 'coursesLibres', nouvelId(maisonId, 'coursesLibres')), {
    nom: nom.trim(),
    quantite,
    unite,
    dansPanier: false,
    ajoutePar: auteur.uid,
    createdAt: serverTimestamp(),
  });
  return b.commit();
}

/** Plusieurs articles d'un coup (ingrédients manquants d'une recette), 1 pièce chacun. */
export function ajouterLibres(maisonId: string, noms: string[], auteur: Auteur) {
  const b = writeBatch(db);
  for (const nom of noms) {
    b.set(refDoc(maisonId, 'coursesLibres', nouvelId(maisonId, 'coursesLibres')), {
      nom: nom.trim(),
      quantite: 1,
      unite: 'pièce',
      dansPanier: false,
      ajoutePar: auteur.uid,
      createdAt: serverTimestamp(),
    });
  }
  return b.commit();
}

export function modifierLibre(maisonId: string, id: string, champs: Partial<Pick<CourseLibre, 'nom' | 'quantite' | 'unite' | 'dansPanier'>>) {
  const b = writeBatch(db);
  b.update(refDoc(maisonId, 'coursesLibres', id), champs);
  return b.commit();
}

export function supprimerLibre(maisonId: string, id: string) {
  const b = writeBatch(db);
  b.delete(refDoc(maisonId, 'coursesLibres', id));
  return b.commit();
}

/**
 * « J'ai rangé les courses » : remet en stock les aliments cochés et retire
 * les articles libres cochés de la liste.
 */
export function rangerCourses(maisonId: string, aliments: Aliment[], libres: CourseLibre[], auteur: Auteur) {
  const plan = planRangement(aliments, libres);
  return appliquer([
    ...plan.aliments.map(({ id, ...champs }) => (b: ReturnType<typeof writeBatch>) =>
      b.update(refDoc(maisonId, 'aliments', id), { ...champs, modifiePar: auteur.uid, updatedAt: serverTimestamp() }),
    ),
    ...plan.libres.map((l) => supprimer(refDoc(maisonId, 'coursesLibres', l.id))),
  ]);
}

/* ---------------- Import ---------------- */

export function appliquerImport(maisonId: string, operations: Operation[], auteur: Auteur) {
  return appliquer(
    operations.map((op): Ecriture => {
      switch (op.op) {
        case 'supprimer':
          return supprimer(refDoc(maisonId, op.collection, op.id));
        case 'creerAppareil':
          return (b) => b.set(refDoc(maisonId, 'appareils', op.id), { nom: op.nom, type: op.type, ordre: op.ordre, createdAt: serverTimestamp() });
        case 'creerTiroir':
          return (b) => b.set(refDoc(maisonId, 'tiroirs', op.id), { appareilId: op.appareilId, nom: op.nom, ordre: op.ordre });
        case 'creerAliment':
          return (b) =>
            b.set(refDoc(maisonId, 'aliments', op.id), {
              tiroirId: op.tiroirId,
              appareilId: op.appareilId,
              nom: op.aliment.nom,
              quantite: op.aliment.quantite,
              quantiteMax: op.aliment.quantiteMax,
              unite: op.aliment.unite,
              datePeremption: op.aliment.datePeremption,
              note: op.aliment.note,
              dansPanier: false,
              achatQuantite: null,
              ajoutePar: auteur.uid,
              ajouteParPrenom: auteur.prenom.slice(0, 40) || 'Moi',
              modifiePar: auteur.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
        case 'majMaxAliment':
          return (b) => b.update(refDoc(maisonId, 'aliments', op.id), { quantiteMax: op.quantiteMax, modifiePar: auteur.uid, updatedAt: serverTimestamp() });
        case 'creerLibre':
          return (b) =>
            b.set(refDoc(maisonId, 'coursesLibres', op.id), {
              nom: op.nom,
              quantite: op.quantite,
              unite: op.unite,
              dansPanier: false,
              ajoutePar: auteur.uid,
              createdAt: serverTimestamp(),
            });
      }
    }),
  );
}
