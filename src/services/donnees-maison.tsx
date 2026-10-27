import { useConvexConnectionState, useQuery } from 'convex/react';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { appareilsTries } from '@/domaine/inventaire';
import { etatSynchro, type EtatSynchro } from '@/domaine/synchro';
import type { Aliment, Appareil, CourseLibre, Maison, Membre, Tiroir } from '@/domaine/types';
import { api } from './convex';
import { useMaisons } from './maisons';

export interface DonneesMaison {
  maisonId: string;
  maison: Maison | null;
  membres: Membre[];
  appareils: Appareil[];
  tiroirs: Tiroir[];
  aliments: Aliment[];
  libres: CourseLibre[];
  /** Vrai tant que les premières données ne sont pas arrivées. */
  chargement: boolean;
  synchro: EtatSynchro;
}

const Contexte = createContext<DonneesMaison | null>(null);

/**
 * Écoute en temps réel toute la maison active (une seule requête Convex).
 * Les écritures de l'app sont appliquées localement tout de suite
 * (voir lots.ts), puis confirmées par le serveur.
 */
export function DonneesMaisonProvider({ maisonId, children }: { maisonId: string; children: ReactNode }) {
  // En cas de retrait (null), on garde l'écran : le fournisseur des maisons
  // détecte le retrait et renvoie au choix de maison.
  const donnees = useQuery(api.donnees.maison, { maison: maisonId });
  const connexion = useConvexConnectionState();
  const synchro = etatSynchro(connexion);

  const valeur = useMemo<DonneesMaison>(
    () => ({
      maisonId,
      maison: donnees?.maison ?? null,
      membres: [...(donnees?.membres ?? [])].sort((a, b) =>
        a.role === b.role ? a.prenom.localeCompare(b.prenom, 'fr') : a.role === 'proprietaire' ? -1 : 1,
      ),
      appareils: appareilsTries(donnees?.appareils ?? []),
      tiroirs: donnees?.tiroirs ?? [],
      aliments: donnees?.aliments ?? [],
      libres: donnees?.libres ?? [],
      chargement: donnees === undefined,
      synchro,
    }),
    [maisonId, donnees, synchro],
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

/** Vrai si la connexion au serveur est coupée (hors ligne). */
export function useHorsLigne(): boolean {
  return use(Contexte)?.synchro === 'hors-ligne';
}
