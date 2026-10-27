import type { OptimisticLocalStore } from 'convex/browser';
import { useQuery } from 'convex/react';
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { codeValide, genererCode, normaliserCode } from '@/domaine/invitation';
import type { Role } from '@/domaine/types';
import { api, convex, nouvelId } from './convex';
import { codeErreur } from './erreurs';
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
  // Rejoue la requête à chaque changement de compte : jamais les maisons d'un autre.
  const liste = useQuery(api.maisons.miennes, uid ? {} : 'skip');
  const [maisonActiveId, setMaisonActiveId] = useState<string | null>(lireMaisonActive);
  const [messageRetrait, setMessageRetrait] = useState<string | null>(null);
  const activeRef = useRef(maisonActiveId);
  const noms = useRef(new Map<string, string>());
  const premiereReponse = useRef(true);
  const retire = useRef(false);

  const choisirMaison = useCallback((id: string | null) => {
    activeRef.current = id;
    setMaisonActiveId(id);
    ecrireMaisonActive(id);
  }, []);

  useEffect(() => {
    premiereReponse.current = true;
    retire.current = false;
  }, [uid]);

  useEffect(() => {
    if (!liste) return;
    liste.forEach((a) => noms.current.set(a.maisonId, a.nom));
    const active = activeRef.current;
    if (active && !liste.some((a) => a.maisonId === active)) {
      retire.current = true;
      const nom = noms.current.get(active);
      setMessageRetrait(nom ? `Tu ne fais plus partie de « ${nom} ».` : 'Tu ne fais plus partie de cette maison.');
      choisirMaison(null);
    } else if (!active && liste.length === 1 && !retire.current && premiereReponse.current) {
      // Une seule maison au lancement : on y entre directement.
      choisirMaison(liste[0].maisonId);
    }
    premiereReponse.current = false;
  }, [liste, choisirMaison]);

  return (
    <Contexte
      value={{
        chargement: !uid || liste === undefined,
        adhesions: liste ?? [],
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
 * Crée la maison et l'adhésion du propriétaire. Renvoie l'id tout de suite :
 * la maison apparaît localement avant la réponse du serveur.
 */
export function creerMaison(nom: string, uid: string, prenom: string) {
  const maisonId = nouvelId();
  const code = genererCode();
  const propre = nom.trim();
  const ecriture = convex.mutation(
    api.maisons.creer,
    { cle: maisonId, nom: propre, code, prenom },
    {
      optimisticUpdate: (store) => {
        const maintenant = Date.now();
        const miennes = store.getQuery(api.maisons.miennes, {}) ?? [];
        store.setQuery(
          api.maisons.miennes,
          {},
          [...miennes, { maisonId, nom: propre, role: 'proprietaire' as const }].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        );
        store.setQuery(
          api.donnees.maison,
          { maison: maisonId },
          {
            maison: { id: maisonId, nom: propre, codeInvitation: code, createdBy: uid, createdAt: maintenant },
            membres: [{ uid, maisonId, prenom: prenom || 'Moi', role: 'proprietaire', joinedAt: maintenant }],
            appareils: [],
            tiroirs: [],
            aliments: [],
            libres: [],
          },
        );
      },
    },
  );
  return { maisonId, ecriture };
}

export type ResultatRejoindre = { ok: true; maisonId: string; dejaMembre: boolean } | { ok: false; message: string };

export async function rejoindreMaison(saisie: string, _uid: string, prenom: string, _adhesions: Adhesion[]): Promise<ResultatRejoindre> {
  const code = normaliserCode(saisie);
  if (!codeValide(code)) return { ok: false, message: 'Le code doit contenir 6 caractères.' };
  try {
    const r = await convex.mutation(api.maisons.rejoindre, { code, prenom });
    return r.ok ? r : { ok: false, message: 'Code invalide ou expiré.' };
  } catch (e) {
    if (codeErreur(e) === 'invalide') return { ok: false, message: 'Code invalide ou expiré.' };
    throw e;
  }
}

/** Retire une maison de ma liste tout de suite (avant la réponse du serveur). */
const sansMaison = (maison: string) => ({
  optimisticUpdate: (store: OptimisticLocalStore) => {
    const miennes = store.getQuery(api.maisons.miennes, {});
    if (miennes) store.setQuery(api.maisons.miennes, {}, miennes.filter((a) => a.maisonId !== maison));
  },
});

export function quitterMaison(maisonId: string, _uid: string) {
  return convex.mutation(api.maisons.quitter, { maison: maisonId }, sansMaison(maisonId));
}

export function retirerMembre(maisonId: string, uid: string) {
  return convex.mutation(
    api.maisons.retirerMembre,
    { maison: maisonId, uid },
    {
      optimisticUpdate: (store) => {
        const d = store.getQuery(api.donnees.maison, { maison: maisonId });
        if (d) store.setQuery(api.donnees.maison, { maison: maisonId }, { ...d, membres: d.membres.filter((m) => m.uid !== uid) });
      },
    },
  );
}

export function renommerMaison(maisonId: string, nom: string) {
  const propre = nom.trim();
  return convex.mutation(
    api.maisons.renommer,
    { maison: maisonId, nom: propre },
    {
      optimisticUpdate: (store) => {
        const d = store.getQuery(api.donnees.maison, { maison: maisonId });
        if (d) store.setQuery(api.donnees.maison, { maison: maisonId }, { ...d, maison: { ...d.maison, nom: propre } });
        const miennes = store.getQuery(api.maisons.miennes, {});
        if (miennes) store.setQuery(api.maisons.miennes, {}, miennes.map((a) => (a.maisonId === maisonId ? { ...a, nom: propre } : a)));
      },
    },
  );
}

export function changerPrenomMembre(maisonId: string, uid: string, prenom: string) {
  const propre = prenom.trim();
  return convex.mutation(
    api.maisons.changerPrenomMembre,
    { maison: maisonId, prenom: propre },
    {
      optimisticUpdate: (store) => {
        const d = store.getQuery(api.donnees.maison, { maison: maisonId });
        if (d) store.setQuery(api.donnees.maison, { maison: maisonId }, { ...d, membres: d.membres.map((m) => (m.uid === uid ? { ...m, prenom: propre } : m)) });
      },
    },
  );
}

/** Nouveau code : l'ancien cesse immédiatement de fonctionner. */
export function regenererCode(maisonId: string, _ancienCode: string) {
  const code = genererCode();
  const ecriture = convex.mutation(
    api.maisons.regenererCode,
    { maison: maisonId, code },
    {
      optimisticUpdate: (store) => {
        const d = store.getQuery(api.donnees.maison, { maison: maisonId });
        if (d) store.setQuery(api.donnees.maison, { maison: maisonId }, { ...d, maison: { ...d.maison, codeInvitation: code } });
      },
    },
  );
  return { code, ecriture };
}

/** Suppression complète (propriétaire) : tout le contenu, puis la maison. */
export async function supprimerMaison(maisonId: string, _uid?: string, _code?: string) {
  await convex.mutation(api.maisons.supprimer, { maison: maisonId }, sansMaison(maisonId));
}
