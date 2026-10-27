/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';

import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { OperationInventaire } from '../../convex/validateurs';

/**
 * Règles d'accès et d'intégrité du serveur (remplacent les tests des règles
 * Firestore). Chaque test part d'une base vide.
 */
const modules = import.meta.glob('../../convex/**/*.*s');

function monde() {
  const t = convexTest(schema, modules);
  return {
    t,
    alice: t.withIdentity({ subject: 'alice', email: 'alice@exemple.fr' }),
    bob: t.withIdentity({ subject: 'bob', email: 'bob@exemple.fr' }),
    chloe: t.withIdentity({ subject: 'chloe', email: 'chloe@exemple.fr' }),
  };
}

type Utilisateur = ReturnType<typeof monde>['alice'];

async function maisonDe(u: Utilisateur, id = 'maison1', code = 'ABC123') {
  await u.mutation(api.maisons.creer, { id, nom: 'Chez nous', code, prenom: 'Alice' });
  return id;
}

const aliment = (id: string, champs: Partial<Extract<OperationInventaire, { op: 'creerAliment' }>> = {}): OperationInventaire => ({
  op: 'creerAliment',
  id,
  tiroirId: 't1',
  appareilId: 'frigo',
  nom: 'Œufs',
  quantite: 4,
  quantiteMax: 6,
  unite: 'pièce',
  datePeremption: null,
  note: null,
  dansPanier: false,
  achatQuantite: null,
  ajouteParPrenom: 'Alice',
  ...champs,
});

const frigo: OperationInventaire[] = [
  { op: 'creerAppareil', id: 'frigo', nom: 'Frigo', type: 'frigo', ordre: 0 },
  { op: 'creerTiroir', id: 't1', appareilId: 'frigo', nom: 'Haut', ordre: 0 },
  { op: 'creerTiroir', id: 't2', appareilId: 'frigo', nom: 'Bas', ordre: 1 },
];

describe('connexion', () => {
  test('sans jeton : rien à lire, aucune écriture', async () => {
    const { t, alice } = monde();
    await maisonDe(alice);
    expect(await t.query(api.maisons.mesAdhesions, {})).toBeNull();
    expect(await t.query(api.donnees.maison, { maisonId: 'maison1' })).toBeNull();
    await expect(t.mutation(api.maisons.creer, { id: 'x', nom: 'X', code: 'XYZ999', prenom: 'X' })).rejects.toThrow(/unauthenticated/);
  });
});

describe('maisons', () => {
  test('créer : je suis propriétaire et je vois la maison', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    expect(await alice.query(api.maisons.mesAdhesions, {})).toEqual([{ maisonId: 'maison1', nom: 'Chez nous', role: 'proprietaire' }]);
    const d = await alice.query(api.donnees.maison, { maisonId: 'maison1' });
    expect(d?.maison).toMatchObject({ id: 'maison1', codeInvitation: 'ABC123', createdBy: 'alice' });
    expect(d?.membres).toEqual([expect.objectContaining({ uid: 'alice', role: 'proprietaire', prenom: 'Alice' })]);
  });

  test('code invalide ou déjà pris : refusé', async () => {
    const { alice, bob } = monde();
    await maisonDe(alice);
    await expect(bob.mutation(api.maisons.creer, { id: 'm2', nom: 'B', code: 'ABC123', prenom: 'Bob' })).rejects.toThrow(/already-exists/);
    await expect(bob.mutation(api.maisons.creer, { id: 'm2', nom: 'B', code: 'abc', prenom: 'Bob' })).rejects.toThrow(/invalid-argument/);
  });

  test("un non-membre ne lit ni n'écrit rien", async () => {
    const { alice, bob } = monde();
    await maisonDe(alice);
    expect(await bob.query(api.donnees.maison, { maisonId: 'maison1' })).toBeNull();
    expect(await bob.query(api.consommations.recentes, { maisonId: 'maison1', depuis: 0 })).toEqual([]);
    await expect(bob.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: frigo })).rejects.toThrow(/permission-denied/);
    await expect(bob.mutation(api.maisons.renommer, { maisonId: 'maison1', nom: 'Pirate' })).rejects.toThrow(/permission-denied/);
  });

  test('rejoindre avec le code, une seule fois ; mauvais code = null', async () => {
    const { alice, bob } = monde();
    await maisonDe(alice);
    expect(await bob.mutation(api.maisons.rejoindre, { code: 'ZZZ999', prenom: 'Bob' })).toBeNull();
    expect(await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' })).toEqual({ maisonId: 'maison1', dejaMembre: false });
    expect(await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' })).toEqual({ maisonId: 'maison1', dejaMembre: true });
    const d = await bob.query(api.donnees.maison, { maisonId: 'maison1' });
    expect(d?.membres.map((m) => m.uid).sort()).toEqual(['alice', 'bob']);
  });

  test("nouveau code : l'ancien ne marche plus ; seul le propriétaire peut le changer", async () => {
    const { alice, bob, chloe } = monde();
    await maisonDe(alice);
    await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' });
    await expect(bob.mutation(api.maisons.regenererCode, { maisonId: 'maison1', code: 'BOB000' })).rejects.toThrow(/permission-denied/);
    await alice.mutation(api.maisons.regenererCode, { maisonId: 'maison1', code: 'NEW456' });
    expect(await chloe.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Chloé' })).toBeNull();
    expect(await chloe.mutation(api.maisons.rejoindre, { code: 'NEW456', prenom: 'Chloé' })).not.toBeNull();
  });

  test('quitter, retirer : le propriétaire ne quitte pas, seul lui retire', async () => {
    const { alice, bob, chloe } = monde();
    await maisonDe(alice);
    await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' });
    await chloe.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Chloé' });
    await expect(alice.mutation(api.maisons.quitter, { maisonId: 'maison1' })).rejects.toThrow(/permission-denied/);
    await expect(bob.mutation(api.maisons.retirerMembre, { maisonId: 'maison1', uid: 'chloe' })).rejects.toThrow(/permission-denied/);
    await alice.mutation(api.maisons.retirerMembre, { maisonId: 'maison1', uid: 'chloe' });
    await bob.mutation(api.maisons.quitter, { maisonId: 'maison1' });
    expect(await bob.query(api.maisons.mesAdhesions, {})).toEqual([]);
    expect(await chloe.query(api.donnees.maison, { maisonId: 'maison1' })).toBeNull();
  });

  test('supprimer : propriétaire seulement, tout disparaît', async () => {
    const { t, alice, bob } = monde();
    await maisonDe(alice);
    await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' });
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [...frigo, aliment('a1')] });
    await expect(bob.mutation(api.maisons.supprimer, { maisonId: 'maison1' })).rejects.toThrow(/permission-denied/);
    await alice.mutation(api.maisons.supprimer, { maisonId: 'maison1' });
    const restes = await t.run(async (ctx) =>
      Promise.all((['maisons', 'membres', 'appareils', 'tiroirs', 'aliments'] as const).map((n) => ctx.db.query(n).collect())),
    );
    expect(restes.flat()).toEqual([]);
  });
});

describe('inventaire', () => {
  test("créer, modifier, déplacer : l'auteur et la date d'ajout ne changent pas", async () => {
    const { alice, bob } = monde();
    await maisonDe(alice);
    await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' });
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [...frigo, aliment('a1')] });
    const avant = (await alice.query(api.donnees.maison, { maisonId: 'maison1' }))!.aliments[0];
    await bob.mutation(api.inventaire.appliquer, {
      maisonId: 'maison1',
      operations: [{ op: 'majAliment', id: 'a1', champs: { tiroirId: 't2', quantite: 2, quantiteMax: 6 } }],
    });
    const apres = (await alice.query(api.donnees.maison, { maisonId: 'maison1' }))!.aliments[0];
    expect(apres).toMatchObject({ tiroirId: 't2', quantite: 2, ajoutePar: 'alice', modifiePar: 'bob', createdAt: avant.createdAt });
  });

  test('règle du maximum : jamais un stock plein inférieur à la quantité', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await expect(
      alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [...frigo, aliment('a1', { quantite: 8, quantiteMax: 6 })] }),
    ).rejects.toThrow(/invalid-argument/);
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [...frigo, aliment('a1')] });
    await expect(
      alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [{ op: 'majAliment', id: 'a1', champs: { quantite: 9 } }] }),
    ).rejects.toThrow(/invalid-argument/);
  });

  test('tout ou rien : une opération refusée annule tout le lot', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await expect(
      alice.mutation(api.inventaire.appliquer, {
        maisonId: 'maison1',
        operations: [...frigo, aliment('a1'), { op: 'majAliment', id: 'inconnu', champs: { nom: 'X' } }],
      }),
    ).rejects.toThrow(/not-found/);
    const d = await alice.query(api.donnees.maison, { maisonId: 'maison1' });
    expect([d!.appareils, d!.tiroirs, d!.aliments]).toEqual([[], [], []]);
  });

  test("les ids d'une autre maison sont introuvables", async () => {
    const { alice, bob } = monde();
    await maisonDe(alice);
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [...frigo, aliment('a1')] });
    await maisonDe(bob, 'maison2', 'BOB222');
    await expect(
      bob.mutation(api.inventaire.appliquer, { maisonId: 'maison2', operations: [{ op: 'majAliment', id: 'a1', champs: { nom: 'Volé' } }] }),
    ).rejects.toThrow(/not-found/);
    await bob.mutation(api.inventaire.appliquer, { maisonId: 'maison2', operations: [{ op: 'supprimerAliment', id: 'a1' }] });
    expect((await alice.query(api.donnees.maison, { maisonId: 'maison1' }))!.aliments).toHaveLength(1);
  });

  test('restauration après suppression : même id, et rien si déjà revenu', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [...frigo, aliment('a1')] });
    const origine = (await alice.query(api.donnees.maison, { maisonId: 'maison1' }))!.aliments[0];
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [{ op: 'supprimerAliment', id: 'a1' }] });
    const restaurer = aliment('a1', { ajoutePar: 'alice', createdAt: origine.createdAt, siAbsent: true });
    expect(await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [restaurer] })).toEqual({ dejaPresents: [] });
    expect(await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [restaurer] })).toEqual({ dejaPresents: ['a1'] });
    const d = await alice.query(api.donnees.maison, { maisonId: 'maison1' });
    expect(d!.aliments).toEqual([expect.objectContaining({ id: 'a1', createdAt: origine.createdAt })]);
  });

  test('supprimer un appareil emporte ses tiroirs et leurs aliments', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await alice.mutation(api.inventaire.appliquer, {
      maisonId: 'maison1',
      operations: [
        ...frigo,
        aliment('a1'),
        { op: 'creerAppareil', id: 'congel', nom: 'Congélateur', type: 'congelateur', ordre: 1 },
        { op: 'creerTiroir', id: 't3', appareilId: 'congel', nom: 'Tiroir 1', ordre: 0 },
        aliment('a2', { tiroirId: 't3', appareilId: 'congel' }),
      ],
    });
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [{ op: 'supprimerAppareil', id: 'frigo' }] });
    const d = await alice.query(api.donnees.maison, { maisonId: 'maison1' });
    expect(d!.appareils.map((a) => a.id)).toEqual(['congel']);
    expect(d!.tiroirs.map((x) => x.id)).toEqual(['t3']);
    expect(d!.aliments.map((x) => x.id)).toEqual(['a2']);
  });

  test("sorties de stock : auteur et date fixés par le serveur, lues par fenêtre", async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await alice.mutation(api.inventaire.appliquer, {
      maisonId: 'maison1',
      operations: [...frigo, aliment('a1'), { op: 'consommation', id: 'c1', nom: 'Œufs', quantite: 2, unite: 'pièce', appareilId: 'frigo' }],
    });
    const sorties = await alice.query(api.consommations.recentes, { maisonId: 'maison1', depuis: 0 });
    expect(sorties).toEqual([expect.objectContaining({ id: 'c1', quantite: 2, par: 'alice' })]);
    expect(await alice.query(api.consommations.recentes, { maisonId: 'maison1', depuis: Date.now() + 60_000 })).toEqual([]);
  });

  test('courses libres', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [{ op: 'creerLibre', id: 'l1', nom: ' Pain ', quantite: 1, unite: 'pièce' }] });
    await alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [{ op: 'majLibre', id: 'l1', champs: { dansPanier: true } }] });
    expect((await alice.query(api.donnees.maison, { maisonId: 'maison1' }))!.libres).toEqual([
      expect.objectContaining({ id: 'l1', nom: 'Pain', dansPanier: true, ajoutePar: 'alice' }),
    ]);
    await expect(
      alice.mutation(api.inventaire.appliquer, { maisonId: 'maison1', operations: [{ op: 'majLibre', id: 'l1', champs: { quantite: 0 } }] }),
    ).rejects.toThrow(/invalid-argument/);
  });
});

describe('profil et compte', () => {
  test('changer de prénom : profil et toutes mes maisons', async () => {
    const { alice } = monde();
    await maisonDe(alice);
    await maisonDe(alice, 'maison2', 'DEF456');
    await alice.mutation(api.profils.assurer, { prenom: 'Alice' });
    await alice.mutation(api.profils.changerPrenom, { prenom: 'Alix' });
    expect(await alice.query(api.profils.moi, {})).toEqual({ uid: 'alice', prenom: 'Alix' });
    for (const maisonId of ['maison1', 'maison2']) {
      expect((await alice.query(api.donnees.maison, { maisonId }))!.membres[0].prenom).toBe('Alix');
    }
  });

  test('supprimer mes données : la maison partagée passe au plus ancien, la maison solo disparaît', async () => {
    const { t, alice, bob, chloe } = monde();
    await maisonDe(alice);
    await maisonDe(alice, 'solo', 'SOL000');
    await alice.mutation(api.profils.assurer, { prenom: 'Alice' });
    await bob.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Bob' });
    await chloe.mutation(api.maisons.rejoindre, { code: 'ABC123', prenom: 'Chloé' });
    await alice.mutation(api.compte.supprimerDonnees, {});

    expect(await alice.query(api.maisons.mesAdhesions, {})).toEqual([]);
    expect(await alice.query(api.profils.moi, {})).toBeNull();
    expect(await bob.query(api.maisons.mesAdhesions, {})).toEqual([{ maisonId: 'maison1', nom: 'Chez nous', role: 'proprietaire' }]);
    expect(await chloe.query(api.maisons.mesAdhesions, {})).toEqual([{ maisonId: 'maison1', nom: 'Chez nous', role: 'membre' }]);
    const solo = await t.run((ctx) => ctx.db.query('maisons').withIndex('par_id', (q) => q.eq('id', 'solo')).first());
    expect(solo).toBeNull();
  });

  test("signalement : l'uid et l'e-mail viennent du jeton, pas de l'app", async () => {
    const { t, alice } = monde();
    await alice.mutation(api.signalements.envoyer, {
      prenom: 'Alice',
      maisonId: 'maison1',
      message: ' Ça plante ',
      appareil: 'Pixel',
      systeme: 'Android 16',
      versionApp: '1.0.0',
    });
    const [s] = await t.run((ctx) => ctx.db.query('signalements').collect());
    expect(s).toMatchObject({ uid: 'alice', email: 'alice@exemple.fr', message: 'Ça plante' });
  });
});
