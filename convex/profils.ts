import { v } from 'convex/values';

import { mutation, query, type MutationCtx } from './_generated/server';
import { exigerIdentite, identite, verifier } from './lib';

function profilDe(ctx: MutationCtx, uid: string) {
  return ctx.db
    .query('profils')
    .withIndex('par_uid', (q) => q.eq('uid', uid))
    .first();
}

/** Mon profil (`null` s'il n'existe pas encore ou si je ne suis pas connecté). */
export const moi = query({
  args: {},
  handler: async (ctx) => {
    const moi = await identite(ctx);
    if (!moi) return null;
    const p = await ctx.db
      .query('profils')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .first();
    return p ? { uid: p.uid, prenom: p.prenom } : null;
  },
});

/** Crée mon profil s'il n'existe pas encore (inscription, ou compte créé hors de l'app). */
export const assurer = mutation({
  args: { prenom: v.string() },
  handler: async (ctx, { prenom }) => {
    const moi = await exigerIdentite(ctx);
    if (await profilDe(ctx, moi.uid)) return;
    await ctx.db.insert('profils', { uid: moi.uid, prenom: verifier.texte(prenom, 40, 'prenom'), createdAt: Date.now() });
  },
});

/** Change mon prénom : profil et affichage dans toutes mes maisons, d'un coup. */
export const changerPrenom = mutation({
  args: { prenom: v.string() },
  handler: async (ctx, a) => {
    const moi = await exigerIdentite(ctx);
    const prenom = verifier.texte(a.prenom, 40, 'prenom');
    const profil = await profilDe(ctx, moi.uid);
    if (profil) await ctx.db.patch(profil._id, { prenom });
    else await ctx.db.insert('profils', { uid: moi.uid, prenom, createdAt: Date.now() });
    const membres = await ctx.db
      .query('membres')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .collect();
    for (const m of membres) await ctx.db.patch(m._id, { prenom });
  },
});
