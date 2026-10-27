import { creerGestionnaireAnnulation } from '@/domaine/annulation';
import { messageErreur } from './erreurs';

/**
 * Messages courts affichés en bas d'écran (erreurs, confirmations), et
 * gestionnaire unique du bandeau « ANNULER ».
 */
export interface Message {
  id: number;
  texte: string;
  type: 'info' | 'erreur';
}

type Ecouteur = (m: Message | null) => void;

let courant: Message | null = null;
let prochainId = 1;
let minuteur: ReturnType<typeof setTimeout> | null = null;
const ecouteurs = new Set<Ecouteur>();

function publier(m: Message | null) {
  courant = m;
  ecouteurs.forEach((e) => e(m));
}

export function afficherMessage(texte: string, type: Message['type'] = 'info', dureeMs = 3500) {
  if (minuteur) clearTimeout(minuteur);
  const m = { id: prochainId++, texte, type };
  publier(m);
  minuteur = setTimeout(() => {
    if (courant?.id === m.id) publier(null);
  }, dureeMs);
}

export function fermerMessage() {
  if (minuteur) clearTimeout(minuteur);
  publier(null);
}

export function abonnerMessages(e: Ecouteur): () => void {
  ecouteurs.add(e);
  return () => {
    ecouteurs.delete(e);
  };
}

export const messageCourant = () => courant;

export function signalerErreur(e: unknown) {
  afficherMessage(messageErreur(e), 'erreur', 5000);
}

/**
 * Lance une écriture sans attendre le serveur : Convex l'applique tout de
 * suite à l'affichage local (l'interface se met à jour) et l'envoie dès que le
 * réseau est disponible. Une écriture refusée est signalée à l'utilisateur.
 */
export function lancer(ecriture: Promise<unknown>) {
  ecriture.catch(signalerErreur);
}

export const annulation = creerGestionnaireAnnulation(5000);
