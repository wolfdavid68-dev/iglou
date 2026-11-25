import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { EtatVide, Puce, Texte, type NomIcone, type Ton } from '@/composants/ui';
import { RECETTES_REPAS, estPrete, formaterDuree, suggererRecettes, type Suggestion } from '@/domaine/recettes';
import { useDonnees } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

type Filtre = 'toutes' | 'pretes' | 'antigaspi' | 'healthy';

const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' },
  { valeur: 'pretes', libelle: 'Prêtes' },
  { valeur: 'antigaspi', libelle: 'Anti-gaspi' },
  { valeur: 'healthy', libelle: 'Healthy' },
];

const garder = (filtre: Filtre, s: Suggestion) =>
  filtre === 'pretes' ? estPrete(s) : filtre === 'antigaspi' ? s.urgents.length > 0 : filtre === 'healthy' ? !!s.recette.healthy : true;

/** Recettes réalisables avec le contenu du frigo et du congélateur. */
export default function EcranRecettes() {
  const c = useCouleurs();
  const { aliments } = useDonnees();
  const [filtre, setFiltre] = useState<Filtre>('toutes');

  const suggestions = suggererRecettes(aliments, new Date(), RECETTES_REPAS);
  const visibles = suggestions.filter((s) => garder(filtre, s));
  const urgents = new Set(suggestions.flatMap((s) => s.urgents.map((a) => a.nom)));
  const enStock = aliments.some((a) => a.quantite > 0);

  return (
    <View className="flex-1 bg-fond">
      <EnTeteDegrade couleurs={c.heroFrigo} motif="chef-hat" titre="Recettes" sousTitre="Avec ce qu’il y a chez toi" retour={false} />
      {!enStock ? (
        <EtatVide emoji="🍳" titre="Rien à cuisiner pour l’instant" texte="Ajoute des aliments dans ton frigo ou ton congélateur : les idées de recettes apparaîtront ici." />
      ) : suggestions.length === 0 ? (
        <EtatVide emoji="🤔" titre="Pas d’idée pour le moment" texte="Il manque un peu trop d’ingrédients pour proposer une recette. Ajoute quelques produits frais !" />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(s) => s.recette.id}
          contentContainerClassName="gap-3 px-4 pb-10 pt-2"
          ListHeaderComponent={
            <View className="gap-4 pb-1">
              {urgents.size > 0 ? <EncartAntiGaspi noms={[...urgents]} /> : null}
              {/* Filtres : une rangée de puces qui défile, avec le nombre de recettes de chacun. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4" accessibilityRole="radiogroup">
                {FILTRES.map((f) => (
                  <Puce
                    key={f.valeur}
                    compacte
                    libelle={f.libelle}
                    nombre={suggestions.filter((s) => garder(f.valeur, s)).length}
                    actif={filtre === f.valeur}
                    accessibilityRole="radio"
                    onPress={() => {
                      if (filtre !== f.valeur) tic();
                      setFiltre(f.valeur);
                    }}
                  />
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <Texte ton="secondaire" className="px-4 py-10 text-center text-base">
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

/** Ce qu'il faut finir vite : tuile d'icône ambre (état « à finir »), texte à l'encre sur une carte. */
function EncartAntiGaspi({ noms }: { noms: string[] }) {
  const c = useCouleurs();
  const liste = noms.slice(0, 3).join(', ') + (noms.length > 3 ? '…' : '');
  return (
    <View style={{ boxShadow: c.ombre.carte }} className="flex-row items-center gap-4 rounded-[20px] border border-contour bg-carte p-4">
      <View className="size-12 items-center justify-center rounded-2xl bg-orange-pale">
        <Ionicons name="hourglass-outline" size={22} color={c.orangeTexte} />
      </View>
      <View className="flex-1 gap-0.5">
        <Texte poids="titre" className="text-[17px] leading-6">
          À finir en priorité
        </Texte>
        <Texte ton="secondaire" className="text-sm leading-5" numberOfLines={3}>
          Les recettes qui utilisent {liste} passent en premier.
        </Texte>
      </View>
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
      accessibilityLabel={`${s.recette.nom}, ${s.recette.minutes} minutes${s.recette.healthy ? ', healthy' : ''}. ${etat}${
        s.urgents.length ? `. Utilise ${s.urgents.map((a) => a.nom).join(', ')}, à finir` : ''
      }`}
      onPress={() => router.push({ pathname: '/recette/[id]', params: { id: s.recette.id } })}
      style={{ boxShadow: c.ombre.carte }}
      className="flex-row gap-4 rounded-[20px] border border-contour bg-carte p-4 active:scale-[0.98] active:bg-carte-enfoncee">
      <View className={`size-[72px] items-center justify-center rounded-[18px] ${prete ? 'bg-vert-pale' : 'bg-carte-enfoncee'}`}>
        <Text className="text-[40px] leading-[48px]" accessible={false}>
          {s.recette.emoji}
        </Text>
      </View>
      <View className="flex-1 gap-1.5">
        <Texte poids="titre" className="text-[17px] leading-[22px]" numberOfLines={2}>
          {s.recette.nom}
        </Texte>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Meta icone="time-outline" texte={formaterDuree(s.recette.minutes)} />
          <Meta icone="people-outline" texte={`${s.recette.portions} pers.`} />
          {s.recette.healthy ? <Meta icone="leaf-outline" texte="Healthy" ton="vert" /> : null}
        </View>
        {prete ? (
          <Meta icone="checkmark-circle" texte={`Tout est là : ${s.disponibles}/${s.requis} ingrédients`} ton="vert" />
        ) : (
          <Meta icone="cart-outline" texte={`Il manque : ${manque}`} ton="secondaire" lignes={1} />
        )}
        {s.urgents.length > 0 ? <Meta icone="hourglass-outline" texte={`À finir : ${s.urgents.map((a) => a.nom).join(', ')}`} ton="orange" lignes={1} /> : null}
      </View>
    </Pressable>
  );
}

/** Ligne d'information d'une carte : petite icône et texte. */
function Meta({ icone, texte, ton = 'secondaire', lignes }: { icone: NomIcone; texte: string; ton?: Ton; lignes?: number }) {
  const c = useCouleurs();
  const couleur = ton === 'vert' ? c.vertTexte : ton === 'orange' ? c.orangeTexte : c.encre3;
  return (
    <View className="shrink flex-row items-center gap-1">
      <Ionicons name={icone} size={15} color={couleur} />
      <Texte poids={ton === 'vert' || ton === 'orange' ? 'moyen' : 'normal'} ton={ton} className="shrink text-[13px]" numberOfLines={lignes}>
        {texte}
      </Texte>
    </View>
  );
}
