/**
 * Web : React Native Firebase embarque sa propre copie du SDK JavaScript.
 * Son authentification ne serait pas vue par Firestore (firestore.web.ts),
 * d'où l'emploi direct de firebase/auth sur la même app.
 */
export * from 'firebase/auth';
