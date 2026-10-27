import { stockage } from './stockage';

/**
 * Dernières données reçues du serveur, gardées sur l'appareil : au démarrage
 * (même hors ligne), l'app affiche tout de suite le dernier état connu, puis
 * les données à jour dès que Convex répond. Clés propres à chaque compte.
 */
const cle = (uid: string, nom: string) => `cache:${uid}:${nom}`;

export function lireCache<T>(uid: string, nom: string): T | null {
  try {
    const brut = stockage.lire(cle(uid, nom));
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

const enAttente = new Map<string, { valeur: unknown; minuteur: ReturnType<typeof setTimeout> }>();

/** Écriture différée et regroupée : une rafale de changements = une écriture. */
export function ecrireCache(uid: string, nom: string, valeur: unknown) {
  const k = cle(uid, nom);
  const precedent = enAttente.get(k);
  if (precedent) clearTimeout(precedent.minuteur);
  const minuteur = setTimeout(() => {
    enAttente.delete(k);
    try {
      stockage.ecrire(k, JSON.stringify(valeur));
    } catch {
      // Stockage plein ou indisponible : le cache est facultatif.
    }
  }, 800);
  enAttente.set(k, { valeur, minuteur });
}

export function effacerCache(uid: string, noms: string[]) {
  for (const nom of noms) {
    const k = cle(uid, nom);
    const precedent = enAttente.get(k);
    if (precedent) clearTimeout(precedent.minuteur);
    enAttente.delete(k);
    try {
      stockage.effacer(k);
    } catch {
      // Rien à faire.
    }
  }
}

export const CACHE_ADHESIONS = 'adhesions';
export const cacheMaison = (maisonId: string) => `maison:${maisonId}`;
