import './init-firebase';

import { getAuth } from './auth-firebase';

/**
 * Firebase ne sert plus qu'aux comptes (Authentication). Les données sont
 * dans Convex (dossier convex/), qui accepte les jetons d'identité Firebase.
 * Seule la configuration publique de l'app est ici : aucune clé d'administration.
 */
export const auth = getAuth();
