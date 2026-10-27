import { retrieveAccount } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, internalQuery, type MutationCtx } from './_generated/server';
import { erreur, identite } from './lib';
import { effacerMaison } from './maisons';

/**
 * Suppression définitive du compte connecté (exigence du Play Store), après
 * vérification du mot de passe. Rien n'est effacé si le mot de passe est faux.
 */
export const supprimer = action({
  args: { motDePasse: v.string() },
  handler: async (ctx, { motDePasse }) => {
    const moi = await ctx.runQuery(internal.compte.connecte, {});
    if (!moi) throw erreur('unauthenticated');
    try {
      await retrieveAccount(ctx, { provider: 'password', account: { id: moi.email, secret: motDePasse } });
    } catch {
      throw new ConvexError({ code: 'auth/wrong-password' });
    }
    await ctx.runMutation(internal.compte.effacer, { userId: moi.userId, uid: moi.uid });
  },
});

export const connecte = internalQuery({
  args: {},
  handler: async (ctx) => {
    const moi = await identite(ctx);
    if (!moi) return null;
    const i = await ctx.auth.getUserIdentity();
    const userId = ctx.db.normalizeId('users', i!.subject.split('|')[0])!;
    return { uid: moi.uid, email: moi.email, userId };
  },
});

/**
 * Efface toutes mes données, en une seule transaction :
 * - maison partagée dont je suis propriétaire : le plus ancien membre le devient ;
 * - maison où je suis seul : supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis mon profil et mon compte (sessions, identifiants).
 */
export const effacer = internalMutation({
  args: { userId: v.id('users'), uid: v.string() },
  handler: async (ctx, { userId, uid }) => {
    await effacerDonnees(ctx, uid);
    await effacerCompte(ctx, userId);
  },
});

export async function effacerDonnees(ctx: MutationCtx, uid: string) {
  const adhesions = await ctx.db
    .query('membres')
    .withIndex('par_uid', (q) => q.eq('uid', uid))
    .collect();

  for (const a of adhesions) {
    if (a.role === 'proprietaire') {
      const autres = (
        await ctx.db
          .query('membres')
          .withIndex('par_maison', (q) => q.eq('maisonId', a.maisonId))
          .collect()
      )
        .filter((m) => m.uid !== uid)
        .sort((x, y) => x.joinedAt - y.joinedAt);
      if (autres.length === 0) {
        await effacerMaison(ctx, a.maisonId);
        continue;
      }
      await ctx.db.patch(autres[0]._id, { role: 'proprietaire' });
    }
    await ctx.db.delete(a._id);
  }

  const profils = await ctx.db
    .query('profils')
    .withIndex('par_uid', (q) => q.eq('uid', uid))
    .collect();
  for (const p of profils) await ctx.db.delete(p._id);
}

async function effacerCompte(ctx: MutationCtx, userId: Id<'users'>) {
  const sessions = await ctx.db
    .query('authSessions')
    .withIndex('userId', (q) => q.eq('userId', userId))
    .collect();
  for (const s of sessions) {
    const jetons = await ctx.db
      .query('authRefreshTokens')
      .withIndex('sessionId', (q) => q.eq('sessionId', s._id))
      .collect();
    for (const j of jetons) await ctx.db.delete(j._id);
    await ctx.db.delete(s._id);
  }
  const comptes = await ctx.db
    .query('authAccounts')
    .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
    .collect();
  for (const c of comptes) {
    const codes = await ctx.db
      .query('authVerificationCodes')
      .withIndex('accountId', (q) => q.eq('accountId', c._id))
      .collect();
    for (const x of codes) await ctx.db.delete(x._id);
    const limites = await ctx.db
      .query('authRateLimits')
      .withIndex('identifier', (q) => q.eq('identifier', c._id))
      .collect();
    for (const x of limites) await ctx.db.delete(x._id);
    await ctx.db.delete(c._id);
  }
  await ctx.db.delete(userId);
}
