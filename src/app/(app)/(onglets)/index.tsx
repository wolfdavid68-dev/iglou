import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Degrade } from '@/composants/appareil';
import { FrigoFantome, FrigoIllustre } from '@/composants/frigo';
import { BandeauHorsLigne, Bouton, BoutonFlottant, Chargement, EtatVide, Texte } from '@/composants/ui';
import { calculerListeCourses, compterArticles } from '@/domaine/courses';
import { emojiPourNom } from '@/domaine/emoji';
import { aConsommerEnPriorite } from '@/domaine/inventaire';
import { cequiPartLePlusVite, JOURS_STATS, type Tendance } from '@/domaine/statistiques';
import { changerDeMaison } from '@/services/changer-maison';
import { useConsommations } from '@/services/consommations';
import { useDonnees, useHorsLigne } from '@/services/donnees-maison';
import { useMaisons } from '@/services/maisons';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

const ESPACE_FRIGOS = 20;

export default function Maison() {
  const router = useRouter();
  const { maisonId, maison, appareils, tiroirs, aliments, libres, chargement } = useDonnees();
  const tendances = cequiPartLePlusVite(useConsommations(maisonId));
  const { adhesions, maisonActiveId, choisirMaison } = useMaisons();
  const horsLigne = useHorsLigne();
  const focalise = useIsFocused();
  const { width } = useWindowDimensions();
  const largeurFrigo = Math.min(240, Math.round(width * 0.6));

  const nouvelAppareil = () => router.push('/appareil/editer');
  const changer = () => changerDeMaison(adhesions, maisonActiveId, choisirMaison, maison?.nom);

  return (
    <View className="flex-1 bg-fond">
      {focalise && <StatusBar style="light" />}
      <ScrollView contentContainerClassName="pb-32" contentContainerStyle={{ flexGrow: 1 }}>
        <EnTeteAccueil
          nomMaison={maison?.nom ?? 'Ma maison'}
          aRacheter={compterArticles(calculerListeCourses(aliments, appareils, libres))}
          aSurveiller={aConsommerEnPriorite(aliments, appareils, tiroirs).length}
          total={aliments.length}
          onChanger={changer}
        />
        <BandeauHorsLigne visible={horsLigne} />

        {chargement ? (
          <Chargement />
        ) : appareils.length === 0 ? (
          <EtatVide emoji="🧊" titre="Aucun appareil pour l’instant" texte="Ajoute ton frigo ou ton congélateur, avec ses tiroirs, pour commencer l’inventaire.">
            <Bouton titre="Ajouter un appareil" icone="add" onPress={nouvelAppareil} className="mt-2" />
          </EtatVide>
        ) : (
          <View className="gap-3 pt-6">
            <View className="flex-row items-baseline justify-between px-5">
              <Texte poids="gras" className="text-lg">
                Mes appareils
              </Texte>
              <Texte ton="discret" className="text-sm">
                Touche pour ouvrir
              </Texte>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={largeurFrigo + ESPACE_FRIGOS}
              decelerationRate="fast"
              contentContainerClassName="px-5 pb-2 pt-3"
              contentContainerStyle={{ gap: ESPACE_FRIGOS }}>
              {appareils.map((a, i) => (
                <Animated.View key={a.id} entering={FadeInRight.duration(450).delay(90 * i)}>
                  <FrigoIllustre
                    appareil={a}
                    tiroirs={tiroirs.filter((t) => t.appareilId === a.id)}
                    contenu={aliments.filter((x) => x.appareilId === a.id)}
                    largeur={largeurFrigo}
                    onOuvrir={() => router.push({ pathname: '/appareil/[id]', params: { id: a.id } })}
                  />
                </Animated.View>
              ))}
              <Animated.View entering={FadeInRight.duration(450).delay(90 * appareils.length)}>
                <FrigoFantome largeur={largeurFrigo} onPress={nouvelAppareil} />
              </Animated.View>
            </ScrollView>

            <Animated.View entering={FadeInDown.duration(350).delay(200)} className="mt-3 px-4">
              <CarteTendances tendances={tendances} />
            </Animated.View>
          </View>
        )}
      </ScrollView>
      {!chargement && tiroirs.length > 0 && <BoutonFlottant libelle="Ajouter un aliment" texte="Aliment" onPress={() => router.push('/aliment/editer')} />}
    </View>
  );
}

/** En-tête en dégradé : salutation, maison active (touchable pour changer) et chiffres clés. */
function EnTeteAccueil({
  nomMaison,
  aRacheter,
  aSurveiller,
  total,
  onChanger,
}: {
  nomMaison: string;
  aRacheter: number;
  aSurveiller: number;
  total: number;
  onChanger: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useCouleurs();
  const { prenom } = useMoi();

  return (
    <Degrade colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 16 }} className="overflow-hidden rounded-b-[32px] px-5 pb-6">
      {/* Flocon décoratif */}
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: insets.top - 30 }}>
        <MaterialCommunityIcons name="snowflake" size={200} color="rgba(255,255,255,0.08)" />
      </View>

      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Texte poids="moyen" ton="aucun" className="text-sm text-white/80">
            {salutation()} {prenom} 👋
          </Texte>
          <Pressable
            onPress={onChanger}
            accessibilityRole="button"
            accessibilityLabel={`${nomMaison}, changer de maison`}
            hitSlop={8}
            className="mt-0.5 flex-row items-center gap-1.5 self-start active:opacity-70">
            <Texte poids="gras" ton="blanc" className="shrink text-3xl" numberOfLines={1}>
              {nomMaison}
            </Texte>
            <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.push('/reglages')}
          accessibilityRole="button"
          accessibilityLabel="Réglages"
          className="size-12 items-center justify-center rounded-full border border-white/30 bg-white/20 active:opacity-70">
          <Texte poids="gras" ton="blanc" className="text-lg">
            {prenom.charAt(0).toUpperCase()}
          </Texte>
        </Pressable>
      </View>

      <View className="mt-6 flex-row gap-3">
        <TuileChiffre valeur={aRacheter} libelle="à racheter" icone="cart-outline" onPress={() => router.push('/courses')} />
        <TuileChiffre valeur={aSurveiller} libelle="à surveiller" icone="time-outline" onPress={aSurveiller ? () => router.push('/recherche') : undefined} />
        <TuileChiffre valeur={total} libelle={total > 1 ? 'aliments' : 'aliment'} icone="nutrition-outline" />
      </View>
    </Degrade>
  );
}

function TuileChiffre({ valeur, libelle, icone, onPress }: { valeur: number; libelle: string; icone: keyof typeof Ionicons.glyphMap; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${valeur} ${libelle}`}
      className="flex-1 gap-1 rounded-2xl border border-white/25 bg-white/15 p-3 active:bg-white/25">
      <Ionicons name={icone} size={18} color="rgba(255,255,255,0.85)" />
      <Texte poids="gras" ton="blanc" className="text-2xl">
        {valeur}
      </Texte>
      <Texte poids="moyen" ton="aucun" className="text-xs text-white/85" numberOfLines={1}>
        {libelle}
      </Texte>
    </Pressable>
  );
}

function salutation(heure = new Date().getHours()): string {
  if (heure < 5 || heure >= 18) return 'Bonsoir';
  return 'Bonjour';
}

/** « Ce qui part le plus vite » : les aliments les plus souvent sortis du stock récemment. */
function CarteTendances({ tendances }: { tendances: Tendance[] }) {
  const c = useCouleurs();
  const record = tendances[0]?.sorties ?? 1;

  return (
    <View className="gap-4 rounded-3xl border border-bordure bg-carte p-4 shadow-sm">
      <View className="flex-row items-center gap-3">
        <View className="size-10 items-center justify-center rounded-2xl bg-orange-pale">
          <Ionicons name="flame" size={20} color={c.orange} />
        </View>
        <View className="flex-1">
          <Texte poids="demi" className="text-lg">
            Ce qui part le plus vite
          </Texte>
          <Texte ton="discret" className="text-xs">
            {JOURS_STATS} derniers jours
          </Texte>
        </View>
      </View>

      {tendances.length === 0 ? (
        <Texte ton="secondaire" className="text-sm">
          Touche « − » sur un aliment quand tu en prends : ses sorties apparaîtront ici pour repérer ce qu’il faut racheter le plus souvent.
        </Texte>
      ) : (
        <View className="gap-3">
          {tendances.map((t, i) => (
            <View
              key={t.nom}
              className="flex-row items-center gap-3"
              accessible
              accessibilityLabel={`${i + 1}. ${t.nom}, sorti ${t.sorties} fois`}>
              <Text className="w-7 text-center text-xl" accessible={false}>
                {emojiPourNom(t.nom)}
              </Text>
              <View className="flex-1 gap-1">
                <View className="flex-row items-baseline justify-between gap-2">
                  <Texte poids="moyen" className="shrink text-sm" numberOfLines={1}>
                    {t.nom}
                  </Texte>
                  <Texte poids="demi" ton="secondaire" className="text-xs">
                    {t.sorties}×
                  </Texte>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-carte-enfoncee">
                  <Degrade
                    colors={i === 0 ? [c.orange, c.courses] : c.hero}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(8, (t.sorties / record) * 100)}%` }}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
