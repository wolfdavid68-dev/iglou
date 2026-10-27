import { v } from 'convex/values';

import { mutation, type MutationCtx } from './_generated/server';
import { erreur, exigerMembre, trouver, verifier, verifierAliment, type Moi, type TableMaison } from './lib';
import { vOperation, type OperationInventaire } from './validateurs';

/** Garde-fou : un import « remplacer tout » d'une grosse maison reste bien en dessous. */
const MAX_OPERATIONS = 4000;

async function exiger<T extends TableMaison>(ctx: MutationCtx, table: T, maisonId: string, id: string) {
  const d = await trouver(ctx, table, maisonId, id);
  if (!d) throw erreur('not-found', `${table}/${id}`);
  return d;
}

async function nouveau(ctx: MutationCtx, table: TableMaison, maisonId: string, id: string) {
  verifier.id(id);
  if (await trouver(ctx, table, maisonId, id)) throw erreur('already-exists', `${table}/${id}`);
}

/** Applique une opération. Renvoie vrai si elle a été ignorée (`siAbsent`). */
async function appliquerUne(ctx: MutationCtx, maisonId: string, moi: Moi, prenom: string, o: OperationInventaire, maintenant: number) {
  switch (o.op) {
    case 'creerAppareil':
      await nouveau(ctx, 'appareils', maisonId, o.id);
      await ctx.db.insert('appareils', {
        maisonId,
        id: o.id,
        nom: verifier.texte(o.nom, 60, 'nom'),
        type: o.type,
        ordre: verifier.entier(o.ordre, 'ordre'),
        createdAt: maintenant,
      });
      return false;

    case 'majAppareil': {
      const d = await exiger(ctx, 'appareils', maisonId, o.id);
      await ctx.db.patch(d._id, {
        ...(o.nom !== undefined && { nom: verifier.texte(o.nom, 60, 'nom') }),
        ...(o.type !== undefined && { type: o.type }),
        ...(o.ordre !== undefined && { ordre: verifier.entier(o.ordre, 'ordre') }),
      });
      return false;
    }

    case 'supprimerAppareil': {
      const d = await trouver(ctx, 'appareils', maisonId, o.id);
      if (!d) return false;
      const contenu = async (table: 'tiroirs' | 'aliments') =>
        (
          await ctx.db
            .query(table)
            .withIndex('par_maison', (q) => q.eq('maisonId', maisonId))
            .collect()
        ).filter((x) => x.appareilId === o.id);
      for (const x of await contenu('aliments')) await ctx.db.delete(x._id);
      for (const x of await contenu('tiroirs')) await ctx.db.delete(x._id);
      await ctx.db.delete(d._id);
      return false;
    }

    case 'creerTiroir':
      await nouveau(ctx, 'tiroirs', maisonId, o.id);
      await ctx.db.insert('tiroirs', {
        maisonId,
        id: o.id,
        appareilId: verifier.id(o.appareilId, 'appareilId'),
        nom: verifier.texte(o.nom, 60, 'nom'),
        ordre: verifier.entier(o.ordre, 'ordre'),
      });
      return false;

    case 'majTiroir': {
      const d = await exiger(ctx, 'tiroirs', maisonId, o.id);
      await ctx.db.patch(d._id, {
        ...(o.nom !== undefined && { nom: verifier.texte(o.nom, 60, 'nom') }),
        ...(o.ordre !== undefined && { ordre: verifier.entier(o.ordre, 'ordre') }),
      });
      return false;
    }

    case 'supprimerTiroir': {
      const d = await trouver(ctx, 'tiroirs', maisonId, o.id);
      if (d) await ctx.db.delete(d._id);
      return false;
    }

    case 'creerAliment': {
      verifier.id(o.id);
      if (await trouver(ctx, 'aliments', maisonId, o.id)) {
        if (o.siAbsent) return true;
        throw erreur('already-exists', `aliments/${o.id}`);
      }
      const aliment = {
        maisonId,
        id: o.id,
        tiroirId: verifier.id(o.tiroirId, 'tiroirId'),
        appareilId: verifier.id(o.appareilId, 'appareilId'),
        nom: o.nom.trim(),
        quantite: o.quantite,
        quantiteMax: o.quantiteMax,
        unite: o.unite,
        datePeremption: o.datePeremption,
        note: o.note,
        dansPanier: o.dansPanier,
        achatQuantite: o.achatQuantite,
        ajoutePar: o.ajoutePar ?? moi.uid,
        ajouteParPrenom: o.ajouteParPrenom.trim().slice(0, 40) || prenom,
        modifiePar: moi.uid,
        createdAt: o.createdAt ?? maintenant,
        updatedAt: maintenant,
      };
      verifierAliment(aliment);
      await ctx.db.insert('aliments', aliment);
      return false;
    }

    case 'majAliment': {
      const d = await exiger(ctx, 'aliments', maisonId, o.id);
      const champs = { ...o.champs, ...(o.champs.nom !== undefined && { nom: o.champs.nom.trim() }) };
      if (champs.tiroirId !== undefined) verifier.id(champs.tiroirId, 'tiroirId');
      if (champs.appareilId !== undefined) verifier.id(champs.appareilId, 'appareilId');
      // L'auteur et la date d'ajout ne changent jamais.
      const apres = { ...d, ...champs, modifiePar: moi.uid, updatedAt: maintenant };
      verifierAliment(apres);
      await ctx.db.patch(d._id, { ...champs, modifiePar: moi.uid, updatedAt: maintenant });
      return false;
    }

    case 'supprimerAliment': {
      const d = await trouver(ctx, 'aliments', maisonId, o.id);
      if (d) await ctx.db.delete(d._id);
      return false;
    }

    case 'creerLibre':
      await nouveau(ctx, 'coursesLibres', maisonId, o.id);
      await ctx.db.insert('coursesLibres', {
        maisonId,
        id: o.id,
        nom: verifier.texte(o.nom, 80, 'nom'),
        quantite: verifier.nombre(o.quantite, 'quantite', true),
        unite: o.unite,
        dansPanier: false,
        ajoutePar: moi.uid,
        createdAt: maintenant,
      });
      return false;

    case 'majLibre': {
      const d = await exiger(ctx, 'coursesLibres', maisonId, o.id);
      await ctx.db.patch(d._id, {
        ...o.champs,
        ...(o.champs.nom !== undefined && { nom: verifier.texte(o.champs.nom, 80, 'nom') }),
        ...(o.champs.quantite !== undefined && { quantite: verifier.nombre(o.champs.quantite, 'quantite', true) }),
      });
      return false;
    }

    case 'supprimerLibre': {
      const d = await trouver(ctx, 'coursesLibres', maisonId, o.id);
      if (d) await ctx.db.delete(d._id);
      return false;
    }

    case 'consommation':
      await nouveau(ctx, 'consommations', maisonId, o.id);
      await ctx.db.insert('consommations', {
        maisonId,
        id: o.id,
        nom: verifier.texte(o.nom, 80, 'nom'),
        quantite: verifier.nombre(o.quantite, 'quantite', true),
        unite: o.unite,
        appareilId: verifier.id(o.appareilId, 'appareilId'),
        par: moi.uid,
        at: maintenant,
      });
      return false;
  }
}

/**
 * Écrit sur l'inventaire d'une maison : toutes les opérations réussissent
 * ensemble ou aucune. Renvoie les ids des aliments déjà présents (`siAbsent`).
 */
export const appliquer = mutation({
  args: { maisonId: v.string(), operations: v.array(vOperation) },
  handler: async (ctx, { maisonId, operations }) => {
    const { moi, membre } = await exigerMembre(ctx, maisonId);
    if (operations.length > MAX_OPERATIONS) throw erreur('invalid-argument', 'operations');
    const maintenant = Date.now();
    const dejaPresents: string[] = [];
    for (const o of operations) {
      if (await appliquerUne(ctx, maisonId, moi, membre.prenom, o, maintenant)) dejaPresents.push(o.id);
    }
    return { dejaPresents };
  },
});
