import { arrondir, normaliser } from './texte';
import type { Consommation, Unite } from './types';

const JOUR = 24 * 60 * 60 * 1000;

/** Fenêtre d'analyse des statistiques, en jours. */
export const JOURS_STATS = 30;

export interface Tendance {
  /** Nom affiché : celui de la sortie la plus récente. */
  nom: string;
  /** Nombre de fois où l'aliment est sorti du stock. */
  sorties: number;
  /** Quantité totale sortie, dans l'unité la plus récente. */
  quantite: number;
  unite: Unite;
}

/** Sorties récentes ; une sortie pas encore horodatée par le serveur compte pour maintenant. */
export function sortiesRecentes(consos: Consommation[], maintenant: number = Date.now(), jours = JOURS_STATS): Consommation[] {
  const depuis = maintenant - jours * JOUR;
  return consos.filter((c) => (c.at ?? maintenant) >= depuis);
}

/**
 * « Ce qui part le plus vite » : les aliments sortis le plus souvent sur la
 * période, regroupés par nom (sans tenir compte des accents ni de la casse).
 */
export function cequiPartLePlusVite(consos: Consommation[], maintenant: number = Date.now(), jours = JOURS_STATS, max = 5): Tendance[] {
  const recentes = [...sortiesRecentes(consos, maintenant, jours)].sort((a, b) => (b.at ?? maintenant) - (a.at ?? maintenant));
  const groupes = new Map<string, Tendance>();
  for (const c of recentes) {
    const cle = normaliser(c.nom);
    const g = groupes.get(cle);
    if (!g) {
      groupes.set(cle, { nom: c.nom, sorties: 1, quantite: c.quantite, unite: c.unite });
    } else {
      g.sorties++;
      if (c.unite === g.unite) g.quantite = arrondir(g.quantite + c.quantite);
    }
  }
  return [...groupes.values()]
    .sort((a, b) => b.sorties - a.sorties || b.quantite - a.quantite || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, max);
}
