import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Degrade, libelleType } from '@/composants/appareil';
import { Texte } from '@/composants/ui';
import { etatPeremption } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import type { Aliment, Appareil, Tiroir } from '@/domaine/types';
import { choc, tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

const DUREE_OUVERTURE = 420;
const COULEURS_MAGNETS = ['bg-[#FECDD3]', 'bg-[#BAE6FD]', 'bg-[#D9F99D]'];
/** Proportions de l'appareil dessiné (hauteur / largeur). */
const RATIO = 1.42;

interface Bilan {
  perimes: number;
  proches: number;
}

function bilan(contenu: Aliment[]): Bilan {
  let perimes = 0;
  let proches = 0;
  for (const a of contenu) {
    const e = etatPeremption(a.datePeremption);
    if (e === 'depassee') perimes++;
    else if (e === 'proche') proches++;
  }
  return { perimes, proches };
}

function textePostIt(contenu: Aliment[], { perimes, proches }: Bilan): string {
  if (contenu.length === 0) return 'Vide ! Remplis-moi';
  if (perimes) return `${perimes} périmé${perimes > 1 ? 's' : ''} !`;
  if (proches) return `${proches} à finir vite`;
  return 'Tout est frais ✓';
}

/** Emojis distincts, les aliments à surveiller d'abord. */
function emojisDe(contenu: Aliment[], max: number): string[] {
  const rang = (a: Aliment) => {
    const e = etatPeremption(a.datePeremption);
    return e === 'depassee' ? 0 : e === 'proche' ? 1 : 2;
  };
  const vus = new Set<string>();
  for (const a of [...contenu].sort((x, y) => rang(x) - rang(y))) {
    vus.add(emojiPourNom(a.nom));
    if (vus.size === max) break;
  }
  return [...vus];
}

/**
 * Appareil dessiné, porte fermée : voyant d'état, magnets et post-it.
 * Au toucher, la porte s'ouvre sur les tiroirs éclairés, puis `onOuvrir`.
 * Elle se referme toute seule quand on revient sur l'écran.
 */
export function FrigoIllustre({
  appareil,
  tiroirs,
  contenu,
  largeur,
  onOuvrir,
}: {
  appareil: Appareil;
  tiroirs: Tiroir[];
  contenu: Aliment[];
  largeur: number;
  onOuvrir: () => void;
}) {
  const c = useCouleurs();
  const focalise = useIsFocused();
  const reduit = useReducedMotion();
  const porte = useSharedValue(0);
  const hauteur = Math.round(largeur * RATIO);
  const congelo = appareil.type === 'congelateur';

  // Retour sur l'écran : la porte se referme.
  useEffect(() => {
    if (focalise) porte.set(withTiming(0, { duration: reduit ? 0 : 500, easing: Easing.out(Easing.cubic) }));
  }, [focalise, porte, reduit]);

  const ouvrir = () => {
    choc();
    if (reduit) return onOuvrir();
    porte.set(withTiming(1, { duration: DUREE_OUVERTURE, easing: Easing.inOut(Easing.cubic) }));
    setTimeout(onOuvrir, DUREE_OUVERTURE - 60);
  };

  const stylePorte = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${-porte.value * 102}deg` }],
  }));
  const styleOmbrePorte = useAnimatedStyle(() => ({ opacity: porte.value * 0.35 }));
  const styleLumiere = useAnimatedStyle(() => ({ opacity: porte.value }));

  const b = bilan(contenu);
  const postIt = textePostIt(contenu, b);
  const voyant = b.perimes ? 'bg-rouge' : b.proches ? 'bg-orange' : 'bg-vert';
  const halo = b.perimes ? c.rouge : b.proches ? c.orange : c.vert;
  const magnets = emojisDe(contenu, 3);

  return (
    <Pressable
      onPress={ouvrir}
      accessibilityRole="button"
      accessibilityLabel={`${appareil.nom}, ${libelleType(appareil.type)}, ${contenu.length} aliment${contenu.length > 1 ? 's' : ''}. ${postIt}`}
      accessibilityHint="Ouvre l’appareil"
      style={{ width: largeur }}
      className="items-center">
      <View style={{ width: largeur, height: hauteur }}>
        {/* Intérieur, visible quand la porte s'ouvre */}
        <Degrade
          colors={c.interieur[appareil.type]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ boxShadow: c.ombre.carte }}
          className="absolute inset-0 gap-2 overflow-hidden rounded-[30px] border-[5px] border-carte-enfoncee p-3 pt-5">
          {tiroirs.slice(0, 4).map((t) => (
            <TiroirMiniature key={t.id} contenu={contenu.filter((a) => a.tiroirId === t.id)} />
          ))}
          <Animated.View pointerEvents="none" style={styleLumiere} className="absolute inset-x-0 top-0">
            <Degrade colors={c.lueur} className="h-24" />
          </Animated.View>
        </Degrade>

        {/* Porte */}
        <Animated.View style={[{ transformOrigin: 'left center', boxShadow: c.ombre.relief }, stylePorte]} className="absolute inset-0 rounded-[30px]">
          <Degrade
            colors={c.carrosserie[appareil.type]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="flex-1 overflow-hidden rounded-[30px] border border-contour">
            {/* Liseré lumineux sur le chant de la porte */}
            <View pointerEvents="none" className="absolute inset-0 rounded-[29px] border border-vitre-bord" />
            <Degrade colors={c.reflet} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.5 }} pointerEvents="none" className="absolute inset-0" />
            {congelo ? <Givre /> : <Joint />}

            {/* Poignées, côté opposé aux charnières */}
            {congelo ? (
              <Poignee style={{ top: '22%', height: '34%' }} />
            ) : (
              <>
                <Poignee style={{ top: '9%', height: '14%' }} />
                <Poignee style={{ top: '36%', height: '30%' }} />
              </>
            )}

            {/* Voyant d'état */}
            <View className="absolute right-3.5 top-3.5 size-5 items-center justify-center rounded-full bg-carte-enfoncee" style={{ boxShadow: 'inset 0 1px 2px rgba(14,26,43,0.18)' }}>
              <View className={`size-2.5 rounded-full ${voyant}`} style={{ boxShadow: `0 0 6px 1px ${halo}` }} />
            </View>

            {/* Magnets */}
            <View className="absolute left-4 flex-row gap-1.5" style={{ top: congelo ? '20%' : '38%' }}>
              {magnets.map((e, i) => (
                <View
                  key={e}
                  className={`size-11 items-center justify-center rounded-full border-2 border-white/70 ${COULEURS_MAGNETS[i]}`}
                  style={{ boxShadow: OMBRE_OBJET, transform: [{ rotate: `${[-10, 7, -4][i]}deg` }, { translateY: [0, 6, -2][i] }] }}>
                  <Text className="text-xl" accessible={false}>
                    {e}
                  </Text>
                </View>
              ))}
            </View>

            {/* Post-it */}
            <View className="absolute left-4 w-[62%] rounded-br-[10px] bg-postit px-3 pb-2 pt-3" style={{ bottom: '9%', boxShadow: OMBRE_OBJET, transform: [{ rotate: '-4deg' }] }}>
              <View className="absolute -top-1.5 left-1/2 -ml-5 h-3.5 w-10 bg-white/45" style={{ transform: [{ rotate: '3deg' }] }} />
              <Text className="font-manuscrit text-xl leading-6 text-postit-encre" numberOfLines={2}>
                {postIt}
              </Text>
            </View>

            <Animated.View pointerEvents="none" style={styleOmbrePorte} className="absolute inset-0 bg-black" />
          </Degrade>
        </Animated.View>
      </View>

      {/* Pieds et ombre au sol */}
      <View className="w-full flex-row justify-between px-[18%]">
        <View className="h-2 w-6 rounded-b-md bg-encre-3/50" />
        <View className="h-2 w-6 rounded-b-md bg-encre-3/50" />
      </View>
      <View className="-mt-0.5 h-2.5 w-[86%] rounded-full bg-black/10" />

      <View className="mt-3 items-center gap-0.5 px-2">
        <Texte poids="titre" className="text-lg leading-6" numberOfLines={1}>
          {appareil.nom}
        </Texte>
        <View className="flex-row items-center gap-1.5">
          {congelo ? (
            <MaterialCommunityIcons name="snowflake" size={14} color={c.congelateurTexte} />
          ) : (
            <MaterialCommunityIcons name="fridge-outline" size={14} color={c.frigoTexte} />
          )}
          <Texte ton="secondaire" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
            {contenu.length} aliment{contenu.length > 1 ? 's' : ''} · {tiroirs.length} tiroir{tiroirs.length > 1 ? 's' : ''}
          </Texte>
        </View>
      </View>
    </Pressable>
  );
}

/** Emplacement pointillé « nouvel appareil », aux mêmes dimensions. */
export function FrigoFantome({ largeur, onPress }: { largeur: number; onPress: () => void }) {
  const c = useCouleurs();
  return (
    <Pressable
      onPress={() => {
        tic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Ajouter un appareil"
      style={{ width: largeur }}
      className="items-center active:scale-[0.98]">
      <View
        style={{ width: largeur, height: Math.round(largeur * RATIO) }}
        className="items-center justify-center gap-3 rounded-[30px] border-2 border-dashed border-encre-3/40 bg-carte/40">
        <View style={{ boxShadow: c.ombre.carte }} className="size-14 items-center justify-center rounded-full border border-contour bg-carte">
          <Ionicons name="add" size={28} color={c.frigoTexte} />
        </View>
        <Texte poids="titre" ton="secondaire" className="text-center text-base leading-5">
          Ajouter{'\n'}un appareil
        </Texte>
      </View>
      <View className="h-2" />
      <View className="mt-3 h-10" />
    </Pressable>
  );
}

function TiroirMiniature({ contenu }: { contenu: Aliment[] }) {
  const emojis = emojisDe(contenu, 4);
  const reste = contenu.length - emojis.length;
  return (
    <View className="flex-1 flex-row items-center justify-center gap-1 rounded-[12px] border border-vitre-bord bg-vitre px-2">
      {emojis.map((e) => (
        <Text key={e} className="text-lg" accessible={false}>
          {e}
        </Text>
      ))}
      {reste > 0 && <Texte className="text-xs" ton="secondaire">+{reste}</Texte>}
    </View>
  );
}

/** Ombre portée des objets collés sur la porte (magnets, post-it). */
const OMBRE_OBJET = '0 1px 1px rgba(14,26,43,0.10), 0 4px 10px rgba(14,26,43,0.14)';

/** Joint entre le compartiment haut et la porte principale du frigo : creux + reflet. */
function Joint() {
  return (
    <View pointerEvents="none" className="absolute inset-x-0" style={{ top: '30%' }}>
      <View className="h-px bg-black/15" />
      <View className="h-px bg-vitre-bord" />
    </View>
  );
}

function Poignee({ style }: { style: { top: `${number}%`; height: `${number}%` } }) {
  return (
    <View
      className="absolute right-3 w-2 rounded-full bg-poignee"
      style={[style, { boxShadow: 'inset 1px 1px 1px rgba(255,255,255,0.55), 1px 2px 4px rgba(14,26,43,0.16)' }]}
    />
  );
}

/** Givre sur le haut de la porte du congélateur. */
function Givre() {
  const c = useCouleurs();
  return (
    <>
      <Degrade colors={c.givrePorte} className="absolute inset-x-0 top-0 h-20" />
      {[
        { left: '12%', top: '5%', s: 16 },
        { left: '38%', top: '3%', s: 11 },
        { left: '60%', top: '7%', s: 14 },
        { left: '24%', top: '11%', s: 9 },
      ].map((f, i) => (
        <View key={i} pointerEvents="none" className="absolute" style={{ left: f.left as `${number}%`, top: f.top as `${number}%` }}>
          <MaterialCommunityIcons name="snowflake" size={f.s} color={c.flocon} />
        </View>
      ))}
    </>
  );
}
