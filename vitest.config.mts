import { defineConfig } from 'vitest/config';

/** Tests du serveur Convex (convex-test) : `npm run test:serveur`. */
export default defineConfig({
  test: {
    include: ['tests/serveur/**/*.test.ts'],
    environment: 'node',
  },
});
