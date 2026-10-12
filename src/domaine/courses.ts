import { estEpuise, fixerQuantite, manque } from './quantites';
import { RAYONS, rayonPourNom, type CleRayon } from './rayons';
import { arrondir } from './texte';
import type { Aliment, Appareil, CourseLibre, TypeAppareil, Unite } from './types';

export interface ArticleAliment {
  genre: 'aliment';
  id: string;
  nom: string;
  unite: Unite;
  /** Ce qui manque pour revenir au stock plein. */
  manque: number;
  /** Quantité qui sera rangée : l'achat ajusté, sinon le manque. */
  aRanger: number;
  epuise: boolean;
  dansPanier: boolean;
  aliment: Aliment;
}

export interface ArticleLibre {
  genre: 'libre';
  id: string;
  nom: string;
  unite: Unite;
  quantite: number;
  dansPanier: boolean;
  libre: CourseLibre;
}

export type Article = ArticleAliment | ArticleLibre;

export interface GroupeCourses {
  cle: string;
  titre: string;
  type: TypeAppareil | 'libre' | 'rayon';
  /** Rayons seulement. */
  emoji?: string;
  articles: Article[];
}

/** Liste groupée par appareil (où ranger), ou par rayon (où acheter). */
export type TriCourses = 'appareil' | 'rayon';

const comparerNoms = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });

export function articlesAManquer(aliments: Aliment[]): Aliment[] {
  return aliments.filter((a) => a.quantite < a.quantiteMax);
}

/**
 * Liste de courses : les aliments sous leur maximum, regroupés par appareil
 * (dans l'ordre des appareils), épuisés en premier, puis les articles libres.
 */
function articleAliment(aliment: Aliment): ArticleAliment {
  const m = manque(aliment);
  return {
    genre: 'aliment',
    id: aliment.id,
    nom: aliment.nom,
    unite: aliment.unite,
    manque: m,
    aRanger: aliment.achatQuantite ?? m,
    epuise: estEpuise(aliment),
    dansPanier: aliment.dansPanier,
    aliment,
  };
}

function articleLibre(libre: CourseLibre): ArticleLibre {
  return { genre: 'libre', id: libre.id, nom: libre.nom, unite: libre.unite, quantite: libre.quantite, dansPanier: libre.dansPanier, libre };
}

const estEpuiseArticle = (a: Article) => a.genre === 'aliment' && a.epuise;
const epuisesPuisNoms = (a: Article, b: Article) => Number(estEpuiseArticle(b)) - Number(estEpuiseArticle(a)) || comparerNoms(a, b);

export function calculerListeCourses(aliments: Aliment[], appareils: Appareil[], libres: CourseLibre[], tri: TriCourses = 'appareil'): GroupeCourses[] {
  if (tri === 'rayon') return listeParRayon(aliments, libres);
  const parAppareil = new Map<string, ArticleAliment[]>();
  for (const aliment of articlesAManquer(aliments)) {
    const liste = parAppareil.get(aliment.appareilId) ?? [];
    liste.push(articleAliment(aliment));
    parAppareil.set(aliment.appareilId, liste);
  }

  const groupes: GroupeCourses[] = [];
  const appareilsTries = [...appareils].sort((a, b) => a.ordre - b.ordre);
  for (const appareil of appareilsTries) {
    const articles = parAppareil.get(appareil.id);
    if (!articles?.length) continue;
    articles.sort((a, b) => Number(b.epuise) - Number(a.epuise) || comparerNoms(a, b));
    groupes.push({ cle: appareil.id, titre: appareil.nom, type: appareil.type, articles });
    parAppareil.delete(appareil.id);
  }

  // Aliments dont l'appareil n'est pas (encore) synchronisé : on ne les perd pas.
  const orphelins = [...parAppareil.values()].flat();
  if (orphelins.length) {
    orphelins.sort((a, b) => Number(b.epuise) - Number(a.epuise) || comparerNoms(a, b));
    groupes.push({ cle: 'autres', titre: 'Autres', type: 'frigo', articles: orphelins });
  }

  if (libres.length) {
    const articles = [...libres].sort(comparerNoms).map(articleLibre);
    groupes.push({ cle: 'libres', titre: 'Autres articles', type: 'libre', articles });
  }

  return groupes;
}

/**
 * Par rayon : aliments et articles libres mêlés, rayon déduit du nom,
 * dans l'ordre des rayons, épuisés en premier puis par nom.
 */
function listeParRayon(aliments: Aliment[], libres: CourseLibre[]): GroupeCourses[] {
  const parRayon = new Map<CleRayon, Article[]>();
  const articles: Article[] = [...articlesAManquer(aliments).map(articleAliment), ...libres.map(articleLibre)];
  for (const article of articles) {
    const cle = rayonPourNom(article.nom);
    parRayon.set(cle, [...(parRayon.get(cle) ?? []), article]);
  }
  return RAYONS.filter((r) => parRayon.has(r.cle)).map((r) => ({
    cle: r.cle,
    titre: r.nom,
    type: 'rayon',
    emoji: r.emoji,
    articles: parRayon.get(r.cle)!.sort(epuisesPuisNoms),
  }));
}

export function compterArticles(groupes: GroupeCourses[]): number {
  return groupes.reduce((total, g) => total + g.articles.length, 0);
}

export interface MiseAJourRangement {
  id: string;
  quantite: number;
  quantiteMax: number;
  dansPanier: false;
  achatQuantite: null;
}

export interface PlanRangement {
  aliments: MiseAJourRangement[];
  /** Articles libres cochés : chacun ouvre le formulaire d'ajout (ou est ignoré). */
  libres: CourseLibre[];
}

/**
 * « J'ai rangé les courses » : chaque aliment coché reçoit la quantité achetée
 * (par défaut ce qui manque, donc retour au maximum). Un achat supérieur relève
 * le maximum ; un achat inférieur laisse l'aliment dans la liste pour le reste.
 */
export function planRangement(aliments: Aliment[], libres: CourseLibre[]): PlanRangement {
  const majs = aliments
    .filter((a) => a.dansPanier)
    .map((a): MiseAJourRangement => {
      const achat = a.achatQuantite ?? manque(a);
      const stock = fixerQuantite(a, arrondir(a.quantite + achat));
      return { id: a.id, ...stock, dansPanier: false, achatQuantite: null };
    });
  return { aliments: majs, libres: libres.filter((l) => l.dansPanier) };
}

/** Appui long : quantité réellement achetée (null = revenir au manque). */
export function ajusterAchat(aliment: Aliment, quantiteAchetee: number): number | null {
  const q = arrondir(quantiteAchetee);
  if (!(q > 0)) throw new Error('La quantité achetée doit être supérieure à 0.');
  return q === manque(aliment) ? null : q;
}

export function texteListeCourses(groupes: GroupeCourses[], nomMaison: string): string {
  const lignes: string[] = [`🛒 Courses – ${nomMaison}`];
  for (const groupe of groupes) {
    const icone = groupe.emoji ?? (groupe.type === 'congelateur' ? '❄️' : groupe.type === 'libre' ? '📝' : '🧊');
    lignes.push('', `${icone} ${groupe.titre}`);
    for (const article of groupe.articles) {
      const quantite = article.genre === 'aliment' ? article.aRanger : article.quantite;
      const coche = article.dansPanier ? '✅' : '▫️';
      lignes.push(`${coche} ${article.nom} – ${formaterPourPartage(quantite, article.unite)}`);
    }
  }
  return lignes.join('\n');
}

function formaterPourPartage(quantite: number, unite: Unite): string {
  if (unite === 'pièce') return `${quantite} pièce${quantite > 1 ? 's' : ''}`;
  if (unite === 'portion') return `${quantite} portion${quantite > 1 ? 's' : ''}`;
  return `${quantite} ${unite}`;
}
