/// <reference types="node" />
/**
 * Tests des règles de sécurité Firestore, sur l'émulateur local.
 * Lancer avec : npm run test:regles   (nécessite Java 21+)
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const MAISON = 'maison1';
const CODE = 'ABC234';

const alimentValide = (uid: string, champs: Record<string, unknown> = {}) => ({
  tiroirId: 't1',
  appareilId: 'frigo',
  nom: 'Œufs',
  quantite: 6,
  quantiteMax: 6,
  unite: 'pièce',
  datePeremption: null,
  note: null,
  dansPanier: false,
  achatQuantite: null,
  ajoutePar: uid,
  ajouteParPrenom: 'Marie',
  modifiePar: uid,
  createdAt: 1,
  updatedAt: 1,
  ...champs,
});

const db = (uid: string) => env.authenticatedContext(uid).firestore();

/** Crée une maison comme le fait l'application : un seul lot. */
async function creerMaison(uid: string, maisonId = MAISON, code = CODE) {
  const f = db(uid);
  const lot = writeBatch(f);
  lot.set(doc(f, 'maisons', maisonId), { nom: 'Chez nous', codeInvitation: code, createdBy: uid, createdAt: 1 });
  lot.set(doc(f, 'maisons', maisonId, 'membres', uid), { uid, maisonId, prenom: 'Marie', role: 'proprietaire', joinedAt: 1 });
  lot.set(doc(f, 'invitations', code), { maisonId });
  return lot.commit();
}

async function rejoindre(uid: string, code = CODE, maisonId = MAISON) {
  return setDoc(doc(db(uid), 'maisons', maisonId, 'membres', uid), { uid, maisonId, prenom: 'Paul', role: 'membre', joinedAt: 1, code });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-congelateur',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await assertSucceeds(creerMaison('marie'));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'maisons', MAISON, 'aliments', 'a1'), alimentValide('marie'));
  });
});

describe('isolation des maisons', () => {
  test('un non-membre ne voit rien', async () => {
    const intrus = db('intrus');
    await assertFails(getDoc(doc(intrus, 'maisons', MAISON)));
    await assertFails(getDocs(collection(intrus, 'maisons', MAISON, 'aliments')));
    await assertFails(getDocs(collection(intrus, 'maisons', MAISON, 'membres')));
    await assertFails(getDoc(doc(intrus, 'maisons', MAISON, 'aliments', 'a1')));
  });

  test('un non-membre ne peut rien écrire', async () => {
    await assertFails(setDoc(doc(db('intrus'), 'maisons', MAISON, 'aliments', 'x'), alimentValide('intrus')));
    await assertFails(deleteDoc(doc(db('intrus'), 'maisons', MAISON, 'aliments', 'a1')));
  });

  test('un visiteur non connecté ne voit rien', async () => {
    const anonyme = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonyme, 'maisons', MAISON)));
    await assertFails(getDoc(doc(anonyme, 'invitations', CODE)));
  });

  test('un membre voit sa maison', async () => {
    await assertSucceeds(getDocs(collection(db('marie'), 'maisons', MAISON, 'aliments')));
  });

  test('chacun liste ses propres adhésions, pas celles des autres', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(db('marie'), 'membres'), where('uid', '==', 'marie'))));
    await assertFails(getDocs(query(collectionGroup(db('intrus'), 'membres'), where('uid', '==', 'marie'))));
  });
});

describe('invitations', () => {
  test('on lit un code connu, on ne peut pas lister les codes', async () => {
    await assertSucceeds(getDoc(doc(db('paul'), 'invitations', CODE)));
    await assertFails(getDocs(collection(db('paul'), 'invitations')));
  });

  test('rejoindre avec le bon code', async () => {
    await assertSucceeds(rejoindre('paul'));
    await assertSucceeds(getDocs(collection(db('paul'), 'maisons', MAISON, 'aliments')));
  });

  test('refusé avec un mauvais code', async () => {
    await assertFails(rejoindre('paul', 'ZZZZZZ'));
  });

  test('impossible de se déclarer propriétaire d’une maison existante', async () => {
    await assertFails(
      setDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'paul'), {
        uid: 'paul', maisonId: MAISON, prenom: 'Paul', role: 'proprietaire', joinedAt: 1,
      }),
    );
  });

  test('impossible d’inscrire quelqu’un d’autre', async () => {
    await assertFails(
      setDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'jean'), {
        uid: 'jean', maisonId: MAISON, prenom: 'Jean', role: 'membre', joinedAt: 1, code: CODE,
      }),
    );
  });

  test('impossible de détourner un code existant', async () => {
    await assertFails(creerMaison('pirate', 'maison2', CODE));
  });

  test('après changement de code, l’ancien ne marche plus', async () => {
    const f = db('marie');
    const lot = writeBatch(f);
    lot.update(doc(f, 'maisons', MAISON), { codeInvitation: 'XYZ789' });
    lot.set(doc(f, 'invitations', 'XYZ789'), { maisonId: MAISON });
    lot.delete(doc(f, 'invitations', CODE));
    await assertSucceeds(lot.commit());
    await assertFails(rejoindre('paul', CODE));
    await assertSucceeds(rejoindre('paul', 'XYZ789'));
  });

  test('un simple membre ne peut pas changer le code', async () => {
    await rejoindre('paul');
    const f = db('paul');
    const lot = writeBatch(f);
    lot.update(doc(f, 'maisons', MAISON), { codeInvitation: 'XYZ789' });
    lot.set(doc(f, 'invitations', 'XYZ789'), { maisonId: MAISON });
    lot.delete(doc(f, 'invitations', CODE));
    await assertFails(lot.commit());
  });
});

describe('membres', () => {
  beforeEach(() => rejoindre('paul'));

  test('un membre peut quitter, le propriétaire non', async () => {
    await assertSucceeds(deleteDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'paul')));
    await assertFails(deleteDoc(doc(db('marie'), 'maisons', MAISON, 'membres', 'marie')));
  });

  test('seul le propriétaire retire un membre', async () => {
    await rejoindre('jean');
    await assertFails(deleteDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'jean')));
    await assertSucceeds(deleteDoc(doc(db('marie'), 'maisons', MAISON, 'membres', 'jean')));
  });

  test('un membre retiré ne voit plus rien', async () => {
    await deleteDoc(doc(db('marie'), 'maisons', MAISON, 'membres', 'paul'));
    await assertFails(getDocs(collection(db('paul'), 'maisons', MAISON, 'aliments')));
  });

  test('un membre ne peut pas se promouvoir', async () => {
    await assertFails(updateDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'paul'), { role: 'proprietaire' }));
  });

  test('seul le propriétaire supprime la maison', async () => {
    await assertFails(deleteDoc(doc(db('paul'), 'maisons', MAISON)));
    await assertSucceeds(deleteDoc(doc(db('marie'), 'maisons', MAISON)));
  });

  test('le propriétaire passe la main avant de partir', async () => {
    const f = db('marie');
    const lot = writeBatch(f);
    lot.update(doc(f, 'maisons', MAISON, 'membres', 'paul'), { role: 'proprietaire' });
    lot.delete(doc(f, 'maisons', MAISON, 'membres', 'marie'));
    await assertSucceeds(lot.commit());
    await assertSucceeds(updateDoc(doc(db('paul'), 'maisons', MAISON), { codeInvitation: CODE, nom: 'Chez Paul' }));
  });

  test('passer la main : seul le rôle change, et seulement vers propriétaire', async () => {
    await rejoindre('jean');
    await assertFails(updateDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'jean'), { role: 'proprietaire' }));
    await assertFails(updateDoc(doc(db('marie'), 'maisons', MAISON, 'membres', 'paul'), { role: 'proprietaire', prenom: 'Pirate' }));
    await assertSucceeds(updateDoc(doc(db('marie'), 'maisons', MAISON, 'membres', 'paul'), { role: 'proprietaire' }));
    await assertFails(updateDoc(doc(db('paul'), 'maisons', MAISON, 'membres', 'marie'), { role: 'membre' }));
  });
});

describe('profils', () => {
  test('chacun supprime son propre profil, pas celui des autres', async () => {
    await assertSucceeds(setDoc(doc(db('marie'), 'profils', 'marie'), { prenom: 'Marie', createdAt: 1 }));
    await assertFails(deleteDoc(doc(db('paul'), 'profils', 'marie')));
    await assertSucceeds(deleteDoc(doc(db('marie'), 'profils', 'marie')));
  });
});

describe('règle du maximum', () => {
  const ref = () => doc(db('marie'), 'maisons', MAISON, 'aliments', 'a1');

  test('baisser la quantité seule est accepté', async () => {
    await assertSucceeds(updateDoc(ref(), { quantite: 2, modifiePar: 'marie' }));
  });

  test('quantité au-dessus du maximum refusée', async () => {
    await assertFails(updateDoc(ref(), { quantite: 8, modifiePar: 'marie' }));
    await assertSucceeds(updateDoc(ref(), { quantite: 8, quantiteMax: 8, modifiePar: 'marie' }));
  });

  test('création avec maximum inférieur refusée', async () => {
    await assertFails(setDoc(doc(db('marie'), 'maisons', MAISON, 'aliments', 'x'), alimentValide('marie', { quantite: 5, quantiteMax: 3 })));
  });

  test('valeurs invalides refusées', async () => {
    await assertFails(updateDoc(ref(), { quantite: -1, modifiePar: 'marie' }));
    await assertFails(updateDoc(ref(), { quantiteMax: 0, quantite: 0, modifiePar: 'marie' }));
    await assertFails(updateDoc(ref(), { unite: 'tonne', modifiePar: 'marie' }));
    await assertFails(updateDoc(ref(), { nom: '', modifiePar: 'marie' }));
    await assertFails(updateDoc(ref(), { piege: true, modifiePar: 'marie' }));
  });

  test('impossible de se faire passer pour un autre membre', async () => {
    await assertFails(updateDoc(ref(), { quantite: 1, modifiePar: 'paul' }));
    await assertFails(updateDoc(ref(), { quantite: 1, modifiePar: 'marie', ajoutePar: 'paul' }));
  });
});

describe('signalements', () => {
  const signalement = (uid: string, champs: Record<string, unknown> = {}) => ({
    uid,
    email: `${uid}@exemple.fr`,
    prenom: 'Marie',
    maisonId: MAISON,
    message: 'L’écran reste blanc',
    appareil: 'Samsung Galaxy S24',
    systeme: 'Android 15',
    versionApp: '1.0.0',
    createdAt: serverTimestamp(),
    ...champs,
  });
  const dbAvecEmail = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@exemple.fr` }).firestore();

  test('envoi accepté, relecture interdite', async () => {
    const ref = doc(dbAvecEmail('marie'), 'signalements', 's1');
    await assertSucceeds(setDoc(ref, signalement('marie')));
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(dbAvecEmail('marie'), 'signalements')));
    await assertFails(deleteDoc(ref));
  });

  test('impossible de signaler au nom d’un autre ou sans connexion', async () => {
    await assertFails(setDoc(doc(dbAvecEmail('marie'), 'signalements', 's2'), signalement('paul')));
    await assertFails(setDoc(doc(dbAvecEmail('marie'), 'signalements', 's3'), signalement('marie', { email: 'faux@exemple.fr' })));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'signalements', 's4'), signalement('marie')));
  });

  test('message vide ou champs en trop refusés', async () => {
    await assertFails(setDoc(doc(dbAvecEmail('marie'), 'signalements', 's5'), signalement('marie', { message: '' })));
    await assertFails(setDoc(doc(dbAvecEmail('marie'), 'signalements', 's6'), signalement('marie', { piege: true })));
  });
});
