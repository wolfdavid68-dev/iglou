import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Bouton, Carte, EnTete, EtatVide, Ligne, Pastille, Separateur, Texte, TitreSection, type NomIcone } from '@/composants/ui';
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
  const enStock = frais.filter((l) => l.aliment);
  const aAcheter = frais.filter((l) => !l.aliment);
  const placard = s.lignes.filter((l) => l.ingredient.placard);

  return (
    <View className="flex-1 bg-fond">
      <EnTete titre={LIBELLES_CATEGORIE[recette.categorie]} />
      <ScrollView contentContainerClassName="px-4 pb-12">
        {/* En-tête du plat : grande tuile douce, nom en police de titre, repères en icônes. */}
        <View className="items-center gap-4 pb-2 pt-3">
          <View style={{ boxShadow: c.ombre.carte }} className="size-32 items-center justify-center rounded-[32px] border border-contour bg-carte">
            <Text className="text-[72px] leading-[88px]" accessible={false}>
              {recette.emoji}
            </Text>
          </View>
          <Texte poids="titre-gras" className="px-2 text-center text-[28px] leading-[34px]" accessibilityRole="header">
            {recette.nom}
          </Texte>
          <View className="flex-row flex-wrap justify-center gap-x-5 gap-y-2">
            <Repere icone="time-outline" texte={formaterDuree(recette.minutes)} />
            <Repere icone="people-outline" texte={`${recette.portions} personne${recette.portions > 1 ? 's' : ''}`} />
            {recette.healthy ? <Repere icone="leaf-outline" texte="Healthy" vert /> : null}
          </View>
          <Pastille
            fond={s.manquants.length ? 'bg-carte-enfoncee' : 'bg-vert-pale'}
            ton={s.manquants.length ? 'secondaire' : 'vert'}
            texte={s.manquants.length ? `Il manque ${s.manquants.length} ingrédient${s.manquants.length > 1 ? 's' : ''}` : 'Tout est là'}
          />
        </View>

        {s.urgents.length > 0 ? (
          <Carte className="mt-4 flex-row items-center gap-4 p-4">
            <View className="size-11 items-center justify-center rounded-2xl bg-orange-pale">
              <Ionicons name="hourglass-outline" size={20} color={c.orangeTexte} />
            </View>
            <Texte ton="secondaire" className="flex-1 text-sm leading-5">
              Parfait pour finir {s.urgents.map((a) => a.nom).join(', ')} avant qu’il ne soit trop tard.
            </Texte>
          </Carte>
        ) : null}

        <TitreSection>Ingrédients</TitreSection>
        {enStock.length > 0 ? (
          <GroupeIngredients titre={`Chez toi (${enStock.length})`}>
            {enStock.map((l, i) => (
              <Fragment key={`${l.ingredient.cle}-${i}`}>
                {i > 0 ? <Separateur /> : null}
                <LigneIngredient ligne={l} emplacement={emplacement(l)} />
              </Fragment>
            ))}
          </GroupeIngredients>
        ) : null}

        {aAcheter.length > 0 ? (
          <GroupeIngredients titre={`À acheter (${aAcheter.length})`} className={enStock.length ? 'mt-5' : ''}>
            {aAcheter.map((l, i) => (
              <Fragment key={`${l.ingredient.cle}-${i}`}>
                {i > 0 ? <Separateur /> : null}
                <LigneIngredient ligne={l} />
              </Fragment>
            ))}
          </GroupeIngredients>
        ) : null}

        {s.manquants.length > 0 ? (
          aAjouter.length > 0 ? (
            <Bouton
              titre={`Ajouter ${aAjouter.length === 1 ? 'le manquant' : `les ${aAjouter.length} manquants`} aux courses`}
              icone="cart-outline"
              onPress={ajouterAuxCourses}
              className="mt-4"
            />
          ) : (
            <View className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-[18px] bg-carte-enfoncee px-4">
              <Ionicons name="checkmark-circle" size={18} color={c.vertTexte} />
              <Texte ton="secondaire" poids="moyen" className="text-sm">
                Déjà dans la liste de courses
              </Texte>
            </View>
          )
        ) : null}

        {placard.length > 0 ? (
          <GroupeIngredients titre="Du placard" className="mt-5">
            <View className="flex-row flex-wrap gap-2 p-4">
              {placard.map((l, i) => (
                <View key={`${l.ingredient.cle}-${i}`} className="rounded-full bg-carte-enfoncee px-3 py-1.5">
                  <Texte className="text-sm">
                    {l.ingredient.nom}
                    {l.ingredient.quantite ? <Texte ton="secondaire" className="text-sm">{` ${l.ingredient.quantite}`}</Texte> : null}
                  </Texte>
                </View>
              ))}
            </View>
          </GroupeIngredients>
        ) : null}

        <TitreSection>Préparation</TitreSection>
        <Carte className="p-4">
          {recette.etapes.map((etape, i) => (
            <View key={i} className={`flex-row gap-4 ${i > 0 ? 'mt-4 border-t border-contour pt-4' : ''}`}>
              <View className="size-8 items-center justify-center rounded-full bg-frigo-pale">
                <Texte poids="titre-gras" ton="frigo" className="text-[15px]" style={{ fontVariant: ['tabular-nums'] }}>
                  {i + 1}
                </Texte>
              </View>
              <Texte className="flex-1 pt-1 text-base leading-6">{etape}</Texte>
            </View>
          ))}
        </Carte>
      </ScrollView>
    </View>
  );
}

/** Repère du plat (durée, personnes) : icône et texte, sans fond. */
function Repere({ icone, texte, vert = false }: { icone: NomIcone; texte: string; vert?: boolean }) {
  const c = useCouleurs();
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icone} size={18} color={vert ? c.vertTexte : c.encre2} />
      <Texte poids="moyen" ton={vert ? 'vert' : 'secondaire'} className="text-[15px]">
        {texte}
      </Texte>
    </View>
  );
}

/** Sous-groupe d'ingrédients : petit intitulé, puis une seule carte avec séparateurs. */
function GroupeIngredients({ titre, children, className = '' }: { titre: string; children: ReactNode; className?: string }) {
  return (
    <View className={`gap-2 ${className}`}>
      <Texte poids="demi" ton="secondaire" className="px-1 text-sm">
        {titre}
      </Texte>
      <Carte className="overflow-hidden">{children}</Carte>
    </View>
  );
}

function LigneIngredient({ ligne: l, emplacement }: { ligne: LigneRecette; emplacement?: string }) {
  const router = useRouter();
  const c = useCouleurs();
  const { ingredient, aliment } = l;
  const titre = ingredient.quantite ? `${ingredient.nom}, ${ingredient.quantite}` : ingredient.nom;

  if (aliment) {
    const etat = etatPeremption(aliment.datePeremption);
    // Le nom de l'aliment n'est rappelé que s'il diffère de l'ingrédient (« Salade » → « Salade verte »).
    const memeNom = aliment.nom.toLowerCase() === ingredient.nom.toLowerCase();
    return (
      <Ligne
        icone="checkmark-circle"
        couleurIcone={c.vertTexte}
        titre={titre}
        sousTitre={memeNom ? emplacement : `${aliment.nom}, ${emplacement}`}
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
      icone={ingredient.optionnel ? 'ellipse-outline' : 'cart-outline'}
      couleurIcone={c.encre2}
      titre={titre}
      sousTitre={ingredient.optionnel ? 'Facultatif' : 'Pas dans ta cuisine'}
    />
  );
}
