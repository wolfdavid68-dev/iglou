import { ConvexError } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

/**
 * Règles d'accès communes (équivalent des anciennes règles Firestore) :
 * on ne lit et ne modifie que les maisons dont on est membre.
 */

export type CodeErreur = 'unauthenticated' | 'permission-denied' | 'invalid-argument' | 'not-found' | 'already-exists';

export function erreur(code: CodeErreur, detail?: string) {
  return new ConvexError({ code, detail: detail ?? '' });
}

type Ctx = QueryCtx | MutationCtx;

export interface Moi {
  uid: string;
  email: string;
}

/** Utilisateur Firebase connecté (uid = `sub` du jeton), ou null. */
export async function identite(ctx: Ctx): Promise<Moi | null> {
  const i = await ctx.auth.getUserIdentity();
  return i ? { uid: i.subject, email: i.email ?? '' } : null;
}

export async function exigerIdentite(ctx: Ctx): Promise<Moi> {
  const moi = await identite(ctx);
  if (!moi) throw erreur('unauthenticated');
  return moi;
}

export function adhesion(ctx: Ctx, maisonId: string, uid: string) {
  return ctx.db
    .query('membres')
    .withIndex('par_maison', (q) => q.eq('maisonId', maisonId).eq('uid', uid))
    .first();
}

/** Membre de la maison, sinon refus. */
export async function exigerMembre(ctx: Ctx, maisonId: string): Promise<{ moi: Moi; membre: Doc<'membres'> }> {
  const moi = await exigerIdentite(ctx);
  const membre = await adhesion(ctx, maisonId, moi.uid);
  if (!membre) throw erreur('permission-denied');
  return { moi, membre };
}

export async function exigerProprietaire(ctx: Ctx, maisonId: string) {
  const r = await exigerMembre(ctx, maisonId);
  if (r.membre.role !== 'proprietaire') throw erreur('permission-denied');
  return r;
}

export function maisonParId(ctx: Ctx, id: string) {
  return ctx.db
    .query('maisons')
    .withIndex('par_id', (q) => q.eq('id', id))
    .first();
}

export type TableMaison = 'appareils' | 'tiroirs' | 'aliments' | 'coursesLibres' | 'consommations';

/** Document `id` d'une table de la maison (jamais d'une autre maison). */
export function trouver<T extends TableMaison>(ctx: Ctx, table: T, maisonId: string, id: string): Promise<Doc<T> | null> {
  // Toutes ces tables ont le même index `par_maison` (maisonId, id) : TypeScript ne sait pas l'exprimer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = ctx.db.query(table) as any;
  return q.withIndex('par_maison', (i: any) => i.eq('maisonId', maisonId).eq('id', id)).first();
}

/** Tout le contenu d'une table pour une maison. */
export function lister<T extends TableMaison>(ctx: Ctx, table: T, maisonId: string): Promise<Doc<T>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = ctx.db.query(table) as any;
  return q.withIndex('par_maison', (i: any) => i.eq('maisonId', maisonId)).collect();
}

/* ---------- Validation des données reçues (l'app n'est jamais crue sur parole) ---------- */

function invalide(champ: string): never {
  throw erreur('invalid-argument', champ);
}

export const verifier = {
  /** Identifiant applicatif : celui de Firestore ou généré par l'app. */
  id(v: string, champ = 'id') {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) invalide(champ);
    return v;
  },
  codeInvitation(v: string) {
    if (!/^[A-Z0-9]{6}$/.test(v)) invalide('codeInvitation');
    return v;
  },
  /** Texte non vide d'au plus `max` caractères (espaces de bord retirés). */
  texte(v: string, max: number, champ: string) {
    const t = v.trim();
    if (t.length === 0 || t.length > max) invalide(champ);
    return t;
  },
  texteOuNul(v: string | null, max: number, champ: string) {
    if (v !== null && v.length > max) invalide(champ);
    return v;
  },
  entier(v: number, champ: string) {
    if (!Number.isInteger(v) || v < 0) invalide(champ);
    return v;
  },
  /** Nombre fini ≥ 0 (ou > 0 si `strict`). */
  nombre(v: number, champ: string, strict = false) {
    if (!Number.isFinite(v) || v < 0 || (strict && v === 0)) invalide(champ);
    return v;
  },
};

/** Règle du maximum : le stock plein n'est jamais inférieur à la quantité. */
export function verifierAliment(a: Pick<Doc<'aliments'>, 'nom' | 'quantite' | 'quantiteMax' | 'datePeremption' | 'note' | 'achatQuantite' | 'ajouteParPrenom'>) {
  verifier.texte(a.nom, 80, 'nom');
  verifier.nombre(a.quantite, 'quantite');
  verifier.nombre(a.quantiteMax, 'quantiteMax', true);
  if (a.quantiteMax < a.quantite) invalide('quantiteMax');
  verifier.texteOuNul(a.datePeremption, 10, 'datePeremption');
  verifier.texteOuNul(a.note, 500, 'note');
  if (a.achatQuantite !== null) verifier.nombre(a.achatQuantite, 'achatQuantite', true);
  verifier.texte(a.ajouteParPrenom, 40, 'ajouteParPrenom');
}
