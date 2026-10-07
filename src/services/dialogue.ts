/**
 * Boîtes de dialogue de l'application (confirmation, choix multiple, saisie).
 * Rendues par <HoteDialogue /> : même apparence sur Android et dans le
 * navigateur, où Alert.alert ne fonctionne pas.
 */
export interface ActionDialogue<T> {
  libelle: string;
  valeur: T;
  style?: 'principal' | 'danger' | 'annuler';
}

export interface Dialogue {
  id: number;
  titre: string;
  message?: string;
  actions: ActionDialogue<unknown>[];
  /** Champ texte : l'action dont la valeur est SAISIE renvoie le texte tapé. */
  champ?: { valeur: string; placeholder?: string; maxLength?: number; secret?: boolean };
  resoudre: (valeur: unknown) => void;
}

type Ecouteur = (d: Dialogue | null) => void;

let courant: Dialogue | null = null;
let prochainId = 1;
const file: Dialogue[] = [];
const ecouteurs = new Set<Ecouteur>();

function publier() {
  courant = file[0] ?? null;
  ecouteurs.forEach((e) => e(courant));
}

/** Ouvre une boîte de dialogue ; résout `null` si elle est fermée sans choix (retour, toucher hors cadre). */
export function demander<T>(
  titre: string,
  message: string | undefined,
  actions: ActionDialogue<T>[],
  champ?: Dialogue['champ'],
): Promise<T | null> {
  return new Promise((resoudre) => {
    file.push({ id: prochainId++, titre, message, actions: actions as ActionDialogue<unknown>[], champ, resoudre: resoudre as (v: unknown) => void });
    if (file.length === 1) publier();
  });
}

export const SAISIE = '__saisie__';

/** Demande un texte (renommer…, mot de passe avec `secret`). Résout le texte nettoyé, ou `null` si annulé. */
export async function saisir(
  titre: string,
  options: { message?: string; valeur?: string; placeholder?: string; maxLength?: number; libelleOk?: string; secret?: boolean; danger?: boolean } = {},
): Promise<string | null> {
  const r = await demander<string | null>(
    titre,
    options.message,
    [
      { libelle: 'Annuler', valeur: null, style: 'annuler' },
      { libelle: options.libelleOk ?? 'Enregistrer', valeur: SAISIE, style: options.danger ? 'danger' : 'principal' },
    ],
    { valeur: options.valeur ?? '', placeholder: options.placeholder, maxLength: options.maxLength, secret: options.secret },
  );
  // Un mot de passe se garde tel quel, espaces compris.
  const texte = typeof r === 'string' ? (options.secret ? r : r.trim()) : '';
  return texte || null;
}

export function repondre(valeur: unknown) {
  const d = file.shift();
  d?.resoudre(valeur);
  publier();
}

export async function confirmer(titre: string, message: string | undefined, libelleOk: string, danger = false): Promise<boolean> {
  const r = await demander(titre, message, [
    { libelle: 'Annuler', valeur: false, style: 'annuler' },
    { libelle: libelleOk, valeur: true, style: danger ? 'danger' : 'principal' },
  ]);
  return r === true;
}

export function abonnerDialogue(e: Ecouteur): () => void {
  ecouteurs.add(e);
  return () => {
    ecouteurs.delete(e);
  };
}

export const dialogueCourant = () => courant;
