import { destinationsPossibles } from '@/domaine/inventaire';
import { fixerQuantite } from '@/domaine/quantites';
import { formaterQuantite } from '@/domaine/texte';
import type { Aliment, Appareil, Tiroir } from '@/domaine/types';
import { choisir } from './feuille';
import { choc, tic } from './haptique';
import { consommerAliment, deplacerAliment, modifierAliment, restaurerAliment, supprimerAliment, type Auteur } from './inventaire';
import { demanderPrise } from './prise';
import { afficherMessage, annulation, lancer, signalerErreur } from './retours';

/**
 * Actions sur un aliment partagées par les écrans (glisser-déposer, fiche,
 * recherche) : toujours avec le bandeau « ANNULER » de 5 s.
 */
export function supprimerAvecAnnulation(maisonId: string, a: Aliment, auteur: Auteur) {
  lancer(supprimerAliment(maisonId, a.id));
  annulation.proposer(`${a.nom} supprimé`, async () => {
    try {
      const r = await restaurerAliment(maisonId, a, auteur);
      if (r === 'existe-deja') afficherMessage(`${a.nom} est déjà revenu.`);
    } catch (e) {
      signalerErreur(e);
    }
  });
}

export function deplacerAvecAnnulation(maisonId: string, a: Aliment, cible: Tiroir, tiroirs: Tiroir[]) {
  if (a.tiroirId === cible.id) return;
  const depart = tiroirs.find((t) => t.id === a.tiroirId);
  lancer(deplacerAliment(maisonId, a, cible));
  annulation.proposer(`${a.nom} → ${cible.nom}`, () => {
    if (depart) lancer(deplacerAliment(maisonId, a, depart));
  });
}

/** Feuille « Déplacer vers… » : tous les tiroirs de la maison, groupés par appareil. */
export function choisirTiroir(titre: string, appareils: Appareil[], tiroirs: Tiroir[], exclure: string | null): Promise<Tiroir | null> {
  return choisir(
    titre,
    destinationsPossibles(appareils, tiroirs, exclure).map((g) => ({
      titre: g.appareil.nom,
      options: g.tiroirs.map((t) => ({ libelle: t.nom, valeur: t })),
    })),
  );
}

/**
 * Toucher un aliment : fenêtre « Combien en as-tu pris ? », puis retire la
 * quantité choisie du stock (bandeau « ANNULER »). La fenêtre permet aussi
 * d'ouvrir la fiche, ouverte directement quand il n'en reste plus.
 */
export async function prendreAliment(maisonId: string, a: Aliment, ouvrirFiche: () => void) {
  if (a.quantite <= 0) return ouvrirFiche();
  const r = await demanderPrise(a);
  if (r === null) return;
  if (r === 'fiche') return ouvrirFiche();

  const prise = Math.min(r.quantite, a.quantite);
  const s = fixerQuantite(a, a.quantite - prise);
  if (s.quantite <= 0) choc();
  else tic();
  lancer(consommerAliment(maisonId, a, s.quantite));
  annulation.proposer(
    s.quantite <= 0 ? `${a.nom} épuisé · ajouté aux courses` : `${a.nom} : −${formaterQuantite(prise, a.unite)}`,
    () => lancer(modifierAliment(maisonId, a.id, { quantite: a.quantite, quantiteMax: a.quantiteMax })),
  );
}
