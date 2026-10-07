import './init-firebase';

import { getAuth } from './auth-firebase';
import {
  Timestamp,
  collection,
  doc,
  getFirestore,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from './firestore';

import type { Aliment, Appareil, Consommation, CourseLibre, Horodatage, Maison, Membre, Tiroir, Unite } from '@/domaine/types';

/**
 * Uniquement la configuration publique de l'application (google-services.json).
 * Aucune clé d'administration n'est présente dans l'app : la sécurité repose
 * sur les règles Firestore (firestore.rules).
 *
 * Le cache persistant de Firestore est actif par défaut : l'app fonctionne
 * hors ligne et les écritures en attente partent au retour du réseau.
 */
export const auth = getAuth();
export const db = getFirestore();

export type SousCollection = 'membres' | 'appareils' | 'tiroirs' | 'aliments' | 'coursesLibres' | 'consommations';

export const refMaison = (maisonId: string) => doc(db, 'maisons', maisonId);
export const refCollection = (maisonId: string, nom: SousCollection) => collection(db, 'maisons', maisonId, nom);
export const refDoc = (maisonId: string, nom: SousCollection, id: string) => doc(db, 'maisons', maisonId, nom, id);
export const refInvitation = (code: string) => doc(db, 'invitations', code);
export const refProfil = (uid: string) => doc(db, 'profils', uid);
export const nouvelId = (maisonId: string, nom: SousCollection) => doc(refCollection(maisonId, nom)).id;

/* ---------- Conversion Firestore → domaine ---------- */

/** Horodatage serveur en millisecondes ; null tant que l'écriture n'est pas confirmée. */
export function versMs(valeur: unknown): Horodatage {
  if (valeur instanceof Timestamp) return valeur.toMillis();
  if (valeur && typeof (valeur as { toMillis?: unknown }).toMillis === 'function') return (valeur as Timestamp).toMillis();
  return typeof valeur === 'number' ? valeur : null;
}

export const depuisMs = (ms: Horodatage) => (ms == null ? null : Timestamp.fromMillis(ms));

type Instantane = DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>;

const lire = (s: Instantane) => (s.data({ serverTimestamps: 'estimate' }) ?? {}) as Record<string, unknown>;
const texte = (v: unknown, defaut = '') => (typeof v === 'string' ? v : defaut);
const nombre = (v: unknown, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut);

export function versMaison(s: Instantane): Maison {
  const d = lire(s);
  return { id: s.id, nom: texte(d.nom), codeInvitation: texte(d.codeInvitation), createdBy: texte(d.createdBy), createdAt: versMs(d.createdAt) };
}

export function versMembre(s: Instantane): Membre {
  const d = lire(s);
  return {
    uid: texte(d.uid, s.id),
    maisonId: texte(d.maisonId),
    prenom: texte(d.prenom),
    role: d.role === 'proprietaire' ? 'proprietaire' : 'membre',
    joinedAt: versMs(d.joinedAt),
  };
}

export function versAppareil(s: Instantane): Appareil {
  const d = lire(s);
  return { id: s.id, nom: texte(d.nom), type: d.type === 'congelateur' ? 'congelateur' : 'frigo', ordre: nombre(d.ordre), createdAt: versMs(d.createdAt) };
}

export function versTiroir(s: Instantane): Tiroir {
  const d = lire(s);
  return { id: s.id, appareilId: texte(d.appareilId), nom: texte(d.nom), ordre: nombre(d.ordre) };
}

export function versAliment(s: Instantane): Aliment {
  const d = lire(s);
  const quantite = nombre(d.quantite);
  return {
    id: s.id,
    tiroirId: texte(d.tiroirId),
    appareilId: texte(d.appareilId),
    nom: texte(d.nom),
    quantite,
    quantiteMax: Math.max(nombre(d.quantiteMax, quantite), quantite),
    unite: texte(d.unite, 'pièce') as Unite,
    datePeremption: typeof d.datePeremption === 'string' ? d.datePeremption : null,
    note: typeof d.note === 'string' ? d.note : null,
    dansPanier: d.dansPanier === true,
    achatQuantite: typeof d.achatQuantite === 'number' ? d.achatQuantite : null,
    ajoutePar: texte(d.ajoutePar),
    ajouteParPrenom: texte(d.ajouteParPrenom),
    modifiePar: texte(d.modifiePar),
    createdAt: versMs(d.createdAt),
    updatedAt: versMs(d.updatedAt),
  };
}

export function versLibre(s: Instantane): CourseLibre {
  const d = lire(s);
  return {
    id: s.id,
    nom: texte(d.nom),
    quantite: nombre(d.quantite, 1),
    unite: texte(d.unite, 'pièce') as Unite,
    dansPanier: d.dansPanier === true,
    ajoutePar: texte(d.ajoutePar),
    createdAt: versMs(d.createdAt),
  };
}

/**
 * Code d'erreur Firebase. Sur le web, le SDK JavaScript omet le préfixe
 * « firestore/ » : on l'ajoute pour avoir les mêmes codes partout.
 */
export function codeErreur(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  return code && !code.includes('/') ? `firestore/${code}` : code;
}

/** Message d'erreur lisible pour l'utilisateur. */
export function messageErreur(e: unknown): string {
  const code = codeErreur(e);
  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet e-mail.';
    case 'auth/weak-password':
      return 'Mot de passe trop court (6 caractères minimum).';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    case 'auth/network-request-failed':
    case 'firestore/unavailable':
      return 'Pas de connexion internet.';
    case 'auth/operation-not-allowed':
      return "La connexion par e-mail n'est pas activée sur le serveur.";
    case 'firestore/permission-denied':
      return "Action refusée : tu n'as pas les droits nécessaires.";
    default:
      return 'Une erreur est survenue. Réessaie.';
  }
}

export function versConsommation(s: Instantane): Consommation {
  const d = lire(s);
  return {
    id: s.id,
    nom: texte(d.nom),
    quantite: nombre(d.quantite),
    unite: texte(d.unite, 'pièce') as Unite,
    appareilId: texte(d.appareilId),
    par: texte(d.par),
    at: versMs(d.at),
  };
}
