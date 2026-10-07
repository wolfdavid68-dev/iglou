import type { Aliment } from '@/domaine/types';

/**
 * Fenêtre « Combien en as-tu pris ? », ouverte au toucher d'un aliment.
 * Rendue par <HotePrise />, sur le modèle des dialogues.
 */
export type ReponsePrise = { quantite: number } | 'fiche';

export interface DemandePrise {
  id: number;
  aliment: Aliment;
  resoudre: (r: ReponsePrise | null) => void;
}

type Ecouteur = (d: DemandePrise | null) => void;

let courante: DemandePrise | null = null;
let prochainId = 1;
const ecouteurs = new Set<Ecouteur>();

function publier(d: DemandePrise | null) {
  courante = d;
  ecouteurs.forEach((e) => e(d));
}

/** Résout la quantité prise, `'fiche'` pour ouvrir la fiche, ou `null` si la fenêtre est fermée. */
export function demanderPrise(aliment: Aliment): Promise<ReponsePrise | null> {
  courante?.resoudre(null);
  return new Promise((resoudre) => {
    publier({ id: prochainId++, aliment, resoudre });
  });
}

export function repondrePrise(r: ReponsePrise | null) {
  const d = courante;
  publier(null);
  d?.resoudre(r);
}

export function abonnerPrise(e: Ecouteur): () => void {
  ecouteurs.add(e);
  return () => {
    ecouteurs.delete(e);
  };
}

export const priseCourante = () => courante;
