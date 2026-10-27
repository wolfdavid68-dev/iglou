import { api } from '../../convex/_generated/api';
import { CACHE_ADHESIONS, cacheMaison, effacerCache } from './cache';
import { convex } from './convex';
import { codeErreur } from './erreurs';
import type { Adhesion } from './maisons';
import { deconnecter } from './session';

/**
 * Supprime définitivement le compte connecté (exigence du Play Store). Le
 * serveur vérifie d'abord le mot de passe (rien n'est effacé s'il est faux),
 * puis, en une transaction :
 * - maison partagée dont je suis propriétaire : le plus ancien membre le devient ;
 * - maison où je suis seul : supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis mon profil et mon compte.
 *
 * `apresSuppression` est appelé dès que le serveur a tout effacé.
 */
export async function supprimerCompte(uid: string, motDePasse: string, adhesions: Adhesion[], apresSuppression?: () => void) {
  try {
    await convex.action(api.compte.supprimer, { motDePasse });
  } catch (e) {
    throw Object.assign(new Error(codeErreur(e)), { code: codeErreur(e), cause: e });
  }
  apresSuppression?.();
  effacerCache(uid, [CACHE_ADHESIONS, ...adhesions.map((a) => cacheMaison(a.maisonId))]);
  // La session n'existe déjà plus côté serveur : on efface simplement les jetons locaux.
  await deconnecter().catch(() => {});
}
