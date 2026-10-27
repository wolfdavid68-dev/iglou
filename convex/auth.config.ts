/**
 * Les jetons de connexion sont émis par Convex Auth (convex/auth.ts) sur ce
 * même déploiement. Variables nécessaires : JWT_PRIVATE_KEY et JWKS
 * (générées par `npx @convex-dev/auth`, voir README).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
