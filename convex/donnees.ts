import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { query } from './_generated/server';
import { adhesion, identite, lister, maisonParId } from './lib';

/** Retire les champs internes de Convex et le `maisonId` répété. */
function propre<T extends { _id: unknown; _creationTime: number; maisonId: string }>(d: T) {
  const { _id, _creationTime, maisonId, ...reste } = d;
  return reste;
}

const versMembre = (m: Doc<'membres'>) => ({ uid: m.uid, maisonId: m.maisonId, prenom: m.prenom, role: m.role, joinedAt: m.joinedAt });

/**
 * Toute la maison active, en temps réel : la maison, ses membres et son
 * inventaire. `null` si je n'en suis pas (ou plus) membre, ou si elle n'existe pas.
 */
export const maison = query({
  args: { maisonId: v.string() },
  handler: async (ctx, { maisonId }) => {
    const moi = await identite(ctx);
    if (!moi || !(await adhesion(ctx, maisonId, moi.uid))) return null;
    const maison = await maisonParId(ctx, maisonId);
    if (!maison) return null;
    const membres = await ctx.db
      .query('membres')
      .withIndex('par_maison', (q) => q.eq('maisonId', maisonId))
      .collect();
    const [appareils, tiroirs, aliments, libres] = await Promise.all([
      lister(ctx, 'appareils', maisonId),
      lister(ctx, 'tiroirs', maisonId),
      lister(ctx, 'aliments', maisonId),
      lister(ctx, 'coursesLibres', maisonId),
    ]);
    return {
      maison: { id: maison.id, nom: maison.nom, codeInvitation: maison.codeInvitation, createdBy: maison.createdBy, createdAt: maison.createdAt },
      membres: membres.map(versMembre),
      appareils: appareils.map(propre),
      tiroirs: tiroirs.map(propre),
      aliments: aliments.map(propre),
      libres: libres.map(propre),
    };
  },
});
