import { registerStaticRoutes } from '@convex-dev/static-hosting';
import { httpRouter } from 'convex/server';

import { components } from './_generated/api';
import { httpAction } from './_generated/server';
import { auth } from './auth';

const http = httpRouter();

// Connexion (Convex Auth) : routes à la racine, avant le site.
auth.addHttpRoutes(http);

// Pages publiques (liens du Play Store et de l'app) : adresses sans « .html ».
for (const page of ['confidentialite', 'suppression-compte', 'presentation']) {
  http.route({
    path: `/${page}`,
    method: 'GET',
    handler: httpAction(async () => new Response(null, { status: 301, headers: { Location: `/${page}.html` } })),
  });
}

// Tout le reste : le site exporté par Expo (npm run deploy).
registerStaticRoutes(http, components.staticHosting);

export default http;
