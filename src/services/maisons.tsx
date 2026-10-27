import { useConvexAuth, useQuery } from 'convex/react';
import type { OptimisticLocalStore } from 'convex/browser';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api } from '../../convex/_generated/api';
import { nouvelId } from '@/domaine/ids';
import { codeValide, genererCode, normaliserCode } from '@/domaine/invitation';
import type { Role } from '@/domaine/types';
import { CACHE_ADHESIONS, ecrireCache, lireCache } from './cache';
import { convex } from './convex';
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
  const { isAuthenticated } = useConvexAuth();
  // `null` : le serveur ne nous reconnaît pas encore (connexion en cours).
  const serveur = useQuery(api.maisons.mesAdhesions, uid && isAuthenticated ? {} : 'skip') ?? undefined;
  const cache = useMemo(() => (uid ? lireCache<Adhesion[]>(uid, CACHE_ADHESIONS) : null), [uid]);

  const [maisonActiveId, setMaisonActiveId] = useState<string | null>(lireMaisonActive);
  const [messageRetrait, setMessageRetrait] = useState<string | null>(null);
  const activeRef = useRef(maisonActiveId);
  // Suivi par compte : au changement d'utilisateur, on repart de zéro.
  const suivi = useRef<{ uid: string | null; premiere: boolean; retire: boolean; noms: Map<string, string> }>({
    uid: null,
    premiere: true,
    retire: false,
    noms: new Map(),
  });

  const choisirMaison = useCallback((id: string | null) => {
    activeRef.current = id;
    setMaisonActiveId(id);
    ecrireMaisonActive(id);
  }, []);

  useEffect(() => {
    if (!uid || !serveur) return;
    if (suivi.current.uid !== uid) suivi.current = { uid, premiere: true, retire: false, noms: new Map() };
    const s = suivi.current;
    ecrireCache(uid, CACHE_ADHESIONS, serveur);

    const active = activeRef.current;
    if (active && !serveur.some((a) => a.maisonId === active)) {
      s.retire = true;
      const nom = s.noms.get(active) ?? cache?.find((a) => a.maisonId === active)?.nom;
      setMessageRetrait(nom ? `Tu ne fais plus partie de « ${nom} ».` : 'Tu ne fais plus partie de cette maison.');
      choisirMaison(null);
    } else if (!active && serveur.length === 1 && !s.retire && s.premiere) {
      // Une seule maison au lancement : on y entre directement.
      choisirMaison(serveur[0].maisonId);
    }
    serveur.forEach((a) => s.noms.set(a.maisonId, a.nom));
    s.premiere = false;
  }, [uid, serveur, cache, choisirMaison]);

  const adhesions = serveur ?? cache ?? [];
  const chargement = !uid || (!serveur && !cache);

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

const trier = (l: Adhesion[]) => [...l].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

/** Modifie localement la liste de mes maisons en attendant le serveur. */
function majAdhesions(store: OptimisticLocalStore, maj: (l: Adhesion[]) => Adhesion[]) {
  const l = store.getQuery(api.maisons.mesAdhesions, {});
  if (l) store.setQuery(api.maisons.mesAdhesions, {}, trier(maj(l)));
}

/**
 * Crée la maison et l'adhésion du propriétaire. Renvoie l'id tout de suite :
 * la maison apparaît localement avant la réponse du serveur.
 */
export function creerMaison(nom: string, uid: string, prenom: string) {
  const maisonId = nouvelId();
  const propre = nom.trim();
  const code = genererCode();
  const ecriture = convex.mutation(
    api.maisons.creer,
    { id: maisonId, nom: propre, code, prenom },
    {
      optimisticUpdate: (store) => {
        majAdhesions(store, (l) => [...l, { maisonId, nom: propre, role: 'proprietaire' }]);
        const maintenant = Date.now();
        store.setQuery(api.donnees.maison, { maisonId }, {
          maison: { id: maisonId, nom: propre, codeInvitation: code, createdBy: uid, createdAt: maintenant },
          membres: [{ uid, maisonId, prenom, role: 'proprietaire', joinedAt: maintenant }],
          appareils: [],
          tiroirs: [],
          aliments: [],
          libres: [],
        });
      },
    },
  );
  return { maisonId, ecriture };
}

export type ResultatRejoindre = { ok: true; maisonId: string; dejaMembre: boolean } | { ok: false; message: string };

export async function rejoindreMaison(saisie: string, prenom: string): Promise<ResultatRejoindre> {
  const code = normaliserCode(saisie);
  if (!codeValide(code)) return { ok: false, message: 'Le code doit contenir 6 caractères.' };
  const r = await convex.mutation(api.maisons.rejoindre, { code, prenom });
  if (!r) return { ok: false, message: 'Code invalide ou expiré.' };
  return { ok: true, ...r };
}

export function quitterMaison(maisonId: string) {
  return convex.mutation(api.maisons.quitter, { maisonId }, {
    optimisticUpdate: (store) => majAdhesions(store, (l) => l.filter((a) => a.maisonId !== maisonId)),
  });
}

export function retirerMembre(maisonId: string, uid: string) {
  return convex.mutation(api.maisons.retirerMembre, { maisonId, uid }, {
    optimisticUpdate: (store) => {
      const d = store.getQuery(api.donnees.maison, { maisonId });
      if (d) store.setQuery(api.donnees.maison, { maisonId }, { ...d, membres: d.membres.filter((m) => m.uid !== uid) });
    },
  });
}

export function renommerMaison(maisonId: string, nom: string) {
  const propre = nom.trim();
  return convex.mutation(api.maisons.renommer, { maisonId, nom: propre }, {
    optimisticUpdate: (store) => {
      majAdhesions(store, (l) => l.map((a) => (a.maisonId === maisonId ? { ...a, nom: propre } : a)));
      const d = store.getQuery(api.donnees.maison, { maisonId });
      if (d) store.setQuery(api.donnees.maison, { maisonId }, { ...d, maison: { ...d.maison, nom: propre } });
    },
  });
}

/** Nouveau code : l'ancien cesse immédiatement de fonctionner. */
export function regenererCode(maisonId: string) {
  const code = genererCode();
  const ecriture = convex.mutation(api.maisons.regenererCode, { maisonId, code }, {
    optimisticUpdate: (store) => {
      const d = store.getQuery(api.donnees.maison, { maisonId });
      if (d) store.setQuery(api.donnees.maison, { maisonId }, { ...d, maison: { ...d.maison, codeInvitation: code } });
    },
  });
  return { code, ecriture };
}

/** Suppression complète (propriétaire) : tout le contenu et la maison, en une transaction. */
export function supprimerMaison(maisonId: string) {
  return convex.mutation(api.maisons.supprimer, { maisonId }, {
    optimisticUpdate: (store) => majAdhesions(store, (l) => l.filter((a) => a.maisonId !== maisonId)),
  });
}
