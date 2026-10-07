export const UNITES = ['pièce', 'g', 'kg', 'L', 'portion'] as const;
export type Unite = (typeof UNITES)[number];

export const TYPES_APPAREIL = ['frigo', 'congelateur'] as const;
export type TypeAppareil = (typeof TYPES_APPAREIL)[number];

export type Role = 'proprietaire' | 'membre';

/** Dates en millisecondes (epoch). `null` = horodatage serveur pas encore connu. */
export type Horodatage = number | null;

export interface Maison {
  id: string;
  nom: string;
  codeInvitation: string;
  createdBy: string;
  createdAt: Horodatage;
}

export interface Membre {
  uid: string;
  maisonId: string;
  prenom: string;
  role: Role;
  joinedAt: Horodatage;
}

export interface Appareil {
  id: string;
  nom: string;
  type: TypeAppareil;
  ordre: number;
  createdAt: Horodatage;
}

export interface Tiroir {
  id: string;
  appareilId: string;
  nom: string;
  ordre: number;
}

export interface Aliment {
  id: string;
  tiroirId: string;
  appareilId: string;
  nom: string;
  quantite: number;
  quantiteMax: number;
  unite: Unite;
  /** Format AAAA-MM-JJ. */
  datePeremption: string | null;
  note: string | null;
  dansPanier: boolean;
  /** Quantité réellement achetée, ajustée par appui long dans la liste de courses. */
  achatQuantite: number | null;
  ajoutePar: string;
  ajouteParPrenom: string;
  modifiePar: string;
  createdAt: Horodatage;
  updatedAt: Horodatage;
}

export interface CourseLibre {
  id: string;
  nom: string;
  quantite: number;
  unite: Unite;
  dansPanier: boolean;
  ajoutePar: string;
  createdAt: Horodatage;
}

/** Une sortie de stock (« − » ou « épuisé ») : sert aux statistiques. */
export interface Consommation {
  id: string;
  nom: string;
  quantite: number;
  unite: Unite;
  appareilId: string;
  par: string;
  at: Horodatage;
}
