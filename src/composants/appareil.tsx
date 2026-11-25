import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { withUniwind } from 'uniwind';

import type { TypeAppareil } from '@/domaine/types';
import { classesAppareil, couleurTexteAppareil, useCouleurs } from '@/theme';

export const Degrade = withUniwind(LinearGradient);

/** Pastille d'icône d'un appareil (frigo turquoise, congélateur bleu), teinte foncée pour rester visible sur le fond pâle. */
export function IconeAppareil({ type, taille = 'moyenne' }: { type: TypeAppareil; taille?: 'petite' | 'moyenne' }) {
  const c = useCouleurs();
  const petite = taille === 'petite';
  return (
    <View className={`items-center justify-center ${classesAppareil[type].pale} ${petite ? 'size-9 rounded-[12px]' : 'size-12 rounded-[14px]'}`}>
      <MaterialCommunityIcons
        name={type === 'congelateur' ? 'snowflake' : 'fridge-outline'}
        size={petite ? 20 : 26}
        color={couleurTexteAppareil(c, type)}
      />
    </View>
  );
}

/** Fond givré du congélateur (dégradé bleu pâle vers le fond). */
export function Givre({ type, children, className = '' }: { type: TypeAppareil; children: ReactNode; className?: string }) {
  const c = useCouleurs();
  if (type !== 'congelateur') return <View className={className}>{children}</View>;
  return (
    <Degrade colors={c.givre} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} className={className}>
      {children}
    </Degrade>
  );
}

export const libelleType = (type: TypeAppareil) => (type === 'congelateur' ? 'Congélateur' : 'Frigo');
