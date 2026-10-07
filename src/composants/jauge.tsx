import { View } from 'react-native';

import { niveauJauge, remplissage, type Stock } from '@/domaine/quantites';

const COULEUR = { plein: 'bg-vert', entame: 'bg-orange', epuise: 'bg-rouge' } as const;

/** Jauge de remplissage : vert plein, orange entamé, rouge épuisé. */
export function Jauge({ stock, className = '' }: { stock: Stock; className?: string }) {
  const niveau = niveauJauge(stock);
  const pourcent = niveau === 'epuise' ? 100 : Math.max(6, Math.round(remplissage(stock) * 100));
  return (
    <View
      className={`h-1.5 overflow-hidden rounded-full bg-carte-enfoncee ${className}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: stock.quantiteMax, now: stock.quantite }}>
      <View className={`h-full rounded-full ${COULEUR[niveau]} ${niveau === 'epuise' ? 'opacity-30' : ''}`} style={{ width: `${pourcent}%` }} />
    </View>
  );
}
