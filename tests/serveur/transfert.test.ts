/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';

import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { convertir, TABLES, versMs, type SourceFirestore } from '../../scripts/transfert-convex.mts';

const modules = import.meta.glob('../../convex/**/*.*s');

const vide = { membres: [], appareils: [], tiroirs: [], aliments: [], coursesLibres: [], consommations: [] };

/** Un extrait de Firestore tel que le lit le script (horodatages en ms), avec quelques défauts. */
const source: SourceFirestore = {
  profils: [{ id: 'alice', data: { prenom: 'Alice', createdAt: 1000 } }],
  maisons: [
    {
      id: 'Mais0nFirestore12345',
      data: { nom: 'Chez nous', codeInvitation: 'ABC123', createdBy: 'alice', createdAt: 1000 },
      ...vide,
      membres: [
        { id: 'alice', data: { uid: 'alice', maisonId: 'Mais0nFirestore12345', prenom: 'Alice', role: 'proprietaire', joinedAt: 1000 } },
        { id: 'bob', data: { prenom: 'Bob', role: 'membre' } },
      ],
      appareils: [{ id: 'frigoA', data: { nom: 'Frigo', type: 'frigo', ordre: 0, createdAt: 1000 } }],
      tiroirs: [{ id: 'tiroirA', data: { appareilId: 'frigoA', nom: 'Haut', ordre: 0 } }],
      aliments: [
        {
          id: 'alimentA',
          data: {
            tiroirId: 'tiroirA', appareilId: 'frigoA', nom: 'Œufs', quantite: 4, quantiteMax: 6, unite: 'pièce',
            datePeremption: '2026-11-02', note: null, dansPanier: false, achatQuantite: null,
            ajoutePar: 'alice', ajouteParPrenom: 'Alice', modifiePar: 'alice', createdAt: 2000, updatedAt: 3000,
          },
        },
        // Données abîmées : maximum trop petit, unité inconnue, champs manquants.
        { id: 'alimentB', data: { tiroirId: 'tiroirA', appareilId: 'frigoA', nom: 'Lait', quantite: 3, quantiteMax: 1, unite: 'bouteille' } },
      ],
      coursesLibres: [{ id: 'libreA', data: { nom: 'Pain', quantite: 2, unite: 'pièce', dansPanier: true, ajoutePar: 'bob', createdAt: 1500 } }],
      consommations: [
        { id: 'consoA', data: { nom: 'Œufs', quantite: 2, unite: 'pièce', appareilId: 'frigoA', par: 'alice', at: 2500 } },
        { id: 'consoVide', data: { nom: 'Rien', quantite: 0, unite: 'pièce', appareilId: 'frigoA', par: 'alice', at: 2500 } },
      ],
    },
    // Code d'invitation en double : la seconde maison en reçoit un neuf.
    { id: 'autreMaison', data: { nom: 'Bis', codeInvitation: 'ABC123', createdBy: 'bob', createdAt: 1 }, ...vide },
  ],
  signalements: [{ id: 's1', data: { uid: 'bob', email: 'bob@exemple.fr', prenom: 'Bob', maisonId: 'x', message: 'Bug', appareil: null, systeme: null, versionApp: '1.0.0', createdAt: 5 } }],
};

test('les horodatages Firestore deviennent des millisecondes, partout', () => {
  const ts = { toMillis: () => 42 };
  expect(versMs({ a: ts, b: [ts, 'x'], c: { d: ts }, e: null })).toEqual({ a: 42, b: [42, 'x'], c: { d: 42 }, e: null });
});

test('Firestore converti : conforme au schéma, ids et comptes conservés, lisible par les membres', async () => {
  const { tables, ignores } = convertir(source, 9999);
  expect(ignores).toEqual([]);

  const t = convexTest(schema, modules);
  // `insert` valide chaque ligne contre le schéma, comme `npx convex import`.
  await t.run(async (ctx) => {
    for (const table of TABLES) for (const ligne of tables[table]) await ctx.db.insert(table, ligne as never);
  });

  const alice = t.withIdentity({ subject: 'alice' });
  const bob = t.withIdentity({ subject: 'bob' });
  expect(await alice.query(api.maisons.mesAdhesions, {})).toEqual([{ maisonId: 'Mais0nFirestore12345', nom: 'Chez nous', role: 'proprietaire' }]);
  expect(await alice.query(api.profils.moi, {})).toEqual({ uid: 'alice', prenom: 'Alice' });

  const d = (await bob.query(api.donnees.maison, { maisonId: 'Mais0nFirestore12345' }))!;
  expect(d.membres.map((m) => [m.uid, m.role, m.joinedAt])).toEqual([
    ['alice', 'proprietaire', 1000],
    ['bob', 'membre', 1000],
  ]);
  expect(d.aliments.find((a) => a.id === 'alimentA')).toMatchObject({ quantite: 4, quantiteMax: 6, datePeremption: '2026-11-02', createdAt: 2000, updatedAt: 3000 });
  expect(d.aliments.find((a) => a.id === 'alimentB')).toMatchObject({ quantite: 3, quantiteMax: 3, unite: 'pièce', ajouteParPrenom: 'Moi' });
  expect(d.libres).toEqual([expect.objectContaining({ id: 'libreA', dansPanier: true })]);
  expect(await alice.query(api.consommations.recentes, { maisonId: 'Mais0nFirestore12345', depuis: 0 })).toEqual([
    expect.objectContaining({ id: 'consoA', quantite: 2 }),
  ]);

  // Après le transfert, l'inventaire reste modifiable (les règles du serveur s'appliquent aux données transférées).
  await bob.mutation(api.inventaire.appliquer, {
    maisonId: 'Mais0nFirestore12345',
    operations: [{ op: 'majAliment', id: 'alimentB', champs: { quantite: 1 } }],
  });

  const codes = tables.maisons.map((m) => m.codeInvitation);
  expect(codes[0]).toBe('ABC123');
  expect(codes[1]).toMatch(/^[A-Z0-9]{6}$/);
  expect(codes[1]).not.toBe('ABC123');
});
