import { construireExport, nomFichierExport, planImport, resumeFichier, validerImport, type Inventaire } from '../import-export';
import { aliment, appareil, libre, tiroir } from './fabriques';

const inventaire: Inventaire = {
  appareils: [appareil({ id: 'frigo', nom: 'Frigo', ordre: 0 }), appareil({ id: 'congel', nom: 'Congélo', type: 'congelateur', ordre: 1 })],
  tiroirs: [tiroir({ id: 't1', appareilId: 'frigo', nom: 'Haut' }), tiroir({ id: 't2', appareilId: 'congel', nom: 'Tiroir 1' })],
  aliments: [
    aliment({ id: 'a1', nom: 'Œufs', quantite: 2, quantiteMax: 6, tiroirId: 't1', appareilId: 'frigo', datePeremption: '2026-10-20' }),
    aliment({ id: 'a2', nom: 'Petits pois', quantite: 1, quantiteMax: 2, unite: 'kg', tiroirId: 't2', appareilId: 'congel' }),
  ],
  libres: [libre({ id: 'l1', nom: 'Éponges' })],
};

const nouvelIds = () => {
  let n = 0;
  return () => `n${++n}`;
};

describe('export', () => {
  test('aller-retour export → import sans perte', () => {
    const fichier = construireExport('Chez nous', inventaire, new Date(2026, 9, 7));
    const relu = validerImport(JSON.parse(JSON.stringify(fichier)));
    expect(relu.ok).toBe(true);
    if (relu.ok) expect(relu.fichier.appareils).toEqual(fichier.appareils);
    expect(resumeFichier(fichier)).toEqual({ appareils: 2, tiroirs: 2, aliments: 2, libres: 1 });
  });

  test('nom de fichier inventaire-<maison>-AAAA-MM-JJ.json', () => {
    expect(nomFichierExport('Chez Léa & Tom', new Date(2026, 9, 7))).toBe('inventaire-chez-lea-tom-2026-10-07.json');
  });
});

describe("validation d'import", () => {
  test("rejette un fichier qui n'est pas un export", () => {
    expect(validerImport(null)).toEqual({ ok: false, erreurs: ["Le fichier n'est pas un export valide."] });
    expect(validerImport({ format: 'autre', version: 1, appareils: [] }).ok).toBe(false);
  });

  test('messages précis par élément', () => {
    const r = validerImport({
      format: 'congelateur-inventaire',
      version: 1,
      appareils: [
        { nom: 'Frigo', type: 'four', tiroirs: [{ nom: 'Haut', aliments: [{ nom: 'Lait', quantite: -1, quantiteMax: 2, unite: 'L' }] }] },
      ],
    });
    expect(r).toEqual({
      ok: false,
      erreurs: ['Appareil n°1 : type inconnu.', 'Appareil n°1, tiroir n°1, aliment n°1 : quantité invalide.'],
    });
  });

  test('refuse 0 ou plus de 20 tiroirs', () => {
    const r = validerImport({ format: 'congelateur-inventaire', version: 1, appareils: [{ nom: 'Frigo', type: 'frigo', tiroirs: [] }] });
    expect(r.ok).toBe(false);
  });

  test('corrige un maximum inférieur à la quantité', () => {
    const r = validerImport({
      format: 'congelateur-inventaire',
      version: 1,
      appareils: [{ nom: 'Frigo', type: 'frigo', tiroirs: [{ nom: 'Haut', aliments: [{ nom: 'Lait', quantite: 3, quantiteMax: 2, unite: 'L' }] }] }],
    });
    expect(r.ok && r.fichier.appareils[0].tiroirs[0].aliments[0]).toMatchObject({ quantite: 3, quantiteMax: 3 });
  });
});

describe("plan d'import", () => {
  const fichier = construireExport('Chez nous', inventaire);

  test('« Remplacer tout » supprime tout puis recrée avec de nouveaux ids', () => {
    const ops = planImport('remplacer', inventaire, fichier, nouvelIds());
    const suppressions = ops.filter((o) => o.op === 'supprimer');
    expect(suppressions).toHaveLength(2 + 2 + 2 + 1);
    expect(ops.findIndex((o) => o.op !== 'supprimer')).toBe(suppressions.length);
    expect(ops.filter((o) => o.op === 'creerAppareil')).toHaveLength(2);
    expect(ops.filter((o) => o.op === 'creerAliment')).toHaveLength(2);
    expect(ops.filter((o) => o.op === 'creerLibre')).toHaveLength(1);
  });

  test('« Fusionner » un fichier identique ne crée rien', () => {
    expect(planImport('fusionner', inventaire, fichier, nouvelIds())).toEqual([]);
  });

  test('« Fusionner » ajoute les nouveautés et ne relève que les maximums plus grands', () => {
    const modifie = structuredClone(fichier);
    modifie.appareils[0].tiroirs[0].aliments[0].quantiteMax = 12; // Œufs : 6 → 12
    modifie.appareils[0].tiroirs[0].aliments.push({ nom: 'Beurre', quantite: 1, quantiteMax: 1, unite: 'pièce', datePeremption: null, note: null });
    modifie.appareils.push({ nom: 'Cave', type: 'frigo', tiroirs: [{ nom: 'Bas', aliments: [] }] });
    modifie.coursesLibres.push({ nom: 'éponges', quantite: 3, unite: 'pièce' });

    expect(planImport('fusionner', inventaire, modifie, nouvelIds())).toEqual([
      { op: 'majMaxAliment', id: 'a1', quantiteMax: 12 },
      expect.objectContaining({ op: 'creerAliment', tiroirId: 't1', appareilId: 'frigo', aliment: expect.objectContaining({ nom: 'Beurre' }) }),
      { op: 'creerAppareil', id: 'n2', nom: 'Cave', type: 'frigo', ordre: 2 },
      { op: 'creerTiroir', id: 'n3', appareilId: 'n2', nom: 'Bas', ordre: 0 },
    ]);
  });
});
