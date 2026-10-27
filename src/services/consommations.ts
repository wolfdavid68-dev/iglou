import { useQuery } from 'convex/react';
import { useState } from 'react';

import { JOURS_STATS } from '@/domaine/statistiques';
import type { Consommation } from '@/domaine/types';
import { api } from './convex';

const JOUR = 24 * 60 * 60 * 1000;

/**
 * Sorties de stock récentes de la maison (fenêtre des statistiques), en temps
 * réel. Lu à part du fournisseur principal : l'historique n'est pas
 * nécessaire pour afficher l'inventaire.
 */
export function useConsommations(maisonId: string): Consommation[] {
  // Début de fenêtre figé à l'ouverture de l'écran : des arguments stables gardent un seul abonnement.
  const [depuis] = useState(() => Date.now() - JOURS_STATS * JOUR);
  return useQuery(api.donnees.consommations, { maison: maisonId, depuis }) ?? [];
}
