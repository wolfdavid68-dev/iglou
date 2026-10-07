/** Métadonnées d'un instantané Firestore (cache local vs serveur). */
export interface MetaInstantane {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export type EtatSynchro = 'synchronise' | 'en-attente' | 'hors-ligne';

/**
 * Hors ligne si au moins un écouteur ne reçoit que le cache local ;
 * « en attente » si des écritures locales n'ont pas encore été confirmées.
 * Les écritures hors ligne sont conservées sur le disque par Firestore et
 * envoyées au retour du réseau, même après fermeture de l'application.
 */
export function etatSynchro(metas: (MetaInstantane | undefined)[]): EtatSynchro {
  const connues = metas.filter((m): m is MetaInstantane => m !== undefined);
  if (connues.some((m) => m.fromCache)) return 'hors-ligne';
  if (connues.some((m) => m.hasPendingWrites)) return 'en-attente';
  return 'synchronise';
}
