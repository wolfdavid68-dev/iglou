import { RAYONS, filtrerParRayons, rayonPourNom, rayonsPresents } from '../rayons';

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

describe('filtre par type d’aliment', () => {
  const contenu = [{ nom: 'Steak haché' }, { nom: 'Saumon' }, { nom: 'Carottes' }, { nom: 'Lardons' }];

  test('rayons présents, dans l’ordre d’affichage, avec leur nombre', () => {
    expect(rayonsPresents(contenu).map((p) => [p.rayon.cle, p.nombre])).toEqual([
      ['legumes', 1],
      ['viandes', 2],
      ['poissons', 1],
    ]);
  });

  test('ne garde que les rayons choisis', () => {
    expect(filtrerParRayons(contenu, new Set(['viandes', 'poissons'] as const)).map((a) => a.nom)).toEqual(['Steak haché', 'Saumon', 'Lardons']);
  });

  test('aucun rayon choisi : tout reste', () => {
    expect(filtrerParRayons(contenu, new Set())).toEqual(contenu);
  });
});
