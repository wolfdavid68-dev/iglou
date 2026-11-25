import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Texte, type NomIcone, type Ton } from "@/composants/ui";
import {
  LIBELLES_CATEGORIE,
  estPrete,
  formaterDuree,
  type Categorie,
  type Suggestion,
} from "@/domaine/recettes";
import { basculerFavori, useFavoris } from "@/services/favoris";
import { tic } from "@/services/haptique";
import { useCouleurs } from "@/theme";

/** Assiette teintée par catégorie : chaque famille de plats a sa couleur douce. */
export const ASSIETTE: Record<Categorie, string> = {
  plat: "bg-courses-pale",
  soupe: "bg-orange-pale",
  salade: "bg-vert-pale",
  entree: "bg-frigo-pale",
  accompagnement: "bg-congelateur-pale",
  dessert: "bg-rouge-pale",
  "petit-dej": "bg-orange-pale",
};

/** Ce qu'il reste à acheter, en clair. */
export function etatRecette(s: Suggestion): string {
  if (estPrete(s)) return "Tout est là";
  const n = s.manquants.length;
  return n === 1
    ? `Il manque ${s.manquants[0].nom.toLowerCase()}`
    : `Il manque ${n} ingrédients`;
}

function libelleAccessible(s: Suggestion, favori: boolean) {
  const r = s.recette;
  return `${r.nom}, ${LIBELLES_CATEGORIE[r.categorie].toLowerCase()}, ${formaterDuree(r.minutes)}${r.healthy ? ", healthy" : ""}. ${etatRecette(s)}${favori ? ". Favori" : ""}`;
}

const ouvrir = (router: ReturnType<typeof useRouter>, id: string) => {
  tic();
  router.push({ pathname: "/recette/[id]", params: { id } });
};

/** Cœur des favoris, posé sur l'assiette. */
export function BoutonFavori({
  id,
  taille = "petit",
}: {
  id: string;
  taille?: "petit" | "grand";
}) {
  const c = useCouleurs();
  const favori = useFavoris().has(id);
  const grand = taille === "grand";
  return (
    <Pressable
      onPress={() => {
        tic();
        basculerFavori(id);
      }}
      accessibilityRole="button"
      accessibilityLabel={
        favori ? "Retirer des favoris" : "Ajouter aux favoris"
      }
      accessibilityState={{ selected: favori }}
      hitSlop={8}
      style={{ boxShadow: c.ombre.carte }}
      className={`${grand ? "size-12" : "size-9"} items-center justify-center rounded-full bg-carte active:scale-90`}
    >
      <Ionicons
        name={favori ? "heart" : "heart-outline"}
        size={grand ? 24 : 19}
        color={favori ? c.rougeTexte : c.encre2}
      />
    </Pressable>
  );
}

/** Repère d'une carte (durée, personnes) : petite icône et texte. */
export function Repere({
  icone,
  texte,
  ton = "secondaire",
}: {
  icone: NomIcone;
  texte: string;
  ton?: Ton;
}) {
  const c = useCouleurs();
  const couleur =
    ton === "vert" ? c.vertTexte : ton === "frigo" ? c.frigoTexte : c.encre3;
  return (
    <View className="shrink flex-row items-center gap-1">
      <Ionicons name={icone} size={14} color={couleur} />
      <Texte
        poids={ton === "secondaire" ? "normal" : "moyen"}
        ton={ton}
        className="shrink text-[13px]"
        numberOfLines={1}
      >
        {texte}
      </Texte>
    </View>
  );
}

/** Pastille d'état posée sur l'assiette : « Tout est là » ou ce qui manque. */
function PastilleEtat({ s }: { s: Suggestion }) {
  const c = useCouleurs();
  const prete = estPrete(s);
  return (
    <View
      className="max-w-full flex-row items-center gap-1 self-start rounded-full bg-carte px-2.5 py-1"
      style={{ boxShadow: c.ombre.carte }}
    >
      <Ionicons
        name={prete ? "checkmark-circle" : "cart-outline"}
        size={14}
        color={prete ? c.vertTexte : c.encre2}
      />
      <Texte
        poids="demi"
        ton={prete ? "vert" : "secondaire"}
        className="shrink text-xs"
        numberOfLines={1}
      >
        {prete ? "Tout est là" : `Il manque ${s.manquants.length}`}
      </Texte>
    </View>
  );
}

/**
 * Carte de recette façon magazine : grande assiette teintée avec l'emoji du
 * plat, le cœur et l'état, puis le nom et la durée. Pour les grilles et les
 * carrousels (largeur fixée par le parent).
 */
export function CarteRecette({
  suggestion: s,
  largeur,
}: {
  suggestion: Suggestion;
  largeur?: number;
}) {
  const router = useRouter();
  const c = useCouleurs();
  const favori = useFavoris().has(s.recette.id);
  const r = s.recette;
  // Le cœur est posé à côté de la carte touchable, pas dedans (pas de bouton dans un bouton).
  return (
    <View style={largeur ? { width: largeur } : undefined}>
      <Pressable
        onPress={() => ouvrir(router, r.id)}
        accessibilityRole="button"
        accessibilityLabel={libelleAccessible(s, favori)}
        className="gap-2.5 active:scale-[0.98] active:opacity-90"
      >
        <View
          style={{ boxShadow: c.ombre.carte }}
          className={`aspect-square items-center justify-center overflow-hidden rounded-[24px] border border-contour ${ASSIETTE[r.categorie]}`}
        >
          {/* L'assiette : un disque clair sous l'emoji. */}
          <View className="size-[64%] items-center justify-center rounded-full bg-carte/70">
            <Text className="text-[52px] leading-[64px]" accessible={false}>
              {r.emoji}
            </Text>
          </View>
          <View className="absolute bottom-2.5 left-2.5 right-2.5">
            <PastilleEtat s={s} />
          </View>
        </View>
        <View className="gap-1 px-1">
          <Texte
            poids="titre"
            className="text-[16px] leading-[21px]"
            numberOfLines={2}
          >
            {r.nom}
          </Texte>
          <View className="flex-row items-center gap-3">
            <Repere icone="time-outline" texte={formaterDuree(r.minutes)} />
            {r.healthy ? (
              <Repere icone="leaf-outline" texte="Healthy" ton="vert" />
            ) : null}
          </View>
        </View>
      </Pressable>
      <View className="absolute right-2.5 top-2.5">
        <BoutonFavori id={r.id} />
      </View>
    </View>
  );
}

/** La recette du jour : grande carte, assiette à gauche, invitation à cuisiner. */
export function CarteRecetteDuJour({
  suggestion: s,
}: {
  suggestion: Suggestion;
}) {
  const router = useRouter();
  const c = useCouleurs();
  const favori = useFavoris().has(s.recette.id);
  const r = s.recette;
  const prete = estPrete(s);
  return (
    <View>
      <Pressable
        onPress={() => ouvrir(router, r.id)}
        accessibilityRole="button"
        accessibilityLabel={`Recette du jour : ${libelleAccessible(s, favori)}`}
        style={{ boxShadow: c.ombre.carte }}
        className="overflow-hidden rounded-[28px] border border-contour bg-carte active:scale-[0.99]"
      >
        <View
          className={`h-44 items-center justify-center ${ASSIETTE[r.categorie]}`}
        >
          <View className="size-36 items-center justify-center rounded-full bg-carte/70">
            <Text className="text-[84px] leading-[100px]" accessible={false}>
              {r.emoji}
            </Text>
          </View>
          <View
            className="absolute left-4 top-4 rounded-full bg-carte px-3 py-1.5"
            style={{ boxShadow: c.ombre.carte }}
          >
            <Texte poids="demi" ton="frigo" className="text-xs">
              Recette du jour
            </Texte>
          </View>
        </View>
        <View className="gap-3 p-4">
          <View className="gap-1">
            <Texte
              poids="titre-gras"
              className="text-[24px] leading-[30px]"
              numberOfLines={2}
            >
              {r.nom}
            </Texte>
            <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
              <Repere icone="time-outline" texte={formaterDuree(r.minutes)} />
              <Repere icone="people-outline" texte={`${r.portions} pers.`} />
              {r.healthy ? (
                <Repere icone="leaf-outline" texte="Healthy" ton="vert" />
              ) : null}
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <View className="shrink flex-row items-center gap-1.5">
              <Ionicons
                name={prete ? "checkmark-circle" : "cart-outline"}
                size={18}
                color={prete ? c.vertTexte : c.encre2}
              />
              <Texte
                poids="moyen"
                ton={prete ? "vert" : "secondaire"}
                className="shrink text-sm"
                numberOfLines={1}
              >
                {etatRecette(s)}
              </Texte>
            </View>
            <View className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-frigo-fort px-4">
              <Texte poids="demi" ton="blanc" className="text-sm">
                Cuisiner
              </Texte>
              <Ionicons name="arrow-forward" size={16} color={c.blanc} />
            </View>
          </View>
        </View>
      </Pressable>
      <View className="absolute right-4 top-4">
        <BoutonFavori id={r.id} />
      </View>
    </View>
  );
}
