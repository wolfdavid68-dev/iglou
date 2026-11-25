import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { ASSIETTE, CarteRecette, CarteRecetteDuJour } from '@/composants/recette';
import { Bouton, ChampRecherche, Puce, Texte } from '@/composants/ui';
import { RECETTES, analyserRecettes, estPrete, recetteDuJour, rechercherRecettes, suggererRecettes, type Categorie, type Suggestion } from '@/domaine/recettes';
import { useDonnees } from '@/services/donnees-maison';
import { useFavoris } from '@/services/favoris';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

/** Filtre de disponibilité ou de goût ; il se combine avec la catégorie. */
type Filtre = 'pretes' | 'presque' | 'favoris' | 'rapides' | 'healthy' | 'toutes';

const FILTRES: { valeur: Filtre; libelle: string; emoji?: string }[] = [
  { valeur: 'pretes', libelle: 'Prêtes' },
  { valeur: 'presque', libelle: 'Il manque peu' },
  { valeur: 'favoris', libelle: 'Favoris', emoji: '❤️' },
  { valeur: 'rapides', libelle: 'Rapides', emoji: '⏱️' },
  { valeur: 'healthy', libelle: 'Healthy', emoji: '🥦' },
  { valeur: 'toutes', libelle: 'Toutes' },
];

const CATEGORIES: { valeur: Categorie; libelle: string; emoji: string }[] = [
  { valeur: 'plat', libelle: 'Plats', emoji: '🍽️' },
  { valeur: 'salade', libelle: 'Salades', emoji: '🥗' },
  { valeur: 'soupe', libelle: 'Soupes', emoji: '🍲' },
  { valeur: 'entree', libelle: 'Entrées', emoji: '🥟' },
  { valeur: 'accompagnement', libelle: 'Accomp.', emoji: '🥔' },
  { valeur: 'dessert', libelle: 'Desserts', emoji: '🍰' },
  { valeur: 'petit-dej', libelle: 'Petit-déj', emoji: '🥐' },
];

/** « Rapide » : prête en 20 minutes au plus. */
const MINUTES_RAPIDE = 20;
const ESPACE = 12;

const VIDES: Partial<Record<Filtre, string>> = {
  pretes: 'Aucune recette n’a tous ses ingrédients chez toi ici. Regarde celles où il en manque peu !',
  presque: 'Rien d’approchant avec ce qu’il y a chez toi. Parcours toutes les recettes !',
  favoris: 'Touche le cœur d’une recette pour la retrouver ici.',
};

/** Le carnet de recettes : tout le catalogue, les plus faisables avec ce qu'on a d'abord. */
export default function EcranRecettes() {
  const c = useCouleurs();
  const { width } = useWindowDimensions();
  const { aliments } = useDonnees();
  const favoris = useFavoris();
  const [filtre, setFiltre] = useState<Filtre>('pretes');
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [saisie, setSaisie] = useState('');

  const tout = useMemo(() => analyserRecettes(aliments, new Date(), RECETTES), [aliments]);
  const suggestions = useMemo(() => suggererRecettes(aliments, new Date(), RECETTES), [aliments]);
  const faisables = useMemo(() => new Set(suggestions.map((s) => s.recette.id)), [suggestions]);
  const duJour = recetteDuJour(suggestions);

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
    }
  };
  const dansCategorie = (cat: Categorie | null, s: Suggestion) => cat === null || s.recette.categorie === cat;

  const recherche = saisie.trim();
  // La recherche porte sur tout le carnet ; catégorie et filtre reviennent quand on l'efface.
  const visibles = recherche ? rechercherRecettes(tout, recherche) : tout.filter((s) => dansCategorie(categorie, s) && garder(filtre, s));
  const largeur = Math.floor((width - 32 - ESPACE) / 2);
  const nomCategorie = CATEGORIES.find((x) => x.valeur === categorie)?.libelle.toLowerCase();

  const choisirCategorie = (cat: Categorie | null) => {
    tic();
    // Toucher la catégorie déjà choisie la retire.
    setCategorie((avant) => (avant === cat ? null : cat));
  };

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
            <View className="gap-5">
              {/* La recette du jour, en tête du carnet. */}
              {duJour ? <CarteRecetteDuJour suggestion={duJour} /> : null}

              {/* Catégories : des assiettes rondes, comme sur les cartes. */}
              <View className="gap-2">
                <Texte poids="titre" className="px-1 text-xl" accessibilityRole="header">
                  Catégories
                </Texte>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-1 px-3" accessibilityRole="radiogroup">
                  <TuileCategorie
                    libelle="Tout"
                    nombre={tout.filter((s) => garder(filtre, s)).length}
                    actif={categorie === null}
                    onPress={() => choisirCategorie(null)}
                    contenu={<Ionicons name="grid-outline" size={26} color={categorie === null ? c.frigoTexte : c.encre2} />}
                    fond="bg-carte-enfoncee"
                  />
                  {CATEGORIES.map((cat) => (
                    <TuileCategorie
                      key={cat.valeur}
                      libelle={cat.libelle}
                      nombre={tout.filter((s) => dansCategorie(cat.valeur, s) && garder(filtre, s)).length}
                      actif={categorie === cat.valeur}
                      onPress={() => choisirCategorie(cat.valeur)}
                      contenu={
                        <Text className="text-[30px] leading-[38px]" accessible={false}>
                          {cat.emoji}
                        </Text>
                      }
                      fond={ASSIETTE[cat.valeur]}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Filtres : une rangée de puces, avec le nombre de recettes de chacun dans la catégorie choisie. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4" accessibilityRole="radiogroup">
                {FILTRES.map((f) => (
                  <Puce
                    key={f.valeur}
                    compacte
                    emoji={f.emoji}
                    libelle={f.libelle}
                    nombre={f.valeur === 'toutes' ? undefined : tout.filter((s) => dansCategorie(categorie, s) && garder(f.valeur, s)).length}
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
          )
        }
        ListEmptyComponent={
          <View className="items-center gap-4 px-6 py-12">
            <Texte poids="titre" className="text-center text-lg">
              {recherche ? 'Aucune recette trouvée' : filtre === 'favoris' ? 'Pas encore de favori' : 'Rien pour l’instant'}
            </Texte>
            <Texte ton="secondaire" className="text-center text-base">
              {recherche
                ? `Rien ne correspond à « ${recherche} ». Essaie un ingrédient : « poulet », « courgette »…`
                : `${nomCategorie ? `Côté ${nomCategorie} : ` : ''}${VIDES[filtre] ?? 'Aucune recette dans ce filtre.'}`}
            </Texte>
            {!recherche && filtre !== 'toutes' ? <Bouton titre="Voir toutes les recettes" variante="secondaire" onPress={() => setFiltre('toutes')} /> : null}
          </View>
        }
        renderItem={({ item }) => <CarteRecette suggestion={item} largeur={largeur} />}
      />
    </View>
  );
}

/** Tuile de catégorie : assiette ronde teintée, nom et nombre de recettes ; anneau vert quand elle est choisie. */
function TuileCategorie({
  libelle,
  nombre,
  actif,
  onPress,
  contenu,
  fond,
}: {
  libelle: string;
  nombre: number;
  actif: boolean;
  onPress: () => void;
  contenu: ReactNode;
  fond: string;
}) {
  const c = useCouleurs();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      accessibilityLabel={`${libelle}, ${nombre} recette${nombre > 1 ? 's' : ''}`}
      className="w-[76px] items-center gap-1.5 py-1 active:scale-95">
      <View
        style={actif ? undefined : { boxShadow: c.ombre.carte }}
        className={`size-16 items-center justify-center rounded-full border-2 ${actif ? 'border-frigo-fort' : 'border-transparent'} ${fond}`}>
        {contenu}
      </View>
      <Texte poids={actif ? 'demi' : 'moyen'} ton={actif ? 'frigo' : 'encre'} className="text-[13px]" numberOfLines={1}>
        {libelle}
      </Texte>
      <Texte ton="discret" className="-mt-1 text-[11px]" style={{ fontVariant: ['tabular-nums'] }}>
        {nombre}
      </Texte>
    </Pressable>
  );
}
