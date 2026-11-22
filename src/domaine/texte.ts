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

/** Nombre à afficher : « 2 », « 1,5 » (virgule française). */
export function formaterNombre(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR');
}

/** Unité à afficher après un nombre : rien pour les pièces et les portions. */
export function suffixeUnite(unite: string): string | undefined {
  return unite === 'pièce' || unite === 'portion' ? undefined : unite;
}

export function formaterQuantite(quantite: number, unite: string): string {
  const nombre = formaterNombre(quantite);
  if (unite === 'pièce') return `${nombre} pièce${quantite > 1 ? 's' : ''}`;
  if (unite === 'portion') return `${nombre} portion${quantite > 1 ? 's' : ''}`;
  return `${nombre} ${unite}`;
}

/** Arrondit pour éviter les 0.30000000000000004 sur les unités décimales. */
export function arrondir(valeur: number): number {
  return Math.round(valeur * 1000) / 1000;
}
