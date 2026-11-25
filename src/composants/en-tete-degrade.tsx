import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Degrade } from '@/composants/appareil';
import { BandeauHorsLigne, Texte, type NomIcone } from '@/composants/ui';
import { useHorsLigne } from '@/services/donnees-maison';
import { useCouleurs } from '@/theme';

/**
 * En-tête d'écran : voile givré qui se fond dans le fond de l'écran (teinte de
 * l'écran → fond), grand titre à l'encre, motif en filigrane et contenu libre
 * en dessous (chiffres, progression…). Le contenu est posé sur un fond clair
 * en clair et sombre en sombre : utiliser les couleurs du thème, jamais le blanc.
 */
export function EnTeteDegrade({
  couleurs,
  titre,
  sousTitre,
  surTitre,
  onTitre,
  libelleTitre,
  motif,
  retour = true,
  actions,
  children,
}: {
  /** Voile du thème (`c.hero`, `c.heroCourses`…), de la teinte vers le fond. */
  couleurs: readonly [string, string, ...string[]];
  titre: string;
  sousTitre?: string;
  /** Petite ligne au-dessus du titre (salutation de l'accueil). */
  surTitre?: string;
  /** Rend le titre touchable, avec un chevron (ex. changer de maison). */
  onTitre?: () => void;
  /** Libellé d'accessibilité du titre touchable. */
  libelleTitre?: string;
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
  const c = useCouleurs();

  return (
    <View>
      {focalise && <StatusBar style={c.sombre ? 'light' : 'dark'} />}
      <Degrade
        colors={couleurs}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={{ paddingTop: insets.top + 8 }}
        className="overflow-hidden px-4 pb-4">
        <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: insets.top - 28 }}>
          <MaterialCommunityIcons name={motif} size={190} color={c.sombre ? 'rgba(255,255,255,0.035)' : 'rgba(14,26,43,0.04)'} />
        </View>

        {retour ? (
          // Écran empilé : barre d'actions, puis grand titre en dessous (jamais tronqué par les boutons).
          <>
            <View className="min-h-14 flex-row items-center justify-between gap-2">
              <BoutonVerre icone="arrow-back" libelle="Retour" onPress={() => router.back()} />
              {actions}
            </View>
            <Titre titre={titre} sousTitre={sousTitre} surTitre={surTitre} onTitre={onTitre} libelleTitre={libelleTitre} className="mt-2 px-1" />
          </>
        ) : (
          <View className="min-h-14 flex-row items-center gap-2">
            <Titre titre={titre} sousTitre={sousTitre} surTitre={surTitre} onTitre={onTitre} libelleTitre={libelleTitre} className="flex-1 pl-1" />
            {actions}
          </View>
        )}

        {children ? <View className="mt-4">{children}</View> : null}
      </Degrade>
      <BandeauHorsLigne visible={horsLigne} />
    </View>
  );
}

function Titre({
  titre,
  sousTitre,
  surTitre,
  onTitre,
  libelleTitre,
  className,
}: {
  titre: string;
  sousTitre?: string;
  surTitre?: string;
  onTitre?: () => void;
  libelleTitre?: string;
  className: string;
}) {
  const c = useCouleurs();
  return (
    <View className={className}>
      {surTitre ? (
        <Texte poids="moyen" ton="secondaire" className="text-sm" numberOfLines={1}>
          {surTitre}
        </Texte>
      ) : null}
      {onTitre ? (
        <Pressable
          onPress={onTitre}
          accessibilityRole="button"
          accessibilityLabel={libelleTitre ?? titre}
          hitSlop={8}
          className="mt-0.5 flex-row items-center gap-1.5 self-start active:opacity-70">
          <Texte poids="titre-gras" className="shrink text-[34px] leading-[40px]" numberOfLines={1}>
            {titre}
          </Texte>
          <Ionicons name="chevron-down" size={22} color={c.encre2} />
        </Pressable>
      ) : (
        <Texte poids="titre-gras" className="text-[34px] leading-[40px]" numberOfLines={2} accessibilityRole="header">
          {titre}
        </Texte>
      )}
      {sousTitre ? (
        <Texte poids="moyen" ton="secondaire" className="text-sm" numberOfLines={1}>
          {sousTitre}
        </Texte>
      ) : null}
    </View>
  );
}

/** Bouton rond en relief (carte, filet et ombre douce) posé sur le voile de l'en-tête. */
export function BoutonVerre({ icone, libelle, onPress }: { icone: NomIcone; libelle: string; onPress: () => void }) {
  const c = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      hitSlop={4}
      onPress={onPress}
      style={{ boxShadow: c.ombre.carte }}
      className="size-12 items-center justify-center rounded-full border border-contour bg-carte active:scale-95 active:bg-carte-enfoncee">
      <Ionicons name={icone} size={22} color={c.encre} />
    </Pressable>
  );
}

/** Pastille chiffrée pour le contenu d'un en-tête (nombre de tiroirs, d'aliments…). */
export function PuceVerre({ icone, texte }: { icone: NomIcone; texte: string }) {
  const c = useCouleurs();
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-contour bg-carte/80 px-3 py-1.5">
      <Ionicons name={icone} size={14} color={c.encre2} />
      <Texte poids="demi" ton="secondaire" className="text-xs">
        {texte}
      </Texte>
    </View>
  );
}
