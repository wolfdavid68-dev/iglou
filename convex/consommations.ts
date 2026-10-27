import { v } from 'convex/values';

import { query } from './_generated/server';
import { adhesion, identite } from './lib';

/** Garde-fou : on ne lit jamais plus que ça, même pour une maison très active. */
const MAX_SORTIES = 500;

/** Sorties de stock depuis `depuis` (ms), les plus récentes d'abord. */
export const recentes = query({
  args: { maisonId: v.string(), depuis: v.number() },
  handler: async (ctx, { maisonId, depuis }) => {
    const moi = await identite(ctx);
    if (!moi || !(await adhesion(ctx, maisonId, moi.uid))) return [];
    const sorties = await ctx.db
      .query('consommations')
      .withIndex('par_maison_date', (q) => q.eq('maisonId', maisonId).gte('at', depuis))
      .order('desc')
      .take(MAX_SORTIES);
    return sorties.map((s) => ({ id: s.id, nom: s.nom, quantite: s.quantite, unite: s.unite, appareilId: s.appareilId, par: s.par, at: s.at }));
  },
});
