import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { Degrade } from '@/composants/appareil';
import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { FrigoFantome, FrigoIllustre } from '@/composants/frigo';
import { CarteRecette, CarteRecetteDuJour } from '@/composants/recette';
import { Bouton, BoutonFlottant, Carte, Chargement, EtatVide, Texte } from '@/composants/ui';
import { calculerListeCourses, compterArticles } from '@/domaine/courses';
import { emojiPourNom } from '@/domaine/emoji';
import { RECETTES, estPrete, recetteDuJour, suggererRecettes, type Suggestion } from '@/domaine/recettes';
import { cequiPartLePlusVite, JOURS_STATS, type Tendance } from '@/domaine/statistiques';
import { changerDeMaison } from '@/services/changer-maison';
import { useConsommations } from '@/services/consommations';
import { useDonnees } from '@/services/donnees-maison';
import { useMaisons } from '@/services/maisons';
import { useMoi } from '@/services/session';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

const ESPACE_FRIGOS = 20;
const LARGEUR_RECETTE = 156;

/** Raccourcis « Envie de… » : ouvrent l'onglet Recettes sur un filtre. */
const ENVIES: { filtre: string; libelle: string; emoji: string }[] = [
  { filtre: 'rapides', libelle: 'Rapide', emoji: '⏱️' },
  { filtre: 'soupe', libelle: 'Soupe', emoji: '🍲' },
  { filtre: 'salade', libelle: 'Salade', emoji: '🥗' },
  { filtre: 'plat', libelle: 'Plat', emoji: '🍽️' },
  { filtre: 'dessert', libelle: 'Dessert', emoji: '🍰' },
  { filtre: 'petit-dej', libelle: 'Petit-déj', emoji: '🥐' },
];

export default function Maison() {
  const router = useRouter();
  const { maisonId, maison, appareils, tiroirs, aliments, libres, chargement } = useDonnees();
  const tendances = cequiPartLePlusVite(useConsommations(maisonId));
  const { adhesions, maisonActiveId, choisirMaison } = useMaisons();
  const { width } = useWindowDimensions();
  const largeurFrigo = Math.min(240, Math.round(width * 0.6));
  const suggestions = useMemo(() => suggererRecettes(aliments, new Date(), RECETTES), [aliments]);
  const aRacheter = compterArticles(calculerListeCourses(aliments, appareils, libres));

  const nouvelAppareil = () => router.push('/appareil/editer');
  const changer = () => changerDeMaison(adhesions, maisonActiveId, choisirMaison, maison?.nom);

  return (
    <View className="flex-1 bg-fond">
      <ScrollView contentContainerClassName="grow pb-32">
        <EnTeteAccueil nomMaison={maison?.nom ?? 'Ma maison'} onChanger={changer} />

        {chargement ? (
          <Chargement />
        ) : appareils.length === 0 ? (
          <EtatVide emoji="🧊" titre="Aucun appareil pour l’instant" texte="Ajoute ton frigo ou ton congélateur, avec ses tiroirs, pour commencer l’inventaire.">
            <Bouton titre="Ajouter un appareil" icone="add" onPress={nouvelAppareil} className="mt-2" />
          </EtatVide>
        ) : (
          <View className="gap-8 pt-2">
            {/* 1. Qu'est-ce qu'on mange ? : la raison d'ouvrir l'appli. */}
            <Animated.View entering={FadeInDown.duration(350)}>
              <QuOnMange suggestions={suggestions} enStock={aliments.some((a) => a.quantite > 0)} />
            </Animated.View>

            {/* 2. Les appareils, porte fermée : on touche pour ouvrir. */}
            <View className="gap-1">
              <TitreBloc titre="Mes appareils" />
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
            </View>

            {/* 3. Les courses, en une ligne. */}
            <View className="px-4">
              <LigneCourses nombre={aRacheter} onPress={() => router.push('/courses')} />
            </View>

            <Animated.View entering={FadeInDown.duration(350).delay(200)} className="px-4">
              <CarteTendances tendances={tendances} />
            </Animated.View>
          </View>
        )}
      </ScrollView>
      {!chargement && tiroirs.length > 0 && <BoutonFlottant libelle="Ajouter un aliment" texte="Aliment" onPress={() => router.push('/aliment/editer')} />}
    </View>
  );
}

/** Titre de bloc de l'accueil, avec une action discrète à droite. */
function TitreBloc({ titre, action, onAction, nombre }: { titre: string; action?: string; onAction?: () => void; nombre?: number }) {
  return (
    <View className="flex-row items-center justify-between gap-3 px-4">
      <View className="flex-row items-center gap-2">
        <Texte poids="titre" className="text-xl" accessibilityRole="header">
          {titre}
        </Texte>
        {nombre ? (
          <View className="min-w-6 items-center rounded-full bg-frigo-pale px-2 py-0.5">
            <Texte poids="demi" ton="frigo" className="text-xs" style={{ fontVariant: ['tabular-nums'] }}>
              {nombre}
            </Texte>
          </View>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={12} className="min-h-12 justify-center active:opacity-60">
          <Texte poids="demi" ton="frigo" className="text-sm">
            {action}
          </Texte>
        </Pressable>
      ) : null}
    </View>
  );
}

/** En-tête givré : salutation, maison active (touchable pour changer), avatar (réglages) et recherche. */
function EnTeteAccueil({ nomMaison, onChanger }: { nomMaison: string; onChanger: () => void }) {
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
      {/* Fausse barre de recherche : ouvre l'écran Recherche, clavier prêt. */}
      <Pressable
        onPress={() => router.push({ pathname: '/recherche', params: { focus: '1' } })}
        accessibilityRole="search"
        accessibilityLabel="Chercher un aliment dans la maison"
        style={{ boxShadow: c.ombre.carte }}
        className="min-h-[52px] flex-row items-center gap-2 rounded-2xl border border-contour bg-carte px-4 active:scale-[0.99] active:bg-carte-enfoncee">
        <Ionicons name="search" size={20} color={c.encre3} />
        <Texte ton="discret" className="flex-1 text-base">
          Chercher dans la maison
        </Texte>
      </Pressable>
    </EnTeteDegrade>
  );
}

/**
 * « Qu'est-ce qu'on mange ? » : la recette du jour, les raccourcis « Envie de… »,
 * puis les recettes prêtes et celles où il ne manque qu'un ingrédient.
 */
function QuOnMange({ suggestions, enStock }: { suggestions: Suggestion[]; enStock: boolean }) {
  const router = useRouter();
  const c = useCouleurs();
  const duJour = recetteDuJour(suggestions);
  const autres = suggestions.filter((s) => s !== duJour);
  const pretes = autres.filter(estPrete).slice(0, 10);
  const presque = autres.filter((s) => s.manquants.length === 1).slice(0, 10);
  const voirRecettes = (filtre: string) => {
    tic();
    router.push({ pathname: '/recettes', params: { filtre } });
  };

  return (
    <View className="gap-6">
      <View className="gap-3">
        <TitreBloc titre="Qu’est-ce qu’on mange ?" />
        <View className="px-4">
          {duJour ? (
            <CarteRecetteDuJour suggestion={duJour} />
          ) : (
            <Carte className="flex-row items-center gap-3 p-4">
              <View className="size-11 items-center justify-center rounded-[14px] bg-frigo-pale">
                <Ionicons name="restaurant-outline" size={21} color={c.frigoTexte} />
              </View>
              <View className="flex-1">
                <Texte poids="titre" className="text-base">
                  {enStock ? 'Pas encore d’idée avec ce que tu as' : 'Ton inventaire est vide'}
                </Texte>
                <Texte ton="secondaire" className="text-sm">
                  {enStock ? 'Parcours les recettes : il manque souvent peu de chose.' : 'Ajoute des aliments : les recettes faisables apparaîtront ici.'}
                </Texte>
              </View>
            </Carte>
          )}
        </View>
        {/* Envie de… : un toucher ouvre les recettes du genre choisi. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-1">
          {ENVIES.map((e) => (
            <Pressable
              key={e.filtre}
              onPress={() => voirRecettes(e.filtre)}
              accessibilityRole="button"
              accessibilityLabel={`Envie de : ${e.libelle}`}
              style={{ boxShadow: c.ombre.carte }}
              className="h-11 flex-row items-center gap-1.5 rounded-full border border-contour bg-carte px-4 active:scale-95 active:bg-carte-enfoncee">
              <Text className="text-base" accessible={false}>
                {e.emoji}
              </Text>
              <Texte poids="moyen" className="text-sm">
                {e.libelle}
              </Texte>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {pretes.length > 0 ? (
        <CarrouselRecettes titre="Prêtes à cuisiner" nombre={suggestions.filter(estPrete).length} suggestions={pretes} onTout={() => voirRecettes('pretes')} />
      ) : null}
      {presque.length > 0 ? <CarrouselRecettes titre="Il manque un ingrédient" suggestions={presque} onTout={() => voirRecettes('presque')} /> : null}
    </View>
  );
}

/** Rangée de recettes qui défile, avec « Tout voir » vers l'onglet Recettes. */
function CarrouselRecettes({ titre, nombre, suggestions, onTout }: { titre: string; nombre?: number; suggestions: Suggestion[]; onTout: () => void }) {
  return (
    <View className="gap-1">
      <TitreBloc titre={titre} nombre={nombre} action="Tout voir" onAction={onTout} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4 pb-3 pt-2"
        snapToInterval={LARGEUR_RECETTE + 12}
        decelerationRate="fast">
        {suggestions.map((s) => (
          <CarteRecette key={s.recette.id} suggestion={s} largeur={LARGEUR_RECETTE} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Ligne « Courses » : combien d'articles manquent, touche pour ouvrir la liste. */
function LigneCourses({ nombre, onPress }: { nombre: number; onPress: () => void }) {
  const c = useCouleurs();
  return (
    <Pressable
      onPress={() => {
        tic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={nombre ? `${nombre} article${nombre > 1 ? 's' : ''} à racheter, ouvrir la liste de courses` : 'Liste de courses'}
      style={{ boxShadow: c.ombre.carte }}
      className="min-h-[72px] flex-row items-center gap-3 rounded-[20px] border border-contour bg-carte px-4 py-3 active:scale-[0.99] active:bg-carte-enfoncee">
      <View className="size-11 items-center justify-center rounded-[14px] bg-courses-pale">
        <Ionicons name="cart" size={21} color={c.coursesTexte} />
      </View>
      <View className="flex-1">
        <Texte poids="titre" className="text-lg leading-6">
          {nombre ? `${nombre} article${nombre > 1 ? 's' : ''} à racheter` : 'Tout est plein'}
        </Texte>
        <Texte ton="secondaire" className="text-sm">
          {nombre ? 'Ta liste de courses est prête' : 'Rien à racheter pour l’instant'}
        </Texte>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.encre3} />
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
