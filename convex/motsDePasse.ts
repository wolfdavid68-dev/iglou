import { ctr } from '@noble/ciphers/aes.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { Scrypt } from 'lucia';

/**
 * Mots de passe des comptes. Les nouveaux sont hachés avec Scrypt (défaut de
 * Convex Auth). Les comptes transférés depuis Firebase gardent leur hash
 * Firebase (« scrypt modifié ») : le mot de passe ne change pas pour
 * l'utilisateur. Paramètres à copier depuis la console Firebase
 * (Authentication → ⋮ → Paramètres de hachage du mot de passe) dans les
 * variables d'environnement Convex FIREBASE_SCRYPT_*.
 */

const PREFIXE_FIREBASE = 'firebase-scrypt$';

export interface ParametresFirebase {
  cleSignature: string;
  separateurSel: string;
  tours: number;
  coutMemoire: number;
}

/** Hash d'un compte transféré : `firebase-scrypt$<hash base64>$<sel base64>`. */
export const secretFirebase = (hash: string, sel: string) => `${PREFIXE_FIREBASE}${hash}$${sel}`;

const octets = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

function egaux(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Algorithme de Firebase : clé = scrypt(mot de passe, sel ‖ séparateur), puis
 * la clé de signature du projet chiffrée en AES-256-CTR (IV nul) avec les
 * 32 premiers octets de cette clé doit redonner le hash enregistré.
 */
export function verifierHashFirebase(motDePasse: string, hash: string, sel: string, p: ParametresFirebase): boolean {
  const s = octets(sel);
  const sep = octets(p.separateurSel);
  const selComplet = new Uint8Array(s.length + sep.length);
  selComplet.set(s);
  selComplet.set(sep, s.length);
  const derivee = scrypt(new TextEncoder().encode(motDePasse), selComplet, { N: 2 ** p.coutMemoire, r: p.tours, p: 1, dkLen: 64 });
  const chiffre = ctr(derivee.slice(0, 32), new Uint8Array(16)).encrypt(octets(p.cleSignature));
  return egaux(chiffre, octets(hash));
}

function parametresFirebase(): ParametresFirebase {
  const e = process.env;
  if (!e.FIREBASE_SCRYPT_SIGNER_KEY || !e.FIREBASE_SCRYPT_SALT_SEPARATOR || !e.FIREBASE_SCRYPT_ROUNDS || !e.FIREBASE_SCRYPT_MEM_COST) {
    throw new Error('Paramètres de hachage Firebase manquants (variables FIREBASE_SCRYPT_*).');
  }
  return {
    cleSignature: e.FIREBASE_SCRYPT_SIGNER_KEY,
    separateurSel: e.FIREBASE_SCRYPT_SALT_SEPARATOR,
    tours: Number(e.FIREBASE_SCRYPT_ROUNDS),
    coutMemoire: Number(e.FIREBASE_SCRYPT_MEM_COST),
  };
}

export const hachage = {
  async hashSecret(motDePasse: string) {
    return await new Scrypt().hash(motDePasse);
  },
  async verifySecret(motDePasse: string, enregistre: string) {
    if (enregistre.startsWith(PREFIXE_FIREBASE)) {
      const [hash, sel] = enregistre.slice(PREFIXE_FIREBASE.length).split('$');
      return verifierHashFirebase(motDePasse, hash, sel, parametresFirebase());
    }
    return await new Scrypt().verify(enregistre, motDePasse);
  },
};
