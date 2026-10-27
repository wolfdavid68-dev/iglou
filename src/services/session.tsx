import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import * as SecureStore from 'expo-secure-store';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { api, convex } from './convex';
import { codeErreur } from './erreurs';

/**
 * Comptes : Convex Auth (e-mail + mot de passe). Les comptes repris de
 * Firebase gardent leur uid et leur mot de passe (voir convex/motsDePasse.ts).
 */

interface Utilisateur {
  uid: string;
  email: string;
}

interface Session {
  chargement: boolean;
  utilisateur: Utilisateur | null;
  /** Prénom affiché aux autres membres. */
  prenom: string;
}

const SessionContexte = createContext<Session>({ chargement: true, utilisateur: null, prenom: '' });

/** Jeton de connexion : trousseau sécurisé sur téléphone, stockage du navigateur sur le web. */
const stockageJetons =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync }
    : undefined;

// Les écrans appellent inscrire()/connecter()… comme de simples fonctions :
// on garde ici les actions fournies par Convex Auth et l'uid courant.
let actions: ReturnType<typeof useAuthActions> | null = null;
let uidActuel = '';

/** uid du compte connecté (chaîne vide si personne). */
export const uidCourant = () => uidActuel;

function actionsAuth() {
  if (!actions) throw new Error('Session pas encore prête.');
  return actions;
}

function SessionInterne({ children }: { children: ReactNode }) {
  const a = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const moi = useQuery(api.utilisateurs.moiCourant, isAuthenticated ? {} : 'skip');

  useEffect(() => {
    actions = a;
  }, [a]);

  const utilisateur = isAuthenticated && moi ? { uid: moi.uid, email: moi.email } : null;
  useEffect(() => {
    uidActuel = utilisateur?.uid ?? '';
  }, [utilisateur?.uid]);

  // Connecté mais profil pas encore reçu : on attend plutôt que d'afficher l'écran de connexion.
  const chargement = isLoading || (isAuthenticated && moi === undefined);

  return <SessionContexte value={{ chargement, utilisateur, prenom: moi?.prenom ?? '' }}>{children}</SessionContexte>;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={stockageJetons}>
      <SessionInterne>{children}</SessionInterne>
    </ConvexAuthProvider>
  );
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

/**
 * En production, Convex masque le texte des erreurs de Convex Auth (le client
 * ne reçoit que « Server Error »). Une erreur non reconnue reçoit donc le code
 * le plus probable pour l'étape en cours (mauvais mot de passe, code expiré…).
 */
async function signInPassword(codeSiMasquee: string, params: Record<string, string>) {
  try {
    await actionsAuth().signIn('password', params);
  } catch (e) {
    if (!(e instanceof ConvexError) && codeErreur(e) === '') throw new ConvexError({ code: codeSiMasquee });
    throw e;
  }
}

export async function inscrire(email: string, motDePasse: string, prenom: string) {
  await signInPassword('compte-existant', { email: email.trim(), password: motDePasse, prenom: prenom.trim(), flow: 'signUp' });
}

export async function connecter(email: string, motDePasse: string) {
  await signInPassword('identifiants', { email: email.trim(), password: motDePasse, flow: 'signIn' });
}

/** Mot de passe oublié, étape 1 : envoie un code à 8 chiffres par e-mail. */
export async function envoyerCodeReinitialisation(email: string) {
  await signInPassword('identifiants', { email: email.trim(), flow: 'reset' });
}

/** Étape 2 : le code reçu et le nouveau mot de passe. Connecte l'utilisateur. */
export async function reinitialiserMotDePasse(email: string, code: string, nouveauMotDePasse: string) {
  await signInPassword('code-reinitialisation', {
    email: email.trim(),
    code: code.replace(/\s/g, ''),
    newPassword: nouveauMotDePasse,
    flow: 'reset-verification',
  });
}

export async function changerPrenom(_uid: string, prenom: string) {
  await convex.mutation(api.utilisateurs.changerPrenom, { prenom: prenom.trim() });
}

export async function deconnecter() {
  await actionsAuth().signOut();
}
