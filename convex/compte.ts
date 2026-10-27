import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { mutation } from './_generated/server';
import { moi } from './acces';
import { effacerMaison } from './maisons';

/**
 * Supprime définitivement le compte connecté (exigence du Play Store) :
 * - maison partagée dont je suis propriétaire : je passe la main au plus
 *   ancien membre, la maison et son inventaire restent aux autres ;
 * - maison où je suis seul : elle est supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis le compte lui-même (sessions, identifiants).
 *
 * L'app redemande le mot de passe (nouvelle connexion) juste avant.
 */
export const supprimer = mutation({
  args: {},
  handler: async (ctx) => {
    const { uid, userId } = await moi(ctx);

    const adhesions = await ctx.db
      .query('membres')
      .withIndex('par_uid', (q) => q.eq('uid', uid))
      .collect();
    for (const a of adhesions) {
      if (a.role === 'proprietaire') {
        const autres = (
          await ctx.db
            .query('membres')
            .withIndex('par_maison_uid', (q) => q.eq('maison', a.maison))
            .collect()
        )
          .filter((m) => m.uid !== uid)
          .sort((x, y) => x.joinedAt - y.joinedAt);
        if (autres.length === 0) {
          await effacerMaison(ctx, a.maison);
          continue;
        }
        await ctx.db.patch(autres[0]._id, { role: 'proprietaire' });
      }
      await ctx.db.delete(a._id);
    }

    await effacerCompte(ctx, userId);
  },
});

/** Efface un compte et tout ce que Convex Auth y rattache. */
export async function effacerCompte(ctx: MutationCtx, userId: Id<'users'>) {
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
    for (const code of codes) await ctx.db.delete(code._id);
    const limite = await ctx.db
      .query('authRateLimits')
      .withIndex('identifier', (q) => q.eq('identifier', c._id))
      .unique();
    if (limite) await ctx.db.delete(limite._id);
    await ctx.db.delete(c._id);
  }
  await ctx.db.delete(userId);
}
