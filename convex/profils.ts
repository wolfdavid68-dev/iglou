import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { exigerIdentite, identite, verifier } from './lib';

/** L'utilisateur connecté : uid, e-mail et prénom affiché. `null` si non connecté. */
export const moi = query({
  args: {},
  handler: async (ctx) => {
    const moi = await identite(ctx);
    if (!moi) return null;
    const p = await ctx.db
      .query('profils')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .first();
    return { uid: moi.uid, email: moi.email, prenom: p?.prenom ?? moi.nom };
  },
});

/** Change mon prénom : profil et affichage dans toutes mes maisons, d'un coup. */
export const changerPrenom = mutation({
  args: { prenom: v.string() },
  handler: async (ctx, a) => {
    const moi = await exigerIdentite(ctx);
    const prenom = verifier.texte(a.prenom, 40, 'prenom');
    const profil = await ctx.db
      .query('profils')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .first();
    if (profil) await ctx.db.patch(profil._id, { prenom });
    else await ctx.db.insert('profils', { uid: moi.uid, prenom, createdAt: Date.now() });
    const membres = await ctx.db
      .query('membres')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .collect();
    for (const m of membres) await ctx.db.patch(m._id, { prenom });
  },
});
