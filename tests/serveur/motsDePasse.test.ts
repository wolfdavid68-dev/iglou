import { createCipheriv, scryptSync } from 'node:crypto';
import { expect, test } from 'vitest';

import { hachage, secretFirebase, verifierHashFirebase } from '../../convex/motsDePasse';

/** Exemple publié par Firebase (github.com/firebase/scrypt). */
const firebase = {
  cleSignature: 'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==',
  separateurSel: 'Bw==',
  tours: 8,
  coutMemoire: 14,
};

test("vecteur officiel de Firebase : l'ancien mot de passe est reconnu", () => {
  const hash = 'lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==';
  expect(verifierHashFirebase('user1password', hash, '42xEC+ixf3L2lw==', firebase)).toBe(true);
  expect(verifierHashFirebase('user1passwort', hash, '42xEC+ixf3L2lw==', firebase)).toBe(false);
});

test('même résultat que le chiffrement de référence (Node : scrypt + AES-256-CTR)', () => {
  const sel = Buffer.from('un-sel-quelconque');
  const derivee = scryptSync('Mot2Passe!', Buffer.concat([sel, Buffer.from(firebase.separateurSel, 'base64')]), 64, {
    N: 2 ** firebase.coutMemoire,
    r: firebase.tours,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const c = createCipheriv('aes-256-ctr', derivee.subarray(0, 32), Buffer.alloc(16, 0));
  const hash = Buffer.concat([c.update(Buffer.from(firebase.cleSignature, 'base64')), c.final()]).toString('base64');
  expect(verifierHashFirebase('Mot2Passe!', hash, sel.toString('base64'), firebase)).toBe(true);
  expect(verifierHashFirebase('mot2passe!', hash, sel.toString('base64'), firebase)).toBe(false);
});

test('comptes transférés et nouveaux comptes passent par la même vérification', async () => {
  process.env.FIREBASE_SCRYPT_SIGNER_KEY = firebase.cleSignature;
  process.env.FIREBASE_SCRYPT_SALT_SEPARATOR = firebase.separateurSel;
  process.env.FIREBASE_SCRYPT_ROUNDS = '8';
  process.env.FIREBASE_SCRYPT_MEM_COST = '14';
  const transfere = secretFirebase('lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==', '42xEC+ixf3L2lw==');
  expect(await hachage.verifySecret('user1password', transfere)).toBe(true);
  expect(await hachage.verifySecret('autre', transfere)).toBe(false);

  const nouveau = await hachage.hashSecret('nouveau-mdp');
  expect(await hachage.verifySecret('nouveau-mdp', nouveau)).toBe(true);
  expect(await hachage.verifySecret('autre', nouveau)).toBe(false);
});
