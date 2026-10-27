'use node';

import { ConvexError, v } from 'convex/values';
import nodemailer from 'nodemailer';

import { internalAction } from './_generated/server';

/**
 * Envoie le code « Mot de passe oublié » depuis une adresse Gmail.
 * Variables Convex : GMAIL_ADRESSE (ex. iglou@gmail.com) et GMAIL_MOT_DE_PASSE_APP
 * (mot de passe d'application Google, 16 lettres : https://myaccount.google.com/apppasswords).
 */
export const envoyerCodeReinitialisation = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const adresse = process.env.GMAIL_ADRESSE;
    const motDePasse = process.env.GMAIL_MOT_DE_PASSE_APP?.replace(/\s/g, '');
    if (!adresse || !motDePasse) {
      console.error('Envoi impossible : GMAIL_ADRESSE ou GMAIL_MOT_DE_PASSE_APP manquant dans Convex.');
      throw new ConvexError({ code: 'envoi-email' });
    }

    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: adresse, pass: motDePasse } });
    try {
      await transport.sendMail({
        from: `Iglou <${adresse}>`,
        to: email,
        subject: 'Ton code Iglou pour changer de mot de passe',
        text: `Ton code : ${code}\n\nSaisis-le dans l'application Iglou pour choisir un nouveau mot de passe. Il est valable 15 minutes.\n\nSi tu n'as rien demandé, ignore ce message.`,
      });
    } catch (e) {
      // Raison du refus de Gmail (mot de passe d'application invalide, quota…), visible dans les journaux Convex.
      console.error('Gmail a refusé l’envoi :', e instanceof Error ? e.message : e);
      throw new ConvexError({ code: 'envoi-email' });
    }
    return null;
  },
});
