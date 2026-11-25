import { useUniwind } from 'uniwind';

import type { TypeAppareil } from '@/domaine/types';

/**
 * Les styles passent par les classes Tailwind (src/global.css). Ces valeurs
 * ne servent qu'aux endroits qui exigent une couleur en JS : icônes, barre
 * d'onglets, dégradés, barre d'état. Garder aligné avec global.css.
 */
const commun = {
  frigo: '#12A594',
  congelateur: '#4A7BEA',
  courses: '#EA7A2C',
  vert: '#2FB36A',
  orange: '#E9A21B',
  rouge: '#E5483D',
  blanc: '#FFFFFF',
  /** Fonds sous texte blanc (≥ 5:1). `frigoFort` est la couleur signature (actions). */
  frigoFort: '#0A6B60',
  coursesFort: '#B4500F',
  congelateurFort: '#2150C4',
};

const clair = {
  ...commun,
  sombre: false,
  fond: '#F3F5F8',
  carte: '#FFFFFF',
  bordure: '#E3E7EE',
  encre: '#0E1A2B',
  encre2: '#4A5568',
  encre3: '#697386',
  /** Couleurs de texte (≥ 4,5:1) : les teintes vives restent pour les icônes et les fonds. */
  frigoTexte: '#0A6B60',
  congelateurTexte: '#2150C4',
  coursesTexte: '#B4500F',
  orangeTexte: '#A35F00',
  vertTexte: '#1B7A43',
  rougeTexte: '#B42F25',
  givre: ['#E2EBFB', '#F3F5F8'] as readonly [string, string],
  /**
   * Voile givré en haut des écrans (teinte → fond), sous un titre à l'encre.
   * Accueil : du sapin au glacier, comme le frigo et le congélateur côte à côte.
   */
  hero: ['#D9EEEA', '#E4EBF8', '#F3F5F8'] as readonly [string, string, string],
  heroCourses: ['#F8E6D6', '#F6EEE7', '#F3F5F8'] as readonly [string, string, string],
  heroRecettes: ['#F6E9D2', '#F5F0E6', '#F3F5F8'] as readonly [string, string, string],
  heroFrigo: ['#D9EEEA', '#E7F1EF', '#F3F5F8'] as readonly [string, string, string],
  heroCongelateur: ['#DCE6FA', '#E8EEF9', '#F3F5F8'] as readonly [string, string, string],
  /** Ombres (boxShadow) : douces en clair, remplacées par le filet `contour` en sombre. */
  ombre: {
    carte: '0 1px 2px rgba(14, 26, 43, 0.04), 0 6px 20px rgba(14, 26, 43, 0.06)',
    relief: '0 2px 6px rgba(14, 26, 43, 0.06), 0 12px 32px rgba(14, 26, 43, 0.10)',
    flottant: '0 6px 16px rgba(10, 107, 96, 0.28), 0 2px 4px rgba(14, 26, 43, 0.10)',
    /** Barre d'onglets : ombre vers le haut au lieu d'un trait. */
    barre: '0 -1px 0 rgba(14, 26, 43, 0.06), 0 -8px 24px rgba(14, 26, 43, 0.05)',
  },
  /** Carrosserie (porte) et intérieur éclairé des appareils illustrés. */
  carrosserie: {
    frigo: ['#FFFFFF', '#EEF2F6'] as readonly [string, string],
    congelateur: ['#F5FAFF', '#DCEAFB'] as readonly [string, string],
  },
  interieur: {
    frigo: ['#DDFBF5', '#F7F9FB'] as readonly [string, string],
    congelateur: ['#DCEBFF', '#F7F9FB'] as readonly [string, string],
  },
  /** Lumière intérieure, du haut vers le bas. */
  lueur: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as readonly [string, string],
  /** Givre en haut de la porte du congélateur, et ses flocons. */
  givrePorte: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'] as readonly [string, string],
  flocon: 'rgba(96,165,250,0.45)',
  /** Reflet diagonal sur la carrosserie. */
  reflet: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as readonly [string, string],
};

export type Couleurs = typeof clair;

const fonce: Couleurs = {
  ...commun,
  sombre: true,
  fond: '#0A0F17',
  carte: '#131A25',
  bordure: '#232E3D',
  encre: '#EEF2F7',
  encre2: '#9AA6B6',
  encre3: '#8592A4',
  frigoTexte: '#4FD1BD',
  congelateurTexte: '#7AA7FF',
  coursesTexte: '#F6A15C',
  orangeTexte: '#F3C04F',
  vertTexte: '#5FD38D',
  rougeTexte: '#F58A80',
  givre: ['#15233F', '#0A0F17'],
  hero: ['#0F2C2A', '#121E33', '#0A0F17'],
  heroCourses: ['#2E1D10', '#1C1813', '#0A0F17'],
  heroRecettes: ['#2C2210', '#1B1913', '#0A0F17'],
  heroFrigo: ['#0F2C2A', '#0F1D20', '#0A0F17'],
  heroCongelateur: ['#13223F', '#111A2A', '#0A0F17'],
  ombre: {
    carte: '0 0 0 rgba(0, 0, 0, 0)',
    relief: '0 12px 32px rgba(0, 0, 0, 0.45)',
    flottant: '0 8px 20px rgba(0, 0, 0, 0.5)',
    barre: '0 -1px 0 rgba(255, 255, 255, 0.07)',
  },
  carrosserie: {
    frigo: ['#2B3749', '#1B2536'],
    congelateur: ['#253A5A', '#17243A'],
  },
  interieur: {
    frigo: ['#0F2E2B', '#0B1220'],
    congelateur: ['#13264A', '#0B1220'],
  },
  lueur: ['rgba(186,230,253,0.12)', 'rgba(186,230,253,0)'],
  givrePorte: ['rgba(186,230,253,0.16)', 'rgba(186,230,253,0)'],
  flocon: 'rgba(186,230,253,0.55)',
  reflet: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)'],
};

/** Couleurs JS du thème actif (suit le choix fait dans Réglages). */
export function useCouleurs(): Couleurs {
  return useUniwind().theme === 'dark' ? fonce : clair;
}

export const couleurAppareil = (type: TypeAppareil) => (type === 'congelateur' ? commun.congelateur : commun.frigo);

/** Couleur de texte par type d'appareil (lisible sur carte et fond). */
export const couleurTexteAppareil = (c: Couleurs, type: TypeAppareil) => (type === 'congelateur' ? c.congelateurTexte : c.frigoTexte);

/** Classes Tailwind par type d'appareil (écrites en entier pour être détectées). */
export const classesAppareil = {
  frigo: { fond: 'bg-frigo', pale: 'bg-frigo-pale', texte: 'text-frigo-texte', bordure: 'border-frigo' },
  congelateur: { fond: 'bg-congelateur', pale: 'bg-congelateur-pale', texte: 'text-congelateur-texte', bordure: 'border-congelateur' },
} as const;

/** Cible tactile minimale (Material). */
export const CIBLE = 48;
/** Hauteur de la zone corbeille pendant un glisser-déposer. */
export const HAUTEUR_CORBEILLE = 96;
