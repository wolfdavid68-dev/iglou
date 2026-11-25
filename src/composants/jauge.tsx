import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { niveauJauge, remplissage, type Stock } from '@/domaine/quantites';
import { useCouleurs } from '@/theme';

/**
 * Jauge de remplissage : vert plein, orange entamé, rouge épuisé.
 * Le remplissage glisse vers sa nouvelle valeur (transition CSS de Reanimated)
 * quand on retire ou ajoute une quantité.
 */
export function Jauge({ stock, className = '' }: { stock: Stock; className?: string }) {
  const c = useCouleurs();
  const niveau = niveauJauge(stock);
  const pourcent = niveau === 'epuise' ? 100 : Math.max(6, Math.round(remplissage(stock) * 100));
  const couleur = niveau === 'plein' ? c.vert : niveau === 'entame' ? c.orange : c.rouge;
  return (
    <View
      className={`h-1.5 overflow-hidden rounded-full bg-carte-enfoncee ${className}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: stock.quantiteMax, now: stock.quantite }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 999,
          width: `${pourcent}%`,
          backgroundColor: couleur,
          opacity: niveau === 'epuise' ? 0.3 : 1,
          transitionProperty: ['width', 'backgroundColor'],
          transitionDuration: 350,
          transitionTimingFunction: 'ease-out',
        }}
      />
    </View>
  );
}
