import { mutation } from './_generated/server';
import { exigerIdentite } from './lib';
import { effacerMaison } from './maisons';

/**
 * Efface toutes mes données avant la suppression du compte Firebase
 * (exigence du Play Store), en une seule transaction :
 * - maison partagée dont je suis propriétaire : le plus ancien membre le devient ;
 * - maison où je suis seul : supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis mon profil.
 */
export const supprimerDonnees = mutation({
  args: {},
  handler: async (ctx) => {
    const moi = await exigerIdentite(ctx);
    const adhesions = await ctx.db
      .query('membres')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .collect();

    for (const a of adhesions) {
      if (a.role === 'proprietaire') {
        const autres = (
          await ctx.db
            .query('membres')
            .withIndex('par_maison', (q) => q.eq('maisonId', a.maisonId))
            .collect()
        )
          .filter((m) => m.uid !== moi.uid)
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
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .collect();
    for (const p of profils) await ctx.db.delete(p._id);
  },
});
