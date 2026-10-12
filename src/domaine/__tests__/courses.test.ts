import { ajusterAchat, calculerListeCourses, compterArticles, planRangement, texteListeCourses } from '../courses';
import { aliment, appareil, libre } from './fabriques';

const frigo = appareil({ id: 'frigo', nom: 'Frigo', ordre: 0 });
const congel = appareil({ id: 'congel', nom: 'Congélateur garage', type: 'congelateur', ordre: 1 });

describe('liste de courses', () => {
  test('seuls les aliments sous leur maximum apparaissent, groupés par appareil', () => {
    const groupes = calculerListeCourses(
      [
        aliment({ id: 'plein', nom: 'Beurre', quantite: 2, quantiteMax: 2 }),
        aliment({ id: 'oeufs', nom: 'Œufs', quantite: 2, quantiteMax: 6 }),
        aliment({ id: 'glace', nom: 'Glace vanille', quantite: 0, quantiteMax: 1, appareilId: 'congel' }),
      ],
      [congel, frigo],
      [],
    );
    expect(groupes.map((g) => g.titre)).toEqual(['Frigo', 'Congélateur garage']);
    expect(groupes[0].articles.map((a) => a.id)).toEqual(['oeufs']);
    expect(groupes[0].articles[0]).toMatchObject({ manque: 4, aRanger: 4, epuise: false });
    expect(compterArticles(groupes)).toBe(2);
  });

  test('épuisés en premier, puis par nom', () => {
    const [groupe] = calculerListeCourses(
      [
        aliment({ id: 'a', nom: 'Abricots', quantite: 1, quantiteMax: 3 }),
        aliment({ id: 'z', nom: 'Zestes', quantite: 0, quantiteMax: 1 }),
        aliment({ id: 'b', nom: 'Beurre', quantite: 0, quantiteMax: 2 }),
      ],
      [frigo],
      [],
    );
    expect(groupe.articles.map((a) => a.id)).toEqual(['b', 'z', 'a']);
  });

  test('les articles libres forment leur propre groupe, en dernier', () => {
    const groupes = calculerListeCourses([aliment({ quantite: 1 })], [frigo], [libre({ nom: 'Sopalin' })]);
    expect(groupes.at(-1)).toMatchObject({ cle: 'libres', titre: 'Autres articles' });
  });

  test('liste vide si tout est plein', () => {
    expect(calculerListeCourses([aliment()], [frigo], [])).toEqual([]);
  });

  test("un aliment dont l'appareil est inconnu n'est pas perdu", () => {
    const groupes = calculerListeCourses([aliment({ appareilId: 'inconnu', quantite: 0 })], [frigo], []);
    expect(groupes[0].cle).toBe('autres');
  });
});

describe('liste de courses par rayon', () => {
  const liste = () =>
    calculerListeCourses(
      [
        aliment({ id: 'steak', nom: 'Steak haché', quantite: 1, quantiteMax: 4, appareilId: 'congel' }),
        aliment({ id: 'pates', nom: 'Pâtes', quantite: 1, quantiteMax: 2 }),
        aliment({ id: 'poulet', nom: 'Poulet', quantite: 0, quantiteMax: 2 }),
        aliment({ id: 'jambon', nom: 'Jambon', quantite: 1, quantiteMax: 2 }),
        aliment({ id: 'plein', nom: 'Beurre', quantite: 2, quantiteMax: 2 }),
      ],
      [frigo, congel],
      [libre({ id: 'riz', nom: 'Riz basmati' }), libre({ id: 'eponges', nom: 'Éponges' })],
      'rayon',
    );

  test('groupés par rayon dans l’ordre du magasin, tous appareils et articles libres confondus', () => {
    const groupes = liste();
    expect(groupes.map((g) => g.cle)).toEqual(['viandes', 'feculents', 'maison']);
    expect(groupes[0]).toMatchObject({ titre: 'Viandes et charcuterie', type: 'rayon', emoji: '🥩' });
    expect(groupes[1].articles.map((a) => a.id)).toEqual(['pates', 'riz']);
    expect(compterArticles(groupes)).toBe(6);
  });

  test('épuisés en premier dans chaque rayon, puis par nom', () => {
    expect(liste()[0].articles.map((a) => a.id)).toEqual(['poulet', 'jambon', 'steak']);
  });

  test("le texte partagé reprend l'emoji du rayon", () => {
    expect(texteListeCourses(liste(), 'Maison')).toContain('🥩 Viandes et charcuterie');
  });
});

describe("« J'ai rangé les courses »", () => {
  test('les aliments cochés reviennent au stock plein et sortent de la liste', () => {
    const oeufs = aliment({ id: 'oeufs', quantite: 2, quantiteMax: 6, dansPanier: true });
    const nonCoche = aliment({ id: 'lait', quantite: 0, quantiteMax: 2 });
    const plan = planRangement([oeufs, nonCoche], []);
    expect(plan.aliments).toEqual([{ id: 'oeufs', quantite: 6, quantiteMax: 6, dansPanier: false, achatQuantite: null }]);
  });

  test('un achat supérieur relève le maximum', () => {
    const plan = planRangement([aliment({ quantite: 2, quantiteMax: 6, dansPanier: true, achatQuantite: 10 })], []);
    expect(plan.aliments[0]).toMatchObject({ quantite: 12, quantiteMax: 12 });
  });

  test('un achat inférieur laisse le reste dans la liste', () => {
    const plan = planRangement([aliment({ quantite: 2, quantiteMax: 6, dansPanier: true, achatQuantite: 1 })], []);
    expect(plan.aliments[0]).toMatchObject({ quantite: 3, quantiteMax: 6 });
  });

  test('les articles libres cochés sont rendus pour être rangés', () => {
    const plan = planRangement([], [libre({ id: 'x', dansPanier: true }), libre({ id: 'y' })]);
    expect(plan.libres.map((l) => l.id)).toEqual(['x']);
  });

  test("ajuster l'achat : null quand on revient au manque, erreur si ≤ 0", () => {
    const a = aliment({ quantite: 2, quantiteMax: 6 });
    expect(ajusterAchat(a, 4)).toBeNull();
    expect(ajusterAchat(a, 8)).toBe(8);
    expect(() => ajusterAchat(a, 0)).toThrow();
  });
});

test('partage en texte', () => {
  const groupes = calculerListeCourses(
    [aliment({ nom: 'Œufs', quantite: 2, quantiteMax: 6, dansPanier: true })],
    [frigo],
    [libre({ nom: 'Éponges', quantite: 2 })],
  );
  expect(texteListeCourses(groupes, 'Maison')).toBe(
    ['🛒 Courses – Maison', '', '🧊 Frigo', '✅ Œufs – 4 pièces', '', '📝 Autres articles', '▫️ Éponges – 2 pièces'].join('\n'),
  );
});
