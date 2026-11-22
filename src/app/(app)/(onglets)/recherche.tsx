import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { ApercuAliment } from '@/composants/aliment';
import { IconeAppareil } from '@/composants/appareil';
import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { ChampRecherche, Encart, EtatVide, Texte } from '@/composants/ui';
import { aConsommerEnPriorite, rechercher, type ResultatRecherche } from '@/domaine/inventaire';
import { prendreAliment } from '@/services/actions-aliment';
import { useDonnees } from '@/services/donnees-maison';
import { useMoi } from '@/services/session';
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
      <EnTeteDegrade couleurs={c.heroFrigo} motif="magnify" titre="Recherche" sousTitre={maison?.nom} retour={false}>
        <ChampRecherche valeur={saisie} onChange={setSaisie} placeholder="Beurre, steak, petits pois…" libelle="Rechercher un aliment" />
      </EnTeteDegrade>

      {vide ? (
        priorites.length ? (
          <FlatList
            data={priorites}
            keyExtractor={(r) => r.aliment.id}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 px-4 pb-8 pt-4"
            ListHeaderComponent={
              <Encart
                emoji="⏳"
                titre="À consommer en priorité"
                texte={`${priorites.length} aliment${priorites.length > 1 ? 's' : ''} périmé${priorites.length > 1 ? 's' : ''} ou bientôt périmé${priorites.length > 1 ? 's' : ''}.`}
                className="mb-1"
              />
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
          contentContainerClassName="gap-2 px-4 pb-8 pt-4"
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
  const { maisonId, appareils } = useDonnees();
  const moi = useMoi();
  const aliment = resultat.aliment;
  const appareil = appareils.find((a) => a.id === aliment.appareilId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${resultat.aliment.nom}, ${resultat.emplacement}`}
      onPress={() =>
        prendreAliment(maisonId, aliment, { uid: moi.uid, prenom: moi.prenom }, () => router.push({ pathname: '/aliment/[id]', params: { id: aliment.id } }))
      }
      className="min-h-16 gap-2 rounded-2xl border border-bordure bg-carte p-4 active:bg-carte-enfoncee">
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
