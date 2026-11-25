import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Annulable } from '@/domaine/annulation';
import { tic } from '@/services/haptique';
import { abonnerMessages, annulation, fermerMessage, messageCourant, type Message } from '@/services/retours';
import { useCouleurs } from '@/theme';
import { Texte, type NomIcone } from './ui';

/**
 * Bandeau du bas : annulation (« Œufs supprimé · Annuler », 5 s) ou message
 * court. Placé une seule fois à la racine ; `decalage` le remonte au-dessus
 * de la barre d'onglets.
 *
 * Surface flottante claire en clair, sombre en sombre (carte + relief) :
 * l'encre du thème y garde un contraste ≥ 4,5:1 dans les deux modes, et
 * l'action « Annuler » prend la couleur signature.
 */
export function BandeauBas({ decalage = 0 }: { decalage?: number }) {
  const insets = useSafeAreaInsets();
  const c = useCouleurs();
  const [annulable, setAnnulable] = useState<Annulable | null>(annulation.courant);
  const [message, setMessage] = useState<Message | null>(messageCourant);

  useEffect(() => annulation.abonner(setAnnulable), []);
  useEffect(() => abonnerMessages(setMessage), []);

  const bas = insets.bottom + 12 + decalage;

  if (annulable) {
    return (
      <Surface key={`a${annulable.id}`} bas={bas} icone="arrow-undo" fondIcone="bg-carte-enfoncee" couleurIcone={c.encre2}>
        <Texte poids="moyen" className="flex-1 py-3 text-base" numberOfLines={2}>
          {annulable.message}
        </Texte>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Annuler : ${annulable.message}`}
          hitSlop={4}
          onPress={() => {
            tic();
            annulation.annuler(annulable.id);
          }}
          className="min-h-12 items-center justify-center rounded-full bg-frigo-pale px-4 active:scale-95 active:opacity-80">
          <Texte poids="demi" ton="frigo" className="text-base">
            Annuler
          </Texte>
        </Pressable>
      </Surface>
    );
  }

  if (message) {
    const erreur = message.type === 'erreur';
    return (
      <Surface
        key={`m${message.id}`}
        bas={bas}
        icone={erreur ? 'alert-circle' : 'checkmark-circle'}
        fondIcone={erreur ? 'bg-rouge-pale' : 'bg-frigo-pale'}
        couleurIcone={erreur ? c.rougeTexte : c.frigoTexte}
        erreur={erreur}>
        <Texte poids="moyen" className="flex-1 py-3 text-base" numberOfLines={3}>
          {message.texte}
        </Texte>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          hitSlop={4}
          onPress={fermerMessage}
          className="size-12 items-center justify-center rounded-full active:bg-carte-enfoncee">
          <Ionicons name="close" size={20} color={c.encre2} />
        </Pressable>
      </Surface>
    );
  }
  return null;
}

/** Carte flottante commune : tuile d'icône à gauche, contenu, relief marqué. */
function Surface({
  bas,
  icone,
  fondIcone,
  couleurIcone,
  erreur = false,
  children,
}: {
  bas: number;
  icone: NomIcone;
  fondIcone: string;
  couleurIcone: string;
  erreur?: boolean;
  children: ReactNode;
}) {
  const c = useCouleurs();
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(150)}
      style={{ bottom: bas, boxShadow: c.ombre.relief }}
      className={`absolute left-4 right-4 min-h-14 flex-row items-center gap-3 rounded-[20px] border bg-carte py-1 pl-2 pr-1.5 ${
        erreur ? 'border-rouge-texte/40' : 'border-contour'
      }`}
      accessibilityRole={erreur ? 'alert' : undefined}
      accessibilityLiveRegion={erreur ? 'assertive' : 'polite'}>
      <View className={`size-10 items-center justify-center rounded-[14px] ${fondIcone}`}>
        <Ionicons name={icone} size={20} color={couleurIcone} />
      </View>
      {children}
    </Animated.View>
  );
}
