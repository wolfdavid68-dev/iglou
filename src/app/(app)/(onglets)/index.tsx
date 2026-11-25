import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { Degrade } from '@/composants/appareil';
import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { FrigoFantome, FrigoIllustre } from '@/composants/frigo';
import { Bouton, BoutonFlottant, Carte, Chargement, EtatVide, Texte, type NomIcone } from '@/composants/ui';
import { calculerListeCourses, compterArticles } from '@/domaine/courses';
import { emojiPourNom } from '@/domaine/emoji';
import { aConsommerEnPriorite } from '@/domaine/inventaire';
import { cequiPartLePlusVite, JOURS_STATS, type Tendance } from '@/domaine/statistiques';
import { changerDeMaison } from '@/services/changer-maison';
import { useConsommations } from '@/services/consommations';
import { useDonnees } from '@/services/donnees-maison';
import { useMaisons } from '@/services/maisons';
import { useMoi } from '@/services/session';
import { tic } from '@/services/haptique';
import { useCouleurs, type Couleurs } from '@/theme';

const ESPACE_FRIGOS = 20;

export default function Maison() {
  const router = useRouter();
  const { maisonId, maison, appareils, tiroirs, aliments, libres, chargement } = useDonnees();
  const tendances = cequiPartLePlusVite(useConsommations(maisonId));
  const { adhesions, maisonActiveId, choisirMaison } = useMaisons();
  const { width } = useWindowDimensions();
  const largeurFrigo = Math.min(240, Math.round(width * 0.6));

  const nouvelAppareil = () => router.push('/appareil/editer');
  const changer = () => changerDeMaison(adhesions, maisonActiveId, choisirMaison, maison?.nom);

  return (
    <View className="flex-1 bg-fond">
      <ScrollView contentContainerClassName="grow pb-32">
        <EnTeteAccueil
          nomMaison={maison?.nom ?? 'Ma maison'}
          aRacheter={compterArticles(calculerListeCourses(aliments, appareils, libres))}
          aSurveiller={aConsommerEnPriorite(aliments, appareils, tiroirs).length}
          total={aliments.length}
          onChanger={changer}
        />

        {chargement ? (
          <Chargement />
        ) : appareils.length === 0 ? (
          <EtatVide emoji="🧊" titre="Aucun appareil pour l’instant" texte="Ajoute ton frigo ou ton congélateur, avec ses tiroirs, pour commencer l’inventaire.">
            <Bouton titre="Ajouter un appareil" icone="add" onPress={nouvelAppareil} className="mt-2" />
          </EtatVide>
        ) : (
          <View className="gap-2 pt-6">
            <View className="flex-row items-baseline justify-between px-4">
              <Texte poids="titre" className="text-xl" accessibilityRole="header">
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
              contentContainerClassName="px-4 pb-2 pt-3"
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

/** En-tête givré : salutation, maison active (touchable pour changer), réglages et chiffres clés. */
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
  const c = useCouleurs();
  const { prenom } = useMoi();

  return (
    <EnTeteDegrade
      couleurs={c.hero}
      motif="snowflake"
      retour={false}
      titre={nomMaison}
      surTitre={`${salutation()} ${prenom}`}
      onTitre={onChanger}
      libelleTitre={`${nomMaison}, changer de maison`}
      actions={
        // Avatar : initiale du prénom sur la couleur signature, ouvre les réglages.
        <Pressable
          onPress={() => {
            tic();
            router.push('/reglages');
          }}
          accessibilityRole="button"
          accessibilityLabel="Réglages"
          hitSlop={4}
          style={{ boxShadow: c.ombre.carte }}
          className="size-12 items-center justify-center rounded-full border-2 border-carte bg-frigo-fort active:scale-95 active:opacity-90">
          <Texte poids="titre-gras" ton="blanc" className="text-xl leading-6">
            {prenom.charAt(0).toUpperCase()}
          </Texte>
        </Pressable>
      }>
      <View className="flex-row gap-3">
        <TuileChiffre valeur={aRacheter} libelle="à racheter" icone="cart-outline" teinte="courses" onPress={() => router.push('/courses')} />
        <TuileChiffre
          valeur={aSurveiller}
          libelle="à surveiller"
          icone="time-outline"
          teinte="orange"
          onPress={aSurveiller ? () => router.push('/recherche') : undefined}
        />
        <TuileChiffre valeur={total} libelle={total > 1 ? 'aliments' : 'aliment'} icone="nutrition-outline" teinte="frigo" />
      </View>
    </EnTeteDegrade>
  );
}

/** Teintes des tuiles chiffrées (classes écrites en entier pour Tailwind). */
const TEINTES_TUILE = {
  courses: { pale: 'bg-courses-pale', icone: (c: Couleurs) => c.coursesTexte },
  orange: { pale: 'bg-orange-pale', icone: (c: Couleurs) => c.orangeTexte },
  frigo: { pale: 'bg-frigo-pale', icone: (c: Couleurs) => c.frigoTexte },
} as const;

/** Chiffre clé de l'en-tête ; le chevron signale les tuiles qui ouvrent un écran. */
function TuileChiffre({
  valeur,
  libelle,
  icone,
  teinte,
  onPress,
}: {
  valeur: number;
  libelle: string;
  icone: NomIcone;
  teinte: keyof typeof TEINTES_TUILE;
  onPress?: () => void;
}) {
  const c = useCouleurs();
  const t = TEINTES_TUILE[teinte];
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tic();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${valeur} ${libelle}`}
      style={{ boxShadow: c.ombre.carte }}
      className={`flex-1 gap-2 rounded-[20px] border border-contour bg-carte p-3 ${onPress ? 'active:scale-[0.98] active:bg-carte-enfoncee' : ''}`}>
      <View className="flex-row items-center justify-between">
        <View className={`size-8 items-center justify-center rounded-[10px] ${t.pale}`}>
          <Ionicons name={icone} size={17} color={t.icone(c)} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={c.encre3} /> : null}
      </View>
      <View>
        <Texte poids="titre-gras" className="text-[28px] leading-8" style={{ fontVariant: ['tabular-nums'] }}>
          {valeur}
        </Texte>
        <Texte poids="moyen" ton="secondaire" className="text-[13px] leading-4" numberOfLines={1}>
          {libelle}
        </Texte>
      </View>
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
    <Carte className="gap-4 p-4">
      <View className="flex-row items-center gap-3">
        <View className="size-11 items-center justify-center rounded-[14px] bg-courses-pale">
          <Ionicons name="trending-up" size={22} color={c.coursesTexte} />
        </View>
        <View className="flex-1">
          <Texte poids="titre" className="text-lg leading-6" accessibilityRole="header">
            Ce qui part le plus vite
          </Texte>
          <Texte ton="discret" className="text-xs">
            {JOURS_STATS} derniers jours
          </Texte>
        </View>
      </View>

      {tendances.length === 0 ? (
        <Texte ton="secondaire" className="text-sm leading-5">
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
              <View className="size-9 items-center justify-center rounded-[12px] bg-carte-enfoncee">
                <Text className="text-lg" accessible={false}>
                  {emojiPourNom(t.nom)}
                </Text>
              </View>
              <View className="flex-1 gap-1.5">
                <View className="flex-row items-baseline justify-between gap-2">
                  <Texte poids="moyen" className="shrink text-sm" numberOfLines={1}>
                    {t.nom}
                  </Texte>
                  <Texte poids="demi" ton={i === 0 ? 'courses' : 'secondaire'} className="text-xs" style={{ fontVariant: ['tabular-nums'] }}>
                    {t.sorties}×
                  </Texte>
                </View>
                {/* Barre : le premier en pleine couleur, les suivants plus discrets. */}
                <View className="h-2 overflow-hidden rounded-full bg-carte-enfoncee">
                  <Degrade
                    colors={i === 0 ? [c.courses, c.coursesFort] : [c.courses, c.courses]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className={`h-full rounded-full ${i === 0 ? '' : 'opacity-45'}`}
                    style={{ width: `${Math.max(8, (t.sorties / record) * 100)}%` }}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Carte>
  );
}
