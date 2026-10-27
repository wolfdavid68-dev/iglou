import type { OperationInventaire } from '../../convex/validateurs';
import type { Aliment, Appareil, CourseLibre, Maison, Membre, Tiroir } from './types';

export type { OperationInventaire };

/** Ce que renvoie le serveur pour la maison active. */
export interface DonneesServeur {
  maison: Maison;
  membres: Membre[];
  appareils: Appareil[];
  tiroirs: Tiroir[];
  aliments: Aliment[];
  libres: CourseLibre[];
}

export interface Auteur {
  uid: string;
  prenom: string;
}

/**
 * Rejoue des opérations sur les données locales, comme le fera le serveur :
 * l'écran se met à jour immédiatement, avant la réponse du réseau.
 * Les opérations impossibles (document absent) sont ignorées ici ; le serveur
 * tranchera et sa réponse remplacera ce résultat provisoire.
 */
export function appliquerOperations(d: DonneesServeur, operations: OperationInventaire[], auteur: Auteur, maintenant: number): DonneesServeur {
  let { appareils, tiroirs, aliments, libres } = d;
  const majAliment = (id: string, champs: Partial<Aliment>) => {
    aliments = aliments.map((a) => (a.id === id ? { ...a, ...champs, modifiePar: auteur.uid, updatedAt: maintenant } : a));
  };

  for (const o of operations) {
    switch (o.op) {
      case 'creerAppareil':
        if (!appareils.some((a) => a.id === o.id))
          appareils = [...appareils, { id: o.id, nom: o.nom.trim(), type: o.type, ordre: o.ordre, createdAt: maintenant }];
        break;
      case 'majAppareil': {
        const { op: _op, id, ...champs } = o;
        appareils = appareils.map((a) => (a.id === id ? { ...a, ...definis(champs) } : a));
        break;
      }
      case 'supprimerAppareil':
        appareils = appareils.filter((a) => a.id !== o.id);
        tiroirs = tiroirs.filter((t) => t.appareilId !== o.id);
        aliments = aliments.filter((a) => a.appareilId !== o.id);
        break;
      case 'creerTiroir':
        if (!tiroirs.some((t) => t.id === o.id)) tiroirs = [...tiroirs, { id: o.id, appareilId: o.appareilId, nom: o.nom.trim(), ordre: o.ordre }];
        break;
      case 'majTiroir': {
        const { op: _op, id, ...champs } = o;
        tiroirs = tiroirs.map((t) => (t.id === id ? { ...t, ...definis(champs) } : t));
        break;
      }
      case 'supprimerTiroir':
        tiroirs = tiroirs.filter((t) => t.id !== o.id);
        break;
      case 'creerAliment':
        if (!aliments.some((a) => a.id === o.id)) {
          const { op: _op, siAbsent: _s, ...a } = o;
          aliments = [
            ...aliments,
            {
              ...a,
              nom: a.nom.trim(),
              ajoutePar: a.ajoutePar ?? auteur.uid,
              ajouteParPrenom: a.ajouteParPrenom || auteur.prenom,
              modifiePar: auteur.uid,
              createdAt: a.createdAt ?? maintenant,
              updatedAt: maintenant,
            },
          ];
        }
        break;
      case 'majAliment':
        majAliment(o.id, definis(o.champs));
        break;
      case 'supprimerAliment':
        aliments = aliments.filter((a) => a.id !== o.id);
        break;
      case 'creerLibre':
        if (!libres.some((l) => l.id === o.id))
          libres = [...libres, { id: o.id, nom: o.nom.trim(), quantite: o.quantite, unite: o.unite, dansPanier: false, ajoutePar: auteur.uid, createdAt: maintenant }];
        break;
      case 'majLibre':
        libres = libres.map((l) => (l.id === o.id ? { ...l, ...definis(o.champs) } : l));
        break;
      case 'supprimerLibre':
        libres = libres.filter((l) => l.id !== o.id);
        break;
      case 'consommation':
        // Historique lu à part (statistiques) : rien à afficher ici.
        break;
    }
  }
  return { ...d, appareils, tiroirs, aliments, libres };
}

/** Retire les champs `undefined` (non fournis) avant fusion. */
function definis<T extends object>(champs: T): Partial<T> {
  return Object.fromEntries(Object.entries(champs).filter(([, v]) => v !== undefined)) as Partial<T>;
}
