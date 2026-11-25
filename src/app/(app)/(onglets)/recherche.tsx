import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type TextStyle } from 'react-native';

import { ApercuAliment } from '@/composants/aliment';
import { IconeAppareil } from '@/composants/appareil';
import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { Carte, ChampRecherche, Separateur, Texte, type NomIcone } from '@/composants/ui';
import { aConsommerEnPriorite, rechercher, type ResultatRecherche } from '@/domaine/inventaire';
import type { Appareil } from '@/domaine/types';
import { prendreAliment } from '@/services/actions-aliment';
import { useDonnees } from '@/services/donnees-maison';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

const CHIFFRES: TextStyle = { fontVariant: ['tabular-nums'] };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Résultats regroupés par appareil, dans l'ordre de pertinence du premier résultat de chacun. */
function grouperParAppareil(resultats: ResultatRecherche[], appareils: Appareil[]) {
  const groupes = new Map<string, { appareil: Appareil | undefined; resultats: ResultatRecherche[] }>();
  for (const r of resultats) {
    const id = r.aliment.appareilId;
    if (!groupes.has(id)) groupes.set(id, { appareil: appareils.find((a) => a.id === id), resultats: [] });
    groupes.get(id)!.resultats.push(r);
  }
  return [...groupes.entries()].map(([id, g]) => ({ id, ...g }));
}

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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 px-4 pb-8 pt-3">
            <EnTeteGroupe
              tuile={
                <View className="size-9 items-center justify-center rounded-xl bg-orange-pale">
                  <Ionicons name="time-outline" size={20} color={c.orangeTexte} />
                </View>
              }
              titre="À consommer en priorité"
              nombre={priorites.length}
            />
            <Texte ton="secondaire" className="-mt-1 px-1 text-sm">
              {pluriel(priorites.length, 'aliment')} {priorites.length > 1 ? 'périmés ou bientôt périmés' : 'périmé ou bientôt périmé'}, du plus urgent au moins urgent.
            </Texte>
            <Carte className="overflow-hidden">
              {priorites.map((r, i) => (
                <View key={r.aliment.id}>
                  {i > 0 && <Separateur />}
                  <LigneResultat resultat={r} />
                </View>
              ))}
            </Carte>
          </ScrollView>
        ) : aliments.length ? (
          <EtatVideIcone
            icone="search"
            titre="Où est passé le beurre ?"
            texte={`Tape un nom pour le retrouver parmi les ${aliments.length} aliments de la maison.`}
          />
        ) : (
          <EtatVideIcone icone="cube-outline" titre="Inventaire vide" texte="Ajoute des aliments dans tes appareils pour pouvoir les retrouver ici." />
        )
      ) : resultats.length === 0 ? (
        <EtatVideIcone icone="help-circle-outline" titre="Aucun résultat" texte={`Rien ne correspond à « ${saisie.trim()} » dans la maison.`} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 px-4 pb-8 pt-3">
          <Texte ton="secondaire" className="-mb-3 px-1 text-sm" style={CHIFFRES} accessibilityLiveRegion="polite">
            {pluriel(resultats.length, 'résultat')}
          </Texte>
          {grouperParAppareil(resultats, appareils).map((g) => (
            <View key={g.id} className="gap-3">
              <EnTeteGroupe
                tuile={g.appareil ? <IconeAppareil type={g.appareil.type} taille="petite" /> : null}
                titre={g.appareil?.nom ?? 'Appareil inconnu'}
                nombre={g.resultats.length}
              />
              <Carte className="overflow-hidden">
                {g.resultats.map((r, i) => (
                  <View key={r.aliment.id}>
                    {i > 0 && <Separateur />}
                    <LigneResultat resultat={r} dansGroupe />
                  </View>
                ))}
              </Carte>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function EnTeteGroupe({ tuile, titre, nombre }: { tuile: ReactNode; titre: string; nombre: number }) {
  return (
    <View className="flex-row items-center gap-3 px-1" accessibilityRole="header">
      {tuile}
      <Texte poids="titre" className="flex-1 text-lg" numberOfLines={1}>
        {titre}
      </Texte>
      <Texte poids="moyen" ton="discret" className="text-sm" style={CHIFFRES}>
        {nombre}
      </Texte>
    </View>
  );
}

/**
 * Ligne d'aliment : aperçu (emoji, stock, jauge) et emplacement. Dans un groupe
 * d'appareil, seul le tiroir est rappelé ; sinon, l'appareil et le tiroir.
 */
function LigneResultat({ resultat, dansGroupe = false }: { resultat: ResultatRecherche; dansGroupe?: boolean }) {
  const router = useRouter();
  const c = useCouleurs();
  const { maisonId, appareils, tiroirs } = useDonnees();
  const moi = useMoi();
  const aliment = resultat.aliment;
  const appareil = appareils.find((a) => a.id === aliment.appareilId);
  const tiroir = tiroirs.find((t) => t.id === aliment.tiroirId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${aliment.nom}, ${resultat.emplacement}`}
      onPress={() =>
        prendreAliment(maisonId, aliment, { uid: moi.uid, prenom: moi.prenom }, () => router.push({ pathname: '/aliment/[id]', params: { id: aliment.id } }))
      }
      className="min-h-16 flex-row items-center gap-3 py-3 pl-4 pr-3 active:bg-carte-enfoncee">
      <View className="flex-1 gap-1.5">
        <ApercuAliment aliment={aliment} />
        <View className="flex-row items-center gap-1.5 pl-9">
          {!dansGroupe && appareil ? (
            <MiniIcone icone={appareil.type === 'congelateur' ? 'snowflake' : 'fridge-outline'} couleur={appareil.type === 'congelateur' ? c.congelateurTexte : c.frigoTexte} />
          ) : null}
          <Texte ton="secondaire" className="flex-1 text-sm" numberOfLines={1}>
            {dansGroupe ? (tiroir?.nom ?? resultat.emplacement) : resultat.emplacement}
          </Texte>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.encre3} />
    </Pressable>
  );
}

const MiniIcone = ({ icone, couleur }: { icone: ComponentProps<typeof MaterialCommunityIcons>['name']; couleur: string }) => (
  <MaterialCommunityIcons name={icone} size={15} color={couleur} />
);

/** État vide : icône dans une tuile teintée (pas d'emoji d'interface). */
function EtatVideIcone({ icone, titre, texte }: { icone: NomIcone; titre: string; texte: string }) {
  const c = useCouleurs();
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <View className="mb-1 size-16 items-center justify-center rounded-[20px] bg-frigo-pale">
        <Ionicons name={icone} size={30} color={c.frigoTexte} />
      </View>
      <Texte poids="titre" className="text-center text-xl" accessibilityRole="header">
        {titre}
      </Texte>
      <Texte ton="secondaire" className="text-center text-base">
        {texte}
      </Texte>
    </View>
  );
}
