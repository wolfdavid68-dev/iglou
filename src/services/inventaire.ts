import { api } from '../../convex/_generated/api';
import type { ResultatRestauration } from '@/domaine/annulation';
import { planRangement } from '@/domaine/courses';
import { nouvelId } from '@/domaine/ids';
import type { Operation } from '@/domaine/import-export';
import { nomsTiroirsParDefaut } from '@/domaine/inventaire';
import { appliquerOperations, type DonneesServeur, type OperationInventaire } from '@/domaine/operations';
import { arrondir } from '@/domaine/texte';
import type { Aliment, Appareil, CourseLibre, Tiroir, TypeAppareil, Unite } from '@/domaine/types';
import { convex } from './convex';
import { auth } from './firebase';

/** Qui écrit (le serveur vérifie de toute façon l'identité réelle). */
export interface Auteur {
  uid: string;
  prenom: string;
}

/**
 * Envoie des opérations au serveur, appliquées en une seule transaction.
 * Elles sont rejouées tout de suite sur les données locales : l'écran se met
 * à jour sans attendre le réseau. Hors ligne, l'envoi part au retour du réseau
 * (tant que l'app reste ouverte).
 */
function ecrire(maisonId: string, operations: OperationInventaire[]) {
  const u = auth.currentUser;
  const auteur = { uid: u?.uid ?? '', prenom: u?.displayName ?? '' };
  return convex.mutation(
    api.inventaire.appliquer,
    { maisonId, operations },
    {
      optimisticUpdate: (store) => {
        const d = store.getQuery(api.donnees.maison, { maisonId });
        if (!d) return;
        store.setQuery(api.donnees.maison, { maisonId }, appliquerOperations(d as DonneesServeur, operations, auteur, Date.now()) as typeof d);
      },
    },
  );
}

/* ---------------- Appareils ---------------- */

export function creerAppareil(maisonId: string, nom: string, type: TypeAppareil, nombreTiroirs: number, ordre: number) {
  const appareilId = nouvelId();
  const ecriture = ecrire(maisonId, [
    { op: 'creerAppareil', id: appareilId, nom: nom.trim(), type, ordre },
    ...nomsTiroirsParDefaut(nombreTiroirs).map((nomTiroir, i): OperationInventaire => ({ op: 'creerTiroir', id: nouvelId(), appareilId, nom: nomTiroir, ordre: i })),
  ]);
  return { appareilId, ecriture };
}

export function modifierAppareil(maisonId: string, appareil: Appareil, champs: Partial<Pick<Appareil, 'nom' | 'type' | 'ordre'>>) {
  return ecrire(maisonId, [{ op: 'majAppareil', id: appareil.id, ...champs }]);
}

export function reordonnerAppareils(maisonId: string, appareils: Appareil[]) {
  return ecrire(
    maisonId,
    appareils.flatMap((a, i): OperationInventaire[] => (a.ordre !== i ? [{ op: 'majAppareil', id: a.id, ordre: i }] : [])),
  );
}

/** Supprime l'appareil, ses tiroirs et leur contenu (le serveur s'en charge). */
export function supprimerAppareil(maisonId: string, appareil: Appareil) {
  return ecrire(maisonId, [{ op: 'supprimerAppareil', id: appareil.id }]);
}

/* ---------------- Tiroirs ---------------- */

export function ajouterTiroir(maisonId: string, appareilId: string, nom: string, ordre: number) {
  return ecrire(maisonId, [{ op: 'creerTiroir', id: nouvelId(), appareilId, nom: nom.trim(), ordre }]);
}

export function renommerTiroir(maisonId: string, tiroirId: string, nom: string) {
  return ecrire(maisonId, [{ op: 'majTiroir', id: tiroirId, nom: nom.trim() }]);
}

export function reordonnerTiroirs(maisonId: string, tiroirs: Tiroir[]) {
  return ecrire(
    maisonId,
    tiroirs.flatMap((t, i): OperationInventaire[] => (t.ordre !== i ? [{ op: 'majTiroir', id: t.id, ordre: i }] : [])),
  );
}

/**
 * Supprime un tiroir. Son contenu est soit déplacé vers `destination`, soit
 * supprimé (`destination` nul).
 */
export function supprimerTiroir(maisonId: string, tiroir: Tiroir, contenu: Aliment[], destination: Tiroir | null) {
  return ecrire(maisonId, [
    ...contenu.map(
      (a): OperationInventaire =>
        destination
          ? { op: 'majAliment', id: a.id, champs: { tiroirId: destination.id, appareilId: destination.appareilId } }
          : { op: 'supprimerAliment', id: a.id },
    ),
    { op: 'supprimerTiroir', id: tiroir.id },
  ]);
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
  const id = nouvelId();
  const ecriture = ecrire(maisonId, [
    {
      op: 'creerAliment',
      id,
      ...a,
      nom: a.nom.trim(),
      dansPanier: false,
      achatQuantite: null,
      ajouteParPrenom: auteur.prenom.slice(0, 40) || 'Moi',
    },
  ]);
  return { id, ecriture };
}

export type ChampsAliment = Partial<
  Pick<Aliment, 'tiroirId' | 'appareilId' | 'nom' | 'quantite' | 'quantiteMax' | 'unite' | 'datePeremption' | 'note' | 'dansPanier' | 'achatQuantite'>
>;

/**
 * Mise à jour partielle : l'auteur et la date d'ajout ne sont jamais réécrits.
 * Quantité et maximum doivent être fournis ensemble quand l'un change
 * (voir `fixerQuantite` / `modifierMaximum`).
 */
export function modifierAliment(maisonId: string, id: string, champs: ChampsAliment) {
  return ecrire(maisonId, [{ op: 'majAliment', id, champs }]);
}

/**
 * Baisse de stock (« − » ou « épuisé ») : met à jour l'aliment et note la
 * sortie dans l'historique (statistiques), dans la même transaction.
 */
export function consommerAliment(maisonId: string, a: Aliment, nouvelleQuantite: number) {
  const operations: OperationInventaire[] = [{ op: 'majAliment', id: a.id, champs: { quantite: nouvelleQuantite, quantiteMax: a.quantiteMax } }];
  const sortie = arrondir(a.quantite - nouvelleQuantite);
  if (sortie > 0) operations.push({ op: 'consommation', id: nouvelId(), nom: a.nom, quantite: sortie, unite: a.unite, appareilId: a.appareilId });
  return ecrire(maisonId, operations);
}

export function deplacerAliment(maisonId: string, aliment: Aliment, cible: Tiroir) {
  return modifierAliment(maisonId, aliment.id, { tiroirId: cible.id, appareilId: cible.appareilId });
}

export function supprimerAliment(maisonId: string, id: string) {
  return ecrire(maisonId, [{ op: 'supprimerAliment', id }]);
}

/**
 * Réinsère un aliment supprimé avec le même id et les mêmes données. Si l'id
 * existe déjà (autre membre, double appui), le serveur ne fait rien.
 */
export async function restaurerAliment(maisonId: string, a: Aliment, auteur: Auteur): Promise<ResultatRestauration> {
  const { dejaPresents } = await ecrire(maisonId, [
    {
      op: 'creerAliment',
      id: a.id,
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
      ...(a.ajoutePar && { ajoutePar: a.ajoutePar }),
      ajouteParPrenom: a.ajouteParPrenom || auteur.prenom,
      ...(a.createdAt != null && { createdAt: a.createdAt }),
      siAbsent: true,
    },
  ]);
  return dejaPresents.includes(a.id) ? 'existe-deja' : 'restaure';
}

/* ---------------- Courses ---------------- */

export function ajouterLibre(maisonId: string, nom: string, quantite: number, unite: Unite) {
  return ecrire(maisonId, [{ op: 'creerLibre', id: nouvelId(), nom: nom.trim(), quantite, unite }]);
}

/** Plusieurs articles d'un coup (ingrédients manquants d'une recette), 1 pièce chacun. */
export function ajouterLibres(maisonId: string, noms: string[]) {
  return ecrire(
    maisonId,
    noms.map((nom): OperationInventaire => ({ op: 'creerLibre', id: nouvelId(), nom: nom.trim(), quantite: 1, unite: 'pièce' })),
  );
}

export function modifierLibre(maisonId: string, id: string, champs: Partial<Pick<CourseLibre, 'nom' | 'quantite' | 'unite' | 'dansPanier'>>) {
  return ecrire(maisonId, [{ op: 'majLibre', id, champs }]);
}

export function supprimerLibre(maisonId: string, id: string) {
  return ecrire(maisonId, [{ op: 'supprimerLibre', id }]);
}

/**
 * « J'ai rangé les courses » : remet en stock les aliments cochés et retire
 * les articles libres cochés de la liste.
 */
export function rangerCourses(maisonId: string, aliments: Aliment[], libres: CourseLibre[]) {
  const plan = planRangement(aliments, libres);
  return ecrire(maisonId, [
    ...plan.aliments.map(({ id, ...champs }): OperationInventaire => ({ op: 'majAliment', id, champs })),
    ...plan.libres.map((l): OperationInventaire => ({ op: 'supprimerLibre', id: l.id })),
  ]);
}

/* ---------------- Import ---------------- */

/** Applique un plan d'import en une seule transaction : tout ou rien. */
export function appliquerImport(maisonId: string, operations: Operation[], auteur: Auteur) {
  return ecrire(
    maisonId,
    operations.map((op): OperationInventaire => {
      switch (op.op) {
        case 'supprimer':
          return op.collection === 'appareils'
            ? { op: 'supprimerAppareil', id: op.id }
            : op.collection === 'tiroirs'
              ? { op: 'supprimerTiroir', id: op.id }
              : op.collection === 'aliments'
                ? { op: 'supprimerAliment', id: op.id }
                : { op: 'supprimerLibre', id: op.id };
        case 'creerAppareil':
          return { op: 'creerAppareil', id: op.id, nom: op.nom, type: op.type, ordre: op.ordre };
        case 'creerTiroir':
          return { op: 'creerTiroir', id: op.id, appareilId: op.appareilId, nom: op.nom, ordre: op.ordre };
        case 'creerAliment':
          return {
            op: 'creerAliment',
            id: op.id,
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
            ajouteParPrenom: auteur.prenom.slice(0, 40) || 'Moi',
          };
        case 'majMaxAliment':
          return { op: 'majAliment', id: op.id, champs: { quantiteMax: op.quantiteMax } };
        case 'creerLibre':
          return { op: 'creerLibre', id: op.id, nom: op.nom, quantite: op.quantite, unite: op.unite };
      }
    }),
  );
}
