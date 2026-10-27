import { internalMutation, internalQuery } from './_generated/server';
import { PREFIXE_FIREBASE } from './motsDePasse';

/**
 * Transfert des comptes Firebase Auth (voir scripts/transfert/LISEZMOI.md).
 *
 * `npx convex import --table transfertComptes comptes.jsonl` dépose les
 * comptes exportés ; `npx convex run transfert:finaliserComptes` crée pour
 * chacun un compte Convex Auth qui garde le même uid (les données de la maison
 * y font référence) et le même mot de passe (hash Firebase vérifié à la
 * connexion, voir motsDePasse.ts).
 *
 * Fonctions internes : appelables seulement depuis le tableau de bord ou la
 * ligne de commande Convex, jamais depuis l'app.
 */

const PAR_PASSAGE = 200;

export const finaliserComptes = internalMutation({
  args: {},
  handler: async (ctx) => {
    let crees = 0;
    let ignores = 0;
    const lot = await ctx.db.query('transfertComptes').take(PAR_PASSAGE);
    for (const c of lot) {
      const email = c.email.trim().toLowerCase();
      const dejaUid = await ctx.db
        .query('users')
        .withIndex('uid', (q) => q.eq('uid', c.uid))
        .first();
      const dejaEmail = await ctx.db
        .query('authAccounts')
        .withIndex('providerAndAccountId', (q) => q.eq('provider', 'password').eq('providerAccountId', email))
        .first();
      if (dejaUid || dejaEmail || !email) {
        ignores++;
      } else {
        const userId = await ctx.db.insert('users', {
          email,
          uid: c.uid,
          ...(c.prenom ? { prenom: c.prenom.slice(0, 40) } : {}),
          ...(c.emailVerifie ? { emailVerificationTime: Date.now() } : {}),
        });
        await ctx.db.insert('authAccounts', {
          userId,
          provider: 'password',
          providerAccountId: email,
          // Sans hash (compte sans mot de passe), seule la réinitialisation par code permettra de se connecter.
          ...(c.hash && c.sel ? { secret: `${PREFIXE_FIREBASE}${c.sel}$${c.hash}` } : {}),
        });
        crees++;
      }
      await ctx.db.delete(c._id);
    }
    const restants = (await ctx.db.query('transfertComptes').take(1)).length > 0;
    return { crees, ignores, restants: restants ? 'oui : relancer la commande' : 'non, terminé' };
  },
});

/** Bilan après transfert : nombre de documents par table. */
export const bilan = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tables = ['users', 'authAccounts', 'maisons', 'membres', 'appareils', 'tiroirs', 'aliments', 'coursesLibres', 'consommations', 'signalements', 'transfertComptes'] as const;
    const res: Record<string, number> = {};
    for (const t of tables) res[t] = (await ctx.db.query(t).collect()).length;
    return res;
  },
});
