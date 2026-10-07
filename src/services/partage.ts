import { Platform, Share } from 'react-native';

import { afficherMessage, signalerErreur } from './retours';

/** Feuille de partage du système (WhatsApp, SMS…) ; sur le web, presse-papiers à défaut. */
export async function partagerTexte(texte: string) {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator.share === 'function') await navigator.share({ text: texte });
      else {
        await navigator.clipboard.writeText(texte);
        afficherMessage('Texte copié dans le presse-papiers.');
      }
    } else {
      await Share.share({ message: texte });
    }
  } catch (e) {
    // Partage annulé par l'utilisateur : rien à signaler.
    if ((e as Error)?.name !== 'AbortError') signalerErreur(e);
  }
}
