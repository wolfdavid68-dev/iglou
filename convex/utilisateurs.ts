import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { moi, moiOuNul, texte } from './acces';

/** Le compte connecté, ou `null`. */
export const moiCourant = query({
  args: {},
  handler: async (ctx) => {
    const m = await moiOuNul(ctx);
    if (!m) return null;
    return { uid: m.uid, email: m.user.email ?? '', prenom: m.user.prenom ?? m.user.name ?? '' };
  },
});

/** Prénom du compte (proposé à la création ou à l'entrée dans une maison). */
export const changerPrenom = mutation({
  args: { prenom: v.string() },
  handler: async (ctx, { prenom }) => {
    const { userId } = await moi(ctx);
    await ctx.db.patch(userId, { prenom: texte(prenom.trim(), 40) });
  },
});
