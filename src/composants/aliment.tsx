import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { etatPeremption } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import { estEpuise } from '@/domaine/quantites';
import { formaterNombre, suffixeUnite } from '@/domaine/texte';
import type { Aliment } from '@/domaine/types';
import { useCouleurs } from '@/theme';
import { Jauge } from './jauge';
import { Texte } from './ui';

/** « 2 / 6 », suivi de l'unité quand ce ne sont pas des pièces ou des portions. */
export function texteStock(a: Pick<Aliment, 'quantite' | 'quantiteMax' | 'unite'>): string {
  const base = `${formaterNombre(a.quantite)} / ${formaterNombre(a.quantiteMax)}`;
  const unite = suffixeUnite(a.unite);
  return unite ? `${base} ${unite}` : base;
}

/**
 * Emoji, nom, stock et jauge d'un aliment (tiroirs, recherche).
 * Compact (cellule de tiroir, demi-largeur) : le nom a toute la largeur et
 * peut tenir sur deux lignes ; le stock passe à côté de la jauge.
 */
export function ApercuAliment({ aliment, compact = false }: { aliment: Aliment; compact?: boolean }) {
  const c = useCouleurs();
  const peremption = etatPeremption(aliment.datePeremption);
  const epuise = estEpuise(aliment);
  const alerte =
    peremption === 'depassee' || peremption === 'proche' ? (
      <Ionicons name="time-outline" size={compact ? 13 : 14} color={peremption === 'depassee' ? c.rougeTexte : c.orangeTexte} />
    ) : null;
  const stock = (
    <Texte ton={epuise ? 'rouge' : 'secondaire'} poids={epuise ? 'demi' : 'normal'} className="text-xs" style={{ fontVariant: ['tabular-nums'] }}>
      {texteStock(aliment)}
    </Texte>
  );

  if (compact) {
    return (
      <View className="flex-1 flex-row items-center gap-2">
        <Text className="text-xl" accessible={false}>
          {emojiPourNom(aliment.nom)}
        </Text>
        <View className="flex-1 gap-1">
          <Texte poids="moyen" className="text-sm leading-[18px]" numberOfLines={2}>
            {aliment.nom}
          </Texte>
          <View className="flex-row items-center gap-1.5">
            <Jauge stock={aliment} className="flex-1" />
            {alerte}
            {stock}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row items-center gap-2">
      <Text className="text-2xl" accessible={false}>
        {emojiPourNom(aliment.nom)}
      </Text>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1">
          <Texte poids="moyen" className="flex-1 text-base" numberOfLines={1}>
            {aliment.nom}
          </Texte>
          {alerte}
          {stock}
        </View>
        <Jauge stock={aliment} />
      </View>
    </View>
  );
}
