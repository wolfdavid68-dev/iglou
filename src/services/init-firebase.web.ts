import { getApps, initializeApp } from 'firebase/app';

/**
 * Web (aperçu dans le navigateur) : configuration publique de l'app web
 * Firebase, utilisée seulement pour les comptes (auth-firebase.web.ts). Ce ne
 * sont pas des secrets : les données sont protégées côté serveur (convex/).
 */
// Garde : le rechargement à chaud réexécute ce module.
if (!getApps().length) initializeApp({
  apiKey: 'AIzaSyAA6GfiaRHfMQYr2LuOlbIAU3SA2l4Wwmw',
  authDomain: 'congelateur-v91vd.firebaseapp.com',
  projectId: 'congelateur-v91vd',
  storageBucket: 'congelateur-v91vd.firebasestorage.app',
  messagingSenderId: '1079813916567',
  appId: '1:1079813916567:web:73eb395f0be0a80293e6d2',
});
