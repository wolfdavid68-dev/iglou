/** État de la connexion au serveur Convex (sous-ensemble de `ConnectionState`). */
export interface EtatConnexion {
  isWebSocketConnected: boolean;
  hasInflightRequests: boolean;
}

export type EtatSynchro = 'synchronise' | 'en-attente' | 'hors-ligne';

/**
 * Hors ligne si la connexion au serveur est coupée ; « en attente » si des
 * écritures locales n'ont pas encore été confirmées. Les écritures faites
 * hors ligne restent en file et partent au retour du réseau (tant que
 * l'application reste ouverte).
 */
export function etatSynchro(c: EtatConnexion): EtatSynchro {
  if (!c.isWebSocketConnected) return 'hors-ligne';
  if (c.hasInflightRequests) return 'en-attente';
  return 'synchronise';
}
