import { ConvexReactClient } from 'convex/react';

import { api } from '../../convex/_generated/api';

/**
 * Client Convex unique de l'app. L'adresse est publique (pas un secret) :
 * la sécurité repose sur les contrôles des fonctions du dossier convex/.
 */
const URL = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!URL) throw new Error('EXPO_PUBLIC_CONVEX_URL manquant : lancer `npx convex dev` pour créer .env.local.');

export const convex = new ConvexReactClient(URL, { unsavedChangesWarning: false });

export { api };

const ALPHABET_ID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Identifiant de 20 caractères, du même genre que ceux de Firestore. */
export function nouvelId(): string {
  let id = '';
  for (let i = 0; i < 20; i++) id += ALPHABET_ID[Math.floor(Math.random() * ALPHABET_ID.length)];
  return id;
}
