import { getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

/**
 * Aperçu web : React Native Firebase n'embarque que Firestore « lite » sur le
 * web (ni temps réel ni cache). On passe donc par le SDK JavaScript complet,
 * dont l'API modulaire est la même, avec cache persistant pour le hors-ligne.
 */
// Le getFirestore local ci-dessous masque celui du SDK (règle ES : un export
// explicite l'emporte sur `export *`).
// eslint-disable-next-line import/export
export * from 'firebase/firestore';

let instance: Firestore | null = null;

// eslint-disable-next-line import/export
export function getFirestore(): Firestore {
  // Rendu côté serveur (pas d'IndexedDB) : cache en mémoire par défaut.
  instance ??= initializeFirestore(
    getApp(),
    typeof window === 'undefined' ? {} : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
  );
  return instance;
}
