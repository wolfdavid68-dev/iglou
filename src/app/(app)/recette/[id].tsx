import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Bouton, Carte, EnTete, EtatVide, Ligne, Pastille, Separateur, Texte, TitreSection } from '@/composants/ui';
import { etatPeremption } from '@/domaine/dates';
import {
  LIBELLES_CATEGORIE,
  analyserRecette,
  formaterDuree,
  manquantsAAjouter,
  trouverRecette,
  type LigneRecette,
} from '@/domaine/recettes';
import { useDonnees } from '@/services/donnees-maison';
import { ajouterLibres, type Auteur } from '@/services/inventaire';
import { afficherMessage, lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

/** Fiche d'une recette : ce qu'on a, ce qui manque, et les étapes. */
export default function FicheRecette() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { maisonId, appareils, tiroirs, aliments, libres } = useDonnees();
  const moi = useMoi();
  const c = useCouleurs();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };

  const recette = trouverRecette(id);
  if (!recette) {
    return (
      <View className="flex-1 bg-fond">
        <EnTete titre="Recette" />
        <EtatVide emoji="🤷" titre="Recette introuvable" />
      </View>
    );
  }

  const s = analyserRecette(recette, aliments);
  const aAjouter = manquantsAAjouter(s, aliments, libres);
  const emplacement = (l: LigneRecette) => {
    if (!l.aliment) return undefined;
    const appareil = appareils.find((a) => a.id === l.aliment!.appareilId);
    const tiroir = tiroirs.find((t) => t.id === l.aliment!.tiroirId);
    return `${appareil?.nom ?? '?'} › ${tiroir?.nom ?? '?'}`;
  };

  const ajouterAuxCourses = () => {
    lancer(ajouterLibres(maisonId, aAjouter.map((i) => i.nom), auteur));
    afficherMessage(`${aAjouter.length} article${aAjouter.length > 1 ? 's' : ''} ajouté${aAjouter.length > 1 ? 's' : ''} aux courses ✔`);
  };

  // Ce qu'on a d'abord, puis ce qui manque, puis le placard.
  const frais = s.lignes.filter((l) => !l.ingredient.placard);
  const placard = s.lignes.filter((l) => l.ingredient.placard);

  return (
    <View className="flex-1 bg-fond">
      <EnTete titre={recette.nom} sousTitre={LIBELLES_CATEGORIE[recette.categorie]} />
      <ScrollView contentContainerClassName="px-4 pb-10">
        <Carte className="items-center gap-3 p-5">
          <Text className="text-6xl" accessible={false}>
            {recette.emoji}
          </Text>
          <Texte poids="gras" className="text-center text-xl">
            {recette.nom}
          </Texte>
          <View className="flex-row flex-wrap justify-center gap-2">
            <Pastille fond="bg-carte-enfoncee" ton="secondaire" texte={`⏱ ${formaterDuree(recette.minutes)}`} />
            <Pastille fond="bg-carte-enfoncee" ton="secondaire" texte={`👥 ${recette.portions} pers.`} />
            <Pastille
              fond={s.manquants.length ? 'bg-courses-pale' : 'bg-vert-pale'}
              ton={s.manquants.length ? 'courses' : 'vert'}
              texte={s.manquants.length ? `Il manque ${s.manquants.length} ingrédient${s.manquants.length > 1 ? 's' : ''}` : 'Tout est là ✓'}
            />
          </View>
          {s.urgents.length > 0 ? (
            <View className="w-full flex-row items-center gap-3 rounded-2xl bg-orange-pale p-3">
              <Texte className="text-2xl">♻️</Texte>
              <Texte ton="secondaire" className="flex-1 text-sm">
                Parfait pour finir {s.urgents.map((a) => a.nom).join(', ')} avant qu’il ne soit trop tard.
              </Texte>
            </View>
          ) : null}
        </Carte>

        <TitreSection>Ingrédients</TitreSection>
        <Carte className="overflow-hidden p-0">
          {frais.map((l, i) => (
            <Fragment key={`${l.ingredient.cle}-${i}`}>
              {i > 0 ? <Separateur /> : null}
              <LigneIngredient ligne={l} emplacement={emplacement(l)} />
            </Fragment>
          ))}
        </Carte>

        {s.manquants.length > 0 ? (
          aAjouter.length > 0 ? (
            <Bouton
              titre={`Ajouter ${aAjouter.length === 1 ? 'le manquant' : `les ${aAjouter.length} manquants`} aux courses`}
              icone="cart"
              fond="bg-courses"
              onPress={ajouterAuxCourses}
              className="mt-3"
            />
          ) : (
            <View className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-courses-pale p-3">
              <Ionicons name="cart" size={18} color={c.courses} />
              <Texte ton="courses" poids="moyen" className="text-sm">
                Déjà dans la liste de courses
              </Texte>
            </View>
          )
        ) : null}

        {placard.length > 0 ? (
          <>
            <TitreSection>Du placard</TitreSection>
            <Texte ton="secondaire" className="px-1 pb-2 text-sm">
              {placard.map((l) => (l.ingredient.quantite ? `${l.ingredient.nom.toLowerCase()} (${l.ingredient.quantite})` : l.ingredient.nom.toLowerCase())).join(' · ')}
            </Texte>
          </>
        ) : null}

        <TitreSection>Préparation</TitreSection>
        <Carte className="gap-4 p-4">
          {recette.etapes.map((etape, i) => (
            <View key={i} className="flex-row gap-3">
              <View className="size-7 items-center justify-center rounded-full bg-frigo-pale">
                <Texte poids="gras" ton="frigo" className="text-sm">
                  {i + 1}
                </Texte>
              </View>
              <Texte className="flex-1 text-base leading-6">{etape}</Texte>
            </View>
          ))}
        </Carte>
      </ScrollView>
    </View>
  );
}

function LigneIngredient({ ligne: l, emplacement }: { ligne: LigneRecette; emplacement?: string }) {
  const router = useRouter();
  const c = useCouleurs();
  const { ingredient, aliment } = l;
  const titre = ingredient.quantite ? `${ingredient.nom} · ${ingredient.quantite}` : ingredient.nom;

  if (aliment) {
    const etat = etatPeremption(aliment.datePeremption);
    return (
      <Ligne
        icone="checkmark-circle"
        couleurIcone={c.vert}
        titre={titre}
        sousTitre={`${aliment.nom} · ${emplacement}`}
        onPress={() => router.push({ pathname: '/aliment/[id]', params: { id: aliment.id } })}
        droite={
          l.urgent ? (
            <Pastille fond={etat === 'depassee' ? 'bg-rouge-pale' : 'bg-orange-pale'} ton={etat === 'depassee' ? 'rouge' : 'orange'} texte={etat === 'depassee' ? 'Périmé' : 'À finir'} />
          ) : undefined
        }
      />
    );
  }
  return (
    <Ligne
      icone={ingredient.optionnel ? 'ellipse-outline' : 'close-circle'}
      couleurIcone={ingredient.optionnel ? c.encre3 : c.courses}
      titre={titre}
      sousTitre={ingredient.optionnel ? 'Facultatif' : 'À acheter'}
    />
  );
}
