import { Uniwind } from 'uniwind';

import { stockage } from './stockage';

/** Thème de l'app : celui du téléphone, ou forcé en clair / sombre. */
export type Apparence = 'system' | 'light' | 'dark';

const CLE_APPARENCE = 'apparence';

export function apparenceEnregistree(): Apparence {
  const v = stockage.lire(CLE_APPARENCE);
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Mémorise le choix sur cet appareil et l'applique tout de suite (styles, barre d'état, dialogues natifs). */
export function choisirApparence(apparence: Apparence) {
  if (apparence === 'system') stockage.effacer(CLE_APPARENCE);
  else stockage.ecrire(CLE_APPARENCE, apparence);
  Uniwind.setTheme(apparence);
}

/** Au démarrage, avant le premier rendu. */
export function restaurerApparence() {
  const apparence = apparenceEnregistree();
  if (apparence !== 'system') Uniwind.setTheme(apparence);
}
