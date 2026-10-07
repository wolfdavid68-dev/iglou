import { useEffect, useState } from 'react';

import { JOURS_STATS } from '@/domaine/statistiques';
import type { Consommation } from '@/domaine/types';
import { depuisMs, refCollection, versConsommation } from './firebase';
import { limit, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot } from './firestore';

const JOUR = 24 * 60 * 60 * 1000;
/** Garde-fou : on ne lit jamais plus que ça, même pour une maison très active. */
const MAX_SORTIES = 500;

/**
 * Sorties de stock récentes de la maison (fenêtre des statistiques), en temps
 * réel. Lu à part du fournisseur principal : l'historique n'est pas
 * nécessaire pour afficher l'inventaire.
 */
export function useConsommations(maisonId: string): Consommation[] {
  const [etat, setEtat] = useState<{ maisonId: string; consos: Consommation[] }>({ maisonId, consos: [] });

  useEffect(() => {
    const depuis = depuisMs(Date.now() - JOURS_STATS * JOUR);
    return onSnapshot(
      query(refCollection(maisonId, 'consommations'), where('at', '>=', depuis), orderBy('at', 'desc'), limit(MAX_SORTIES)),
      (snap: QuerySnapshot<DocumentData>) => setEtat({ maisonId, consos: snap.docs.map(versConsommation) }),
      // Statistiques facultatives : en cas d'erreur, on n'affiche simplement rien.
      () => setEtat({ maisonId, consos: [] }),
    );
  }, [maisonId]);

  return etat.maisonId === maisonId ? etat.consos : [];
}
