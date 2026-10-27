import staticHosting from '@convex-dev/static-hosting/convex.config';
import { defineApp } from 'convex/server';

/** Le site web (PWA et pages publiques) est servi par Convex : voir http.ts. */
const app = defineApp();
app.use(staticHosting);

export default app;
