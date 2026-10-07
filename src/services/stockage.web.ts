/** Web : localStorage du navigateur (absent pendant le rendu côté serveur). */
const dispo = () => typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function';

export const stockage = {
  lire: (cle: string): string | null => (dispo() ? localStorage.getItem(cle) : null),
  ecrire: (cle: string, valeur: string) => {
    if (dispo()) localStorage.setItem(cle, valeur);
  },
  effacer: (cle: string) => {
    if (dispo()) localStorage.removeItem(cle);
  },
};
