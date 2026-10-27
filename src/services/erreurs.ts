import { ConvexError } from 'convex/values';

/**
 * Code d'erreur commun : `auth/…` pour les comptes (convex/auth.ts),
 * `serveur/…` pour les autres refus du serveur (voir convex/lib.ts).
 */
export function codeErreur(e: unknown): string {
  if (e instanceof ConvexError) {
    const code = (e.data as { code?: string } | undefined)?.code;
    return code?.startsWith('auth/') ? code : `serveur/${code ?? 'inconnu'}`;
  }
  return (e as { code?: string })?.code ?? '';
}

/** Message d'erreur lisible pour l'utilisateur. */
export function messageErreur(e: unknown): string {
  switch (codeErreur(e)) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth/wrong-password':
      return 'Mot de passe incorrect.';
    case 'auth/invalid-code':
      return 'Code incorrect ou expiré.';
    case 'auth/email-non-envoye':
      return "L'e-mail n'a pas pu partir. Réessaie dans quelques minutes.";
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet e-mail.';
    case 'auth/weak-password':
      return 'Mot de passe trop court (6 caractères minimum).';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    case 'auth/network-request-failed':
      return 'Pas de connexion internet.';
    case 'serveur/permission-denied':
    case 'serveur/unauthenticated':
      return "Action refusée : tu n'as pas les droits nécessaires.";
    case 'serveur/not-found':
      return 'Cet élément a été supprimé entre-temps.';
    case 'serveur/invalid-argument':
      return 'Données invalides : vérifie ta saisie.';
    default:
      return 'Une erreur est survenue. Réessaie.';
  }
}
