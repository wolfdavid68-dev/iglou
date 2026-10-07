import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Degrade } from '@/composants/appareil';
import { BandeauHorsLigne, Texte, type NomIcone } from '@/composants/ui';
import { useHorsLigne } from '@/services/donnees-maison';

/**
 * En-tête en dégradé, dans l'esprit de l'accueil : titre blanc, motif
 * décoratif en filigrane et contenu libre en dessous (chiffres, progression…).
 */
export function EnTeteDegrade({
  couleurs,
  titre,
  sousTitre,
  motif,
  retour = true,
  actions,
  children,
}: {
  couleurs: readonly [string, string, ...string[]];
  titre: string;
  sousTitre?: string;
  /** Grande icône décorative, à peine visible, en haut à droite. */
  motif: ComponentProps<typeof MaterialCommunityIcons>['name'];
  retour?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const horsLigne = useHorsLigne();
  const focalise = useIsFocused();

  return (
    <View>
      {focalise && <StatusBar style="light" />}
      <Degrade
        colors={couleurs}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8 }}
        className="overflow-hidden rounded-b-[32px] px-4 pb-5">
        <View pointerEvents="none" style={{ position: 'absolute', right: -36, top: insets.top - 24 }}>
          <MaterialCommunityIcons name={motif} size={180} color="rgba(255,255,255,0.1)" />
        </View>

        {retour ? (
          // Écran empilé : barre d'actions, puis grand titre en dessous (jamais tronqué par les boutons).
          <>
            <View className="min-h-14 flex-row items-center justify-between gap-2">
              <BoutonVerre icone="arrow-back" libelle="Retour" onPress={() => router.back()} />
              {actions}
            </View>
            <Titre titre={titre} sousTitre={sousTitre} className="mt-2 px-1" />
          </>
        ) : (
          <View className="min-h-14 flex-row items-center gap-2">
            <Titre titre={titre} sousTitre={sousTitre} className="flex-1 pl-1" />
            {actions}
          </View>
        )}

        {children ? <View className="mt-4">{children}</View> : null}
      </Degrade>
      <BandeauHorsLigne visible={horsLigne} />
    </View>
  );
}

function Titre({ titre, sousTitre, className }: { titre: string; sousTitre?: string; className: string }) {
  return (
    <View className={className}>
      <Texte poids="gras" ton="blanc" className="text-3xl" numberOfLines={2} accessibilityRole="header">
        {titre}
      </Texte>
      {sousTitre ? (
        <Texte poids="moyen" ton="aucun" className="text-sm text-white/80" numberOfLines={1}>
          {sousTitre}
        </Texte>
      ) : null}
    </View>
  );
}

/** Bouton rond « verre dépoli », lisible sur un dégradé. */
export function BoutonVerre({ icone, libelle, onPress }: { icone: NomIcone; libelle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      hitSlop={4}
      onPress={onPress}
      className="size-12 items-center justify-center rounded-full border border-white/25 bg-white/15 active:bg-white/30">
      <Ionicons name={icone} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

/** Pastille chiffrée semi-transparente pour le contenu d'un en-tête en dégradé. */
export function PuceVerre({ icone, texte }: { icone: NomIcone; texte: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5">
      <Ionicons name={icone} size={14} color="rgba(255,255,255,0.9)" />
      <Texte poids="demi" ton="blanc" className="text-xs">
        {texte}
      </Texte>
    </View>
  );
}
