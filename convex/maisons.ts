import { v } from 'convex/values';

import type { MutationCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { adhesion, codeInvitationValide, exigerMembre, exigerProprietaire, maisonParCle, moi, moiOuNul, refus, texte } from './acces';

const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Mes maisons (nom et rôle), triées par nom. */
export const miennes = query({
  args: {},
  handler: async (ctx) => {
    const m = await moiOuNul(ctx);
    if (!m) return [];
    const membres = await ctx.db
      .query('membres')
      .withIndex('par_uid', (q) => q.eq('uid', m.uid))
      .collect();
    const liste = await Promise.all(
      membres.map(async (a) => ({ maisonId: a.maison, nom: (await maisonParCle(ctx, a.maison))?.nom ?? 'Maison', role: a.role })),
    );
    return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  },
});

const codeLibre = async (ctx: MutationCtx, code: string) =>
  !(await ctx.db
    .query('maisons')
    .withIndex('par_code', (q) => q.eq('codeInvitation', code))
    .first());

/** Le code proposé par l'app s'il est libre, sinon un autre. */
async function codeUnique(ctx: MutationCtx, propose: string) {
  if (codeInvitationValide(propose) && (await codeLibre(ctx, propose))) return propose;
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHABET_CODE[Math.floor(Math.random() * ALPHABET_CODE.length)];
    if (await codeLibre(ctx, code)) return code;
  }
}

/** Crée la maison et l'adhésion du propriétaire. `cle` est choisie par l'app. */
export const creer = mutation({
  args: { cle: v.string(), nom: v.string(), code: v.string(), prenom: v.string() },
  handler: async (ctx, { cle, nom, code, prenom }) => {
    const { uid } = await moi(ctx);
    if (!cle || (await maisonParCle(ctx, cle))) throw refus();
    const maintenant = Date.now();
    const codeInvitation = await codeUnique(ctx, code);
    await ctx.db.insert('maisons', { cle, nom: texte(nom.trim(), 60), codeInvitation, createdBy: uid, createdAt: maintenant });
    await ctx.db.insert('membres', { maison: cle, uid, prenom: texte(prenom.trim() || 'Moi', 40), role: 'proprietaire', joinedAt: maintenant });
    return codeInvitation;
  },
});

/** Rejoint la maison dont `code` est le code d'invitation actuel. */
export const rejoindre = mutation({
  args: { code: v.string(), prenom: v.string() },
  handler: async (ctx, { code, prenom }) => {
    const { uid } = await moi(ctx);
    const maison = codeInvitationValide(code)
      ? await ctx.db
          .query('maisons')
          .withIndex('par_code', (q) => q.eq('codeInvitation', code))
          .first()
      : null;
    if (!maison) return { ok: false as const };
    if (await adhesion(ctx, maison.cle, uid)) return { ok: true as const, maisonId: maison.cle, dejaMembre: true };
    await ctx.db.insert('membres', { maison: maison.cle, uid, prenom: texte(prenom.trim() || 'Moi', 40), role: 'membre', joinedAt: Date.now() });
    return { ok: true as const, maisonId: maison.cle, dejaMembre: false };
  },
});

/** Quitter une maison (le propriétaire doit d'abord la supprimer ou passer la main). */
export const quitter = mutation({
  args: { maison: v.string() },
  handler: async (ctx, { maison }) => {
    const { membre } = await exigerMembre(ctx, maison);
    if (membre.role === 'proprietaire') throw refus();
    await ctx.db.delete(membre._id);
  },
});

export const retirerMembre = mutation({
  args: { maison: v.string(), uid: v.string() },
  handler: async (ctx, { maison, uid }) => {
    await exigerProprietaire(ctx, maison);
    const cible = await adhesion(ctx, maison, uid);
    if (cible && cible.role !== 'proprietaire') await ctx.db.delete(cible._id);
  },
});

export const renommer = mutation({
  args: { maison: v.string(), nom: v.string() },
  handler: async (ctx, { maison, nom }) => {
    await exigerMembre(ctx, maison);
    const doc = await maisonParCle(ctx, maison);
    if (!doc) throw refus('introuvable');
    await ctx.db.patch(doc._id, { nom: texte(nom.trim(), 60) });
  },
});

/** Mon prénom affiché dans une maison. */
export const changerPrenomMembre = mutation({
  args: { maison: v.string(), prenom: v.string() },
  handler: async (ctx, { maison, prenom }) => {
    const { membre } = await exigerMembre(ctx, maison);
    await ctx.db.patch(membre._id, { prenom: texte(prenom.trim(), 40) });
  },
});

/** Nouveau code : l'ancien cesse immédiatement de fonctionner. */
export const regenererCode = mutation({
  args: { maison: v.string(), code: v.string() },
  handler: async (ctx, { maison, code }) => {
    await exigerProprietaire(ctx, maison);
    const doc = await maisonParCle(ctx, maison);
    if (!doc) throw refus('introuvable');
    const codeInvitation = await codeUnique(ctx, code);
    await ctx.db.patch(doc._id, { codeInvitation });
    return codeInvitation;
  },
});

/** Efface la maison et tout son contenu. Appelé par le propriétaire (ou à la suppression de son compte). */
export async function effacerMaison(ctx: MutationCtx, maison: string) {
  for (const table of ['aliments', 'tiroirs', 'appareils', 'coursesLibres', 'consommations'] as const) {
    const docs = await ctx.db
      .query(table)
      .withIndex('par_maison_cle', (q) => q.eq('maison', maison))
      .collect();
    for (const d of docs) await ctx.db.delete(d._id);
  }
  const membres = await ctx.db
    .query('membres')
    .withIndex('par_maison_uid', (q) => q.eq('maison', maison))
    .collect();
  for (const m of membres) await ctx.db.delete(m._id);
  const doc = await maisonParCle(ctx, maison);
  if (doc) await ctx.db.delete(doc._id);
}

export const supprimer = mutation({
  args: { maison: v.string() },
  handler: async (ctx, { maison }) => {
    await exigerProprietaire(ctx, maison);
    await effacerMaison(ctx, maison);
  },
});
