import type { AuthConfig } from 'convex/server';

/**
 * Les comptes restent sur Firebase Authentication : Convex accepte
 * directement les jetons d'identité Firebase du projet (uid = `sub`).
 */
const PROJET_FIREBASE = 'congelateur-v91vd';

export default {
  providers: [
    {
      type: 'customJwt',
      applicationID: PROJET_FIREBASE,
      issuer: `https://securetoken.google.com/${PROJET_FIREBASE}`,
      jwks: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      algorithm: 'RS256',
    },
  ],
} satisfies AuthConfig;
