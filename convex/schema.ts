import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { vRole, vTypeAppareil, vUnite } from './validateurs';

/**
 * Base Convex d'Iglou. Chaque document garde un identifiant applicatif `id`
 * (celui de Firestore pour les données transférées, généré par l'app sinon) :
 * les liens, la maison active mémorisée et l'annulation fonctionnent tels quels.
 * Toutes les données d'une maison portent `maisonId` ; les index commencent par
 * lui, si bien qu'une lecture ne sort jamais de la maison demandée.
 *
 * Les comptes restent sur Firebase Authentication : `uid` = uid Firebase.
 */
export default defineSchema({
  profils: defineTable({
    uid: v.string(),
    prenom: v.string(),
    createdAt: v.number(),
  }).index('par_uid', ['uid']),

  maisons: defineTable({
    id: v.string(),
    nom: v.string(),
    codeInvitation: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index('par_id', ['id'])
    .index('par_code', ['codeInvitation']),

  membres: defineTable({
    maisonId: v.string(),
    uid: v.string(),
    prenom: v.string(),
    role: vRole,
    joinedAt: v.number(),
  })
    .index('par_maison', ['maisonId', 'uid'])
    .index('par_uid', ['uid']),

  appareils: defineTable({
    maisonId: v.string(),
    id: v.string(),
    nom: v.string(),
    type: vTypeAppareil,
    ordre: v.number(),
    createdAt: v.number(),
  }).index('par_maison', ['maisonId', 'id']),

  tiroirs: defineTable({
    maisonId: v.string(),
    id: v.string(),
    appareilId: v.string(),
    nom: v.string(),
    ordre: v.number(),
  }).index('par_maison', ['maisonId', 'id']),

  aliments: defineTable({
    maisonId: v.string(),
    id: v.string(),
    tiroirId: v.string(),
    appareilId: v.string(),
    nom: v.string(),
    quantite: v.number(),
    quantiteMax: v.number(),
    unite: vUnite,
    datePeremption: v.union(v.string(), v.null()),
    note: v.union(v.string(), v.null()),
    dansPanier: v.boolean(),
    achatQuantite: v.union(v.number(), v.null()),
    ajoutePar: v.string(),
    ajouteParPrenom: v.string(),
    modifiePar: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('par_maison', ['maisonId', 'id']),

  coursesLibres: defineTable({
    maisonId: v.string(),
    id: v.string(),
    nom: v.string(),
    quantite: v.number(),
    unite: vUnite,
    dansPanier: v.boolean(),
    ajoutePar: v.string(),
    createdAt: v.number(),
  }).index('par_maison', ['maisonId', 'id']),

  /** Journal des sorties de stock (statistiques), en ajout seul. */
  consommations: defineTable({
    maisonId: v.string(),
    id: v.string(),
    nom: v.string(),
    quantite: v.number(),
    unite: vUnite,
    appareilId: v.string(),
    par: v.string(),
    at: v.number(),
  })
    .index('par_maison', ['maisonId', 'id'])
    .index('par_maison_date', ['maisonId', 'at']),

  /** Bugs et idées envoyés depuis l'app : lus depuis le tableau de bord Convex. */
  signalements: defineTable({
    uid: v.string(),
    email: v.string(),
    prenom: v.union(v.string(), v.null()),
    maisonId: v.string(),
    message: v.string(),
    appareil: v.union(v.string(), v.null()),
    systeme: v.union(v.string(), v.null()),
    versionApp: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }),
});
