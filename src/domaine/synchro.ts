/** État de la connexion au serveur (Convex). */
export interface EtatConnexion {
  connecte: boolean;
  /** Faux tant que la toute première connexion n'a pas abouti (démarrage). */
  dejaConnecte: boolean;
  /** Tentatives de connexion échouées depuis le démarrage. */
  tentativesEchouees: number;
  /** Écritures envoyées mais pas encore confirmées par le serveur. */
  ecrituresEnAttente: number;
}

export type EtatSynchro = 'synchronise' | 'en-attente' | 'hors-ligne';

/**
 * Hors ligne quand la connexion est perdue (ou n'a jamais pu s'établir) ;
 * « en attente » tant que des écritures ne sont pas confirmées. Hors ligne,
 * les écritures restent en file dans l'app et partent au retour du réseau.
 */
export function etatSynchro(c: EtatConnexion): EtatSynchro {
  if (!c.connecte && (c.dejaConnecte || c.tentativesEchouees > 0)) return 'hors-ligne';
  if (c.ecrituresEnAttente > 0) return 'en-attente';
  return 'synchronise';
}
