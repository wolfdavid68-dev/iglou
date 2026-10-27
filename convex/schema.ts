import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Chaque document garde un identifiant texte `cle` choisi par l'application
 * (comme les ids Firestore) : l'interface peut afficher un nouvel élément
 * avant la réponse du serveur, et les données reprises de Firebase gardent
 * leurs ids et leurs liens (tiroirId, appareilId…).
 *
 * Toutes les dates sont en millisecondes.
 */
export const unite = v.union(v.literal('pièce'), v.literal('g'), v.literal('kg'), v.literal('L'), v.literal('portion'));
export const typeAppareil = v.union(v.literal('frigo'), v.literal('congelateur'));
export const role = v.union(v.literal('proprietaire'), v.literal('membre'));

export default defineSchema({
  ...authTables,

  // Table des comptes de Convex Auth, complétée par l'app.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** Prénom affiché aux autres membres. */
    prenom: v.optional(v.string()),
    /** Identifiant repris de Firebase Auth (comptes transférés). Sinon, l'id Convex sert d'uid. */
    uid: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('uid', ['uid']),

  maisons: defineTable({
    cle: v.string(),
    nom: v.string(),
    codeInvitation: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index('par_cle', ['cle'])
    .index('par_code', ['codeInvitation']),

  membres: defineTable({
    maison: v.string(),
    uid: v.string(),
    prenom: v.string(),
    role,
    joinedAt: v.number(),
  })
    .index('par_maison_uid', ['maison', 'uid'])
    .index('par_uid', ['uid']),

  appareils: defineTable({
    maison: v.string(),
    cle: v.string(),
    nom: v.string(),
    type: typeAppareil,
    ordre: v.number(),
    createdAt: v.number(),
  }).index('par_maison_cle', ['maison', 'cle']),

  tiroirs: defineTable({
    maison: v.string(),
    cle: v.string(),
    appareilId: v.string(),
    nom: v.string(),
    ordre: v.number(),
  }).index('par_maison_cle', ['maison', 'cle']),

  aliments: defineTable({
    maison: v.string(),
    cle: v.string(),
    tiroirId: v.string(),
    appareilId: v.string(),
    nom: v.string(),
    quantite: v.number(),
    quantiteMax: v.number(),
    unite,
    datePeremption: v.union(v.string(), v.null()),
    note: v.union(v.string(), v.null()),
    dansPanier: v.boolean(),
    achatQuantite: v.union(v.number(), v.null()),
    ajoutePar: v.string(),
    ajouteParPrenom: v.string(),
    modifiePar: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('par_maison_cle', ['maison', 'cle']),

  coursesLibres: defineTable({
    maison: v.string(),
    cle: v.string(),
    nom: v.string(),
    quantite: v.number(),
    unite,
    dansPanier: v.boolean(),
    ajoutePar: v.string(),
    createdAt: v.number(),
  }).index('par_maison_cle', ['maison', 'cle']),

  /** Journal des sorties de stock (statistiques), en ajout seul. */
  consommations: defineTable({
    maison: v.string(),
    cle: v.string(),
    nom: v.string(),
    quantite: v.number(),
    unite,
    appareilId: v.string(),
    par: v.string(),
    at: v.number(),
  })
    .index('par_maison_cle', ['maison', 'cle'])
    .index('par_maison_at', ['maison', 'at']),

  /**
   * Comptes Firebase en attente (transfert) : remplie par `npx convex import`,
   * vidée par `transfert:finaliserComptes`, qui crée les vrais comptes.
   */
  transfertComptes: defineTable({
    uid: v.string(),
    email: v.string(),
    prenom: v.optional(v.string()),
    emailVerifie: v.optional(v.boolean()),
    /** Hash et sel Firebase (base64), absents pour un compte sans mot de passe. */
    hash: v.optional(v.string()),
    sel: v.optional(v.string()),
  }),

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
