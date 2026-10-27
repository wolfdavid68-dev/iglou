import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';
import { estSecretFirebase, secretFirebase } from './motsDePasse';

/** Comptes traités par appel (reste largement sous les limites d'une transaction). */
const LOT = 200;

/**
 * Transfert des comptes Firebase : crée les utilisateurs Convex Auth à partir
 * de la table de transit `transfertComptes` (remplie par
 * scripts/transfert-convex.mts), en gardant l'uid Firebase et le hash du mot
 * de passe. Idempotent ; à rappeler tant que `termine` est faux.
 *
 *   npx convex run transfert:creerComptes [--prod]
 */
export const creerComptes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const lot = await ctx.db.query('transfertComptes').take(LOT);
    let crees = 0;
    for (const c of lot) {
      const email = c.email.trim().toLowerCase();
      const existant = await ctx.db
        .query('authAccounts')
        .withIndex('providerAndAccountId', (q) => q.eq('provider', 'password').eq('providerAccountId', email))
        .first();
      const dejaTransfere = await ctx.db
        .query('users')
        .withIndex('par_uid', (q) => q.eq('uid', c.uid))
        .first();
      if (!existant && !dejaTransfere) {
        const userId = await ctx.db.insert('users', {
          email,
          uid: c.uid,
          ...(c.nom && { name: c.nom }),
          ...(c.emailVerifie && { emailVerificationTime: Date.now() }),
        });
        await ctx.db.insert('authAccounts', {
          userId,
          provider: 'password',
          providerAccountId: email,
          // Sans hash (cas rare), le compte existe mais il faudra « Mot de passe oublié ».
          ...(c.hash && c.sel && { secret: secretFirebase(c.hash, c.sel) }),
          ...(c.emailVerifie && { emailVerified: email }),
        });
        crees++;
      }
      await ctx.db.delete(c._id);
    }
    const termine = (await ctx.db.query('transfertComptes').first()) === null;
    return { crees, termine };
  },
});

/** Le compte a-t-il encore son ancien hash Firebase ? (converti à la connexion, voir auth.ts) */
export const aHashFirebase = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const compte = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) => q.eq('provider', 'password').eq('providerAccountId', email))
      .first();
    return !!compte?.secret && estSecretFirebase(compte.secret);
  },
});

/** Comptes transférés dont le mot de passe n'a pas encore été converti (personne ne s'est reconnecté). */
export const restantsAConvertir = internalQuery({
  args: {},
  handler: async (ctx) => {
    const comptes = await ctx.db.query('authAccounts').collect();
    return comptes.filter((c) => c.secret && estSecretFirebase(c.secret)).length;
  },
});
