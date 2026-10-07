import Storage from 'expo-sqlite/kv-store';

/** Petit stockage clé/valeur local et synchrone (préférences de l'appareil). */
export const stockage = {
  lire: (cle: string): string | null => Storage.getItemSync(cle),
  ecrire: (cle: string, valeur: string) => Storage.setItemSync(cle, valeur),
  effacer: (cle: string) => {
    Storage.removeItemSync(cle);
  },
};
