import * as SecureStore from 'expo-secure-store';

/**
 * Téléphone : jetons de connexion Convex Auth dans le stockage sécurisé
 * d'Android (Keystore). Le web utilise localStorage (jetons.web.ts).
 */
const cle = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

export const stockageJetons = {
  getItem: (k: string) => SecureStore.getItemAsync(cle(k)),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(cle(k), v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(cle(k)),
};
