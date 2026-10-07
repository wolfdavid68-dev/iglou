import { destinationsPossibles } from '@/domaine/inventaire';
import type { Aliment, Appareil, Tiroir } from '@/domaine/types';
import { choisir } from './feuille';
import { deplacerAliment, restaurerAliment, supprimerAliment, type Auteur } from './inventaire';
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

export function deplacerAvecAnnulation(maisonId: string, a: Aliment, cible: Tiroir, tiroirs: Tiroir[], auteur: Auteur) {
  if (a.tiroirId === cible.id) return;
  const depart = tiroirs.find((t) => t.id === a.tiroirId);
  lancer(deplacerAliment(maisonId, a, cible, auteur));
  annulation.proposer(`${a.nom} → ${cible.nom}`, () => {
    if (depart) lancer(deplacerAliment(maisonId, a, depart, auteur));
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
