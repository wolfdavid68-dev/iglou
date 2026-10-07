import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { etatPeremption } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import { estEpuise } from '@/domaine/quantites';
import type { Aliment } from '@/domaine/types';
import { useCouleurs } from '@/theme';
import { Jauge } from './jauge';
import { Texte } from './ui';

const nombre = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR'));

/** « 2 / 6 », suivi de l'unité quand ce ne sont pas des pièces ou des portions. */
export function texteStock(a: Pick<Aliment, 'quantite' | 'quantiteMax' | 'unite'>): string {
  const base = `${nombre(a.quantite)} / ${nombre(a.quantiteMax)}`;
  return a.unite === 'pièce' || a.unite === 'portion' ? base : `${base} ${a.unite}`;
}

/** Emoji, nom, stock et jauge d'un aliment (tiroirs, recherche). */
export function ApercuAliment({ aliment, compact = false }: { aliment: Aliment; compact?: boolean }) {
  const c = useCouleurs();
  const peremption = etatPeremption(aliment.datePeremption);
  const epuise = estEpuise(aliment);
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <Text className={compact ? 'text-xl' : 'text-2xl'} accessible={false}>
        {emojiPourNom(aliment.nom)}
      </Text>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1">
          <Texte poids="moyen" className={`flex-1 ${compact ? 'text-sm' : 'text-base'}`} numberOfLines={1}>
            {aliment.nom}
          </Texte>
          {peremption === 'depassee' || peremption === 'proche' ? (
            <Ionicons name="time-outline" size={14} color={peremption === 'depassee' ? c.rouge : c.orange} />
          ) : null}
          <Texte ton={epuise ? 'rouge' : 'secondaire'} poids={epuise ? 'demi' : 'normal'} className="text-xs">
            {texteStock(aliment)}
          </Texte>
        </View>
        <Jauge stock={aliment} />
      </View>
    </View>
  );
}
