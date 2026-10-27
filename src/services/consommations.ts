import { useConvexAuth, useQuery } from 'convex/react';
import { useState } from 'react';

import { api } from '../../convex/_generated/api';
import { JOURS_STATS } from '@/domaine/statistiques';
import type { Consommation } from '@/domaine/types';

const JOUR = 24 * 60 * 60 * 1000;
const AUCUNE: Consommation[] = [];

/**
 * Sorties de stock récentes de la maison (fenêtre des statistiques), en temps
 * réel. Lu à part du fournisseur principal : l'historique n'est pas
 * nécessaire pour afficher l'inventaire.
 */
export function useConsommations(maisonId: string): Consommation[] {
  const { isAuthenticated } = useConvexAuth();
  // Début de fenêtre arrondi au jour : arguments stables, une seule souscription par jour.
  const [depuis] = useState(() => Math.floor(Date.now() / JOUR) * JOUR - JOURS_STATS * JOUR);
  return useQuery(api.consommations.recentes, isAuthenticated ? { maisonId, depuis } : 'skip') ?? AUCUNE;
}
