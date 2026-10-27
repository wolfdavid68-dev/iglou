import { ConvexReactClient } from 'convex/react';

/**
 * Client Convex unique de l'app. L'adresse du déploiement vient de
 * `EXPO_PUBLIC_CONVEX_URL` (`.env.local` en développement, variables EAS pour
 * les builds). Les comptes passent aussi par Convex : voir session.tsx.
 */
const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) console.warn('EXPO_PUBLIC_CONVEX_URL manquant : lance `npx convex dev` (voir README).');

export const convex = new ConvexReactClient(url ?? 'https://configuration-manquante.convex.cloud', {
  // Pas de « quitter la page ? » sur le web : les écritures en attente repartent au retour.
  unsavedChangesWarning: false,
});
