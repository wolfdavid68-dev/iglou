import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const actif = Platform.OS !== 'web';

/** Petit « clic » discret, pour chaque cran d'un réglage de quantité. */
export function tic() {
  if (actif) Haptics.selectionAsync().catch(() => {});
}

/** Impact léger, pour une action franche (stock vidé, ajout…). */
export function choc() {
  if (actif) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
