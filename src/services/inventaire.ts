import { restaurerSiAbsent, type ResultatRestauration } from '@/domaine/annulation';
import { planRangement } from '@/domaine/courses';
import type { Operation } from '@/domaine/import-export';
import { nomsTiroirsParDefaut } from '@/domaine/inventaire';
import { arrondir } from '@/domaine/texte';
import type { Aliment, Appareil, CourseLibre, Tiroir, TypeAppareil, Unite } from '@/domaine/types';
import { api, convex, nouvelId } from './convex';
import { envoyer, type Op } from './lots';

/** Qui écrit (le serveur enregistre `modifiePar` d'après le compte connecté). */
export interface Auteur {
  uid: string;
  prenom: string;
}

const suppression = (col: 'appareils' | 'tiroirs' | 'aliments' | 'coursesLibres', id: string): Op => ({ op: 'delete', col, id });

/* ---------------- Appareils ---------------- */

export function creerAppareil(maisonId: string, nom: string, type: TypeAppareil, nombreTiroirs: number, ordre: number) {
  const appareilId = nouvelId();
  const ops: Op[] = [{ op: 'set', col: 'appareils', id: appareilId, d: { nom: nom.trim(), type, ordre } }];
  nomsTiroirsParDefaut(nombreTiroirs).forEach((nomTiroir, i) => {
    ops.push({ op: 'set', col: 'tiroirs', id: nouvelId(), d: { appareilId, nom: nomTiroir, ordre: i } });
  });
  return { appareilId, ecriture: envoyer(maisonId, ops) };
}

export function modifierAppareil(maisonId: string, appareil: Appareil, champs: Partial<Pick<Appareil, 'nom' | 'type' | 'ordre'>>) {
  return envoyer(maisonId, [{ op: 'update', col: 'appareils', id: appareil.id, d: champs }]);
}

export function reordonnerAppareils(maisonId: string, appareils: Appareil[]) {
  const ops = appareils.flatMap((a, i): Op[] => (a.ordre !== i ? [{ op: 'update', col: 'appareils', id: a.id, d: { ordre: i } }] : []));
  return envoyer(maisonId, ops);
}

export function supprimerAppareil(maisonId: string, appareil: Appareil, tiroirs: Tiroir[], aliments: Aliment[]) {
  return envoyer(maisonId, [
    ...aliments.filter((a) => a.appareilId === appareil.id).map((a) => suppression('aliments', a.id)),
    ...tiroirs.filter((t) => t.appareilId === appareil.id).map((t) => suppression('tiroirs', t.id)),
    suppression('appareils', appareil.id),
  ]);
}

/* ---------------- Tiroirs ---------------- */

export function ajouterTiroir(maisonId: string, appareilId: string, nom: string, ordre: number) {
  return envoyer(maisonId, [{ op: 'set', col: 'tiroirs', id: nouvelId(), d: { appareilId, nom: nom.trim(), ordre } }]);
}

export function renommerTiroir(maisonId: string, tiroirId: string, nom: string) {
  return envoyer(maisonId, [{ op: 'update', col: 'tiroirs', id: tiroirId, d: { nom: nom.trim() } }]);
}

export function reordonnerTiroirs(maisonId: string, tiroirs: Tiroir[]) {
  const ops = tiroirs.flatMap((t, i): Op[] => (t.ordre !== i ? [{ op: 'update', col: 'tiroirs', id: t.id, d: { ordre: i } }] : []));
  return envoyer(maisonId, ops);
}

/**
 * Supprime un tiroir. Son contenu est soit déplacé vers `destination`, soit
 * supprimé (`destination` nul).
 */
export function supprimerTiroir(maisonId: string, tiroir: Tiroir, contenu: Aliment[], destination: Tiroir | null, auteur: Auteur) {
  const ops: Op[] = contenu.map(
    (a): Op =>
      destination
        ? { op: 'update', col: 'aliments', id: a.id, d: { tiroirId: destination.id, appareilId: destination.appareilId } }
        : suppression('aliments', a.id),
  );
  ops.push(suppression('tiroirs', tiroir.id));
  return envoyer(maisonId, ops);
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
  const ecriture = envoyer(maisonId, [
    {
      op: 'set',
      col: 'aliments',
      id,
      d: {
        ...a,
        nom: a.nom.trim(),
        dansPanier: false,
        achatQuantite: null,
        ajoutePar: auteur.uid,
        ajouteParPrenom: auteur.prenom.slice(0, 40) || 'Moi',
      },
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
export function modifierAliment(maisonId: string, id: string, champs: ChampsAliment, auteur: Auteur) {
  return envoyer(maisonId, [{ op: 'update', col: 'aliments', id, d: champs }]);
}

/**
 * Baisse de stock (« − » ou « épuisé ») : met à jour l'aliment et note la
 * sortie dans l'historique (statistiques), dans le même lot.
 */
export function consommerAliment(maisonId: string, a: Aliment, nouvelleQuantite: number, auteur: Auteur) {
  const ops: Op[] = [{ op: 'update', col: 'aliments', id: a.id, d: { quantite: nouvelleQuantite, quantiteMax: a.quantiteMax } }];
  const sortie = arrondir(a.quantite - nouvelleQuantite);
  if (sortie > 0) {
    ops.push({ op: 'set', col: 'consommations', id: nouvelId(), d: { nom: a.nom, quantite: sortie, unite: a.unite, appareilId: a.appareilId } });
  }
  return envoyer(maisonId, ops);
}

export function deplacerAliment(maisonId: string, aliment: Aliment, cible: Tiroir, auteur: Auteur) {
  return modifierAliment(maisonId, aliment.id, { tiroirId: cible.id, appareilId: cible.appareilId }, auteur);
}

export function supprimerAliment(maisonId: string, id: string) {
  return envoyer(maisonId, [suppression('aliments', id)]);
}

/** Réinsère un aliment supprimé avec le même id et les mêmes données. */
export function restaurerAliment(maisonId: string, a: Aliment, auteur: Auteur): Promise<ResultatRestauration> {
  return restaurerSiAbsent(
    async () => {
      const donnees = convex.watchQuery(api.donnees.maison, { maison: maisonId }).localQueryResult();
      return donnees?.aliments.some((x) => x.id === a.id) ?? false;
    },
    async () => {
      // Pas d'attente du serveur : la restauration apparaît tout de suite, même hors ligne.
      envoyer(maisonId, [
        {
          op: 'set',
          col: 'aliments',
          id: a.id,
          d: {
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
            ...(a.createdAt != null ? { createdAt: a.createdAt } : {}),
          },
        },
      ]).catch(() => {});
    },
  );
}

/* ---------------- Courses ---------------- */

const nouveauLibre = (nom: string, quantite: number, unite: Unite, auteur: Auteur): Op => ({
  op: 'set',
  col: 'coursesLibres',
  id: nouvelId(),
  d: { nom: nom.trim(), quantite, unite, dansPanier: false, ajoutePar: auteur.uid },
});

export function ajouterLibre(maisonId: string, nom: string, quantite: number, unite: Unite, auteur: Auteur) {
  return envoyer(maisonId, [nouveauLibre(nom, quantite, unite, auteur)]);
}

/** Plusieurs articles d'un coup (ingrédients manquants d'une recette), 1 pièce chacun. */
export function ajouterLibres(maisonId: string, noms: string[], auteur: Auteur) {
  return envoyer(
    maisonId,
    noms.map((nom) => nouveauLibre(nom, 1, 'pièce', auteur)),
  );
}

export function modifierLibre(maisonId: string, id: string, champs: Partial<Pick<CourseLibre, 'nom' | 'quantite' | 'unite' | 'dansPanier'>>) {
  return envoyer(maisonId, [{ op: 'update', col: 'coursesLibres', id, d: champs }]);
}

export function supprimerLibre(maisonId: string, id: string) {
  return envoyer(maisonId, [suppression('coursesLibres', id)]);
}

/**
 * « J'ai rangé les courses » : remet en stock les aliments cochés et retire
 * les articles libres cochés de la liste.
 */
export function rangerCourses(maisonId: string, aliments: Aliment[], libres: CourseLibre[], auteur: Auteur) {
  const plan = planRangement(aliments, libres);
  return envoyer(maisonId, [
    ...plan.aliments.map(({ id, ...champs }): Op => ({ op: 'update', col: 'aliments', id, d: champs })),
    ...plan.libres.map((l) => suppression('coursesLibres', l.id)),
  ]);
}

/* ---------------- Import ---------------- */

export function appliquerImport(maisonId: string, operations: Operation[], auteur: Auteur) {
  return envoyer(
    maisonId,
    operations.map((op): Op => {
      switch (op.op) {
        case 'supprimer':
          return suppression(op.collection, op.id);
        case 'creerAppareil':
          return { op: 'set', col: 'appareils', id: op.id, d: { nom: op.nom, type: op.type, ordre: op.ordre } };
        case 'creerTiroir':
          return { op: 'set', col: 'tiroirs', id: op.id, d: { appareilId: op.appareilId, nom: op.nom, ordre: op.ordre } };
        case 'creerAliment':
          return {
            op: 'set',
            col: 'aliments',
            id: op.id,
            d: {
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
            },
          };
        case 'majMaxAliment':
          return { op: 'update', col: 'aliments', id: op.id, d: { quantiteMax: op.quantiteMax } };
        case 'creerLibre':
          return {
            op: 'set',
            col: 'coursesLibres',
            id: op.id,
            d: { nom: op.nom, quantite: op.quantite, unite: op.unite, dansPanier: false, ajoutePar: auteur.uid },
          };
      }
    }),
  );
}
