import {
  collection,
  collectionGroup,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from './firestore';
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { enLots } from '@/domaine/import-export';
import { codeValide, genererCode, normaliserCode } from '@/domaine/invitation';
import type { Role } from '@/domaine/types';
import { codeErreur, db, refCollection, refDoc, refInvitation, refMaison, versMembre, type SousCollection } from './firebase';
import { useSession } from './session';
import { stockage } from './stockage';

const CLE_MAISON_ACTIVE = 'maisonActive';

export interface Adhesion {
  maisonId: string;
  nom: string;
  role: Role;
}

interface ContexteMaisons {
  chargement: boolean;
  adhesions: Adhesion[];
  maisonActiveId: string | null;
  choisirMaison: (id: string | null) => void;
  /** « Tu ne fais plus partie de … » après un retrait par le propriétaire. */
  messageRetrait: string | null;
  effacerMessageRetrait: () => void;
}

const Contexte = createContext<ContexteMaisons | null>(null);

function lireMaisonActive(): string | null {
  try {
    return stockage.lire(CLE_MAISON_ACTIVE);
  } catch {
    return null;
  }
}

function ecrireMaisonActive(id: string | null) {
  try {
    if (id) stockage.ecrire(CLE_MAISON_ACTIVE, id);
    else stockage.effacer(CLE_MAISON_ACTIVE);
  } catch {
    // Stockage local indisponible : on redemandera la maison au prochain lancement.
  }
}

export function MaisonsProvider({ children }: { children: ReactNode }) {
  const { utilisateur } = useSession();
  const uid = utilisateur?.uid ?? null;
  // L'état est rattaché à l'uid : au changement de compte, on repart de zéro sans effet de bord.
  const [etat, setEtat] = useState<{ uid: string | null; adhesions: Adhesion[]; charge: boolean }>({
    uid: null,
    adhesions: [],
    charge: false,
  });
  const [maisonActiveId, setMaisonActiveId] = useState<string | null>(lireMaisonActive);
  const [messageRetrait, setMessageRetrait] = useState<string | null>(null);
  const activeRef = useRef(maisonActiveId);

  const choisirMaison = useCallback((id: string | null) => {
    activeRef.current = id;
    setMaisonActiveId(id);
    ecrireMaisonActive(id);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let actif = true;
    let retire = false;
    let premiereReponse = true;
    const noms = new Map<string, string>();
    const q = query(collectionGroup(db, 'membres'), where('uid', '==', uid));
    const desabonner = onSnapshot(
      q,
      { includeMetadataChanges: true },
      async (snap) => {
        const membres = snap.docs.map(versMembre);
        const liste = await Promise.all(
          membres.map(async (m): Promise<Adhesion> => {
            const maison = await getDoc(refMaison(m.maisonId)).catch(() => null);
            const nom = (maison?.data()?.nom as string | undefined) ?? noms.get(m.maisonId) ?? 'Maison';
            noms.set(m.maisonId, nom);
            return { maisonId: m.maisonId, nom, role: m.role };
          }),
        );
        if (!actif) return;
        liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        // Tant que seul le cache répond et qu'il est vide, on attend le serveur.
        const charge = !snap.metadata.fromCache || liste.length > 0;
        setEtat({ uid, adhesions: liste, charge });

        if (snap.metadata.fromCache) return;
        const active = activeRef.current;
        if (active && !liste.some((a) => a.maisonId === active)) {
          retire = true;
          const nom = noms.get(active);
          setMessageRetrait(nom ? `Tu ne fais plus partie de « ${nom} ».` : 'Tu ne fais plus partie de cette maison.');
          choisirMaison(null);
        } else if (!active && liste.length === 1 && !retire && premiereReponse) {
          // Une seule maison au lancement : on y entre directement.
          choisirMaison(liste[0].maisonId);
        }
        premiereReponse = false;
      },
      () => {
        if (actif) setEtat((e) => ({ ...e, uid, charge: true }));
      },
    );
    return () => {
      actif = false;
      desabonner();
    };
  }, [uid, choisirMaison]);

  const adhesions = etat.uid === uid ? etat.adhesions : [];
  const chargement = !uid || etat.uid !== uid || !etat.charge;

  return (
    <Contexte
      value={{
        chargement,
        adhesions,
        maisonActiveId,
        choisirMaison,
        messageRetrait,
        effacerMessageRetrait: () => setMessageRetrait(null),
      }}>
      {children}
    </Contexte>
  );
}

export function useMaisons() {
  const c = use(Contexte);
  if (!c) throw new Error('MaisonsProvider manquant');
  return c;
}

/* ---------------------------------------------------------------------------
 * Actions
 * ------------------------------------------------------------------------- */

/**
 * Crée la maison, l'adhésion du propriétaire et le code d'invitation en un seul
 * lot. Renvoie l'id tout de suite : la maison apparaît localement même hors ligne.
 */
export function creerMaison(nom: string, uid: string, prenom: string) {
  const code = genererCode();
  const maisonId = doc(collection(db, 'maisons')).id;
  const lot = writeBatch(db);
  lot.set(refMaison(maisonId), { nom: nom.trim(), codeInvitation: code, createdBy: uid, createdAt: serverTimestamp() });
  lot.set(refDoc(maisonId, 'membres', uid), { uid, maisonId, prenom, role: 'proprietaire', joinedAt: serverTimestamp() });
  lot.set(refInvitation(code), { maisonId });
  return { maisonId, ecriture: lot.commit() };
}

export type ResultatRejoindre = { ok: true; maisonId: string; dejaMembre: boolean } | { ok: false; message: string };

export async function rejoindreMaison(saisie: string, uid: string, prenom: string, adhesions: Adhesion[]): Promise<ResultatRejoindre> {
  const code = normaliserCode(saisie);
  if (!codeValide(code)) return { ok: false, message: 'Le code doit contenir 6 caractères.' };
  const invitation = await getDoc(refInvitation(code));
  const maisonId = invitation.data()?.maisonId as string | undefined;
  if (!invitation.exists() || !maisonId) return { ok: false, message: 'Code invalide ou expiré.' };
  if (adhesions.some((a) => a.maisonId === maisonId)) return { ok: true, maisonId, dejaMembre: true };
  try {
    await setDoc(refDoc(maisonId, 'membres', uid), { uid, maisonId, prenom, role: 'membre', joinedAt: serverTimestamp(), code });
  } catch (e) {
    if (codeErreur(e) === 'firestore/permission-denied') return { ok: false, message: 'Code invalide ou expiré.' };
    throw e;
  }
  return { ok: true, maisonId, dejaMembre: false };
}

export function quitterMaison(maisonId: string, uid: string) {
  return deleteDoc(refDoc(maisonId, 'membres', uid));
}

export function retirerMembre(maisonId: string, uid: string) {
  return deleteDoc(refDoc(maisonId, 'membres', uid));
}

export function renommerMaison(maisonId: string, nom: string) {
  return updateDoc(refMaison(maisonId), { nom: nom.trim() });
}

export function changerPrenomMembre(maisonId: string, uid: string, prenom: string) {
  return updateDoc(refDoc(maisonId, 'membres', uid), { prenom: prenom.trim() });
}

/** Nouveau code : l'ancien cesse immédiatement de fonctionner. */
export function regenererCode(maisonId: string, ancienCode: string) {
  const code = genererCode();
  const lot = writeBatch(db);
  lot.update(refMaison(maisonId), { codeInvitation: code });
  lot.set(refInvitation(code), { maisonId });
  lot.delete(refInvitation(ancienCode));
  return { code, ecriture: lot.commit() };
}

/** Suppression complète (propriétaire) : tout le contenu, puis la maison. */
export async function supprimerMaison(maisonId: string, uid: string, code: string) {
  const collections: SousCollection[] = ['aliments', 'tiroirs', 'appareils', 'coursesLibres', 'consommations'];
  const refs = [];
  for (const nom of collections) {
    const snap = await getDocs(refCollection(maisonId, nom));
    refs.push(...snap.docs.map((d) => d.ref));
  }
  const membres = await getDocs(refCollection(maisonId, 'membres'));
  refs.push(...membres.docs.filter((d) => d.id !== uid).map((d) => d.ref));
  await Promise.all(
    enLots(refs).map((lot) => {
      const b = writeBatch(db);
      lot.forEach((r) => b.delete(r));
      return b.commit();
    }),
  );
  // Dernier lot : la maison, l'invitation et notre propre adhésion ensemble.
  const fin = writeBatch(db);
  fin.delete(refInvitation(code));
  fin.delete(refMaison(maisonId));
  fin.delete(refDoc(maisonId, 'membres', uid));
  await fin.commit();
}
