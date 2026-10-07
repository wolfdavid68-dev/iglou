import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from './auth-firebase';
import { getDoc, onSnapshot, serverTimestamp, setDoc } from './firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { auth, refProfil } from './firebase';

type Utilisateur = User;

interface Session {
  chargement: boolean;
  utilisateur: Utilisateur | null;
  /** Prénom affiché aux autres membres. */
  prenom: string;
}

const SessionContexte = createContext<Session>({ chargement: true, utilisateur: null, prenom: '' });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(auth.currentUser);
  const [chargement, setChargement] = useState(true);
  // Prénom rattaché à l'uid : au changement de compte, l'ancien n'est jamais affiché.
  const [profil, setProfil] = useState<{ uid: string; prenom: string } | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUtilisateur(u);
        setChargement(false);
      }),
    [],
  );

  useEffect(() => {
    if (!utilisateur) return;
    const uid = utilisateur.uid;
    return onSnapshot(
      refProfil(uid),
      (s) => setProfil({ uid, prenom: (s.data()?.prenom as string | undefined) ?? utilisateur.displayName ?? '' }),
      () => setProfil({ uid, prenom: utilisateur.displayName ?? '' }),
    );
  }, [utilisateur]);

  const prenom = utilisateur && profil?.uid === utilisateur.uid ? profil.prenom : '';

  return <SessionContexte value={{ chargement, utilisateur, prenom }}>{children}</SessionContexte>;
}

export function useSession() {
  return use(SessionContexte);
}

/** Pour les écrans connectés : l'utilisateur est garanti par la navigation. */
export function useMoi(): { uid: string; email: string; prenom: string } {
  const { utilisateur, prenom } = use(SessionContexte);
  if (!utilisateur) throw new Error('Aucun utilisateur connecté.');
  return { uid: utilisateur.uid, email: utilisateur.email ?? '', prenom: prenom || utilisateur.displayName || 'Moi' };
}

export async function inscrire(email: string, motDePasse: string, prenom: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), motDePasse);
  await updateProfile(user, { displayName: prenom.trim() });
  await setDoc(refProfil(user.uid), { prenom: prenom.trim(), createdAt: serverTimestamp() });
}

export async function connecter(email: string, motDePasse: string) {
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
  // Profil absent (compte créé hors de l'app) : on le crée avec le nom affiché.
  const profil = await getDoc(refProfil(user.uid)).catch(() => null);
  if (profil && !profil.exists() && user.displayName) {
    await setDoc(refProfil(user.uid), { prenom: user.displayName, createdAt: serverTimestamp() }).catch(() => {});
  }
}

export function reinitialiserMotDePasse(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function changerPrenom(uid: string, prenom: string) {
  await setDoc(refProfil(uid), { prenom: prenom.trim() }, { merge: true });
  if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: prenom.trim() });
}

export function deconnecter() {
  return signOut(auth);
}
