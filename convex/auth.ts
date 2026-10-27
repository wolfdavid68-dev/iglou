import { Email } from '@convex-dev/auth/providers/Email';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import { generateRandomString, type RandomReader } from '@oslojs/crypto/random';

import { internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import { motsDePasse } from './motsDePasse';

/**
 * Code à 8 chiffres envoyé par e-mail pour choisir un nouveau mot de passe.
 * L'envoi passe par Gmail (voir convex/courriel.ts pour les variables à définir).
 */
const ReinitialisationParCode = Email({
  id: 'code-email',
  maxAge: 15 * 60,
  async generateVerificationToken() {
    const aleatoire: RandomReader = {
      read(octets) {
        crypto.getRandomValues(octets as Uint8Array<ArrayBuffer>);
      },
    };
    return generateRandomString(aleatoire, '0123456789', 8);
  },
  // Convex Auth passe le contexte de l'action en second argument (absent de ses types).
  async sendVerificationRequest({ identifier: email, token }, ctx?: ActionCtx) {
    if (!ctx) throw new ConvexError({ code: 'envoi-email' });
    // nodemailer a besoin de Node : l'envoi se fait dans une action à part.
    await ctx.runAction(internal.courriel.envoyerCodeReinitialisation, { email, code: token });
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      // Appelé à chaque connexion : le prénom n'est fourni qu'à l'inscription.
      profile(params) {
        const email = String(params.email ?? '')
          .trim()
          .toLowerCase();
        const prenom = typeof params.prenom === 'string' ? params.prenom.trim().slice(0, 40) : '';
        return { email, ...(params.flow === 'signUp' && prenom ? { prenom } : {}) };
      },
      // Même exigence qu'avant (Firebase) : 6 caractères minimum.
      validatePasswordRequirements(mdp) {
        if (!mdp || mdp.length < 6) throw new ConvexError({ code: 'mot-de-passe-faible' });
      },
      crypto: motsDePasse,
      reset: ReinitialisationParCode,
    }),
  ],
});
