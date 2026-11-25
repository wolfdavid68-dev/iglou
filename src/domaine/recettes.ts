import { etatPeremption } from './dates';
import { RECETTES_BRUTES, type Categorie, type RecetteBrute } from './recettes-donnees';
import { RECETTES_BRUTES_2 } from './recettes-donnees-2';
import { RECETTES_BRUTES_3 } from './recettes-donnees-3';
import { RECETTES_BRUTES_4 } from './recettes-donnees-4';
import { RECETTES_BRUTES_5 } from './recettes-donnees-5';
import { RECETTES_BRUTES_6 } from './recettes-donnees-6';
import { RECETTES_BRUTES_7 } from './recettes-donnees-7';
import { RECETTES_BRUTES_8 } from './recettes-donnees-8';
import { RECETTES_BRUTES_9 } from './recettes-donnees-9';
import { RECETTES_BRUTES_10 } from './recettes-donnees-10';
import { RECETTES_BRUTES_11 } from './recettes-donnees-11';
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

/** Recettes des premiers lots qui sont aussi des repas healthy. */
export const HEALTHY_EXISTANTES = new Set([
  'poke-bowl-saumon', 'buddha-bowl', 'salade-quinoa', 'dahl-lentilles', 'soupe-miso', 'saumon-papillote',
  'gaspacho', 'taboule', 'curry-legumes', 'tofu-saute', 'chili-sin-carne', 'salade-lentilles',
  'salade-pois-chiches', 'soupe-legumes', 'minestrone', 'salade-poulet-avocat', 'bowl-mexicain',
  'rouleaux-printemps', 'salade-courgettes-crues', 'curry-pois-chiches-epinards', 'brocolis-rotis',
  'legumes-rotis', 'ratatouille', 'poisson-four', 'salade-haricots-verts-thon', 'veloute-brocoli',
  'soupe-lentilles', 'pisto', 'aloo-gobi', 'salade-fenouil-orange', 'carottes-rapees', 'haricots-verts-ail',
  'soupe-asiatique',
]);

export const RECETTES: Recette[] = [...RECETTES_BRUTES, ...RECETTES_BRUTES_2, ...RECETTES_BRUTES_3, ...RECETTES_BRUTES_4, ...RECETTES_BRUTES_5, ...RECETTES_BRUTES_6, ...RECETTES_BRUTES_7, ...RECETTES_BRUTES_8, ...RECETTES_BRUTES_9, ...RECETTES_BRUTES_10, ...RECETTES_BRUTES_11].map(
  (r) => ({
    ...r,
    healthy: r.healthy === true || HEALTHY_EXISTANTES.has(r.id),
    ingredients: r.ingredients.map(lireIngredient),
  }),
);

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
      ? (disponibles / requis) * 100 + urgents.length * 5 - manquants.length * 10 + optionnelsTrouves * 2
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
 * celles qui utilisent ce qu'on a (ce qui périme bientôt donne un léger bonus).
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

// ---------------- Catalogue, recherche, recette du jour ----------------

/** Les plus faisables d'abord : moins de manquants, puis meilleur score, puis ordre alphabétique. */
function parFaisabilite(a: Suggestion, b: Suggestion): number {
  return a.manquants.length - b.manquants.length || b.score - a.score || a.recette.nom.localeCompare(b.recette.nom, 'fr');
}

/** Tout le catalogue analysé face à l'inventaire (même les recettes infaisables), les plus faisables d'abord. */
export function analyserRecettes(
  aliments: Aliment[],
  aujourdHui: Date = new Date(),
  recettes: Recette[] = RECETTES,
): Suggestion[] {
  const enStock = indexerStock(aliments);
  return recettes.map((r) => analyser(r, enStock, aujourdHui)).sort(parFaisabilite);
}

/**
 * Recherche dans le catalogue : chaque mot tapé doit commencer un mot du nom
 * de la recette ou d'un de ses ingrédients (« poul curry » trouve le poulet au
 * curry). Les recettes dont le nom correspond passent devant ; l'ordre reçu est
 * gardé sinon.
 */
export function rechercherRecettes<T extends { recette: Recette }>(liste: T[], texte: string): T[] {
  const cherches = mots(texte);
  if (cherches.length === 0) return liste;
  const trouve = (motsCible: string[]) => cherches.every((c) => motsCible.some((m) => m.startsWith(c)));
  const parNom: T[] = [];
  const parIngredient: T[] = [];
  for (const item of liste) {
    const r = item.recette;
    if (trouve(mots(r.nom))) parNom.push(item);
    else if (trouve([...mots(r.nom), ...r.ingredients.flatMap((i) => mots(i.nom))])) parIngredient.push(item);
  }
  return [...parNom, ...parIngredient];
}

/** Catégories servies comme repas principal : candidates à la « recette du jour ». */
const CATEGORIES_DU_JOUR = new Set<Categorie>(['plat', 'soupe', 'salade']);

/**
 * Recette du jour : une des meilleures recettes prêtes (sinon presque prêtes),
 * plutôt un plat, une soupe ou une salade. Elle change chaque jour mais reste
 * la même toute la journée.
 */
export function recetteDuJour(suggestions: Suggestion[], aujourdHui: Date = new Date()): Suggestion | null {
  const pretes = suggestions.filter((s) => estPrete(s));
  const groupe = pretes.length ? pretes : suggestions.filter((s) => s.manquants.length <= 1);
  if (groupe.length === 0) return null;
  const repas = groupe.filter((s) => CATEGORIES_DU_JOUR.has(s.recette.categorie));
  const candidates = (repas.length ? repas : groupe).slice(0, 7);
  const jour = Math.floor(Date.UTC(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate()) / 86_400_000);
  return candidates[jour % candidates.length];
}

// ---------------- Nombre de personnes ----------------

/** Noms d'unités comptables, au singulier, et leur pluriel. */
const UNITES_COMPTABLES: Record<string, string> = {
  gousse: 'gousses', tranche: 'tranches', pave: 'pavés', pavé: 'pavés', cuisse: 'cuisses', escalope: 'escalopes',
  branche: 'branches', feuille: 'feuilles', poignée: 'poignées', filet: 'filets', steak: 'steaks', botte: 'bottes',
  boîte: 'boîtes', cube: 'cubes', morceau: 'morceaux', sachet: 'sachets', bouquet: 'bouquets', blanc: 'blancs',
  pincée: 'pincées', tomate: 'tomates', laitue: 'laitues',
};
const SINGULIERS: Record<string, string> = Object.fromEntries(Object.entries(UNITES_COMPTABLES).map(([s, p]) => [p, s]));

const UNITES_MESUREES = new Set(['g', 'kg', 'cl', 'l', 'ml']);

function lireNombre(texte: string): number {
  const [n, d] = texte.split('/');
  return d ? Number(n) / Number(d) : Number(n.replace(',', '.'));
}

function ecrireNombre(n: number): string {
  if (n === 0.5) return '1/2';
  if (n === 0.25) return '1/4';
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/** Arrondi lisible : au gramme près ne sert à rien, un œuf se compte entier (ou par moitié). */
function arrondirQuantite(n: number, unite: string | undefined): number {
  if (unite === 'g' || unite === 'ml') return n >= 250 ? Math.round(n / 10) * 10 : Math.max(5, Math.round(n / 5) * 5);
  if (unite === 'cl') return Math.max(1, Math.round(n));
  if (unite === 'kg' || unite === 'l') return Math.max(0.1, Math.round(n * 10) / 10);
  if (n < 0.375) return 0.25;
  if (n < 0.75) return 0.5;
  return n < 10 ? Math.round(n * 2) / 2 : Math.round(n);
}

/**
 * Adapte la quantité d'un ingrédient au nombre de personnes : seul le nombre
 * de tête est recalculé (« 1 boîte de 400 g » → « 2 boîtes de 400 g »), avec
 * l'accord des unités courantes. Les textes sans nombre restent tels quels.
 */
export function adapterQuantite(quantite: string | null, portionsBase: number, portions: number): string | null {
  if (!quantite || portions === portionsBase || portionsBase <= 0) return quantite;
  const m = /^(\d+\/\d+|\d+(?:[.,]\d+)?)(\s*)(\S*)(.*)$/.exec(quantite);
  if (!m) return quantite;
  const [, nombre, espace, mot, reste] = m;
  const unite = mot.toLowerCase();
  const n = arrondirQuantite((lireNombre(nombre) * portions) / portionsBase, UNITES_MESUREES.has(unite) ? unite : undefined);
  let motAccorde = mot;
  if (n > 1 && UNITES_COMPTABLES[unite]) motAccorde = UNITES_COMPTABLES[unite];
  else if (n <= 1 && SINGULIERS[unite]) motAccorde = SINGULIERS[unite];
  return `${ecrireNombre(n)}${espace}${motAccorde}${reste}`;
}
