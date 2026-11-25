import { useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abonnerFeuille, feuilleCourante, repondreFeuille } from '@/services/feuille';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';
import { BoutonIcone, Separateur, Texte } from './ui';

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
          className="max-h-[80%] w-full max-w-lg self-center rounded-t-[28px] border border-b-0 border-contour bg-fond"
          style={{ paddingBottom: insets.bottom + 12, boxShadow: c.ombre.relief }}
          onPress={() => {}}
          accessibilityViewIsModal>
          <View className="items-center pt-2.5">
            <View className="h-1 w-10 rounded-full bg-bordure" />
          </View>
          <View className="flex-row items-center gap-2 pb-1 pl-5 pr-2 pt-2">
            <Texte poids="titre-gras" className="flex-1 text-[22px] leading-7" accessibilityRole="header" numberOfLines={2}>
              {f.titre}
            </Texte>
            <BoutonIcone icone="close" libelle="Fermer" couleur={c.encre2} onPress={() => repondreFeuille(null)} />
          </View>
          <ScrollView contentContainerClassName="gap-4 px-4 pb-2 pt-2">
            {f.sections.map((s, i) => (
              <View key={s.titre ?? i} className="gap-2">
                {s.titre ? (
                  <Texte poids="demi" ton="secondaire" className="px-1 text-sm" numberOfLines={1}>
                    {s.titre}
                  </Texte>
                ) : null}
                {/* Les options d'une section forment une seule liste groupée. */}
                <View style={{ boxShadow: c.ombre.carte }} className="overflow-hidden rounded-[20px] border border-contour bg-carte">
                  {s.options.map((o, j) => (
                    <View key={j}>
                      {j > 0 ? <Separateur /> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          tic();
                          repondreFeuille(o.valeur);
                        }}
                        className="min-h-14 justify-center px-4 py-3 active:bg-carte-enfoncee">
                        <Texte poids="moyen" className="text-base" numberOfLines={1}>
                          {o.libelle}
                        </Texte>
                        {o.sousTitre ? (
                          <Texte ton="secondaire" className="text-sm" numberOfLines={1}>
                            {o.sousTitre}
                          </Texte>
                        ) : null}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
