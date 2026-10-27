import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

/**
 * Contrôles d'accès, repris des anciennes règles Firestore : un utilisateur ne
 * lit et ne modifie que les maisons dont il est membre.
 */

/** Erreur avec un code stable, lisible par l'app (voir messageErreur). */
export const refus = (code: 'non-connecte' | 'refuse' | 'invalide' | 'introuvable' = 'refuse') => new ConvexError({ code });

export interface Moi {
  userId: Id<'users'>;
  /** Identifiant utilisé dans les données (ajoutePar, membres…). */
  uid: string;
  user: Doc<'users'>;
}

/** uid d'un compte : celui repris de Firebase, sinon l'id Convex. */
export const uidDe = (user: Doc<'users'>) => user.uid ?? user._id;

export async function moiOuNul(ctx: QueryCtx): Promise<Moi | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return { userId, uid: uidDe(user), user };
}

export async function moi(ctx: QueryCtx): Promise<Moi> {
  const m = await moiOuNul(ctx);
  if (!m) throw refus('non-connecte');
  return m;
}

export async function adhesion(ctx: QueryCtx, maison: string, uid: string) {
  return ctx.db
    .query('membres')
    .withIndex('par_maison_uid', (q) => q.eq('maison', maison).eq('uid', uid))
    .unique();
}

export async function maisonParCle(ctx: QueryCtx, cle: string) {
  return ctx.db
    .query('maisons')
    .withIndex('par_cle', (q) => q.eq('cle', cle))
    .unique();
}

/** L'utilisateur connecté, s'il est membre de la maison ; refus sinon. */
export async function exigerMembre(ctx: QueryCtx, maison: string) {
  const m = await moi(ctx);
  const membre = await adhesion(ctx, maison, m.uid);
  if (!membre) throw refus();
  return { ...m, membre };
}

export async function exigerProprietaire(ctx: QueryCtx, maison: string) {
  const r = await exigerMembre(ctx, maison);
  if (r.membre.role !== 'proprietaire') throw refus();
  return r;
}

/* ---------- Validation des champs (comme firestore.rules) ---------- */

export function texte(v: string, max: number) {
  if (v.length === 0 || v.length > max) throw refus('invalide');
  return v;
}

export function texteOuNul(v: string | null, max: number) {
  if (v != null && v.length > max) throw refus('invalide');
  return v;
}

export function codeInvitationValide(code: string) {
  return /^[A-Z0-9]{6}$/.test(code);
}
