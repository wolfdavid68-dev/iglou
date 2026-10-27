import { v } from 'convex/values';

import { mutation } from './_generated/server';
import { exigerIdentite, verifier } from './lib';

const court = (v: string | null, max: number) => (v === null ? null : v.slice(0, max));

/** Bug ou idée envoyé depuis l'app. Lisible seulement depuis le tableau de bord Convex. */
export const envoyer = mutation({
  args: {
    prenom: v.union(v.string(), v.null()),
    maisonId: v.string(),
    message: v.string(),
    appareil: v.union(v.string(), v.null()),
    systeme: v.union(v.string(), v.null()),
    versionApp: v.union(v.string(), v.null()),
  },
  handler: async (ctx, a) => {
    const moi = await exigerIdentite(ctx);
    await ctx.db.insert('signalements', {
      uid: moi.uid,
      email: moi.email,
      prenom: court(a.prenom, 40),
      maisonId: a.maisonId.slice(0, 64),
      message: verifier.texte(a.message, 2000, 'message'),
      appareil: court(a.appareil, 100),
      systeme: court(a.systeme, 60),
      versionApp: court(a.versionApp, 30),
      createdAt: Date.now(),
    });
  },
});
