import { useConvexAuth, useConvexConnectionState, useQuery } from 'convex/react';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '../../convex/_generated/api';
import { appareilsTries } from '@/domaine/inventaire';
import type { DonneesServeur } from '@/domaine/operations';
import { etatSynchro, type EtatSynchro } from '@/domaine/synchro';
import type { Aliment, Appareil, CourseLibre, Maison, Membre, Tiroir } from '@/domaine/types';
import { cacheMaison, ecrireCache, lireCache } from './cache';
import { useMaisons } from './maisons';
import { useSession } from './session';

export interface DonneesMaison {
  maisonId: string;
  maison: Maison | null;
  membres: Membre[];
  appareils: Appareil[];
  tiroirs: Tiroir[];
  aliments: Aliment[];
  libres: CourseLibre[];
  /** Vrai tant qu'aucune donnée (serveur ou dernier état connu) n'est disponible. */
  chargement: boolean;
  synchro: EtatSynchro;
}

const Contexte = createContext<DonneesMaison | null>(null);

/** État de la connexion à Convex (bandeau « Hors ligne »). */
export function useSynchro(): EtatSynchro {
  const c = useConvexConnectionState();
  return etatSynchro({
    connecte: c.isWebSocketConnected,
    dejaConnecte: c.hasEverConnected,
    tentativesEchouees: c.connectionRetries,
    ecrituresEnAttente: c.inflightMutations,
  });
}

/**
 * Toute la maison active, en temps réel, en une seule requête Convex. Avant la
 * première réponse (démarrage, hors ligne), on affiche le dernier état connu.
 */
export function DonneesMaisonProvider({ maisonId, children }: { maisonId: string; children: ReactNode }) {
  const uid = useSession().utilisateur?.uid ?? null;
  const { isAuthenticated } = useConvexAuth();
  const serveur = useQuery(api.donnees.maison, isAuthenticated ? { maisonId } : 'skip');
  const cache = useMemo(() => (uid ? lireCache<DonneesServeur>(uid, cacheMaison(maisonId)) : null), [uid, maisonId]);
  // `null` = plus accès (retrait, suppression) : on garde l'affichage, le
  // fournisseur des maisons détecte le retrait et renvoie au choix de maison.
  const [dernier, setDernier] = useState<DonneesServeur | null>(null);
  if (serveur && serveur !== dernier) setDernier(serveur);
  const synchro = useSynchro();

  useEffect(() => {
    if (uid && serveur) ecrireCache(uid, cacheMaison(maisonId), serveur);
  }, [uid, maisonId, serveur]);

  const d = serveur ?? dernier ?? cache;

  const valeur = useMemo<DonneesMaison>(
    () => ({
      maisonId,
      maison: d?.maison ?? null,
      membres: [...(d?.membres ?? [])].sort((a, b) =>
        a.role === b.role ? a.prenom.localeCompare(b.prenom, 'fr') : a.role === 'proprietaire' ? -1 : 1,
      ),
      appareils: appareilsTries(d?.appareils ?? []),
      tiroirs: d?.tiroirs ?? [],
      aliments: d?.aliments ?? [],
      libres: d?.libres ?? [],
      chargement: !d,
      synchro,
    }),
    [maisonId, d, synchro],
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

/** Vrai quand la connexion au serveur est perdue (seulement dans une maison ouverte). */
export function useHorsLigne(): boolean {
  const dansUneMaison = use(Contexte) !== null;
  return useSynchro() === 'hors-ligne' && dansUneMaison;
}

