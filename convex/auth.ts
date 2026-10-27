import Resend from '@auth/core/providers/resend';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import { generateRandomString, type RandomReader } from '@oslojs/crypto/random';
import { Resend as ResendAPI } from 'resend';

import type { DataModel } from './_generated/dataModel';
import { motsDePasse } from './motsDePasse';

/**
 * Code à 8 chiffres envoyé par e-mail pour choisir un nouveau mot de passe.
 * Nécessite la variable Convex AUTH_RESEND_KEY (clé https://resend.com) et,
 * pour un expéditeur à votre nom, AUTH_EMAIL_FROM (domaine vérifié chez Resend).
 */
const ReinitialisationParCode = Resend({
  id: 'resend-otp',
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    const aleatoire: RandomReader = {
      read(octets) {
        crypto.getRandomValues(octets as Uint8Array<ArrayBuffer>);
      },
    };
    return generateRandomString(aleatoire, '0123456789', 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? 'Iglou <onboarding@resend.dev>',
      to: [email],
      subject: 'Ton code Iglou pour changer de mot de passe',
      text: `Ton code : ${token}\n\nSaisis-le dans l'application Iglou pour choisir un nouveau mot de passe. Il est valable 15 minutes.\n\nSi tu n'as rien demandé, ignore ce message.`,
    });
    // ConvexError : son code reste lisible par l'app même en production.
    if (error) throw new ConvexError({ code: 'envoi-email' });
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
