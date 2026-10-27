import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { adhesion, maisonParCle, moiOuNul } from './acces';

/**
 * Lectures en temps réel. Les documents sont renvoyés sous la forme utilisée
 * par l'app (src/domaine/types.ts) : `id` = clé texte de l'app.
 */

const sansInterne = <T extends { _id: unknown; _creationTime: unknown; maison?: unknown; cle?: unknown }>(d: T) => {
  const { _id, _creationTime, maison, cle, ...reste } = d;
  return reste;
};

export const versMaison = (m: Doc<'maisons'>) => ({ id: m.cle, nom: m.nom, codeInvitation: m.codeInvitation, createdBy: m.createdBy, createdAt: m.createdAt });
export const versMembre = (m: Doc<'membres'>) => ({ uid: m.uid, maisonId: m.maison, prenom: m.prenom, role: m.role, joinedAt: m.joinedAt });
const avecId = <T extends { cle: string; _id: unknown; _creationTime: unknown; maison: unknown }>(d: T) => ({ id: d.cle, ...sansInterne(d) });

const membresDe = (ctx: QueryCtx, maison: string) =>
  ctx.db
    .query('membres')
    .withIndex('par_maison_uid', (q) => q.eq('maison', maison))
    .collect();

const contenu = <T extends 'appareils' | 'tiroirs' | 'aliments' | 'coursesLibres'>(ctx: QueryCtx, table: T, maison: string) =>
  ctx.db
    .query(table as 'appareils')
    .withIndex('par_maison_cle', (q) => q.eq('maison', maison))
    .collect() as unknown as Promise<Doc<T>[]>;

/**
 * Toute la maison active d'un coup. `null` si la maison n'existe pas ou si
 * je n'en suis pas (ou plus) membre.
 */
export const maison = query({
  args: { maison: v.string() },
  handler: async (ctx, { maison }) => {
    const m = await moiOuNul(ctx);
    if (!m || !(await adhesion(ctx, maison, m.uid))) return null;
    const doc = await maisonParCle(ctx, maison);
    if (!doc) return null;
    const [membres, appareils, tiroirs, aliments, libres] = await Promise.all([
      membresDe(ctx, maison),
      contenu(ctx, 'appareils', maison),
      contenu(ctx, 'tiroirs', maison),
      contenu(ctx, 'aliments', maison),
      contenu(ctx, 'coursesLibres', maison),
    ]);
    return {
      maison: versMaison(doc),
      membres: membres.map(versMembre),
      appareils: appareils.map(avecId),
      tiroirs: tiroirs.map(avecId),
      aliments: aliments.map(avecId),
      libres: libres.map(avecId),
    };
  },
});

/** Garde-fou : on ne lit jamais plus que ça, même pour une maison très active. */
const MAX_SORTIES = 500;

/** Sorties de stock depuis `depuis` (ms), les plus récentes d'abord. */
export const consommations = query({
  args: { maison: v.string(), depuis: v.number() },
  handler: async (ctx, { maison, depuis }) => {
    const m = await moiOuNul(ctx);
    if (!m || !(await adhesion(ctx, maison, m.uid))) return [];
    const docs = await ctx.db
      .query('consommations')
      .withIndex('par_maison_at', (q) => q.eq('maison', maison).gte('at', depuis))
      .order('desc')
      .take(MAX_SORTIES);
    return docs.map(avecId);
  },
});
