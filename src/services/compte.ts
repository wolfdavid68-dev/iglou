import { api, convex } from './convex';
import type { Adhesion } from './maisons';
import { connecter, deconnecter } from './session';

/**
 * Supprime définitivement le compte connecté (exigence du Play Store) :
 * - maison partagée dont je suis propriétaire : je passe la main au plus
 *   ancien membre, la maison et son inventaire restent aux autres ;
 * - maison où je suis seul : elle est supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis le compte lui-même (voir convex/compte.ts, tout en une transaction).
 *
 * Le mot de passe est redemandé d'abord, et rien n'est effacé s'il est faux.
 * `apresVerification` est appelé une fois le mot de passe accepté, juste
 * avant l'effacement.
 */
export async function supprimerCompte(email: string, motDePasse: string, _adhesions: Adhesion[], apresVerification?: () => void) {
  await connecter(email, motDePasse);
  apresVerification?.();
  await convex.mutation(api.compte.supprimer, {});
  // Les sessions sont déjà effacées côté serveur : on oublie le jeton local.
  await deconnecter().catch(() => {});
}
