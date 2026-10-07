import type { Aliment, Appareil, CourseLibre, Tiroir } from '../types';

export function aliment(champs: Partial<Aliment> = {}): Aliment {
  return {
    id: 'a1',
    tiroirId: 't1',
    appareilId: 'frigo',
    nom: 'Œufs',
    quantite: 6,
    quantiteMax: 6,
    unite: 'pièce',
    datePeremption: null,
    note: null,
    dansPanier: false,
    achatQuantite: null,
    ajoutePar: 'u1',
    ajouteParPrenom: 'Marie',
    modifiePar: 'u1',
    createdAt: 0,
    updatedAt: 0,
    ...champs,
  };
}

export function appareil(champs: Partial<Appareil> = {}): Appareil {
  return { id: 'frigo', nom: 'Frigo cuisine', type: 'frigo', ordre: 0, createdAt: 0, ...champs };
}

export function tiroir(champs: Partial<Tiroir> = {}): Tiroir {
  return { id: 't1', appareilId: 'frigo', nom: 'Bac à légumes', ordre: 0, ...champs };
}

export function libre(champs: Partial<CourseLibre> = {}): CourseLibre {
  return { id: 'l1', nom: 'Éponges', quantite: 1, unite: 'pièce', dansPanier: false, ajoutePar: 'u1', createdAt: 0, ...champs };
}
