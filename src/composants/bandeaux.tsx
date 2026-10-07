import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Annulable } from '@/domaine/annulation';
import { abonnerMessages, annulation, fermerMessage, messageCourant, type Message } from '@/services/retours';
import { Texte } from './ui';

/**
 * Bandeau du bas : annulation (« Œufs supprimé · ANNULER », 5 s) ou message
 * court. Placé une seule fois à la racine ; `decalage` le remonte au-dessus
 * de la barre d'onglets.
 */
export function BandeauBas({ decalage = 0 }: { decalage?: number }) {
  const insets = useSafeAreaInsets();
  const [annulable, setAnnulable] = useState<Annulable | null>(annulation.courant);
  const [message, setMessage] = useState<Message | null>(messageCourant);

  useEffect(() => annulation.abonner(setAnnulable), []);
  useEffect(() => abonnerMessages(setMessage), []);

  const bas = insets.bottom + 12 + decalage;

  if (annulable) {
    return (
      <Animated.View
        key={`a${annulable.id}`}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        style={{ bottom: bas }}
        className="absolute left-4 right-4 min-h-12 flex-row items-center rounded-2xl bg-encre pl-4 shadow-lg"
        accessibilityLiveRegion="polite">
        <Texte ton="aucun" className="flex-1 py-3 text-base text-fond" numberOfLines={2}>
          {annulable.message}
        </Texte>
        <Pressable
          accessibilityRole="button"
          onPress={() => annulation.annuler(annulable.id)}
          className="min-h-12 justify-center rounded-2xl px-4 active:opacity-70">
          <Texte poids="gras" ton="courses" className="text-base">
            ANNULER
          </Texte>
        </Pressable>
      </Animated.View>
    );
  }

  if (message) {
    return (
      <Animated.View
        key={`m${message.id}`}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        style={{ bottom: bas }}
        className={`absolute left-4 right-4 min-h-12 flex-row items-center gap-3 rounded-2xl px-4 shadow-lg ${
          message.type === 'erreur' ? 'bg-rouge' : 'bg-encre'
        }`}
        accessibilityLiveRegion="polite">
        <Texte ton="aucun" className={`flex-1 py-3 text-base ${message.type === 'erreur' ? 'text-white' : 'text-fond'}`} numberOfLines={3}>
          {message.texte}
        </Texte>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermerMessage} className="size-10 items-center justify-center">
          <Ionicons name="close" size={20} color={message.type === 'erreur' ? '#fff' : '#94A3B8'} />
        </Pressable>
      </Animated.View>
    );
  }
  return null;
}
