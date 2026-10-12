import { RAYONS, rayonPourNom } from '../rayons';

describe('rayon d’un aliment', () => {
  test.each([
    ['Steak haché', 'viandes'],
    ['Cuisses de poulet', 'viandes'],
    ['Pâté de campagne', 'viandes'],
    ['Pâtes', 'feculents'],
    ['Spaghetti', 'feculents'],
    ['Pommes de terre', 'feculents'],
    ['Pommes', 'fruits'],
    ['Jus d’orange', 'boissons'],
    ['Oranges', 'fruits'],
    ['Lait demi-écrémé', 'cremerie'],
    ['Laitue', 'legumes'],
    ['Vin rouge', 'boissons'],
    ['Vinaigre balsamique', 'epicerie'],
    ['Œufs', 'cremerie'],
    ['Fromage blanc', 'cremerie'],
    ['Pâte à tartiner', 'sucre'],
    ['Pâte feuilletée', 'epicerie'],
    ['Pizza 4 fromages', 'plats'],
    ['Glace vanille', 'surgeles'],
    ['Filets de cabillaud', 'poissons'],
    ['Baguette', 'boulangerie'],
    ['Éponges', 'maison'],
    ['Ailes de volaille', 'viandes'],
    ['Truc mystère', 'autres'],
  ])('%s → %s', (nom, rayon) => {
    expect(rayonPourNom(nom)).toBe(rayon);
  });

  test('chaque rayon a une clé unique', () => {
    expect(new Set(RAYONS.map((r) => r.cle)).size).toBe(RAYONS.length);
  });
});
