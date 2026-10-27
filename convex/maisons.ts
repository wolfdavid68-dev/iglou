import { v } from 'convex/values';

import { mutation, query, type MutationCtx } from './_generated/server';
import { adhesion, erreur, exigerIdentite, exigerMembre, exigerProprietaire, identite, lister, maisonParId, verifier, type TableMaison } from './lib';

/** Mes maisons (nom et rôle), triées par nom. `null` tant que la connexion n'est pas établie. */
export const mesAdhesions = query({
  args: {},
  handler: async (ctx) => {
    const moi = await identite(ctx);
    if (!moi) return null;
    const membres = await ctx.db
      .query('membres')
      .withIndex('par_uid', (q) => q.eq('uid', moi.uid))
      .collect();
    const liste = [];
    for (const m of membres) {
      const maison = await maisonParId(ctx, m.maisonId);
      if (maison) liste.push({ maisonId: m.maisonId, nom: maison.nom, role: m.role });
    }
    return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  },
});

async function codeLibre(ctx: MutationCtx, code: string) {
  verifier.codeInvitation(code);
  const existe = await ctx.db
    .query('maisons')
    .withIndex('par_code', (q) => q.eq('codeInvitation', code))
    .first();
  if (existe) throw erreur('already-exists', 'codeInvitation');
}

/** Crée la maison et l'adhésion du propriétaire. `id` et `code` sont tirés par l'app. */
export const creer = mutation({
  args: { id: v.string(), nom: v.string(), code: v.string(), prenom: v.string() },
  handler: async (ctx, a) => {
    const moi = await exigerIdentite(ctx);
    verifier.id(a.id);
    if (await maisonParId(ctx, a.id)) throw erreur('already-exists', 'id');
    await codeLibre(ctx, a.code);
    const maintenant = Date.now();
    await ctx.db.insert('maisons', {
      id: a.id,
      nom: verifier.texte(a.nom, 60, 'nom'),
      codeInvitation: a.code,
      createdBy: moi.uid,
      createdAt: maintenant,
    });
    await ctx.db.insert('membres', {
      maisonId: a.id,
      uid: moi.uid,
      prenom: verifier.texte(a.prenom, 40, 'prenom'),
      role: 'proprietaire',
      joinedAt: maintenant,
    });
  },
});

/** Rejoindre avec un code d'invitation. `null` si le code ne correspond à aucune maison. */
export const rejoindre = mutation({
  args: { code: v.string(), prenom: v.string() },
  handler: async (ctx, { code, prenom }) => {
    const moi = await exigerIdentite(ctx);
    const maison = await ctx.db
      .query('maisons')
      .withIndex('par_code', (q) => q.eq('codeInvitation', code))
      .first();
    if (!maison) return null;
    if (await adhesion(ctx, maison.id, moi.uid)) return { maisonId: maison.id, dejaMembre: true };
    await ctx.db.insert('membres', {
      maisonId: maison.id,
      uid: moi.uid,
      prenom: verifier.texte(prenom, 40, 'prenom'),
      role: 'membre',
      joinedAt: Date.now(),
    });
    return { maisonId: maison.id, dejaMembre: false };
  },
});

/** Quitter une maison (le propriétaire doit d'abord passer la main ou la supprimer). */
export const quitter = mutation({
  args: { maisonId: v.string() },
  handler: async (ctx, { maisonId }) => {
    const { membre } = await exigerMembre(ctx, maisonId);
    if (membre.role === 'proprietaire') throw erreur('permission-denied');
    await ctx.db.delete(membre._id);
  },
});

/** Le propriétaire retire un autre membre. */
export const retirerMembre = mutation({
  args: { maisonId: v.string(), uid: v.string() },
  handler: async (ctx, { maisonId, uid }) => {
    const { moi } = await exigerProprietaire(ctx, maisonId);
    if (uid === moi.uid) throw erreur('permission-denied');
    const cible = await adhesion(ctx, maisonId, uid);
    if (cible) await ctx.db.delete(cible._id);
  },
});

/** Renommer : tout membre. */
export const renommer = mutation({
  args: { maisonId: v.string(), nom: v.string() },
  handler: async (ctx, { maisonId, nom }) => {
    await exigerMembre(ctx, maisonId);
    const maison = await maisonParId(ctx, maisonId);
    if (!maison) throw erreur('not-found');
    await ctx.db.patch(maison._id, { nom: verifier.texte(nom, 60, 'nom') });
  },
});

/** Nouveau code d'invitation (propriétaire) : l'ancien cesse aussitôt de fonctionner. */
export const regenererCode = mutation({
  args: { maisonId: v.string(), code: v.string() },
  handler: async (ctx, { maisonId, code }) => {
    await exigerProprietaire(ctx, maisonId);
    const maison = await maisonParId(ctx, maisonId);
    if (!maison) throw erreur('not-found');
    await codeLibre(ctx, code);
    await ctx.db.patch(maison._id, { codeInvitation: code });
  },
});

const CONTENU: TableMaison[] = ['aliments', 'tiroirs', 'appareils', 'coursesLibres', 'consommations'];

/** Efface la maison, tout son contenu et toutes les adhésions. */
export async function effacerMaison(ctx: MutationCtx, maisonId: string) {
  for (const table of CONTENU) {
    for (const d of await lister(ctx, table, maisonId)) await ctx.db.delete(d._id);
  }
  const membres = await ctx.db
    .query('membres')
    .withIndex('par_maison', (q) => q.eq('maisonId', maisonId))
    .collect();
  for (const m of membres) await ctx.db.delete(m._id);
  const maison = await maisonParId(ctx, maisonId);
  if (maison) await ctx.db.delete(maison._id);
}

/** Suppression complète par le propriétaire, en une seule transaction. */
export const supprimer = mutation({
  args: { maisonId: v.string() },
  handler: async (ctx, { maisonId }) => {
    await exigerProprietaire(ctx, maisonId);
    await effacerMaison(ctx, maisonId);
  },
});
