import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { EnTete, EtatVide, Pastille, Segments, Texte } from '@/composants/ui';
import { RECETTES_REPAS, estPrete, formaterDuree, suggererRecettes, type Suggestion } from '@/domaine/recettes';
import { useDonnees } from '@/services/donnees-maison';
import { useCouleurs } from '@/theme';

type Filtre = 'toutes' | 'pretes' | 'antigaspi' | 'healthy';

const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' },
  { valeur: 'pretes', libelle: 'Prêtes' },
  { valeur: 'antigaspi', libelle: 'Anti-gaspi' },
  { valeur: 'healthy', libelle: 'Healthy' },
];

/** Recettes réalisables avec le contenu du frigo et du congélateur. */
export default function EcranRecettes() {
  const { aliments } = useDonnees();
  const [filtre, setFiltre] = useState<Filtre>('toutes');

  const suggestions = suggererRecettes(aliments, new Date(), RECETTES_REPAS);
  const visibles = suggestions.filter((s) =>
    filtre === 'pretes'
      ? estPrete(s)
      : filtre === 'antigaspi'
        ? s.urgents.length > 0
        : filtre === 'healthy'
          ? s.recette.healthy
          : true,
  );
  const urgents = new Set(suggestions.flatMap((s) => s.urgents.map((a) => a.nom)));
  const enStock = aliments.some((a) => a.quantite > 0);

  return (
    <View className="flex-1 bg-fond">
      <EnTete titre="Recettes" sousTitre="Avec ce qu’il y a chez toi" retour={false} />
      {!enStock ? (
        <EtatVide emoji="🍳" titre="Rien à cuisiner pour l’instant" texte="Ajoute des aliments dans ton frigo ou ton congélateur : les idées de recettes apparaîtront ici." />
      ) : suggestions.length === 0 ? (
        <EtatVide emoji="🤔" titre="Pas d’idée pour le moment" texte="Il manque un peu trop d’ingrédients pour proposer une recette. Ajoute quelques produits frais !" />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(s) => s.recette.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          ListHeaderComponent={
            <View className="gap-3 pb-1">
              {urgents.size > 0 ? (
                <View className="flex-row items-center gap-3 rounded-2xl bg-orange-pale p-4">
                  <Texte className="text-3xl">♻️</Texte>
                  <View className="flex-1">
                    <Texte poids="demi" className="text-base">
                      Anti-gaspi
                    </Texte>
                    <Texte ton="secondaire" className="text-sm" numberOfLines={3}>
                      Les recettes qui utilisent {[...urgents].slice(0, 3).join(', ')}
                      {urgents.size > 3 ? '…' : ''} passent en premier.
                    </Texte>
                  </View>
                </View>
              ) : null}
              <Segments options={FILTRES} valeur={filtre} onChange={setFiltre} />
              <Texte ton="secondaire" className="text-sm" accessibilityLiveRegion="polite">
                {visibles.length} recette{visibles.length > 1 ? 's' : ''}
              </Texte>
            </View>
          }
          ListEmptyComponent={
            <Texte ton="secondaire" className="py-8 text-center text-base">
              {filtre === 'pretes'
                ? 'Aucune recette avec tous les ingrédients. Regarde celles où il en manque peu !'
                : filtre === 'healthy'
                  ? 'Pas encore de recette healthy avec ce que tu as. Ajoute des légumes frais !'
                  : 'Rien ne périme bientôt : pas d’urgence anti-gaspi.'}
            </Texte>
          }
          renderItem={({ item }) => <CarteRecette suggestion={item} />}
        />
      )}
    </View>
  );
}

function CarteRecette({ suggestion: s }: { suggestion: Suggestion }) {
  const router = useRouter();
  const c = useCouleurs();
  const prete = estPrete(s);
  const manque = s.manquants.map((i) => i.nom.toLowerCase()).join(', ');
  const etat = prete ? 'Tout est là' : `Il manque : ${manque}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${s.recette.nom}, ${s.recette.minutes} minutes${s.recette.healthy ? ', healthy' : ''}. ${etat}`}
      onPress={() => router.push({ pathname: '/recette/[id]', params: { id: s.recette.id } })}
      className="flex-row items-center gap-3 rounded-2xl border border-bordure bg-carte p-3 active:bg-carte-enfoncee">
      <View className={`size-16 items-center justify-center rounded-2xl ${prete ? 'bg-vert-pale' : 'bg-carte-enfoncee'}`}>
        <Text className="text-4xl" accessible={false}>
          {s.recette.emoji}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <Texte poids="demi" className="text-base" numberOfLines={2}>
          {s.recette.nom}
        </Texte>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={14} color={c.encre3} />
          <Texte ton="discret" className="text-xs">
            {formaterDuree(s.recette.minutes)} · {s.recette.portions} pers.
          </Texte>
          {s.recette.healthy ? (
            <Texte ton="vert" poids="moyen" className="text-xs">
              · 🌿 Healthy
            </Texte>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name={prete ? 'checkmark-circle' : 'cart-outline'} size={14} color={prete ? c.vert : c.courses} />
          <Texte ton={prete ? 'vert' : 'courses'} poids="moyen" className="flex-1 text-xs" numberOfLines={1}>
            {prete ? `Tout est là · ${s.disponibles}/${s.requis} ingrédients` : `Il manque : ${manque}`}
          </Texte>
        </View>
        {s.urgents.length > 0 ? (
          <View className="flex-row">
            <Pastille fond="bg-orange-pale" ton="orange" texte={`♻️ Utilise ${s.urgents.map((a) => a.nom).join(', ')}`} />
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.encre3} />
    </Pressable>
  );
}
