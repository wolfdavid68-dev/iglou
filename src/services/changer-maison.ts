import { choisir } from './feuille';
import type { Adhesion } from './maisons';

const NOUVELLE = '__nouvelle__';

/**
 * Feuille « Changer de maison » : les maisons de l'utilisateur, puis
 * « Créer ou rejoindre une maison » (retour à l'écran de choix).
 */
export async function changerDeMaison(
  adhesions: Adhesion[],
  activeId: string | null,
  choisirMaison: (id: string | null) => void,
  /** Nom à jour de la maison active (les noms des adhésions peuvent dater d'avant un renommage). */
  nomActuel?: string,
) {
  const choix = await choisir('Changer de maison', [
    {
      titre: 'Mes maisons',
      options: adhesions.map((a) => ({
        libelle: a.maisonId === activeId ? `${nomActuel ?? a.nom} ✓` : a.nom,
        sousTitre: [a.role === 'proprietaire' ? 'Propriétaire' : 'Membre', a.maisonId === activeId ? 'maison actuelle' : null].filter(Boolean).join(' · '),
        valeur: a.maisonId,
      })),
    },
    { options: [{ libelle: '+ Créer ou rejoindre une maison', valeur: NOUVELLE }] },
  ]);
  if (!choix || choix === activeId) return;
  choisirMaison(choix === NOUVELLE ? null : choix);
}
