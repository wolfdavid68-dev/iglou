import { openBrowserAsync } from 'expo-web-browser';

/** Pages publiques hébergées sur Firebase Hosting (dossier `site/`). */
export const SITE = 'https://congelateur-v91vd.web.app';
export const LIEN_CONFIDENTIALITE = `${SITE}/confidentialite`;
export const LIEN_SUPPRESSION_COMPTE = `${SITE}/suppression-compte`;

/** Adresse de contact pour les données personnelles. */
export const CONTACT = 'admin@iglou.biz';

export function ouvrirLien(url: string) {
  openBrowserAsync(url).catch(() => {});
}
