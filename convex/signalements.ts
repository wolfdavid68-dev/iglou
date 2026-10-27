import { v } from 'convex/values';

import { mutation } from './_generated/server';
import { moi, texte } from './acces';

const court = (s: string | null, max: number) => (s == null ? null : s.slice(0, max));

/** Bug ou idée envoyé depuis l'app. Lisible seulement depuis le tableau de bord Convex. */
export const envoyer = mutation({
  args: {
    message: v.string(),
    maisonId: v.string(),
    appareil: v.union(v.string(), v.null()),
    systeme: v.union(v.string(), v.null()),
    versionApp: v.union(v.string(), v.null()),
  },
  handler: async (ctx, a) => {
    const { uid, user } = await moi(ctx);
    await ctx.db.insert('signalements', {
      uid,
      email: user.email ?? '',
      prenom: court(user.prenom ?? null, 40),
      maisonId: a.maisonId.slice(0, 60),
      message: texte(a.message.trim(), 2000),
      appareil: court(a.appareil, 100),
      systeme: court(a.systeme, 60),
      versionApp: court(a.versionApp, 30),
      createdAt: Date.now(),
    });
  },
});
