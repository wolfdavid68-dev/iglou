import { etatPeremption } from './dates';
import { memeNom, normaliser } from './texte';
import type { Aliment, Appareil, Tiroir } from './types';

export function tiroirsDeLAppareil(tiroirs: Tiroir[], appareilId: string): Tiroir[] {
  return tiroirs.filter((t) => t.appareilId === appareilId).sort((a, b) => a.ordre - b.ordre);
}

export function appareilsTries(appareils: Appareil[]): Appareil[] {
  return [...appareils].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));
}

export function alimentsDuTiroir(aliments: Aliment[], tiroirId: string): Aliment[] {
  return aliments
    .filter((a) => a.tiroirId === tiroirId)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
}

/** Aliment du même nom déjà présent dans le tiroir (pour proposer « Ajouter à l'existant »). */
export function trouverDoublon(aliments: Aliment[], tiroirId: string, nom: string): Aliment | undefined {
  return aliments.find((a) => a.tiroirId === tiroirId && memeNom(a.nom, nom));
}

/**
 * Tiroir proposé quand on ajoute sans en avoir choisi un : celui où se trouve
 * déjà un aliment du même nom, sinon le premier tiroir du premier appareil.
 */
export function tiroirParDefaut(appareils: Appareil[], tiroirs: Tiroir[], aliments: Aliment[], nom = ''): Tiroir | undefined {
  const meme = nom.trim() ? aliments.find((a) => memeNom(a.nom, nom)) : undefined;
  const sien = meme && tiroirs.find((t) => t.id === meme.tiroirId);
  if (sien) return sien;
  for (const appareil of appareilsTries(appareils)) {
    const premier = tiroirsDeLAppareil(tiroirs, appareil.id)[0];
    if (premier) return premier;
  }
  return undefined;
}

/** Autocomplétion : noms déjà saisis dans la maison, sans doublon, ceux qui commencent par la saisie d'abord. */
export function suggestionsNoms(aliments: Aliment[], saisie: string, limite = 6): string[] {
  const s = normaliser(saisie);
  if (!s) return [];
  const vus = new Map<string, string>();
  for (const a of aliments) {
    const n = normaliser(a.nom);
    if (n !== s && n.includes(s) && !vus.has(n)) vus.set(n, a.nom);
  }
  return [...vus.entries()]
    .sort(([na], [nb]) => Number(nb.startsWith(s)) - Number(na.startsWith(s)) || na.localeCompare(nb, 'fr'))
    .slice(0, limite)
    .map(([, nom]) => nom);
}

/** Déplacement : seul l'emplacement change, jamais la quantité ni le maximum. */
export function deplacement(aliment: Aliment, tiroirCible: Tiroir): Pick<Aliment, 'tiroirId' | 'appareilId'> | null {
  if (aliment.tiroirId === tiroirCible.id) return null;
  return { tiroirId: tiroirCible.id, appareilId: tiroirCible.appareilId };
}

export interface ResultatRecherche {
  aliment: Aliment;
  emplacement: string;
}

/** Aliments périmés ou à consommer vite, du plus urgent au moins urgent. */
export function aConsommerEnPriorite(aliments: Aliment[], appareils: Appareil[], tiroirs: Tiroir[], aujourdHui: Date = new Date()): ResultatRecherche[] {
  const appareilParId = new Map(appareils.map((a) => [a.id, a]));
  const tiroirParId = new Map(tiroirs.map((t) => [t.id, t]));
  return aliments
    .filter((a) => {
      const etat = etatPeremption(a.datePeremption, aujourdHui);
      return etat === 'depassee' || etat === 'proche';
    })
    .sort((a, b) => (a.datePeremption ?? '').localeCompare(b.datePeremption ?? '') || a.nom.localeCompare(b.nom, 'fr'))
    .map((aliment) => ({
      aliment,
      emplacement: `${appareilParId.get(aliment.appareilId)?.nom ?? '?'} › ${tiroirParId.get(aliment.tiroirId)?.nom ?? '?'}`,
    }));
}

export function rechercher(aliments: Aliment[], appareils: Appareil[], tiroirs: Tiroir[], saisie: string): ResultatRecherche[] {
  const s = normaliser(saisie);
  if (!s) return [];
  const appareilParId = new Map(appareils.map((a) => [a.id, a]));
  const tiroirParId = new Map(tiroirs.map((t) => [t.id, t]));
  return aliments
    .filter((a) => normaliser(a.nom).includes(s))
    .sort((a, b) => {
      const na = normaliser(a.nom);
      const nb = normaliser(b.nom);
      return Number(nb.startsWith(s)) - Number(na.startsWith(s)) || na.localeCompare(nb, 'fr');
    })
    .map((aliment) => ({
      aliment,
      emplacement: `${appareilParId.get(aliment.appareilId)?.nom ?? '?'} › ${tiroirParId.get(aliment.tiroirId)?.nom ?? '?'}`,
    }));
}

export function nomsTiroirsParDefaut(nombre: number): string[] {
  return Array.from({ length: nombre }, (_, i) => `Tiroir ${i + 1}`);
}

/** Suppression d'un tiroir : jamais le dernier de l'appareil. */
export function peutSupprimerTiroir(tiroirs: Tiroir[], tiroir: Tiroir): boolean {
  return tiroirs.filter((t) => t.appareilId === tiroir.appareilId).length > 1;
}

/** Réordonne une liste après déplacement d'un élément (haut / bas). */
export function deplacerDansListe<T>(liste: T[], depuis: number, vers: number): T[] {
  if (vers < 0 || vers >= liste.length || depuis === vers) return liste;
  const copie = [...liste];
  const [element] = copie.splice(depuis, 1);
  copie.splice(vers, 0, element);
  return copie;
}

export interface GroupeDestinations {
  appareil: Appareil;
  tiroirs: Tiroir[];
}

/** Tiroirs où l'on peut déplacer quelque chose, groupés par appareil (le tiroir de départ exclu). */
export function destinationsPossibles(appareils: Appareil[], tiroirs: Tiroir[], exclure: string | null): GroupeDestinations[] {
  return appareilsTries(appareils)
    .map((appareil) => ({ appareil, tiroirs: tiroirsDeLAppareil(tiroirs, appareil.id).filter((t) => t.id !== exclure) }))
    .filter((g) => g.tiroirs.length > 0);
}
