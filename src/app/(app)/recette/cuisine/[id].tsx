import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ASSIETTE } from '@/composants/recette';
import { Bouton, Carte, Compteur, EtatVide, Separateur, Texte } from '@/composants/ui';
import { emojiPourNom } from '@/domaine/emoji';
import { pasPourUnite } from '@/domaine/quantites';
import { adapterQuantite, analyserRecette, trouverRecette, type LigneRecette } from '@/domaine/recettes';
import { formaterQuantite, suffixeUnite } from '@/domaine/texte';
import type { Aliment } from '@/domaine/types';
import { useDonnees } from '@/services/donnees-maison';
import { choc, tic } from '@/services/haptique';
import { consommerAliment, type Auteur } from '@/services/inventaire';
import { afficherMessage, lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

/**
 * Mode cuisine : l'écran reste allumé, une étape à la fois en grand, puis
 * « J'ai cuisiné » pour retirer du stock ce qui a servi.
 * Étape 0 = sortir les ingrédients ; 1…n = préparation ; n + 1 = mise à jour du stock.
 */
export default function ModeCuisine() {
  useKeepAwake();
  const { id, portions: portionsTexte } = useLocalSearchParams<{ id: string; portions?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useCouleurs();
  const { aliments } = useDonnees();
  const [etape, setEtape] = useState(0);

  const recette = trouverRecette(id);
  if (!recette) return <EtatVide emoji="🤷" titre="Recette introuvable" />;

  const portions = Number(portionsTexte) || recette.portions;
  const s = analyserRecette(recette, aliments);
  const total = recette.etapes.length;
  const fin = etape > total;

  const aller = (n: number) => {
    tic();
    setEtape(n);
  };

  return (
    <View className="flex-1 bg-fond" style={{ paddingTop: insets.top }}>
      {/* Haut : fermer, nom du plat, progression en segments. */}
      <View className="gap-3 px-4 pb-2 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Quitter le mode cuisine"
            hitSlop={4}
            style={{ boxShadow: c.ombre.carte }}
            className="size-11 items-center justify-center rounded-full border border-contour bg-carte active:scale-95">
            <Ionicons name="close" size={22} color={c.encre} />
          </Pressable>
          <View className="flex-1">
            <Texte poids="titre" className="text-base" numberOfLines={1}>
              {recette.emoji} {recette.nom}
            </Texte>
            <Texte ton="secondaire" className="text-xs" style={{ fontVariant: ['tabular-nums'] }}>
              {etape === 0 ? 'Préparer les ingrédients' : fin ? 'Bon appétit !' : `Étape ${etape} sur ${total}`}
            </Texte>
          </View>
        </View>
        <View className="flex-row gap-1" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total + 1, now: etape }}>
          {Array.from({ length: total + 2 }, (_, i) => (
            <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= etape ? 'bg-frigo-fort' : 'bg-carte-enfoncee'}`} />
          ))}
        </View>
      </View>

      <Animated.View key={etape} entering={FadeIn.duration(220)} className="flex-1">
        {etape === 0 ? (
          <MiseEnPlace lignes={s.lignes} base={recette.portions} portions={portions} />
        ) : fin ? (
          <JaiCuisine lignes={s.lignes} emoji={recette.emoji} fond={ASSIETTE[recette.categorie]} onFini={() => router.back()} />
        ) : (
          <ScrollView contentContainerClassName="grow justify-center gap-6 px-6 py-8">
            <Texte poids="titre-gras" ton="frigo" className="text-[64px] leading-[68px]" style={{ fontVariant: ['tabular-nums'] }}>
              {etape}
            </Texte>
            <Texte className="text-[24px] leading-[34px]" accessibilityLiveRegion="polite">
              {recette.etapes[etape - 1]}
            </Texte>
          </ScrollView>
        )}
      </Animated.View>

      {/* Bas : précédent / suivant (sauf sur l'écran final, qui a ses propres boutons). */}
      {fin ? null : (
        <View className="flex-row gap-3 px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {etape > 0 ? (
            <Pressable
              onPress={() => aller(etape - 1)}
              accessibilityRole="button"
              accessibilityLabel="Étape précédente"
              className="size-[52px] items-center justify-center rounded-[18px] bg-carte-enfoncee active:scale-95">
              <Ionicons name="arrow-back" size={22} color={c.encre} />
            </Pressable>
          ) : null}
          <Bouton
            titre={etape === 0 ? 'C’est parti' : etape === total ? 'J’ai terminé' : 'Étape suivante'}
            icone={etape === total ? 'checkmark' : 'arrow-forward'}
            onPress={() => aller(etape + 1)}
            className="flex-1"
          />
        </View>
      )}
    </View>
  );
}

/** Étape 0 : la liste des ingrédients à sortir, qu'on coche au fur et à mesure. */
function MiseEnPlace({ lignes, base, portions }: { lignes: LigneRecette[]; base: number; portions: number }) {
  const c = useCouleurs();
  const [sortis, setSortis] = useState<Set<number>>(new Set());
  const basculer = (i: number) => {
    tic();
    setSortis((avant) => {
      const apres = new Set(avant);
      if (apres.has(i)) apres.delete(i);
      else apres.add(i);
      return apres;
    });
  };
  return (
    <ScrollView contentContainerClassName="gap-3 px-4 pb-6 pt-4">
      <Texte poids="titre-gras" className="px-1 text-[28px] leading-[34px]" accessibilityRole="header">
        Sors les ingrédients
      </Texte>
      <Texte ton="secondaire" className="px-1 text-base">
        Pour {portions} personne{portions > 1 ? 's' : ''}. Touche chaque ingrédient une fois sur le plan de travail.
      </Texte>
      <Carte className="mt-1 overflow-hidden">
        {lignes.map((l, i) => {
          const fait = sortis.has(i);
          const q = adapterQuantite(l.ingredient.quantite, base, portions);
          return (
            <View key={`${l.ingredient.cle}-${i}`}>
              {i > 0 ? <Separateur /> : null}
              <Pressable
                onPress={() => basculer(i)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: fait }}
                className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-carte-enfoncee">
                <View className={`size-7 items-center justify-center rounded-full border-2 ${fait ? 'border-frigo-fort bg-frigo-fort' : 'border-bordure'}`}>
                  {fait ? <Ionicons name="checkmark" size={17} color={c.blanc} /> : null}
                </View>
                <Texte poids="moyen" className={`flex-1 text-base ${fait ? 'line-through opacity-50' : ''}`}>
                  {l.ingredient.nom}
                  {q ? <Texte ton="secondaire" className="text-base">{`  ${q}`}</Texte> : null}
                </Texte>
                {l.ingredient.optionnel ? (
                  <Texte ton="discret" className="text-xs">
                    facultatif
                  </Texte>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </Carte>
    </ScrollView>
  );
}

/** Aliments de l'inventaire qui ont servi, sans doublon (deux ingrédients peuvent viser le même). */
function alimentsUtilises(lignes: LigneRecette[]): Aliment[] {
  const vus = new Map<string, Aliment>();
  for (const l of lignes) if (l.aliment && !vus.has(l.aliment.id)) vus.set(l.aliment.id, l.aliment);
  return [...vus.values()];
}

/**
 * « J'ai cuisiné » : pour chaque aliment utilisé, ce qu'il en reste (une unité
 * de moins proposée d'office), puis on enregistre d'un coup.
 */
function JaiCuisine({ lignes, emoji, fond, onFini }: { lignes: LigneRecette[]; emoji: string; fond: string; onFini: () => void }) {
  const { maisonId } = useDonnees();
  const moi = useMoi();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };
  const utilises = alimentsUtilises(lignes);
  const [restes, setRestes] = useState<Record<string, number>>(() =>
    Object.fromEntries(utilises.map((a) => [a.id, Math.max(0, Math.round((a.quantite - pasPourUnite(a.unite)) * 1000) / 1000)])),
  );

  const enregistrer = () => {
    const changes = utilises.filter((a) => restes[a.id] !== undefined && restes[a.id] < a.quantite);
    for (const a of changes) lancer(consommerAliment(maisonId, a, restes[a.id], auteur));
    choc();
    afficherMessage(changes.length ? `Stock mis à jour : ${changes.length} aliment${changes.length > 1 ? 's' : ''} ✔` : 'Bon appétit !');
    onFini();
  };

  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-4">
      <View className="items-center gap-3 py-2">
        <View className={`size-28 items-center justify-center rounded-full ${fond}`}>
          <Text className="text-[64px] leading-[76px]" accessible={false}>
            {emoji}
          </Text>
        </View>
        <Texte poids="titre-gras" className="text-center text-[28px] leading-[34px]" accessibilityRole="header">
          Bon appétit !
        </Texte>
        <Texte ton="secondaire" className="text-center text-base">
          {utilises.length ? 'Ajuste ce qu’il reste de chaque aliment utilisé, puis enregistre.' : 'Aucun aliment de la maison n’a servi pour cette recette.'}
        </Texte>
      </View>

      {utilises.length ? (
        <Carte className="overflow-hidden">
          {utilises.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Separateur /> : null}
              <View className="gap-2 px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xl" accessible={false}>
                    {emojiPourNom(a.nom)}
                  </Text>
                  <Texte poids="demi" className="flex-1 text-base" numberOfLines={1}>
                    {a.nom}
                  </Texte>
                  <Texte ton="discret" className="text-xs">
                    avant : {formaterQuantite(a.quantite, a.unite)}
                  </Texte>
                </View>
                <Compteur
                  libelle={`reste de ${a.nom}`}
                  valeur={restes[a.id] ?? a.quantite}
                  onChange={(v) => setRestes((r) => ({ ...r, [a.id]: v }))}
                  max={a.quantite}
                  pas={pasPourUnite(a.unite)}
                  suffixe={suffixeUnite(a.unite)}
                />
              </View>
            </View>
          ))}
        </Carte>
      ) : null}

      <Bouton titre={utilises.length ? 'Enregistrer le stock' : 'Terminer'} icone="checkmark" onPress={enregistrer} />
      {utilises.length ? <Bouton titre="Ne rien changer" variante="discret" onPress={onFini} /> : null}
    </ScrollView>
  );
}
