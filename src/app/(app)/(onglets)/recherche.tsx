import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { ApercuAliment } from '@/composants/aliment';
import { IconeAppareil } from '@/composants/appareil';
import { BoutonIcone, EnTete, EtatVide, Texte } from '@/composants/ui';
import { aConsommerEnPriorite, rechercher, type ResultatRecherche } from '@/domaine/inventaire';
import { useDonnees } from '@/services/donnees-maison';
import { useCouleurs } from '@/theme';

/** Recherche globale d'un aliment dans toute la maison. */
export default function EcranRecherche() {
  const c = useCouleurs();
  const { maison, appareils, tiroirs, aliments } = useDonnees();
  const [saisie, setSaisie] = useState('');
  const resultats = rechercher(aliments, appareils, tiroirs, saisie);
  const priorites = aConsommerEnPriorite(aliments, appareils, tiroirs);
  const vide = !saisie.trim();

  return (
    <View className="flex-1 bg-fond">
      <EnTete titre="Recherche" sousTitre={maison?.nom} retour={false} />
      <View className="px-4 pb-3">
        <View className="min-h-12 flex-row items-center gap-2 rounded-xl border border-bordure bg-carte pl-4">
          <Ionicons name="search" size={20} color={c.encre3} />
          <TextInput
            value={saisie}
            onChangeText={setSaisie}
            placeholder="Beurre, steak, petits pois…"
            placeholderTextColor={c.encre3}
            accessibilityLabel="Rechercher un aliment"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 py-3 font-inter text-base text-encre"
          />
          {saisie ? <BoutonIcone icone="close-circle" libelle="Effacer la recherche" onPress={() => setSaisie('')} couleur={c.encre3} taille={20} /> : null}
        </View>
      </View>

      {vide ? (
        priorites.length ? (
          <FlatList
            data={priorites}
            keyExtractor={(r) => r.aliment.id}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 px-4 pb-8"
            ListHeaderComponent={
              <View className="mb-1 flex-row items-center gap-3 rounded-2xl bg-orange-pale p-4">
                <Texte className="text-3xl">⏳</Texte>
                <View className="flex-1">
                  <Texte poids="demi" className="text-base">
                    À consommer en priorité
                  </Texte>
                  <Texte ton="secondaire" className="text-sm">
                    {priorites.length} aliment{priorites.length > 1 ? 's' : ''} périmé{priorites.length > 1 ? 's' : ''} ou bientôt périmé{priorites.length > 1 ? 's' : ''}.
                  </Texte>
                </View>
              </View>
            }
            renderItem={({ item }) => <LigneResultat resultat={item} />}
          />
        ) : aliments.length ? (
          <EtatVide emoji="🔎" titre="Où est passé le beurre ?" texte={`Tape un nom pour le retrouver parmi les ${aliments.length} aliments de la maison.`} />
        ) : (
          <EtatVide emoji="🧊" titre="Inventaire vide" texte="Ajoute des aliments dans tes appareils pour pouvoir les retrouver ici." />
        )
      ) : resultats.length === 0 ? (
        <EtatVide emoji="🤷" titre="Aucun résultat" texte={`Rien ne correspond à « ${saisie.trim()} » dans la maison.`} />
      ) : (
        <FlatList
          data={resultats}
          keyExtractor={(r) => r.aliment.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 px-4 pb-8"
          ListHeaderComponent={
            <Texte ton="secondaire" className="pb-1 text-sm" accessibilityLiveRegion="polite">
              {resultats.length} résultat{resultats.length > 1 ? 's' : ''}
            </Texte>
          }
          renderItem={({ item }) => <LigneResultat resultat={item} />}
        />
      )}
    </View>
  );
}

function LigneResultat({ resultat }: { resultat: ResultatRecherche }) {
  const router = useRouter();
  const c = useCouleurs();
  const { appareils } = useDonnees();
  const appareil = appareils.find((a) => a.id === resultat.aliment.appareilId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${resultat.aliment.nom}, ${resultat.emplacement}`}
      onPress={() => router.push({ pathname: '/aliment/[id]', params: { id: resultat.aliment.id } })}
      className="min-h-16 gap-2 rounded-2xl border border-bordure bg-carte p-3 active:bg-carte-enfoncee">
      <ApercuAliment aliment={resultat.aliment} />
      <View className="flex-row items-center gap-2">
        {appareil ? <IconeAppareil type={appareil.type} taille="petite" /> : null}
        <Texte ton="secondaire" className="flex-1 text-sm" numberOfLines={1}>
          {resultat.emplacement}
        </Texte>
        <Ionicons name="chevron-forward" size={18} color={c.encre3} />
      </View>
    </Pressable>
  );
}
