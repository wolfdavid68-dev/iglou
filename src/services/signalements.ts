import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { api } from '../../convex/_generated/api';
import { convex } from './convex';

/** Infos jointes à chaque signalement, pour reproduire le bug. */
export function contexteTechnique() {
  const appareil = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS;
  const systeme = `${Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'} ${Device.osVersion ?? ''}`.trim();
  const versionApp = Constants.expoConfig?.version ?? '?';
  return { appareil: appareil.slice(0, 100), systeme: systeme.slice(0, 60), versionApp: versionApp.slice(0, 30) };
}

/**
 * Envoie un signalement (bug ou idée). Les signalements ne sont lisibles que
 * depuis le tableau de bord Convex : l'app peut seulement en créer.
 * L'uid et l'e-mail sont pris dans le jeton de connexion, côté serveur.
 */
export function envoyerSignalement(message: string, auteur: { prenom: string }, maisonId: string) {
  return convex.mutation(api.signalements.envoyer, {
    prenom: auteur.prenom.slice(0, 40),
    maisonId,
    message: message.trim(),
    ...contexteTechnique(),
  });
}
