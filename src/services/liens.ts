import { openBrowserAsync } from 'expo-web-browser';

/** Pages publiques hébergées sur Firebase Hosting (dossier `site/`). */
export const SITE = 'https://iglou.web.app';
export const LIEN_CONFIDENTIALITE = `${SITE}/confidentialite`;
export const LIEN_SUPPRESSION_COMPTE = `${SITE}/suppression-compte`;

/** Adresse de contact pour les données personnelles. */
export const CONTACT = 'wolfdavid68@gmail.com';

export function ouvrirLien(url: string) {
  openBrowserAsync(url).catch(() => {});
}
