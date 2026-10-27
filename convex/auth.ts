import { Email } from '@convex-dev/auth/providers/Email';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import { hachage } from './motsDePasse';

/**
 * Comptes Iglou : e-mail + mot de passe, gérés par Convex Auth.
 * Réinitialisation du mot de passe par un code à 8 chiffres envoyé par e-mail
 * (Resend : variables AUTH_RESEND_KEY et AUTH_EMAIL_FROM).
 */

const CodeMotDePasse = Email({
  id: 'code-mot-de-passe',
  maxAge: 15 * 60,
  async generateVerificationToken() {
    const octets = new Uint8Array(8);
    crypto.getRandomValues(octets);
    return Array.from(octets, (o) => String(o % 10)).join('');
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const cle = process.env.AUTH_RESEND_KEY;
    if (!cle) {
      // Déploiement sans envoi d'e-mails (développement) : le code est dans les journaux Convex.
      console.warn(`AUTH_RESEND_KEY absent : code de réinitialisation pour ${email} = ${token}`);
      return;
    }
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? 'Iglou <noreply@iglou.biz>',
        to: [email],
        subject: `Iglou : ton code ${token}`,
        text:
          `Bonjour,\n\nVoici ton code pour choisir un nouveau mot de passe Iglou : ${token}\n\n` +
          `Il est valable 15 minutes. Si tu n'as rien demandé, ignore simplement ce message.\n\nIglou`,
      }),
    });
    if (!reponse.ok) throw new ConvexError({ code: 'auth/email-non-envoye' });
  },
});

const motDePasse = Password({
  profile(params) {
    const email = String(params.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError({ code: 'auth/invalid-email' });
    const nom = typeof params.name === 'string' ? params.name.trim().slice(0, 40) : '';
    const profil: { email: string; name?: string } = { email };
    if (nom) profil.name = nom;
    return profil as { email: string };
  },
  validatePasswordRequirements(mdp) {
    if (mdp.length < 6) throw new ConvexError({ code: 'auth/weak-password' });
  },
  crypto: hachage,
  reset: CodeMotDePasse,
});

/** Erreurs de Convex Auth → codes lisibles par l'app (les erreurs ordinaires sont masquées en production). */
export function traduireErreur(e: unknown): unknown {
  if (e instanceof ConvexError) return e;
  const m = e instanceof Error ? e.message : String(e);
  const code = /InvalidAccountId/.test(m)
    ? 'auth/user-not-found'
    : /InvalidSecret|Invalid credentials/.test(m)
      ? 'auth/invalid-credential'
      : /TooManyFailedAttempts/.test(m)
        ? 'auth/too-many-requests'
        : /already exists/.test(m)
          ? 'auth/email-already-in-use'
          : /Invalid code|Could not verify code/.test(m)
            ? 'auth/invalid-code'
            : /Invalid password/.test(m)
              ? 'auth/weak-password'
              : null;
  return code ? new ConvexError({ code }) : e;
}

type AvecOptions = { options: { authorize: (...a: unknown[]) => Promise<unknown> } };
const options = (motDePasse as unknown as AvecOptions).options;
const autoriser = options.authorize;
options.authorize = async (...a: unknown[]) => {
  try {
    return await autoriser(...a);
  } catch (e) {
    throw traduireErreur(e);
  }
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [motDePasse],
  callbacks: {
    /** Nouveau compte : son profil (prénom affiché) est créé tout de suite. */
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId, profile }) {
      if (existingUserId) return;
      const prenom = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim().slice(0, 40) : 'Moi';
      await ctx.db.insert('profils', { uid: userId, prenom, createdAt: Date.now() });
    },
  },
});
