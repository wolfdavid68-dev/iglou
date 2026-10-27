import { v, type Infer } from 'convex/values';

export const vUnite = v.union(v.literal('pièce'), v.literal('g'), v.literal('kg'), v.literal('L'), v.literal('portion'));
export const vTypeAppareil = v.union(v.literal('frigo'), v.literal('congelateur'));
export const vRole = v.union(v.literal('proprietaire'), v.literal('membre'));
const texteOuNul = v.union(v.string(), v.null());
const nombreOuNul = v.union(v.number(), v.null());

/**
 * Écritures sur l'inventaire d'une maison. Une liste d'opérations est appliquée
 * en une seule transaction par `inventaire.appliquer`, et rejouée telle quelle
 * sur les données locales pour un affichage immédiat (mise à jour optimiste).
 */
export const vOperation = v.union(
  v.object({ op: v.literal('creerAppareil'), id: v.string(), nom: v.string(), type: vTypeAppareil, ordre: v.number() }),
  v.object({
    op: v.literal('majAppareil'),
    id: v.string(),
    nom: v.optional(v.string()),
    type: v.optional(vTypeAppareil),
    ordre: v.optional(v.number()),
  }),
  /** Supprime aussi ses tiroirs et leurs aliments. */
  v.object({ op: v.literal('supprimerAppareil'), id: v.string() }),

  v.object({ op: v.literal('creerTiroir'), id: v.string(), appareilId: v.string(), nom: v.string(), ordre: v.number() }),
  v.object({ op: v.literal('majTiroir'), id: v.string(), nom: v.optional(v.string()), ordre: v.optional(v.number()) }),
  /** Le contenu doit avoir été déplacé ou supprimé par des opérations précédentes. */
  v.object({ op: v.literal('supprimerTiroir'), id: v.string() }),

  v.object({
    op: v.literal('creerAliment'),
    id: v.string(),
    tiroirId: v.string(),
    appareilId: v.string(),
    nom: v.string(),
    quantite: v.number(),
    quantiteMax: v.number(),
    unite: vUnite,
    datePeremption: texteOuNul,
    note: texteOuNul,
    dansPanier: v.boolean(),
    achatQuantite: nombreOuNul,
    /** Restauration après suppression : auteur et date d'origine. Sinon : moi, maintenant. */
    ajoutePar: v.optional(v.string()),
    ajouteParPrenom: v.string(),
    createdAt: v.optional(v.number()),
    /** Ne rien faire (sans erreur) si l'aliment existe déjà. */
    siAbsent: v.optional(v.boolean()),
  }),
  v.object({
    op: v.literal('majAliment'),
    id: v.string(),
    champs: v.object({
      tiroirId: v.optional(v.string()),
      appareilId: v.optional(v.string()),
      nom: v.optional(v.string()),
      quantite: v.optional(v.number()),
      quantiteMax: v.optional(v.number()),
      unite: v.optional(vUnite),
      datePeremption: v.optional(texteOuNul),
      note: v.optional(texteOuNul),
      dansPanier: v.optional(v.boolean()),
      achatQuantite: v.optional(nombreOuNul),
    }),
  }),
  v.object({ op: v.literal('supprimerAliment'), id: v.string() }),

  v.object({ op: v.literal('creerLibre'), id: v.string(), nom: v.string(), quantite: v.number(), unite: vUnite }),
  v.object({
    op: v.literal('majLibre'),
    id: v.string(),
    champs: v.object({
      nom: v.optional(v.string()),
      quantite: v.optional(v.number()),
      unite: v.optional(vUnite),
      dansPanier: v.optional(v.boolean()),
    }),
  }),
  v.object({ op: v.literal('supprimerLibre'), id: v.string() }),

  /** Sortie de stock pour les statistiques (auteur et date fixés par le serveur). */
  v.object({ op: v.literal('consommation'), id: v.string(), nom: v.string(), quantite: v.number(), unite: vUnite, appareilId: v.string() }),
);

export type OperationInventaire = Infer<typeof vOperation>;
