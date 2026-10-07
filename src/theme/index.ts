import { useUniwind } from 'uniwind';

import type { TypeAppareil } from '@/domaine/types';

/**
 * Les styles passent par les classes Tailwind (src/global.css). Ces valeurs
 * ne servent qu'aux endroits qui exigent une couleur en JS : icônes, barre
 * d'onglets, dégradés, barre d'état. Garder aligné avec global.css.
 */
const commun = {
  frigo: '#14B8A6',
  congelateur: '#3B82F6',
  courses: '#F97316',
  vert: '#22C55E',
  orange: '#F59E0B',
  rouge: '#EF4444',
  blanc: '#FFFFFF',
};

const clair = {
  ...commun,
  sombre: false,
  fond: '#F7F9FB',
  carte: '#FFFFFF',
  bordure: '#E2E8F0',
  encre: '#0F172A',
  encre2: '#64748B',
  encre3: '#94A3B8',
  givre: ['#DBEAFE', '#F7F9FB'] as readonly [string, string],
  /** Dégradé de l'en-tête d'accueil (frigo → congélateur). */
  hero: ['#14B8A6', '#0EA5E9', '#3B82F6'] as readonly [string, string, string],
  /** En-têtes en dégradé des autres écrans. */
  heroCourses: ['#F59E0B', '#F97316', '#F43F5E'] as readonly [string, string, string],
  heroFrigo: ['#2DD4BF', '#14B8A6', '#0EA5E9'] as readonly [string, string, string],
  heroCongelateur: ['#38BDF8', '#3B82F6', '#6366F1'] as readonly [string, string, string],
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
  fond: '#0B1220',
  carte: '#151E2E',
  bordure: '#263247',
  encre: '#F1F5F9',
  encre2: '#94A3B8',
  encre3: '#64748B',
  givre: ['#172A4A', '#0B1220'],
  hero: ['#0F766E', '#0369A1', '#1D4ED8'],
  heroCourses: ['#B45309', '#C2410C', '#BE123C'],
  heroFrigo: ['#0F766E', '#0E7490', '#0369A1'],
  heroCongelateur: ['#0369A1', '#1D4ED8', '#4338CA'],
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

/** Classes Tailwind par type d'appareil (écrites en entier pour être détectées). */
export const classesAppareil = {
  frigo: { fond: 'bg-frigo', pale: 'bg-frigo-pale', texte: 'text-frigo', bordure: 'border-frigo' },
  congelateur: { fond: 'bg-congelateur', pale: 'bg-congelateur-pale', texte: 'text-congelateur', bordure: 'border-congelateur' },
} as const;

/** Cible tactile minimale (Material). */
export const CIBLE = 48;
/** Hauteur de la zone corbeille pendant un glisser-déposer. */
export const HAUTEUR_CORBEILLE = 96;
