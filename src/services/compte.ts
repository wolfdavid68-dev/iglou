import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from './auth-firebase';
import { deleteDoc, getDoc, getDocs, writeBatch } from './firestore';

import { auth, db, refCollection, refDoc, refMaison, refProfil, versMaison, versMembre } from './firebase';
import { quitterMaison, supprimerMaison, type Adhesion } from './maisons';

/**
 * Supprime définitivement le compte connecté (exigence du Play Store) :
 * - maison partagée dont je suis propriétaire : je passe la main au plus
 *   ancien membre, la maison et son inventaire restent aux autres ;
 * - maison où je suis seul : elle est supprimée avec tout son contenu ;
 * - maison où je suis simple membre : je la quitte ;
 * puis mon profil, puis le compte Firebase lui-même.
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
  const uid = user.uid;

  for (const a of adhesions) {
    if (a.role !== 'proprietaire') {
      await quitterMaison(a.maisonId, uid);
      continue;
    }
    const autres = (await getDocs(refCollection(a.maisonId, 'membres'))).docs
      .map(versMembre)
      .filter((m) => m.uid !== uid)
      .sort((x, y) => (x.joinedAt ?? 0) - (y.joinedAt ?? 0));
    if (autres.length > 0) {
      const lot = writeBatch(db);
      lot.update(refDoc(a.maisonId, 'membres', autres[0].uid), { role: 'proprietaire' });
      lot.delete(refDoc(a.maisonId, 'membres', uid));
      await lot.commit();
    } else {
      const maison = versMaison(await getDoc(refMaison(a.maisonId)));
      await supprimerMaison(a.maisonId, uid, maison.codeInvitation);
    }
  }

  await deleteDoc(refProfil(uid));
  await deleteUser(user);
}
