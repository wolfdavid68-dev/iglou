/** Minuscules, sans accents ni espaces superflus : sert aux comparaisons et à la recherche. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .trim();
}

export function memeNom(a: string, b: string): boolean {
  return normaliser(a) === normaliser(b);
}

export function formaterQuantite(quantite: number, unite: string): string {
  const nombre = Number.isInteger(quantite) ? String(quantite) : quantite.toLocaleString('fr-FR');
  if (unite === 'pièce') return `${nombre} pièce${quantite > 1 ? 's' : ''}`;
  if (unite === 'portion') return `${nombre} portion${quantite > 1 ? 's' : ''}`;
  return `${nombre} ${unite}`;
}

/** Arrondit pour éviter les 0.30000000000000004 sur les unités décimales. */
export function arrondir(valeur: number): number {
  return Math.round(valeur * 1000) / 1000;
}
