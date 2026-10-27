import { ctr } from '@noble/ciphers/aes.js';
import { scrypt } from '@noble/hashes/scrypt.js';

/**
 * Hachage des mots de passe pour Convex Auth.
 *
 * - Nouveaux comptes et mots de passe réinitialisés : même format que Convex
 *   Auth par défaut (scrypt, « sel:clé » en hexadécimal).
 * - Comptes repris de Firebase : le hash Firebase est gardé tel quel
 *   (« fbscrypt$sel$hash ») et vérifié avec l'algorithme de Firebase
 *   (scrypt modifié). Chacun garde donc son mot de passe actuel.
 *
 * Paramètres Firebase : console Firebase → Authentication → Users → ⋮ →
 * « Password hash parameters », enregistrés dans les variables Convex
 * FIREBASE_SIGNER_KEY, FIREBASE_SALT_SEPARATOR, FIREBASE_ROUNDS, FIREBASE_MEM_COST.
 *
 * Code JavaScript pur : ces fonctions tournent dans une mutation Convex
 * (pas de module crypto de Node).
 */

const enc = new TextEncoder();

const depuisBase64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const enHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Comparaison à temps constant. */
function egaux(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

const cleConvex = (mdp: string, selHex: string) => scrypt(enc.encode(mdp.normalize('NFKC')), enc.encode(selHex), { N: 16384, r: 16, p: 1, dkLen: 64 });

function verifierFirebase(mdp: string, selB64: string, hashB64: string) {
  const signerKey = process.env.FIREBASE_SIGNER_KEY;
  const separateur = process.env.FIREBASE_SALT_SEPARATOR;
  if (!signerKey || !separateur) throw new Error('Paramètres de hachage Firebase absents (FIREBASE_SIGNER_KEY, FIREBASE_SALT_SEPARATOR).');
  const rounds = Number(process.env.FIREBASE_ROUNDS ?? 8);
  const memCost = Number(process.env.FIREBASE_MEM_COST ?? 14);

  const sel = depuisBase64(selB64);
  const sep = depuisBase64(separateur);
  const selComplet = new Uint8Array(sel.length + sep.length);
  selComplet.set(sel);
  selComplet.set(sep, sel.length);
  const cle = scrypt(enc.encode(mdp), selComplet, { N: 2 ** memCost, r: rounds, p: 1, dkLen: 32 });
  const attendu = ctr(cle, new Uint8Array(16)).encrypt(depuisBase64(signerKey));
  return egaux(attendu, depuisBase64(hashB64));
}

export const PREFIXE_FIREBASE = 'fbscrypt$';

export const motsDePasse = {
  async hashSecret(mdp: string) {
    const sel = enHex(crypto.getRandomValues(new Uint8Array(16)));
    return `${sel}:${enHex(cleConvex(mdp, sel))}`;
  },
  async verifySecret(mdp: string, stocke: string) {
    if (stocke.startsWith(PREFIXE_FIREBASE)) {
      const [, sel, hash] = stocke.split('$');
      return !!sel && !!hash && verifierFirebase(mdp, sel, hash);
    }
    const [sel, cle] = stocke.split(':');
    if (!sel || !cle) return false;
    return egaux(enc.encode(enHex(cleConvex(mdp, sel))), enc.encode(cle));
  },
};
