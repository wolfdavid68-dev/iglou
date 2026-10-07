import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { creerMaison, useMaisons } from './maisons';
import { lancer } from './retours';
import { connecter, inscrire, useSession } from './session';

// Derrière `__DEV__` : en build de production, le minificateur retire ces valeurs du bundle.
const EMAIL = __DEV__ ? process.env.EXPO_PUBLIC_DEV_EMAIL : undefined;
const MDP = __DEV__ ? process.env.EXPO_PUBLIC_DEV_MDP : undefined;

/**
 * Aperçu web en local uniquement : connexion automatique avec le compte de
 * test de `.env.local` et entrée directe dans une maison. Inactif sur
 * téléphone et dans les builds (`__DEV__` faux).
 */
const ACTIF =
  __DEV__ &&
  Platform.OS === 'web' &&
  typeof location !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(location.hostname) &&
  !!EMAIL &&
  !!MDP;

const COMPTE_ABSENT = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'];

/** Vrai tant que l'entrée automatique est en cours (rien à afficher). */
export function useAccesDirectDev(): boolean {
  const session = useSession();
  const maisons = useMaisons();
  const [termine, setTermine] = useState(!ACTIF);
  const connexionTentee = useRef(false);
  const maisonFaite = useRef(false);
  const utilisateur = session.utilisateur;

  useEffect(() => {
    if (termine || session.chargement || utilisateur || connexionTentee.current) return;
    connexionTentee.current = true;
    connecter(EMAIL!, MDP!)
      .catch((e: { code?: string }) => {
        if (COMPTE_ABSENT.includes(e.code ?? '')) return inscrire(EMAIL!, MDP!, 'Testeur');
        throw e;
      })
      .catch((e) => {
        console.warn('[accès direct] connexion impossible', e);
        setTermine(true);
      });
  }, [termine, session.chargement, utilisateur]);

  useEffect(() => {
    if (termine || !utilisateur || maisons.chargement || maisonFaite.current) return;
    maisonFaite.current = true;
    if (!maisons.maisonActiveId) {
      if (maisons.adhesions.length) {
        maisons.choisirMaison(maisons.adhesions[0].maisonId);
      } else {
        const { maisonId, ecriture } = creerMaison('Maison test', utilisateur.uid, session.prenom || 'Testeur');
        lancer(ecriture);
        maisons.choisirMaison(maisonId);
      }
    }
    setTermine(true);
  }, [termine, utilisateur, maisons, session.prenom]);

  return !termine;
}
