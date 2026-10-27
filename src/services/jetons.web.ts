/** Web : localStorage du navigateur (absent pendant le rendu côté serveur). */
const dispo = () => typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function';

export const stockageJetons = {
  getItem: (k: string) => (dispo() ? localStorage.getItem(k) : null),
  setItem: (k: string, v: string) => {
    if (dispo()) localStorage.setItem(k, v);
  },
  removeItem: (k: string) => {
    if (dispo()) localStorage.removeItem(k);
  },
};
