import { cequiPartLePlusVite, sortiesRecentes } from '../statistiques';
import type { Consommation } from '../types';

const JOUR = 24 * 60 * 60 * 1000;
const MAINTENANT = Date.UTC(2026, 9, 7, 12);

function conso(champs: Partial<Consommation> = {}): Consommation {
  return { id: 'c', nom: 'Lait', quantite: 1, unite: 'L', appareilId: 'frigo', par: 'u1', at: MAINTENANT - JOUR, ...champs };
}

describe('statistiques de consommation', () => {
  test('ne garde que la fenêtre récente ; une sortie en attente compte pour maintenant', () => {
    const r = sortiesRecentes([conso({ id: 'vieux', at: MAINTENANT - 40 * JOUR }), conso({ id: 'recent' }), conso({ id: 'attente', at: null })], MAINTENANT);
    expect(r.map((c) => c.id)).toEqual(['recent', 'attente']);
  });

  test('classe par nombre de sorties, regroupe les noms sans accents ni casse', () => {
    const t = cequiPartLePlusVite(
      [
        conso({ nom: 'Lait' }),
        conso({ nom: 'lait', at: MAINTENANT - 2 * JOUR }),
        conso({ nom: 'Œufs', quantite: 2, unite: 'pièce' }),
        conso({ nom: 'Pâtes', unite: 'g', quantite: 500 }),
        conso({ nom: 'pates', unite: 'g', quantite: 250, at: MAINTENANT - 3 * JOUR }),
        conso({ nom: 'Pates', unite: 'g', quantite: 250, at: MAINTENANT - 4 * JOUR }),
      ],
      MAINTENANT,
    );
    expect(t).toEqual([
      { nom: 'Pâtes', sorties: 3, quantite: 1000, unite: 'g' },
      { nom: 'Lait', sorties: 2, quantite: 2, unite: 'L' },
      { nom: 'Œufs', sorties: 1, quantite: 2, unite: 'pièce' },
    ]);
  });

  test("n'additionne pas des unités différentes et limite le nombre de lignes", () => {
    const t = cequiPartLePlusVite([conso({ quantite: 1, unite: 'L' }), conso({ quantite: 200, unite: 'g', at: MAINTENANT - 2 * JOUR })], MAINTENANT);
    expect(t[0]).toMatchObject({ sorties: 2, quantite: 1, unite: 'L' });
    const beaucoup = Array.from({ length: 8 }, (_, i) => conso({ nom: `Aliment ${i}` }));
    expect(cequiPartLePlusVite(beaucoup, MAINTENANT)).toHaveLength(5);
  });
});
