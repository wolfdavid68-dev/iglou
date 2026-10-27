import { v, type Infer } from 'convex/values';

import type { MutationCtx } from './_generated/server';
import { mutation } from './_generated/server';
import { exigerMembre, refus, texte, texteOuNul } from './acces';
import { typeAppareil, unite } from './schema';

/**
 * Écritures de l'inventaire d'une maison, envoyées par lots (comme les
 * « batch » Firestore) : tout le lot réussit ou rien n'est écrit.
 *
 * L'app applique le même lot à son affichage avant la réponse du serveur
 * (mise à jour optimiste, voir src/services/lots.ts).
 */

const nul = <T extends Parameters<typeof v.union>[0]>(t: T) => v.union(t, v.null());

const champsAppareil = { nom: v.string(), type: typeAppareil, ordre: v.number() };
const champsTiroir = { appareilId: v.string(), nom: v.string(), ordre: v.number() };
const champsAliment = {
  tiroirId: v.string(),
  appareilId: v.string(),
  nom: v.string(),
  quantite: v.number(),
  quantiteMax: v.number(),
  unite,
  datePeremption: nul(v.string()),
  note: nul(v.string()),
  dansPanier: v.boolean(),
  achatQuantite: nul(v.number()),
};
const champsLibre = { nom: v.string(), quantite: v.number(), unite, dansPanier: v.boolean() };

const partiel = <T extends Record<string, Parameters<typeof v.optional>[0]>>(champs: T) =>
  v.object(Object.fromEntries(Object.entries(champs).map(([k, t]) => [k, v.optional(t)])) as { [K in keyof T]: ReturnType<typeof v.optional<T[K]>> });

export const vOp = v.union(
  // Création ou remplacement complet
  v.object({ op: v.literal('set'), col: v.literal('appareils'), id: v.string(), d: v.object({ ...champsAppareil, createdAt: v.optional(v.number()) }) }),
  v.object({ op: v.literal('set'), col: v.literal('tiroirs'), id: v.string(), d: v.object(champsTiroir) }),
  v.object({
    op: v.literal('set'),
    col: v.literal('aliments'),
    id: v.string(),
    d: v.object({ ...champsAliment, ajoutePar: v.string(), ajouteParPrenom: v.string(), createdAt: v.optional(v.number()) }),
  }),
  v.object({ op: v.literal('set'), col: v.literal('coursesLibres'), id: v.string(), d: v.object({ ...champsLibre, ajoutePar: v.string() }) }),
  v.object({
    op: v.literal('set'),
    col: v.literal('consommations'),
    id: v.string(),
    d: v.object({ nom: v.string(), quantite: v.number(), unite, appareilId: v.string() }),
  }),
  // Mise à jour partielle d'un document existant
  v.object({ op: v.literal('update'), col: v.literal('appareils'), id: v.string(), d: partiel(champsAppareil) }),
  v.object({ op: v.literal('update'), col: v.literal('tiroirs'), id: v.string(), d: partiel(champsTiroir) }),
  v.object({ op: v.literal('update'), col: v.literal('aliments'), id: v.string(), d: partiel(champsAliment) }),
  v.object({ op: v.literal('update'), col: v.literal('coursesLibres'), id: v.string(), d: partiel(champsLibre) }),
  // Suppression (sans effet si le document n'existe plus)
  v.object({
    op: v.literal('delete'),
    col: v.union(v.literal('appareils'), v.literal('tiroirs'), v.literal('aliments'), v.literal('coursesLibres')),
    id: v.string(),
  }),
);

export type Op = Infer<typeof vOp>;
export type CollectionLot = Op['col'];

/** Nombre maximal d'opérations par lot (l'app découpe au-delà). */
export const TAILLE_LOT = 450;

export const appliquer = mutation({
  args: { maison: v.string(), ops: v.array(vOp) },
  handler: async (ctx, { maison, ops }) => {
    if (ops.length > TAILLE_LOT) throw refus('invalide');
    const { uid } = await exigerMembre(ctx, maison);
    const maintenant = Date.now();
    for (const op of ops) await appliquerOp(ctx, maison, uid, maintenant, op);
  },
});

const trouver = (ctx: MutationCtx, col: CollectionLot, maison: string, cle: string) =>
  ctx.db
    .query(col)
    .withIndex('par_maison_cle', (q) => q.eq('maison', maison).eq('cle', cle))
    .unique();

const entier = (n: number) => {
  if (!Number.isInteger(n)) throw refus('invalide');
};

async function appliquerOp(ctx: MutationCtx, maison: string, uid: string, maintenant: number, op: Op) {
  const existant = await trouver(ctx, op.col, maison, op.id);

  if (op.op === 'delete') {
    if (existant) await ctx.db.delete(existant._id);
    return;
  }

  if (op.op === 'update') {
    if (!existant) throw refus('introuvable');
    // Les champs absents (undefined) ne sont pas modifiés.
    const champs = Object.fromEntries(Object.entries(op.d).filter(([, val]) => val !== undefined));
    const fusion = { ...existant, ...champs };
    if (op.col === 'aliments') Object.assign(fusion, { modifiePar: uid, updatedAt: maintenant });
    valider(op.col, fusion as never);
    const { _id, _creationTime, ...doc } = fusion;
    await ctx.db.replace(_id, doc as never);
    return;
  }

  // op.op === 'set'
  const base = { maison, cle: op.id };
  let doc: Record<string, unknown>;
  switch (op.col) {
    case 'appareils':
      doc = { ...base, ...op.d, createdAt: op.d.createdAt ?? (existant as { createdAt?: number } | null)?.createdAt ?? maintenant };
      break;
    case 'tiroirs':
      doc = { ...base, ...op.d };
      break;
    case 'aliments': {
      const ancien = existant as { ajoutePar: string; createdAt: number } | null;
      // L'auteur et la date d'ajout ne changent jamais.
      if (ancien && (op.d.ajoutePar !== ancien.ajoutePar || (op.d.createdAt != null && op.d.createdAt !== ancien.createdAt))) throw refus();
      doc = { ...base, ...op.d, createdAt: ancien?.createdAt ?? op.d.createdAt ?? maintenant, modifiePar: uid, updatedAt: maintenant };
      break;
    }
    case 'coursesLibres':
      doc = { ...base, ...op.d, createdAt: (existant as { createdAt?: number } | null)?.createdAt ?? maintenant };
      break;
    case 'consommations':
      // Journal en ajout seul.
      if (existant) throw refus();
      doc = { ...base, ...op.d, par: uid, at: maintenant };
      break;
  }
  valider(op.col, doc as never);
  if (existant) await ctx.db.replace(existant._id, doc as never);
  else await ctx.db.insert(op.col, doc as never);
}

type DocLot = {
  nom: string;
  ordre?: number;
  quantite?: number;
  quantiteMax?: number;
  datePeremption?: string | null;
  note?: string | null;
  achatQuantite?: number | null;
  ajouteParPrenom?: string;
};

/** Mêmes contraintes que les anciennes règles Firestore. */
function valider(col: CollectionLot, d: DocLot) {
  switch (col) {
    case 'appareils':
    case 'tiroirs':
      texte(d.nom, 60);
      entier(d.ordre!);
      return;
    case 'aliments':
      texte(d.nom, 80);
      if (!(d.quantite! >= 0) || !(d.quantiteMax! > 0)) throw refus('invalide');
      // Règle du maximum : le stock plein n'est jamais inférieur à la quantité.
      if (d.quantiteMax! < d.quantite!) throw refus('invalide');
      texteOuNul(d.datePeremption ?? null, 10);
      texteOuNul(d.note ?? null, 500);
      if (d.achatQuantite != null && !(d.achatQuantite > 0)) throw refus('invalide');
      texte(d.ajouteParPrenom!, 40);
      return;
    case 'coursesLibres':
    case 'consommations':
      texte(d.nom, 80);
      if (!(d.quantite! > 0)) throw refus('invalide');
      return;
  }
}
