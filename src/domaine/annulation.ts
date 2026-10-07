/**
 * Bandeau « Œufs supprimé · ANNULER » : une seule annulation en attente à la fois,
 * valable `dureeMs`. Indépendant de React pour être testable.
 */
export interface Annulable {
  id: number;
  message: string;
  annuler: () => Promise<void> | void;
}

export interface GestionnaireAnnulation {
  proposer: (message: string, annuler: Annulable['annuler']) => number;
  annuler: (id: number) => Promise<'annule' | 'expire'>;
  fermer: (id: number) => void;
  courant: () => Annulable | null;
  abonner: (ecouteur: (courant: Annulable | null) => void) => () => void;
}

export interface Minuteur {
  definir: (fn: () => void, ms: number) => unknown;
  effacer: (poignee: unknown) => void;
}

const minuteurParDefaut: Minuteur = {
  definir: (fn, ms) => setTimeout(fn, ms),
  effacer: (p) => clearTimeout(p as ReturnType<typeof setTimeout>),
};

export function creerGestionnaireAnnulation(dureeMs = 5000, minuteur: Minuteur = minuteurParDefaut): GestionnaireAnnulation {
  let courant: Annulable | null = null;
  let poignee: unknown = null;
  let prochainId = 1;
  const ecouteurs = new Set<(c: Annulable | null) => void>();

  const notifier = () => ecouteurs.forEach((e) => e(courant));
  const vider = () => {
    if (poignee != null) minuteur.effacer(poignee);
    poignee = null;
    courant = null;
    notifier();
  };

  return {
    proposer(message, annuler) {
      if (poignee != null) minuteur.effacer(poignee);
      const id = prochainId++;
      courant = { id, message, annuler };
      poignee = minuteur.definir(() => {
        if (courant?.id === id) vider();
      }, dureeMs);
      notifier();
      return id;
    },
    async annuler(id) {
      if (!courant || courant.id !== id) return 'expire';
      const action = courant.annuler;
      vider();
      await action();
      return 'annule';
    },
    fermer(id) {
      if (courant?.id === id) vider();
    },
    courant: () => courant,
    abonner(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },
  };
}

export type ResultatRestauration = 'restaure' | 'existe-deja';

/**
 * Réinsertion à l'identique d'un aliment supprimé. Si l'id existe déjà (autre
 * membre, double appui), on ne fait rien : pas de doublon, pas de plantage.
 */
export async function restaurerSiAbsent(
  existe: () => Promise<boolean>,
  reinserer: () => Promise<void>,
): Promise<ResultatRestauration> {
  if (await existe()) return 'existe-deja';
  await reinserer();
  return 'restaure';
}
