import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api } from '../../convex/_generated/api';
import { convex } from './convex';
import { codeErreur } from './erreurs';
import { stockageJetons } from './jetons';
import { stockage } from './stockage';

/**
 * Comptes : Convex Auth (e-mail + mot de passe). Les jetons sont gardés sur
 * l'appareil ; le dernier utilisateur connu aussi, pour ouvrir l'app hors ligne.
 */

export interface Utilisateur {
  uid: string;
  email: string;
}

interface Session {
  /** Vrai seulement au démarrage, tant qu'on ne sait pas si quelqu'un est connecté. */
  chargement: boolean;
  utilisateur: Utilisateur | null;
  /** Prénom affiché aux autres membres. */
  prenom: string;
}

const SessionContexte = createContext<Session>({ chargement: true, utilisateur: null, prenom: '' });

type ConnuLocalement = Utilisateur & { prenom: string };
const CLE_SESSION = 'session';

function lireSession(): ConnuLocalement | null {
  try {
    const brut = stockage.lire(CLE_SESSION);
    return brut ? (JSON.parse(brut) as ConnuLocalement) : null;
  } catch {
    return null;
  }
}

function ecrireSession(s: ConnuLocalement | null) {
  try {
    if (s) stockage.ecrire(CLE_SESSION, JSON.stringify(s));
    else stockage.effacer(CLE_SESSION);
  } catch {
    // Facultatif : sans ce souvenir, l'app attend simplement le serveur au démarrage.
  }
}

/** Actions de connexion et utilisateur courant, disponibles hors des composants. */
let actions: ReturnType<typeof useAuthActions> | null = null;
let auteur = { uid: '', prenom: '' };

/** Qui écrit, pour l'affichage immédiat des modifications (le serveur vérifie l'identité réelle). */
export const auteurCourant = () => auteur;

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    // shouldHandleCode : le paramètre `code` des liens d'invitation n'est pas un code de connexion.
    <ConvexAuthProvider client={convex} storage={stockageJetons} shouldHandleCode={false}>
      <SessionInterne>{children}</SessionInterne>
    </ConvexAuthProvider>
  );
}

function SessionInterne({ children }: { children: ReactNode }) {
  const authActions = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const moi = useQuery(api.profils.moi, isAuthenticated ? {} : 'skip');
  const [connu, setConnu] = useState<ConnuLocalement | null>(lireSession);
  const [demarre, setDemarre] = useState(connu !== null);

  useEffect(() => {
    actions = authActions;
  }, [authActions]);

  // Souvenir local mis à jour à chaque réponse du serveur, effacé à la déconnexion.
  const deconnecte = !isLoading && (!isAuthenticated || moi === null);
  const versionServeur = moi ? { uid: moi.uid, email: moi.email, prenom: moi.prenom } : null;
  const aJour = JSON.stringify(versionServeur) === JSON.stringify(connu);
  if (versionServeur && !aJour) setConnu(versionServeur);
  if (deconnecte && connu) setConnu(null);
  if (!demarre && (deconnecte || moi)) setDemarre(true);

  useEffect(() => {
    if (!isLoading) ecrireSession(connu);
  }, [connu, isLoading]);

  // Pendant la connexion au serveur (démarrage, hors ligne), le dernier utilisateur connu reste affiché.
  const courant = moi ?? (deconnecte ? null : connu);
  const utilisateur = courant ? { uid: courant.uid, email: courant.email } : null;
  const prenom = courant?.prenom ?? '';

  useEffect(() => {
    auteur = { uid: courant?.uid ?? '', prenom: courant?.prenom ?? '' };
  }, [courant?.uid, courant?.prenom]);

  return <SessionContexte value={{ chargement: !demarre, utilisateur, prenom }}>{children}</SessionContexte>;
}

export function useSession() {
  return use(SessionContexte);
}

/** Pour les écrans connectés : l'utilisateur est garanti par la navigation. */
export function useMoi(): { uid: string; email: string; prenom: string } {
  const { utilisateur, prenom } = use(SessionContexte);
  if (!utilisateur) throw new Error('Aucun utilisateur connecté.');
  return { uid: utilisateur.uid, email: utilisateur.email, prenom: prenom || 'Moi' };
}

/* ---------------------------------------------------------------------------
 * Actions (les erreurs portent un `code` du type « auth/… », voir erreurs.ts)
 * ------------------------------------------------------------------------- */

function exigerActions() {
  if (!actions) throw Object.assign(new Error('Connexion pas encore prête.'), { code: 'auth/network-request-failed' });
  return actions;
}

async function avecCode<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    throw Object.assign(new Error(codeErreur(e) || 'erreur'), { code: codeErreur(e), cause: e });
  }
}

export function inscrire(email: string, motDePasse: string, prenom: string) {
  return avecCode(() => exigerActions().signIn('password', { flow: 'signUp', email: email.trim(), password: motDePasse, name: prenom.trim() }));
}

export function connecter(email: string, motDePasse: string) {
  return avecCode(() => exigerActions().signIn('password', { flow: 'signIn', email: email.trim(), password: motDePasse }));
}

/** Étape 1 : un code à 8 chiffres part par e-mail. */
export function demanderCodeMotDePasse(email: string) {
  return avecCode(() => exigerActions().signIn('password', { flow: 'reset', email: email.trim() }));
}

/** Étape 2 : le code et le nouveau mot de passe. L'utilisateur est ensuite connecté. */
export function choisirNouveauMotDePasse(email: string, code: string, nouveau: string) {
  return avecCode(() =>
    exigerActions().signIn('password', { flow: 'reset-verification', email: email.trim(), code: code.trim(), newPassword: nouveau }),
  );
}

/** Mon prénom, partout : profil et affichage dans toutes mes maisons. */
export function changerPrenom(prenom: string) {
  return convex.mutation(api.profils.changerPrenom, { prenom: prenom.trim() });
}

export function deconnecter() {
  return exigerActions().signOut();
}
