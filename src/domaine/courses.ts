import { estEpuise, fixerQuantite, manque } from './quantites';
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
  type: TypeAppareil | 'libre';
  articles: Article[];
}

const comparerNoms = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });

export function articlesAManquer(aliments: Aliment[]): Aliment[] {
  return aliments.filter((a) => a.quantite < a.quantiteMax);
}

/**
 * Liste de courses : les aliments sous leur maximum, regroupés par appareil
 * (dans l'ordre des appareils), épuisés en premier, puis les articles libres.
 */
export function calculerListeCourses(aliments: Aliment[], appareils: Appareil[], libres: CourseLibre[]): GroupeCourses[] {
  const parAppareil = new Map<string, ArticleAliment[]>();
  for (const aliment of articlesAManquer(aliments)) {
    const liste = parAppareil.get(aliment.appareilId) ?? [];
    const m = manque(aliment);
    liste.push({
      genre: 'aliment',
      id: aliment.id,
      nom: aliment.nom,
      unite: aliment.unite,
      manque: m,
      aRanger: aliment.achatQuantite ?? m,
      epuise: estEpuise(aliment),
      dansPanier: aliment.dansPanier,
      aliment,
    });
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
    const articles: ArticleLibre[] = [...libres].sort(comparerNoms).map((libre) => ({
      genre: 'libre',
      id: libre.id,
      nom: libre.nom,
      unite: libre.unite,
      quantite: libre.quantite,
      dansPanier: libre.dansPanier,
      libre,
    }));
    groupes.push({ cle: 'libres', titre: 'Autres articles', type: 'libre', articles });
  }

  return groupes;
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
    lignes.push('', `${groupe.type === 'congelateur' ? '❄️' : groupe.type === 'libre' ? '📝' : '🧊'} ${groupe.titre}`);
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
