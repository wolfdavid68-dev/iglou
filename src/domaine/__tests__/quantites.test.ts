import {
  ajouterALExistant,
  decrementer,
  fixerQuantite,
  incrementer,
  manque,
  modifierMaximum,
  niveauJauge,
  pasPourUnite,
  remplissage,
  stockInitial,
} from '../quantites';

describe('règle du maximum (stock plein)', () => {
  test("à l'insertion, le maximum vaut la quantité", () => {
    expect(stockInitial(6)).toEqual({ quantite: 6, quantiteMax: 6 });
  });

  test('une baisse ne touche jamais le maximum', () => {
    expect(decrementer({ quantite: 6, quantiteMax: 6 })).toEqual({ quantite: 5, quantiteMax: 6 });
    expect(fixerQuantite({ quantite: 6, quantiteMax: 6 }, 2)).toEqual({ quantite: 2, quantiteMax: 6 });
  });

  test('une hausse au-delà du maximum relève le maximum', () => {
    expect(incrementer({ quantite: 6, quantiteMax: 6 })).toEqual({ quantite: 7, quantiteMax: 7 });
    expect(fixerQuantite({ quantite: 2, quantiteMax: 6 }, 10)).toEqual({ quantite: 10, quantiteMax: 10 });
  });

  test('une hausse sous le maximum ne le change pas', () => {
    expect(incrementer({ quantite: 2, quantiteMax: 6 })).toEqual({ quantite: 3, quantiteMax: 6 });
  });

  test('la quantité ne descend jamais sous 0', () => {
    expect(decrementer({ quantite: 0, quantiteMax: 4 })).toEqual({ quantite: 0, quantiteMax: 4 });
    expect(decrementer({ quantite: 0.2, quantiteMax: 1 }, 0.5)).toEqual({ quantite: 0, quantiteMax: 1 });
  });

  test("pas décimaux sans erreurs d'arrondi", () => {
    expect(incrementer({ quantite: 0.1, quantiteMax: 1 }, 0.2).quantite).toBe(0.3);
    expect(pasPourUnite('kg')).toBe(0.5);
    expect(pasPourUnite('g')).toBe(50);
    expect(pasPourUnite('pièce')).toBe(1);
  });

  test('modifier le maximum à la baisse ramène la quantité (avec confirmation)', () => {
    expect(modifierMaximum({ quantite: 6, quantiteMax: 6 }, 4)).toEqual({ quantite: 4, quantiteMax: 4, quantiteReduite: true });
    expect(modifierMaximum({ quantite: 2, quantiteMax: 6 }, 4)).toEqual({ quantite: 2, quantiteMax: 4, quantiteReduite: false });
    expect(() => modifierMaximum({ quantite: 2, quantiteMax: 6 }, 0)).toThrow();
  });

  test("ajouter à l'existant suit la même règle", () => {
    expect(ajouterALExistant({ quantite: 4, quantiteMax: 6 }, 1)).toEqual({ quantite: 5, quantiteMax: 6 });
    expect(ajouterALExistant({ quantite: 4, quantiteMax: 6 }, 6)).toEqual({ quantite: 10, quantiteMax: 10 });
  });

  test('jauge et manque', () => {
    expect(manque({ quantite: 2, quantiteMax: 6 })).toBe(4);
    expect(niveauJauge({ quantite: 6, quantiteMax: 6 })).toBe('plein');
    expect(niveauJauge({ quantite: 2, quantiteMax: 6 })).toBe('entame');
    expect(niveauJauge({ quantite: 0, quantiteMax: 6 })).toBe('epuise');
    expect(remplissage({ quantite: 3, quantiteMax: 6 })).toBe(0.5);
  });
});
