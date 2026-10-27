import { ConvexProviderWithAuth, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api } from '../../convex/_generated/api';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from './auth-firebase';
import { convex } from './convex';
import { auth } from './firebase';

/**
 * Comptes : Firebase Authentication. Données : Convex, qui reçoit le jeton
 * d'identité Firebase de l'utilisateur connecté (uid identique des deux côtés).
 */

interface EtatAuth {
  chargement: boolean;
  utilisateur: User | null;
  /** Nom affiché Firebase, relu après chaque changement (l'objet User peut être modifié sur place). */
  nomAffiche: string;
}

interface Session {
  chargement: boolean;
  utilisateur: User | null;
  /** Prénom affiché aux autres membres. */
  prenom: string;
}

const AuthContexte = createContext<EtatAuth>({ chargement: true, utilisateur: null, nomAffiche: '' });
const SessionContexte = createContext<Session>({ chargement: true, utilisateur: null, prenom: '' });

/** Relit l'utilisateur Firebase (après inscription ou changement de prénom). */
const rafraichisseurs = new Set<() => void>();
const rafraichirUtilisateur = () => rafraichisseurs.forEach((r) => r());

const lireEtat = (chargement: boolean): EtatAuth => ({
  chargement,
  utilisateur: auth.currentUser,
  nomAffiche: auth.currentUser?.displayName ?? '',
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatAuth>(() => lireEtat(true));

  useEffect(() => {
    const rafraichir = () => setEtat(lireEtat(false));
    rafraichisseurs.add(rafraichir);
    const desabonner = onAuthStateChanged(auth, rafraichir);
    return () => {
      rafraichisseurs.delete(rafraichir);
      desabonner();
    };
  }, []);

  return (
    <AuthContexte value={etat}>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFirebase}>
        <SessionAvecProfil>{children}</SessionAvecProfil>
      </ConvexProviderWithAuth>
    </AuthContexte>
  );
}

/** Pont Firebase → Convex : fournit le jeton d'identité, rafraîchi à la demande. */
function useAuthFirebase() {
  const { chargement, utilisateur } = use(AuthContexte);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!utilisateur) return null;
      try {
        return await utilisateur.getIdToken(forceRefreshToken);
      } catch {
        return null;
      }
    },
    [utilisateur],
  );
  return useMemo(
    () => ({ isLoading: chargement, isAuthenticated: !!utilisateur, fetchAccessToken }),
    [chargement, utilisateur, fetchAccessToken],
  );
}

function SessionAvecProfil({ children }: { children: ReactNode }) {
  const { chargement, utilisateur, nomAffiche } = use(AuthContexte);
  const { isAuthenticated } = useConvexAuth();
  const profil = useQuery(api.profils.moi, isAuthenticated ? {} : 'skip');
  const assurerProfil = useMutation(api.profils.assurer);
  const profilCree = useRef<string | null>(null);
  const uid = utilisateur?.uid ?? null;

  // Profil absent (inscription, ou compte créé hors de l'app) : créé avec le nom affiché.
  useEffect(() => {
    if (!uid || profil !== null || !nomAffiche.trim() || profilCree.current === uid) return;
    profilCree.current = uid;
    assurerProfil({ prenom: nomAffiche.trim().slice(0, 40) }).catch(() => {
      profilCree.current = null;
    });
  }, [uid, profil, nomAffiche, assurerProfil]);

  // Prénom rattaché à l'uid : au changement de compte, l'ancien n'est jamais affiché.
  const prenom = uid ? (profil?.uid === uid ? profil.prenom : nomAffiche) : '';

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

/** Le profil Convex est créé dès que la connexion au serveur est établie (voir SessionAvecProfil). */
export async function inscrire(email: string, motDePasse: string, prenom: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), motDePasse);
  await updateProfile(user, { displayName: prenom.trim() });
  rafraichirUtilisateur();
}

export async function connecter(email: string, motDePasse: string) {
  await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
}

export function reinitialiserMotDePasse(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

/** Mon prénom, partout : profil, affichage dans toutes mes maisons, nom Firebase. */
export async function changerPrenom(prenom: string) {
  await convex.mutation(api.profils.changerPrenom, { prenom: prenom.trim() });
  if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: prenom.trim() });
  rafraichirUtilisateur();
}

export function deconnecter() {
  return signOut(auth);
}
