import { etatPeremption } from './dates';
import { RECETTES_BRUTES, type Categorie, type RecetteBrute } from './recettes-donnees';
import { RECETTES_BRUTES_2 } from './recettes-donnees-2';
import { RECETTES_BRUTES_3 } from './recettes-donnees-3';
import { INGREDIENTS, type CleIngredient, type DefIngredient } from './recettes-ingredients';
import { normaliser } from './texte';
import type { Aliment, CourseLibre } from './types';

export type { Categorie } from './recettes-donnees';

export const LIBELLES_CATEGORIE: Record<Categorie, string> = {
  'petit-dej': 'Petit-déjeuner',
  entree: 'Entrée',
  soupe: 'Soupe',
  salade: 'Salade',
  plat: 'Plat',
  accompagnement: 'Accompagnement',
  dessert: 'Dessert',
};

export interface IngredientRecette {
  cle: CleIngredient;
  nom: string;
  /** Quantité indicative (« 250 g », « 2 gousses »), ou null. */
  quantite: string | null;
  optionnel: boolean;
  /** Produit de placard supposé disponible : jamais compté comme manquant. */
  placard: boolean;
}

export interface Recette extends Omit<RecetteBrute, 'ingredients'> {
  ingredients: IngredientRecette[];
}

export interface LigneRecette {
  ingredient: IngredientRecette;
  /** Aliment de l'inventaire utilisé (celui qui périme le plus tôt), ou null. */
  aliment: Aliment | null;
  urgent: boolean;
}

export interface Suggestion {
  recette: Recette;
  lignes: LigneRecette[];
  /** Ingrédients indispensables trouvés dans l'inventaire. */
  disponibles: number;
  /** Ingrédients indispensables (ni placard ni facultatifs). */
  requis: number;
  manquants: IngredientRecette[];
  /** Aliments qui périment bientôt (ou déjà) et que la recette utilise. */
  urgents: Aliment[];
  score: number;
}

// ---------------- Reconnaissance des noms ----------------

/** Mots d'un texte, normalisés et mis au singulier (« Œufs frais » → oeuf, frai). */
export function mots(texte: string): string[] {
  return normaliser(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((m) => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m));
}

/**
 * Mots qui, placés avant l'ingrédient, désignent un produit préparé :
 * « Yaourt à la fraise » n'est pas de la fraise, « Sauce tomate » pas une tomate.
 */
const PREPARES = new Set(
  [
    'yaourt', 'glace', 'sorbet', 'confiture', 'compote', 'jus', 'sauce', 'soupe', 'veloute', 'creme',
    'mousse', 'gateau', 'tarte', 'tartelette', 'biscuit', 'sirop', 'pizza', 'quiche', 'gratin', 'plat',
    'puree', 'chips', 'nectar', 'coulis', 'cake', 'muffin', 'flan', 'lasagne', 'salade', 'pate', 'skyr',
    'boisson', 'crepe', 'nugget', 'cordon', 'bonbon', 'barre', 'cereale', 'terrine', 'rillette',
    'croquette', 'feuillete', 'friand', 'tourte', 'sandwich', 'wrap', 'burger', 'aromatise', 'arome',
  ].flatMap(mots),
);

interface DefCompilee {
  cles: string[][];
  sauf: string[][];
}

const COMPILEES = new Map<DefIngredient, DefCompilee>();

function compiler(def: DefIngredient): DefCompilee {
  let c = COMPILEES.get(def);
  if (!c) {
    c = { cles: def.cles.map(mots), sauf: (def.sauf ?? []).map(mots) };
    COMPILEES.set(def, c);
  }
  return c;
}

/** Position de la suite de mots `suite` dans `texte`, à partir de `depuis` ; -1 si absente. */
function chercher(texte: string[], suite: string[], depuis = 0): number {
  if (suite.length === 0) return -1;
  for (let i = depuis; i + suite.length <= texte.length; i++) {
    let ok = true;
    for (let j = 0; j < suite.length; j++) {
      if (texte[i + j] !== suite[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function correspondMots(def: DefIngredient, nom: string[]): boolean {
  const c = compiler(def);
  if (c.sauf.some((s) => chercher(nom, s) >= 0)) return false;
  return c.cles.some((cle) => {
    for (let i = chercher(nom, cle); i >= 0; i = chercher(nom, cle, i + 1)) {
      if (!nom.slice(0, i).some((m) => PREPARES.has(m))) return true;
    }
    return false;
  });
}

/** L'aliment nommé `nomAliment` peut-il servir d'ingrédient `def` ? */
export function correspond(def: DefIngredient, nomAliment: string): boolean {
  return correspondMots(def, mots(nomAliment));
}

// ---------------- Base de recettes ----------------

function lireIngredient(entree: string): IngredientRecette {
  const optionnel = entree.endsWith('?');
  const brut = optionnel ? entree.slice(0, -1) : entree;
  const deuxPoints = brut.indexOf(':');
  const cle = (deuxPoints >= 0 ? brut.slice(0, deuxPoints) : brut) as CleIngredient;
  const def: DefIngredient = INGREDIENTS[cle];
  return {
    cle,
    nom: def.nom,
    quantite: deuxPoints >= 0 ? brut.slice(deuxPoints + 1).trim() : null,
    optionnel,
    placard: def.placard === true,
  };
}

export const RECETTES: Recette[] = [...RECETTES_BRUTES, ...RECETTES_BRUTES_2, ...RECETTES_BRUTES_3].map((r) => ({
  ...r,
  ingredients: r.ingredients.map(lireIngredient),
}));

/** Les repas du midi et du soir seulement : ni desserts ni petits-déjeuners. */
export const RECETTES_REPAS: Recette[] = RECETTES.filter((r) => r.categorie !== 'dessert' && r.categorie !== 'petit-dej');

/** « 25 min », « 1 h 30 », « 3 h ». */
export function formaterDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function trouverRecette(id: string): Recette | undefined {
  return RECETTES.find((r) => r.id === id);
}

// ---------------- Suggestions ----------------

function estUrgent(aliment: Aliment, aujourdHui: Date): boolean {
  const etat = etatPeremption(aliment.datePeremption, aujourdHui);
  return etat === 'depassee' || etat === 'proche';
}

/** Celui qui périme le plus tôt d'abord ; les aliments sans date en dernier. */
function parPeremption(a: Aliment, b: Aliment): number {
  if (a.datePeremption && b.datePeremption) return a.datePeremption.localeCompare(b.datePeremption);
  if (a.datePeremption) return -1;
  if (b.datePeremption) return 1;
  return 0;
}

/** Index « clé d'ingrédient → aliments en stock correspondants », calculé à la demande. */
function indexerStock(aliments: Aliment[]) {
  const stock = aliments.filter((a) => a.quantite > 0).map((a) => ({ aliment: a, mots: mots(a.nom) }));
  const cache = new Map<CleIngredient, Aliment[]>();
  return (cle: CleIngredient): Aliment[] => {
    let trouves = cache.get(cle);
    if (!trouves) {
      const def: DefIngredient = INGREDIENTS[cle];
      trouves = stock.filter((s) => correspondMots(def, s.mots)).map((s) => s.aliment).sort(parPeremption);
      cache.set(cle, trouves);
    }
    return trouves;
  };
}

function analyser(recette: Recette, enStock: (cle: CleIngredient) => Aliment[], aujourdHui: Date): Suggestion {
  const lignes: LigneRecette[] = recette.ingredients.map((ingredient) => {
    const aliment = enStock(ingredient.cle)[0] ?? null;
    return { ingredient, aliment, urgent: aliment != null && estUrgent(aliment, aujourdHui) };
  });

  const indispensables = lignes.filter((l) => !l.ingredient.placard && !l.ingredient.optionnel);
  const requis = indispensables.length;
  const disponibles = indispensables.filter((l) => l.aliment).length;
  const manquants = indispensables.filter((l) => !l.aliment).map((l) => l.ingredient);
  const optionnelsTrouves = lignes.filter((l) => l.ingredient.optionnel && l.aliment).length;

  const urgents: Aliment[] = [];
  for (const l of lignes) {
    if (l.urgent && l.aliment && !urgents.includes(l.aliment)) urgents.push(l.aliment);
  }

  const score =
    requis > 0
      ? (disponibles / requis) * 100 + urgents.length * 40 - manquants.length * 10 + optionnelsTrouves * 2
      : 0;

  return { recette, lignes, disponibles, requis, manquants, urgents, score };
}

/** Analyse une recette précise face à l'inventaire (écran de détail). */
export function analyserRecette(recette: Recette, aliments: Aliment[], aujourdHui: Date = new Date()): Suggestion {
  return analyser(recette, indexerStock(aliments), aujourdHui);
}

/** La recette vaut-elle d'être proposée ? */
function pertinente(s: Suggestion): boolean {
  if (s.requis === 0 || s.disponibles === 0 || s.manquants.length > 3) return false;
  return s.disponibles * 2 >= s.requis || s.urgents.length > 0;
}

/**
 * Recettes réalisables (ou presque) avec l'inventaire, les meilleures d'abord :
 * celles qui utilisent ce qu'on a, et surtout ce qui périme bientôt.
 */
export function suggererRecettes(
  aliments: Aliment[],
  aujourdHui: Date = new Date(),
  recettes: Recette[] = RECETTES,
): Suggestion[] {
  const enStock = indexerStock(aliments);
  return recettes
    .map((r) => analyser(r, enStock, aujourdHui))
    .filter(pertinente)
    .sort((a, b) => b.score - a.score || a.recette.minutes - b.recette.minutes);
}

/** Tous les ingrédients indispensables sont là. */
export function estPrete(s: Suggestion): boolean {
  return s.manquants.length === 0;
}

/**
 * Ingrédients manquants qui ne sont pas déjà sur la liste de courses : ni en
 * article libre, ni en aliment de l'inventaire (un aliment épuisé y figure déjà).
 */
export function manquantsAAjouter(
  suggestion: Suggestion,
  aliments: Aliment[],
  libres: CourseLibre[],
): IngredientRecette[] {
  const noms = [...aliments.map((a) => a.nom), ...libres.map((l) => l.nom)].map(mots);
  return suggestion.manquants.filter((ing) => {
    const def: DefIngredient = INGREDIENTS[ing.cle];
    return !noms.some((n) => correspondMots(def, n));
  });
}
