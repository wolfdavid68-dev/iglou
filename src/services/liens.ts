import { openBrowserAsync } from 'expo-web-browser';

/**
 * Pages publiques (dossier `public/`), servies par Convex avec le site web.
 * EXPO_PUBLIC_CONVEX_SITE_URL : écrit par `npx convex dev` dans .env.local,
 * variable EAS pour les builds (voir README).
 */
export const SITE = (process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? '').replace(/\/$/, '');
export const LIEN_CONFIDENTIALITE = `${SITE}/confidentialite`;
export const LIEN_SUPPRESSION_COMPTE = `${SITE}/suppression-compte`;

/** Adresse de contact pour les données personnelles. */
export const CONTACT = 'admin@iglou.biz';

export function ouvrirLien(url: string) {
  openBrowserAsync(url).catch(() => {});
}
