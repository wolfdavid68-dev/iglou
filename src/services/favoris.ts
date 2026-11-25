import { useSyncExternalStore } from 'react';

import { stockage } from './stockage';

/**
 * Recettes favorites, gardées sur cet appareil (préférence personnelle, pas
 * partagée avec la maison). Les écrans s'abonnent avec `useFavoris`.
 */
const CLE = 'recettes-favorites';

let cache: ReadonlySet<string> | null = null;
const abonnes = new Set<() => void>();

function lire(): ReadonlySet<string> {
  if (!cache) {
    try {
      const brut = stockage.lire(CLE);
      cache = new Set(brut ? (JSON.parse(brut) as string[]) : []);
    } catch {
      cache = new Set();
    }
  }
  return cache;
}

export function basculerFavori(id: string) {
  const suivant = new Set(lire());
  if (suivant.has(id)) suivant.delete(id);
  else suivant.add(id);
  cache = suivant;
  stockage.ecrire(CLE, JSON.stringify([...suivant]));
  abonnes.forEach((f) => f());
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

const VIDE: ReadonlySet<string> = new Set();

/** Ensemble des identifiants de recettes favorites (se met à jour quand on en ajoute ou retire une). */
export function useFavoris(): ReadonlySet<string> {
  return useSyncExternalStore(abonner, lire, () => VIDE);
}
