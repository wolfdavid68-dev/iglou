/**
 * Feuille de choix montant du bas (« Déplacer vers… », destination du contenu
 * d'un tiroir…). Rendue par <HoteFeuille />, sur le modèle des dialogues.
 */
export interface OptionFeuille<T> {
  libelle: string;
  sousTitre?: string;
  valeur: T;
}

export interface SectionFeuille<T> {
  titre?: string;
  options: OptionFeuille<T>[];
}

export interface Feuille {
  id: number;
  titre: string;
  sections: SectionFeuille<unknown>[];
  resoudre: (valeur: unknown) => void;
}

type Ecouteur = (f: Feuille | null) => void;

let courante: Feuille | null = null;
let prochainId = 1;
const ecouteurs = new Set<Ecouteur>();

function publier(f: Feuille | null) {
  courante = f;
  ecouteurs.forEach((e) => e(f));
}

/** Résout `null` si la feuille est fermée sans choix. Une nouvelle feuille remplace la précédente. */
export function choisir<T>(titre: string, sections: SectionFeuille<T>[]): Promise<T | null> {
  courante?.resoudre(null);
  return new Promise((resoudre) => {
    publier({ id: prochainId++, titre, sections: sections as SectionFeuille<unknown>[], resoudre: resoudre as (v: unknown) => void });
  });
}

export function repondreFeuille(valeur: unknown) {
  const f = courante;
  publier(null);
  f?.resoudre(valeur);
}

export function abonnerFeuille(e: Ecouteur): () => void {
  ecouteurs.add(e);
  return () => {
    ecouteurs.delete(e);
  };
}

export const feuilleCourante = () => courante;
