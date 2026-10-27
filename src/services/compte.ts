import { api } from '../../convex/_generated/api';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from './auth-firebase';
import { CACHE_ADHESIONS, cacheMaison, effacerCache } from './cache';
import { convex } from './convex';
import { auth } from './firebase';
import type { Adhesion } from './maisons';

/**
 * Supprime définitivement le compte connecté (exigence du Play Store) :
 * - maison partagée dont je suis propriétaire : je passe la main au plus
 *   ancien membre, la maison et son inventaire restent aux autres ;
 * - maison où je suis seul : elle est supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis mon profil (tout cela côté serveur, en une transaction), puis le
 * compte Firebase lui-même.
 *
 * Le mot de passe est redemandé d'abord : Firebase l'exige pour supprimer un
 * compte, et rien n'est effacé si le mot de passe est faux. `apresVerification`
 * est appelé une fois le mot de passe accepté, juste avant le premier effacement.
 */
export async function supprimerCompte(motDePasse: string, adhesions: Adhesion[], apresVerification?: () => void) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Aucun utilisateur connecté.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, motDePasse));
  apresVerification?.();
  await convex.mutation(api.compte.supprimerDonnees, {});
  effacerCache(user.uid, [CACHE_ADHESIONS, ...adhesions.map((a) => cacheMaison(a.maisonId))]);
  await deleteUser(user);
}
