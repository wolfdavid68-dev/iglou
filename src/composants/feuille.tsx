import { Ionicons } from '@expo/vector-icons';
import { useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abonnerFeuille, feuilleCourante, repondreFeuille } from '@/services/feuille';
import { useCouleurs } from '@/theme';
import { Texte } from './ui';

const abonner = (cb: () => void) => abonnerFeuille(cb);

/** Affiche la feuille de choix en cours, ancrée en bas de l'écran. */
export function HoteFeuille() {
  const f = useSyncExternalStore(abonner, feuilleCourante, feuilleCourante);
  const insets = useSafeAreaInsets();
  const c = useCouleurs();
  if (!f) return null;
  return (
    <Modal transparent visible animationType="slide" onRequestClose={() => repondreFeuille(null)} statusBarTranslucent>
      <Pressable className="flex-1 justify-end bg-voile" onPress={() => repondreFeuille(null)} accessibilityLabel="Fermer">
        <Pressable
          className="max-h-[80%] w-full max-w-lg self-center rounded-t-3xl bg-carte"
          style={{ paddingBottom: insets.bottom + 8 }}
          onPress={() => {}}
          accessibilityViewIsModal>
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-bordure" />
          </View>
          <View className="flex-row items-center gap-2 py-2 pl-6 pr-2">
            <Texte poids="gras" className="flex-1 text-xl" accessibilityRole="header" numberOfLines={2}>
              {f.titre}
            </Texte>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={() => repondreFeuille(null)}
              className="size-12 items-center justify-center rounded-full active:bg-carte-enfoncee">
              <Ionicons name="close" size={24} color={c.encre2} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="pb-2">
            {f.sections.map((s, i) => (
              <View key={s.titre ?? i}>
                {s.titre ? (
                  <Texte poids="demi" ton="secondaire" className="px-6 pb-1 pt-3 text-xs uppercase tracking-wider" numberOfLines={1}>
                    {s.titre}
                  </Texte>
                ) : null}
                {s.options.map((o, j) => (
                  <Pressable
                    key={j}
                    accessibilityRole="button"
                    onPress={() => repondreFeuille(o.valeur)}
                    className="min-h-12 justify-center px-6 py-3 active:bg-carte-enfoncee">
                    <Texte poids="moyen" className="text-base" numberOfLines={1}>
                      {o.libelle}
                    </Texte>
                    {o.sousTitre ? (
                      <Texte ton="secondaire" className="text-sm" numberOfLines={1}>
                        {o.sousTitre}
                      </Texte>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
