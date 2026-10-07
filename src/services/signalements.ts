import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { collection, doc, serverTimestamp, writeBatch } from './firestore';
import { db } from './firebase';

/** Infos jointes à chaque signalement, pour reproduire le bug. */
export function contexteTechnique() {
  const appareil = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS;
  const systeme = `${Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'} ${Device.osVersion ?? ''}`.trim();
  const versionApp = Constants.expoConfig?.version ?? '?';
  return { appareil: appareil.slice(0, 100), systeme: systeme.slice(0, 60), versionApp: versionApp.slice(0, 30) };
}

/**
 * Envoie un signalement (bug ou idée). Les signalements ne sont lisibles que
 * depuis la console Firebase : l'app peut seulement en créer.
 */
export function envoyerSignalement(message: string, auteur: { uid: string; email: string; prenom: string }, maisonId: string) {
  const b = writeBatch(db);
  b.set(doc(collection(db, 'signalements')), {
    uid: auteur.uid,
    email: auteur.email,
    prenom: auteur.prenom.slice(0, 40),
    maisonId,
    message: message.trim(),
    ...contexteTechnique(),
    createdAt: serverTimestamp(),
  });
  return b.commit();
}
