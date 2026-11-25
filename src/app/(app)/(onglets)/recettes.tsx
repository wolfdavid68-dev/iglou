import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, useWindowDimensions, View } from 'react-native';

import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { CarteRecette } from '@/composants/recette';
import { Bouton, ChampRecherche, Puce, Texte } from '@/composants/ui';
import { RECETTES, analyserRecettes, estPrete, rechercherRecettes, suggererRecettes, type Categorie, type Suggestion } from '@/domaine/recettes';
import { useDonnees } from '@/services/donnees-maison';
import { useFavoris } from '@/services/favoris';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

type Filtre = 'pretes' | 'presque' | 'favoris' | 'rapides' | 'healthy' | Categorie | 'toutes';

const FILTRES: { valeur: Filtre; libelle: string; emoji?: string }[] = [
  { valeur: 'pretes', libelle: 'Prêtes' },
  { valeur: 'presque', libelle: 'Il manque peu' },
  { valeur: 'favoris', libelle: 'Favoris', emoji: '❤️' },
  { valeur: 'rapides', libelle: 'Rapides', emoji: '⏱️' },
  { valeur: 'healthy', libelle: 'Healthy', emoji: '🥦' },
  { valeur: 'plat', libelle: 'Plats', emoji: '🍽️' },
  { valeur: 'soupe', libelle: 'Soupes', emoji: '🍲' },
  { valeur: 'salade', libelle: 'Salades', emoji: '🥗' },
  { valeur: 'entree', libelle: 'Entrées', emoji: '🥟' },
  { valeur: 'accompagnement', libelle: 'Accompagnements', emoji: '🥔' },
  { valeur: 'dessert', libelle: 'Desserts', emoji: '🍰' },
  { valeur: 'petit-dej', libelle: 'Petit-déj', emoji: '🥐' },
  { valeur: 'toutes', libelle: 'Toutes' },
];

/** « Rapide » : prête en 20 minutes au plus. */
const MINUTES_RAPIDE = 20;
const ESPACE = 12;

const estFiltre = (v: string | undefined): v is Filtre => FILTRES.some((f) => f.valeur === v);

const VIDES: Record<string, string> = {
  pretes: 'Aucune recette n’a tous ses ingrédients chez toi pour l’instant. Regarde celles où il en manque peu !',
  presque: 'Rien d’approchant avec ce qu’il y a chez toi. Parcours toutes les recettes !',
  favoris: 'Touche le cœur d’une recette pour la retrouver ici.',
};

/** Le carnet de recettes : tout le catalogue, les plus faisables avec ce qu'on a d'abord. */
export default function EcranRecettes() {
  const c = useCouleurs();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { aliments } = useDonnees();
  const favoris = useFavoris();
  // `?filtre=soupe` : raccourci « Envie de… » de l'accueil.
  const { filtre: filtreDemande } = useLocalSearchParams<{ filtre?: string }>();
  const [filtre, setFiltre] = useState<Filtre>(estFiltre(filtreDemande) ? filtreDemande : 'pretes');
  const [saisie, setSaisie] = useState('');
  // Nouveau raccourci reçu : il remplace le filtre (ajustement pendant le rendu, sans effet).
  const [demandeVue, setDemandeVue] = useState(filtreDemande);
  if (filtreDemande !== demandeVue) {
    setDemandeVue(filtreDemande);
    if (estFiltre(filtreDemande)) {
      setFiltre(filtreDemande);
      setSaisie('');
    }
  }
  // Puis on l'efface de l'adresse : le même raccourci pourra resservir.
  useEffect(() => {
    if (filtreDemande) router.setParams({ filtre: undefined });
  }, [filtreDemande, router]);

  const tout = useMemo(() => analyserRecettes(aliments, new Date(), RECETTES), [aliments]);
  const faisables = useMemo(() => new Set(suggererRecettes(aliments, new Date(), RECETTES).map((s) => s.recette.id)), [aliments]);

  const garder = (f: Filtre, s: Suggestion): boolean => {
    const r = s.recette;
    switch (f) {
      case 'pretes':
        return estPrete(s);
      case 'presque':
        return faisables.has(r.id) && !estPrete(s);
      case 'favoris':
        return favoris.has(r.id);
      case 'rapides':
        return r.minutes <= MINUTES_RAPIDE;
      case 'healthy':
        return !!r.healthy;
      case 'toutes':
        return true;
      default:
        return r.categorie === f;
    }
  };

  const recherche = saisie.trim();
  // La recherche porte sur tout le carnet ; les filtres reviennent quand on l'efface.
  const visibles = recherche ? rechercherRecettes(tout, recherche) : tout.filter((s) => garder(filtre, s));
  const largeur = Math.floor((width - 32 - ESPACE) / 2);

  return (
    <View className="flex-1 bg-fond">
      <EnTeteDegrade
        couleurs={c.heroRecettes}
        motif="chef-hat"
        titre="Recettes"
        sousTitre={`${RECETTES.length} recettes, ${tout.filter(estPrete).length} prêtes avec ce que tu as`}
        retour={false}>
        <ChampRecherche valeur={saisie} onChange={setSaisie} placeholder="Gratin, poulet, crêpes…" libelle="Chercher une recette ou un ingrédient" />
      </EnTeteDegrade>

      <FlatList
        key={largeur}
        data={visibles}
        keyExtractor={(s) => s.recette.id}
        numColumns={2}
        columnWrapperStyle={{ gap: ESPACE }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-5 px-4 pb-12 pt-1"
        ListHeaderComponent={
          recherche ? (
            <Texte ton="secondaire" className="px-1 text-sm" accessibilityLiveRegion="polite">
              {visibles.length ? `${visibles.length} recette${visibles.length > 1 ? 's' : ''} pour « ${recherche} »` : ''}
            </Texte>
          ) : (
            // Filtres : une seule rangée qui défile, avec le nombre de recettes de chacun.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4" accessibilityRole="radiogroup">
              {FILTRES.map((f) => (
                <Puce
                  key={f.valeur}
                  compacte
                  emoji={f.emoji}
                  libelle={f.libelle}
                  nombre={f.valeur === 'toutes' ? undefined : tout.filter((s) => garder(f.valeur, s)).length}
                  actif={filtre === f.valeur}
                  accessibilityRole="radio"
                  onPress={() => {
                    if (filtre !== f.valeur) tic();
                    setFiltre(f.valeur);
                  }}
                />
              ))}
            </ScrollView>
          )
        }
        ListEmptyComponent={
          <View className="items-center gap-4 px-6 py-12">
            <Texte poids="titre" className="text-center text-lg">
              {recherche ? 'Aucune recette trouvée' : filtre === 'favoris' ? 'Pas encore de favori' : 'Rien pour l’instant'}
            </Texte>
            <Texte ton="secondaire" className="text-center text-base">
              {recherche ? `Rien ne correspond à « ${recherche} ». Essaie un ingrédient : « poulet », « courgette »…` : (VIDES[filtre] ?? 'Aucune recette dans ce filtre.')}
            </Texte>
            {!recherche && filtre !== 'toutes' ? <Bouton titre="Voir toutes les recettes" variante="secondaire" onPress={() => setFiltre('toutes')} /> : null}
          </View>
        }
        renderItem={({ item }) => <CarteRecette suggestion={item} largeur={largeur} />}
      />
    </View>
  );
}
