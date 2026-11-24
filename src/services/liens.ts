import { openBrowserAsync } from 'expo-web-browser';

/** Pages publiques (dossier `public/`), servies avec la PWA par le VPS (deploy/vps/). */
export const SITE = 'https://iglou.mediurg.systems';
export const LIEN_CONFIDENTIALITE = `${SITE}/confidentialite`;
export const LIEN_SUPPRESSION_COMPTE = `${SITE}/suppression-compte`;

/** Adresse de contact pour les données personnelles. */
export const CONTACT = 'wolfdavid68@gmail.com';

export function ouvrirLien(url: string) {
  openBrowserAsync(url).catch(() => {});
}
