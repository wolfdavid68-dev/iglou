import type { OptimisticLocalStore } from 'convex/browser';
import type { FunctionReturnType } from 'convex/server';

import { enLots } from '@/domaine/import-export';
import type { Op } from '../../convex/lots';
import { api, convex } from './convex';
import { uidCourant } from './session';

export type { Op };

type Donnees = NonNullable<FunctionReturnType<typeof api.donnees.maison>>;
type Liste = 'appareils' | 'tiroirs' | 'aliments' | 'libres';

const LISTE: Record<Exclude<Op['col'], 'consommations'>, Liste> = {
  appareils: 'appareils',
  tiroirs: 'tiroirs',
  aliments: 'aliments',
  coursesLibres: 'libres',
};

/**
 * Applique un lot à l'affichage local, comme le fera le serveur : l'interface
 * change tout de suite, avant la réponse (et même sans réseau : Convex garde
 * les écritures en file et les envoie au retour de la connexion).
 */
function appliquerLocalement(donnees: Donnees, ops: Op[], uid: string, maintenant: number): Donnees {
  const d = { ...donnees, appareils: [...donnees.appareils], tiroirs: [...donnees.tiroirs], aliments: [...donnees.aliments], libres: [...donnees.libres] };
  for (const op of ops) {
    if (op.col === 'consommations') continue;
    const liste = d[LISTE[op.col]] as { id: string; createdAt?: number }[];
    const i = liste.findIndex((x) => x.id === op.id);
    if (op.op === 'delete') {
      if (i >= 0) liste.splice(i, 1);
      continue;
    }
    const champs = Object.fromEntries(Object.entries(op.d).filter(([, v]) => v !== undefined));
    const auteur = op.col === 'aliments' ? { modifiePar: uid, updatedAt: maintenant } : {};
    if (op.op === 'update') {
      if (i >= 0) liste[i] = { ...liste[i], ...champs, ...auteur };
      continue;
    }
    const createdAt = (champs.createdAt as number | undefined) ?? (i >= 0 ? liste[i].createdAt : undefined) ?? maintenant;
    const doc = { id: op.id, ...champs, ...auteur, ...(op.col === 'tiroirs' ? {} : { createdAt }) };
    if (i >= 0) liste[i] = doc;
    else liste.push(doc);
  }
  return d;
}

function miseAJourOptimiste(maison: string, uid: string) {
  return (store: OptimisticLocalStore, { ops }: { maison: string; ops: Op[] }) => {
    const maintenant = Date.now();
    const actuel = store.getQuery(api.donnees.maison, { maison });
    if (actuel) store.setQuery(api.donnees.maison, { maison }, appliquerLocalement(actuel, ops, uid, maintenant));

    const sorties = ops.flatMap((op) =>
      op.op === 'set' && op.col === 'consommations' ? [{ id: op.id, ...op.d, par: uid, at: maintenant }] : [],
    );
    if (sorties.length === 0) return;
    for (const { args, value } of store.getAllQueries(api.donnees.consommations)) {
      if (args.maison === maison && value) store.setQuery(api.donnees.consommations, args, [...sorties, ...value]);
    }
  };
}

/**
 * Envoie des écritures en lots de 450 au plus. Chaque lot est atomique
 * (tout ou rien) ; ils partent dans l'ordre.
 */
export function envoyer(maison: string, ops: Op[]): Promise<void> {
  if (ops.length === 0) return Promise.resolve();
  const uid = uidCourant();
  return Promise.all(
    enLots(ops).map((lot) => convex.mutation(api.lots.appliquer, { maison, ops: lot }, { optimisticUpdate: miseAJourOptimiste(maison, uid) })),
  ).then(() => undefined);
}
