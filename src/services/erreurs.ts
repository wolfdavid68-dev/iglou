import { ConvexError } from 'convex/values';

/**
 * Code d'une erreur renvoyée par le serveur Convex :
 * - codes de l'app (`ConvexError({ code })`, voir convex/acces.ts) ;
 * - erreurs de Convex Auth, reconnues à leur texte.
 */
export function codeErreur(e: unknown): string {
  if (e instanceof ConvexError) {
    const code = (e.data as { code?: unknown } | undefined)?.code;
    return typeof code === 'string' ? code : '';
  }
  const texte = e instanceof Error ? e.message : String(e ?? '');
  if (/InvalidSecret|InvalidAccountId|Invalid credentials/i.test(texte)) return 'identifiants';
  if (/already exists/i.test(texte)) return 'compte-existant';
  if (/TooManyFailedAttempts|rate limit/i.test(texte)) return 'trop-de-tentatives';
  if (/Invalid code|Could not verify code|InvalidVerificationCode/i.test(texte)) return 'code-reinitialisation';
  if (/Envoi de l'e-mail impossible|AUTH_RESEND_KEY/i.test(texte)) return 'envoi-email';
  if (/mot-de-passe-faible|Invalid password/i.test(texte)) return 'mot-de-passe-faible';
  if (/Connection lost|network|Failed to fetch|WebSocket/i.test(texte)) return 'reseau';
  return '';
}

/** Message d'erreur lisible pour l'utilisateur. */
export function messageErreur(e: unknown): string {
  switch (codeErreur(e)) {
    case 'identifiants':
      return 'E-mail ou mot de passe incorrect.';
    case 'compte-existant':
      return 'Un compte existe déjà avec cet e-mail.';
    case 'mot-de-passe-faible':
      return 'Mot de passe trop court (6 caractères minimum).';
    case 'trop-de-tentatives':
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    case 'code-reinitialisation':
      return 'Code incorrect ou expiré.';
    case 'envoi-email':
      return "L'e-mail n'a pas pu être envoyé. Réessaie plus tard.";
    case 'reseau':
      return 'Pas de connexion internet.';
    case 'non-connecte':
      return 'Tu as été déconnecté. Reconnecte-toi.';
    case 'refuse':
      return "Action refusée : tu n'as pas les droits nécessaires.";
    case 'invalide':
      return 'Données invalides.';
    case 'introuvable':
      return "Cet élément n'existe plus.";
    default:
      return 'Une erreur est survenue. Réessaie.';
  }
}
