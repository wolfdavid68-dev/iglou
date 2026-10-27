import { nouvelId } from '../ids';
import { appliquerOperations, type DonneesServeur } from '../operations';
import { aliment, appareil, libre, tiroir } from './fabriques';

const moi = { uid: 'u2', prenom: 'Paul' };

function donnees(champs: Partial<DonneesServeur> = {}): DonneesServeur {
  return {
    maison: { id: 'm1', nom: 'Chez nous', codeInvitation: 'ABC123', createdBy: 'u1', createdAt: 0 },
    membres: [],
    appareils: [appareil()],
    tiroirs: [tiroir(), tiroir({ id: 't2', nom: 'Haut', ordre: 1 })],
    aliments: [aliment()],
    libres: [libre()],
    ...champs,
  };
}

describe('affichage immédiat des écritures (mise à jour optimiste)', () => {
  test("déplacer : seul l'emplacement change, l'auteur d'origine reste", () => {
    const d = appliquerOperations(donnees(), [{ op: 'majAliment', id: 'a1', champs: { tiroirId: 't2' } }], moi, 42);
    expect(d.aliments[0]).toMatchObject({ tiroirId: 't2', quantite: 6, ajoutePar: 'u1', modifiePar: 'u2', updatedAt: 42, createdAt: 0 });
  });

  test("un champ non fourni n'écrase rien", () => {
    const d = appliquerOperations(donnees(), [{ op: 'majAliment', id: 'a1', champs: { nom: undefined, quantite: 2 } }], moi, 1);
    expect(d.aliments[0]).toMatchObject({ nom: 'Œufs', quantite: 2 });
  });

  test("créer un aliment : ajouté par moi, maintenant ; pas de doublon si l'id existe", () => {
    const creation = {
      op: 'creerAliment' as const,
      id: 'a2',
      tiroirId: 't1',
      appareilId: 'frigo',
      nom: ' Beurre ',
      quantite: 1,
      quantiteMax: 2,
      unite: 'pièce' as const,
      datePeremption: null,
      note: null,
      dansPanier: false,
      achatQuantite: null,
      ajouteParPrenom: 'Paul',
    };
    const d = appliquerOperations(donnees(), [creation, creation], moi, 7);
    expect(d.aliments).toHaveLength(2);
    expect(d.aliments[1]).toMatchObject({ id: 'a2', nom: 'Beurre', ajoutePar: 'u2', createdAt: 7 });
  });

  test("supprimer un appareil retire aussi ses tiroirs et son contenu", () => {
    const d = appliquerOperations(donnees(), [{ op: 'supprimerAppareil', id: 'frigo' }], moi, 1);
    expect([d.appareils, d.tiroirs, d.aliments]).toEqual([[], [], []]);
  });

  test('courses libres et opérations inconnues localement', () => {
    const d = appliquerOperations(
      donnees(),
      [
        { op: 'majLibre', id: 'l1', champs: { dansPanier: true } },
        { op: 'creerLibre', id: 'l2', nom: 'Pain', quantite: 1, unite: 'pièce' },
        { op: 'majAliment', id: 'absent', champs: { quantite: 1 } },
        { op: 'consommation', id: 'c1', nom: 'Œufs', quantite: 1, unite: 'pièce', appareilId: 'frigo' },
      ],
      moi,
      1,
    );
    expect(d.libres.map((l) => [l.id, l.dansPanier])).toEqual([
      ['l1', true],
      ['l2', false],
    ]);
    expect(d.aliments).toEqual(donnees().aliments);
  });

  test("les données d'origine ne sont jamais modifiées", () => {
    const origine = donnees();
    const copie = JSON.parse(JSON.stringify(origine));
    appliquerOperations(origine, [{ op: 'supprimerAliment', id: 'a1' }, { op: 'majTiroir', id: 't1', nom: 'Bas' }], moi, 1);
    expect(origine).toEqual(copie);
  });
});

test('identifiants : 20 caractères, au format des anciens ids Firestore', () => {
  const ids = new Set(Array.from({ length: 1000 }, nouvelId));
  expect(ids.size).toBe(1000);
  for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
});
