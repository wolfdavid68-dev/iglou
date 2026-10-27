import { arrondir } from './texte';
import type { Aliment, Unite } from './types';

export interface Stock {
  quantite: number;
  quantiteMax: number;
}

/**
 * Règle du maximum (« stock plein ») :
 * - à l'insertion, le maximum vaut la quantité ;
 * - une hausse au-delà du maximum relève le maximum ;
 * - une baisse ne touche jamais le maximum ;
 * - seul `modifierMaximum` (action explicite) peut baisser le maximum.
 *
 * Quantité et maximum sont toujours écrits ensemble, et le serveur (convex/lots.ts)
 * refuse toute écriture où `quantiteMax < quantite`.
 */
export function stockInitial(quantite: number): Stock {
  const q = Math.max(0, arrondir(quantite));
  return { quantite: q, quantiteMax: q };
}

export function fixerQuantite(stock: Stock, nouvelleQuantite: number): Stock {
  const quantite = Math.max(0, arrondir(nouvelleQuantite));
  return { quantite, quantiteMax: Math.max(stock.quantiteMax, quantite) };
}

/** Pas utilisé par les boutons « − » / « + » : 1 pour les pièces et portions, adapté sinon. */
export function pasPourUnite(unite: Unite): number {
  switch (unite) {
    case 'g':
      return 50;
    case 'kg':
      return 0.5;
    case 'L':
      return 0.5;
    default:
      return 1;
  }
}

/** Lit une quantité tapée (« 2 », « 1,5 ») ; `null` si ce n'est pas un nombre positif. */
export function lireQuantite(texte: string): number | null {
  const n = Number(texte.trim().replace(',', '.'));
  return texte.trim() && Number.isFinite(n) && n > 0 ? arrondir(n) : null;
}

export function incrementer(stock: Stock, pas = 1): Stock {
  return fixerQuantite(stock, stock.quantite + pas);
}

export function decrementer(stock: Stock, pas = 1): Stock {
  return fixerQuantite(stock, Math.max(0, stock.quantite - pas));
}

export interface ResultatMaximum extends Stock {
  /** Vrai si la quantité actuelle doit être ramenée au nouveau maximum (demander confirmation). */
  quantiteReduite: boolean;
}

export function modifierMaximum(stock: Stock, nouveauMax: number): ResultatMaximum {
  const quantiteMax = arrondir(nouveauMax);
  if (!(quantiteMax > 0)) throw new Error('Le maximum doit être supérieur à 0.');
  const quantiteReduite = stock.quantite > quantiteMax;
  return {
    quantiteMax,
    quantite: quantiteReduite ? quantiteMax : stock.quantite,
    quantiteReduite,
  };
}

export function manque(stock: Stock): number {
  return arrondir(Math.max(0, stock.quantiteMax - stock.quantite));
}

export function estEpuise(stock: Stock): boolean {
  return stock.quantite <= 0;
}

/** Remplissage entre 0 et 1, pour la jauge. */
export function remplissage(stock: Stock): number {
  if (stock.quantiteMax <= 0) return 0;
  return Math.min(1, Math.max(0, stock.quantite / stock.quantiteMax));
}

export type NiveauJauge = 'plein' | 'entame' | 'epuise';

export function niveauJauge(stock: Stock): NiveauJauge {
  if (estEpuise(stock)) return 'epuise';
  return stock.quantite >= stock.quantiteMax ? 'plein' : 'entame';
}

/** Ajout à un aliment existant du même tiroir (« Ajouter à l'existant »). */
export function ajouterALExistant(aliment: Pick<Aliment, 'quantite' | 'quantiteMax'>, ajout: number): Stock {
  return fixerQuantite(aliment, aliment.quantite + ajout);
}
