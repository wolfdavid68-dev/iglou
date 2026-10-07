import { onSnapshot, query, type DocumentData, type QuerySnapshot } from './firestore';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { appareilsTries } from '@/domaine/inventaire';
import { etatSynchro, type EtatSynchro, type MetaInstantane } from '@/domaine/synchro';
import type { Aliment, Appareil, CourseLibre, Maison, Membre, Tiroir } from '@/domaine/types';
import {
  refCollection,
  refMaison,
  versAliment,
  versAppareil,
  versLibre,
  versMaison,
  versMembre,
  versTiroir,
  type SousCollection,
} from './firebase';
import { useMaisons } from './maisons';

export interface DonneesMaison {
  maisonId: string;
  maison: Maison | null;
  membres: Membre[];
  appareils: Appareil[];
  tiroirs: Tiroir[];
  aliments: Aliment[];
  libres: CourseLibre[];
  /** Vrai tant que les premières données (cache ou serveur) ne sont pas arrivées. */
  chargement: boolean;
  synchro: EtatSynchro;
}

const Contexte = createContext<DonneesMaison | null>(null);

type Cle = 'maison' | SousCollection;
const CLES: Cle[] = ['maison', 'membres', 'appareils', 'tiroirs', 'aliments', 'coursesLibres'];

interface Etat {
  maisonId: string;
  maison: Maison | null;
  membres: Membre[];
  appareils: Appareil[];
  tiroirs: Tiroir[];
  aliments: Aliment[];
  libres: CourseLibre[];
  recus: Partial<Record<Cle, true>>;
  metas: Partial<Record<Cle, MetaInstantane>>;
}

const etatVide = (maisonId: string): Etat => ({
  maisonId,
  maison: null,
  membres: [],
  appareils: [],
  tiroirs: [],
  aliments: [],
  libres: [],
  recus: {},
  metas: {},
});

const meta = (s: { metadata: { fromCache: boolean; hasPendingWrites: boolean } }): MetaInstantane => ({
  fromCache: s.metadata.fromCache,
  hasPendingWrites: s.metadata.hasPendingWrites,
});

/**
 * Écoute en temps réel toute la maison active. Firestore sert d'abord le cache
 * local (affichage immédiat, même hors ligne), puis les mises à jour du serveur.
 */
export function DonneesMaisonProvider({ maisonId, children }: { maisonId: string; children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(() => etatVide(maisonId));

  useEffect(() => {
    const options = { includeMetadataChanges: true };
    const maj = (cle: Cle, champs: Partial<Etat>, m: MetaInstantane) =>
      setEtat((e) => {
        const base = e.maisonId === maisonId ? e : etatVide(maisonId);
        return { ...base, ...champs, recus: { ...base.recus, [cle]: true }, metas: { ...base.metas, [cle]: m } };
      });
    // En cas d'erreur (droits retirés), on garde les données affichées : le
    // fournisseur des maisons détecte le retrait et renvoie au choix de maison.
    const surErreur = (cle: Cle) => () => maj(cle, {}, { fromCache: false, hasPendingWrites: false });

    const ecouter = <T,>(nom: SousCollection, convertir: (s: QuerySnapshot<DocumentData>['docs'][number]) => T, champ: keyof Etat) =>
      onSnapshot(
        query(refCollection(maisonId, nom)),
        options,
        (snap: QuerySnapshot<DocumentData>) => maj(nom, { [champ]: snap.docs.map(convertir) } as Partial<Etat>, meta(snap)),
        surErreur(nom),
      );

    const desabonnements = [
      onSnapshot(
        refMaison(maisonId),
        options,
        (s) => maj('maison', { maison: s.exists() ? versMaison(s) : null }, meta(s)),
        surErreur('maison'),
      ),
      ecouter('membres', versMembre, 'membres'),
      ecouter('appareils', versAppareil, 'appareils'),
      ecouter('tiroirs', versTiroir, 'tiroirs'),
      ecouter('aliments', versAliment, 'aliments'),
      ecouter('coursesLibres', versLibre, 'libres'),
    ];
    return () => desabonnements.forEach((d) => d());
  }, [maisonId]);

  const courant = etat.maisonId === maisonId ? etat : etatVide(maisonId);

  const valeur = useMemo<DonneesMaison>(
    () => ({
      maisonId,
      maison: courant.maison,
      membres: [...courant.membres].sort((a, b) =>
        a.role === b.role ? a.prenom.localeCompare(b.prenom, 'fr') : a.role === 'proprietaire' ? -1 : 1,
      ),
      appareils: appareilsTries(courant.appareils),
      tiroirs: courant.tiroirs,
      aliments: courant.aliments,
      libres: courant.libres,
      chargement: !CLES.every((c) => courant.recus[c]),
      synchro: etatSynchro(CLES.map((c) => courant.metas[c])),
    }),
    [maisonId, courant],
  );

  return <Contexte value={valeur}>{children}</Contexte>;
}

export function useDonnees(): DonneesMaison {
  const c = use(Contexte);
  if (!c) throw new Error('DonneesMaisonProvider manquant');
  return c;
}

/** Rôle de l'utilisateur courant dans la maison active. */
export function useEstProprietaire(): boolean {
  const { maisonId } = useDonnees();
  const { adhesions } = useMaisons();
  return adhesions.find((a) => a.maisonId === maisonId)?.role === 'proprietaire';
}


/** Vrai si la maison active n'est servie que par le cache local (hors ligne). */
export function useHorsLigne(): boolean {
  return use(Contexte)?.synchro === 'hors-ligne';
}
