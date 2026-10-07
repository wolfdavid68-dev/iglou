import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApercuAliment } from '@/composants/aliment';
import { BoutonVerre, EnTeteDegrade, PuceVerre } from '@/composants/en-tete-degrade';
import { Degrade, libelleType } from '@/composants/appareil';
import { Bouton, BoutonIcone, Carte, Champ, Chargement, EnTete, EtatVide, Texte } from '@/composants/ui';
import { etatPeremption } from '@/domaine/dates';
import { alimentsDuTiroir, deplacerDansListe, peutSupprimerTiroir, tiroirsDeLAppareil } from '@/domaine/inventaire';
import type { Aliment, Appareil, Tiroir } from '@/domaine/types';
import { choisirTiroir, deplacerAvecAnnulation, prendreAliment, supprimerAvecAnnulation } from '@/services/actions-aliment';
import { confirmer, demander } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { ajouterTiroir, renommerTiroir, reordonnerTiroirs, supprimerTiroir, type Auteur } from '@/services/inventaire';
import { lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { HAUTEUR_CORBEILLE, classesAppareil, useCouleurs } from '@/theme';

const MAX_TIROIRS = 20;
const LARGEUR_FANTOME = 200;
const CORBEILLE = 'corbeille';

export default function EcranAppareil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useCouleurs();
  const { maisonId, appareils, tiroirs: tousTiroirs, aliments, chargement } = useDonnees();
  const moi = useMoi();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };
  const [gestion, setGestion] = useState(false);

  // Retour Android : quitte d'abord le mode « gérer les tiroirs ».
  useEffect(() => {
    if (!gestion) return;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      setGestion(false);
      return true;
    });
    return () => abonnement.remove();
  }, [gestion]);

  const appareil = appareils.find((a) => a.id === id);
  if (chargement) return <Chargement />;
  if (!appareil) {
    return (
      <View className="flex-1 bg-fond">
        <EnTete titre="Appareil introuvable" />
        <EtatVide emoji="🤷" titre="Cet appareil n’existe plus" texte="Il a peut-être été supprimé par un autre membre de la maison." />
      </View>
    );
  }

  const tiroirs = tiroirsDeLAppareil(tousTiroirs, appareil.id);
  const contenu = aliments.filter((a) => a.appareilId === appareil.id);
  const aSurveiller = contenu.filter((a) => ['depassee', 'proche'].includes(etatPeremption(a.datePeremption) ?? '')).length;

  return (
    <View className="flex-1 bg-fond">
      <EnTeteDegrade
        couleurs={appareil.type === 'congelateur' ? c.heroCongelateur : c.heroFrigo}
        motif={appareil.type === 'congelateur' ? 'snowflake' : 'fridge-outline'}
        titre={gestion ? 'Gérer les tiroirs' : appareil.nom}
        sousTitre={gestion ? appareil.nom : libelleType(appareil.type)}
        actions={
          gestion ? (
            <BoutonVerre icone="checkmark" libelle="Terminer" onPress={() => setGestion(false)} />
          ) : (
            <View className="flex-row gap-2">
              <BoutonVerre icone="options-outline" libelle="Gérer les tiroirs" onPress={() => setGestion(true)} />
              <BoutonVerre
                icone="create-outline"
                libelle="Modifier l’appareil"
                onPress={() => router.push({ pathname: '/appareil/editer', params: { id: appareil.id } })}
              />
            </View>
          )
        }>
        {!gestion && (
          <View className="flex-row flex-wrap gap-2">
            <PuceVerre icone="file-tray-stacked-outline" texte={`${tiroirs.length} tiroir${tiroirs.length > 1 ? 's' : ''}`} />
            <PuceVerre icone="nutrition-outline" texte={`${contenu.length} aliment${contenu.length > 1 ? 's' : ''}`} />
            {aSurveiller > 0 && <PuceVerre icone="time-outline" texte={`${aSurveiller} à consommer vite`} />}
          </View>
        )}
      </EnTeteDegrade>
      {gestion ? (
        <GestionTiroirs maisonId={maisonId} appareil={appareil} tiroirs={tiroirs} aliments={aliments} appareils={appareils} tousTiroirs={tousTiroirs} auteur={auteur} />
      ) : (
        <GrilleTiroirs maisonId={maisonId} appareil={appareil} tiroirs={tiroirs} aliments={aliments} appareils={appareils} tousTiroirs={tousTiroirs} auteur={auteur} />
      )}
    </View>
  );
}

interface PropsSection {
  maisonId: string;
  appareil: Appareil;
  tiroirs: Tiroir[];
  aliments: Aliment[];
  appareils: Appareil[];
  tousTiroirs: Tiroir[];
  auteur: Auteur;
}

/* ---------------------------------------------------------------------------
 * Grille des tiroirs et glisser-déposer
 * ------------------------------------------------------------------------- */

interface Rect {
  id: string;
  x: number;
  y: number;
  l: number;
  h: number;
}

const contient = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.l && y >= r.y && y <= r.y + r.h;

const vibrer = (style: 'debut' | 'survol') => {
  if (Platform.OS === 'web') return;
  if (style === 'debut') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else Haptics.selectionAsync();
};

function GrilleTiroirs({ maisonId, appareil, tiroirs, aliments, appareils, tousTiroirs, auteur }: PropsSection) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useCouleurs();
  const [glisse, setGlisse] = useState<{ aliment: Aliment; cible: string | null } | null>(null);
  const glisseRef = useRef<{ aliment: Aliment; cible: string | null } | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const racine = useRef<View>(null);
  const origine = useRef({ x: 0, y: 0 });
  const vues = useRef(new Map<string, View>());
  const zones = useRef<Rect[]>([]);
  const corbeille = useRef<View>(null);
  const zoneCorbeille = useRef<Rect | null>(null);

  const styleFantome = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - LARGEUR_FANTOME / 2 }, { translateY: y.value - 72 }],
  }));

  const cibleEn = (px: number, py: number): string | null => {
    if (zoneCorbeille.current && contient(zoneCorbeille.current, px, py)) return CORBEILLE;
    return zones.current.find((z) => contient(z, px, py))?.id ?? null;
  };

  const placer = (px: number, py: number) => {
    x.value = px - origine.current.x;
    y.value = py - origine.current.y;
  };

  const debut = (aliment: Aliment, px: number, py: number) => {
    racine.current?.measureInWindow((ox, oy) => {
      origine.current = { x: ox, y: oy };
      placer(px, py);
    });
    zones.current = [];
    vues.current.forEach((vue, tiroirId) =>
      vue.measureInWindow((zx, zy, l, h) => {
        zones.current.push({ id: tiroirId, x: zx, y: zy, l, h });
      }),
    );
    placer(px, py);
    glisseRef.current = { aliment, cible: null };
    setGlisse(glisseRef.current);
    vibrer('debut');
  };

  const bouger = (px: number, py: number) => {
    const g = glisseRef.current;
    if (!g) return;
    placer(px, py);
    let cible = cibleEn(px, py);
    if (cible === g.aliment.tiroirId) cible = null;
    if (cible !== g.cible) {
      glisseRef.current = { ...g, cible };
      setGlisse(glisseRef.current);
      if (cible) vibrer('survol');
    }
  };

  const arreter = () => {
    glisseRef.current = null;
    zoneCorbeille.current = null;
    setGlisse(null);
  };

  const deposer = (px: number, py: number) => {
    const g = glisseRef.current;
    if (!g) return;
    const cible = cibleEn(px, py);
    arreter();
    if (cible === CORBEILLE) {
      supprimerAvecAnnulation(maisonId, g.aliment, auteur);
      return;
    }
    const tiroir = tiroirs.find((t) => t.id === cible);
    if (tiroir) deplacerAvecAnnulation(maisonId, g.aliment, tiroir, tousTiroirs, auteur);
  };

  const deplacerVers = async (a: Aliment) => {
    const cible = await choisirTiroir(`Déplacer « ${a.nom} » vers…`, appareils, tousTiroirs, a.tiroirId);
    if (cible) deplacerAvecAnnulation(maisonId, a, cible, tousTiroirs, auteur);
  };

  return (
    <View ref={racine} collapsable={false} className="flex-1">
      {/* Intérieur de l'appareil, éclairé par le haut */}
      <Degrade colors={c.interieur[appareil.type]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} className="absolute inset-0" />
      <Degrade colors={c.lueur} pointerEvents="none" className="absolute inset-x-0 top-0 h-40" />
      <ScrollView
        scrollEnabled={!glisse}
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + (glisse ? HAUTEUR_CORBEILLE + 48 : 32) }}>
        {tiroirs.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.duration(380).delay(70 * i)}>
            <CarteTiroir
              tiroir={t}
              appareil={appareil}
              contenu={alimentsDuTiroir(aliments, t.id)}
              survole={glisse?.cible === t.id}
              enGlisse={glisse?.aliment.id ?? null}
              enregistrer={(vue) => {
                if (vue) vues.current.set(t.id, vue);
                else vues.current.delete(t.id);
              }}
              onAjouter={() => router.push({ pathname: '/aliment/editer', params: { tiroirId: t.id } })}
              onToucher={(a) => prendreAliment(maisonId, a, auteur, () => router.push({ pathname: '/aliment/[id]', params: { id: a.id } }))}
              onDeplacer={deplacerVers}
              onSupprimer={(a) => supprimerAvecAnnulation(maisonId, a, auteur)}
              glisser={{ debut, bouger, deposer, arreter }}
            />
          </Animated.View>
        ))}
        <View className="flex-row items-center gap-2 px-1 pt-1">
          <Ionicons name="hand-left-outline" size={16} color="#94A3B8" />
          <Texte ton="discret" className="flex-1 text-sm">
            Touche un aliment pour dire combien tu en as pris. Appui long pour le glisser vers un autre tiroir ou la corbeille.
          </Texte>
        </View>
      </ScrollView>

      {glisse && (
        <>
          <View
            ref={corbeille}
            collapsable={false}
            onLayout={() =>
              corbeille.current?.measureInWindow((zx, zy, l, h) => {
                zoneCorbeille.current = { id: CORBEILLE, x: zx, y: zy, l, h };
              })
            }
            pointerEvents="none"
            style={{ height: HAUTEUR_CORBEILLE, bottom: insets.bottom + 16 }}
            className={`absolute left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-rouge ${
              glisse.cible === CORBEILLE ? 'bg-rouge' : 'bg-rouge-pale'
            }`}
            accessibilityLiveRegion="polite">
            <Ionicons name="trash-outline" size={28} color={glisse.cible === CORBEILLE ? '#fff' : '#EF4444'} />
            <Texte poids="demi" ton={glisse.cible === CORBEILLE ? 'blanc' : 'rouge'} className="text-base">
              {glisse.cible === CORBEILLE ? 'Lâcher pour supprimer' : 'Glisser ici pour supprimer'}
            </Texte>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[{ width: LARGEUR_FANTOME }, styleFantome]}
            className="absolute left-0 top-0 rounded-2xl border border-bordure bg-carte p-3 opacity-95 shadow-xl">
            <ApercuAliment aliment={glisse.aliment} compact />
          </Animated.View>
        </>
      )}
    </View>
  );
}

interface Glisser {
  debut: (a: Aliment, x: number, y: number) => void;
  bouger: (x: number, y: number) => void;
  deposer: (x: number, y: number) => void;
  arreter: () => void;
}

function CarteTiroir({
  tiroir,
  appareil,
  contenu,
  survole,
  enGlisse,
  enregistrer,
  onAjouter,
  onToucher,
  onDeplacer,
  onSupprimer,
  glisser,
}: {
  tiroir: Tiroir;
  appareil: Appareil;
  contenu: Aliment[];
  survole: boolean;
  enGlisse: string | null;
  enregistrer: (vue: View | null) => void;
  onAjouter: () => void;
  onToucher: (a: Aliment) => void;
  onDeplacer: (a: Aliment) => void;
  onSupprimer: (a: Aliment) => void;
  glisser: Glisser;
}) {
  const c = useCouleurs();
  const classes = classesAppareil[appareil.type];
  return (
    <View
      ref={enregistrer}
      collapsable={false}
      className={`overflow-hidden rounded-3xl border-2 shadow-sm ${survole ? `${classes.bordure} ${classes.pale}` : 'border-vitre-bord bg-vitre'}`}>
      {/* Bac vitré */}
      <View className="min-h-20 flex-row flex-wrap p-1.5">
        {contenu.length === 0 ? (
          <Texte ton="discret" className="w-full self-center px-2 py-4 text-center text-sm">
            {survole ? 'Lâcher ici' : 'Tiroir vide'}
          </Texte>
        ) : (
          contenu.map((a) => (
            <View key={a.id} className="w-1/2 p-0.5">
              <LigneAliment
                aliment={a}
                masque={enGlisse === a.id}
                onToucher={() => onToucher(a)}
                onDeplacer={() => onDeplacer(a)}
                onSupprimer={() => onSupprimer(a)}
                glisser={glisser}
              />
            </View>
          ))
        )}
      </View>

      {/* Façade du tiroir, avec sa poignée */}
      <View className="flex-row items-center gap-3 border-t border-bordure bg-facade py-1.5 pl-4 pr-1.5">
        <View pointerEvents="none" className="absolute left-1/2 top-1.5 -ml-10 h-1.5 w-20 rounded-full bg-poignee" />
        <Texte poids="demi" className="shrink text-base" numberOfLines={1}>
          {tiroir.nom}
        </Texte>
        <View className={`rounded-full px-2 py-0.5 ${classes.pale}`}>
          <Texte poids="demi" ton={appareil.type} className="text-xs">
            {contenu.length}
          </Texte>
        </View>
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ajouter un aliment dans ${tiroir.nom}`}
          onPress={onAjouter}
          className={`size-12 items-center justify-center rounded-full active:opacity-70 ${classes.pale}`}>
          <Ionicons name="add" size={24} color={appareil.type === 'congelateur' ? c.congelateur : c.frigo} />
        </Pressable>
      </View>
    </View>
  );
}

function LigneAliment({
  aliment,
  masque,
  onToucher,
  onDeplacer,
  onSupprimer,
  glisser,
}: {
  aliment: Aliment;
  masque: boolean;
  onToucher: () => void;
  onDeplacer: () => void;
  onSupprimer: () => void;
  glisser: Glisser;
}) {
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(300)
    .onStart((e) => glisser.debut(aliment, e.absoluteX, e.absoluteY))
    .onUpdate((e) => glisser.bouger(e.absoluteX, e.absoluteY))
    .onEnd((e, reussi) => (reussi ? glisser.deposer(e.absoluteX, e.absoluteY) : glisser.arreter()))
    .onFinalize(() => glisser.arreter());
  const toucher = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_e, reussi) => {
      if (reussi) onToucher();
    });

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, toucher)}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${aliment.nom}, ${aliment.quantite} sur ${aliment.quantiteMax}`}
        accessibilityHint="Indique combien tu en as pris. Appui long pour déplacer."
        accessibilityActions={[
          { name: 'activate' },
          { name: 'deplacer', label: 'Déplacer vers…' },
          { name: 'supprimer', label: 'Supprimer' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'deplacer') onDeplacer();
          else if (e.nativeEvent.actionName === 'supprimer') onSupprimer();
          else onToucher();
        }}
        className={`min-h-12 select-none justify-center rounded-2xl bg-carte/80 px-2 py-1.5 active:bg-carte ${masque ? 'opacity-30' : ''}`}>
        {/* Le contenu laisse passer le toucher : toute la bulle réagit, pas seulement l'emoji. */}
        <View pointerEvents="none" className="flex-1 flex-row">
          <ApercuAliment aliment={aliment} compact />
        </View>
      </View>
    </GestureDetector>
  );
}

/* ---------------------------------------------------------------------------
 * Gestion des tiroirs : renommer, réordonner, ajouter, supprimer
 * ------------------------------------------------------------------------- */

function GestionTiroirs({ maisonId, appareil, tiroirs, aliments, appareils, tousTiroirs, auteur }: PropsSection) {
  const insets = useSafeAreaInsets();

  const ajouter = () => {
    const noms = new Set(tiroirs.map((t) => t.nom.toLowerCase()));
    let n = tiroirs.length + 1;
    while (noms.has(`tiroir ${n}`)) n++;
    lancer(ajouterTiroir(maisonId, appareil.id, `Tiroir ${n}`, tiroirs.length));
  };

  const monter = (i: number, sens: -1 | 1) => lancer(reordonnerTiroirs(maisonId, deplacerDansListe(tiroirs, i, i + sens)));

  const supprimer = async (t: Tiroir) => {
    if (!peutSupprimerTiroir(tousTiroirs, t)) return;
    const contenu = alimentsDuTiroir(aliments, t.id);
    if (contenu.length === 0) {
      if (await confirmer(`Supprimer « ${t.nom} » ?`, 'Le tiroir est vide.', 'Supprimer', true)) {
        lancer(supprimerTiroir(maisonId, t, [], null, auteur));
      }
      return;
    }
    const n = contenu.length;
    const choix = await demander(`Supprimer « ${t.nom} » ?`, `Il contient ${n} aliment${n > 1 ? 's' : ''}. Que veux-tu en faire ?`, [
      { libelle: 'Déplacer le contenu…', valeur: 'deplacer' as const, style: 'principal' },
      { libelle: `Tout supprimer (${n})`, valeur: 'tout' as const, style: 'danger' },
      { libelle: 'Annuler', valeur: null, style: 'annuler' },
    ]);
    if (choix === 'tout') {
      lancer(supprimerTiroir(maisonId, t, contenu, null, auteur));
    } else if (choix === 'deplacer') {
      const destination = await choisirTiroir(`Déplacer le contenu de « ${t.nom} » vers…`, appareils, tousTiroirs, t.id);
      if (destination) lancer(supprimerTiroir(maisonId, t, contenu, destination, auteur));
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-3 px-4 pt-3"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {tiroirs.length === 0 ? (
        <EtatVide emoji="🗄️" titre="Aucun tiroir" texte="Ajoute un tiroir pour ranger tes aliments." />
      ) : (
        tiroirs.map((t, i) => (
          <LigneTiroir
            key={`${t.id}:${t.nom}`}
            tiroir={t}
            nombre={alimentsDuTiroir(aliments, t.id).length}
            premier={i === 0}
            dernier={i === tiroirs.length - 1}
            seul={tiroirs.length === 1}
            onRenommer={(nom) => lancer(renommerTiroir(maisonId, t.id, nom))}
            onMonter={() => monter(i, -1)}
            onDescendre={() => monter(i, 1)}
            onSupprimer={() => supprimer(t)}
          />
        ))
      )}
      {tiroirs.length === 1 && (
        <Texte ton="discret" className="px-1 text-sm">
          Un appareil garde toujours au moins un tiroir.
        </Texte>
      )}
      <Bouton titre="Ajouter un tiroir" icone="add" variante="secondaire" desactive={tiroirs.length >= MAX_TIROIRS} onPress={ajouter} />
      {tiroirs.length >= MAX_TIROIRS && (
        <Texte ton="discret" className="px-1 text-sm">
          {MAX_TIROIRS} tiroirs au maximum par appareil.
        </Texte>
      )}
    </ScrollView>
  );
}

function LigneTiroir({
  tiroir,
  nombre,
  premier,
  dernier,
  seul,
  onRenommer,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  tiroir: Tiroir;
  nombre: number;
  premier: boolean;
  dernier: boolean;
  seul: boolean;
  onRenommer: (nom: string) => void;
  onMonter: () => void;
  onDescendre: () => void;
  onSupprimer: () => void;
}) {
  const c = useCouleurs();
  const [nom, setNom] = useState(tiroir.nom);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = () => {
    const propre = nom.trim();
    if (!propre) {
      setErreur('Donne un nom au tiroir.');
      return;
    }
    setErreur(null);
    if (propre !== tiroir.nom) onRenommer(propre);
  };

  return (
    <Carte className="gap-1 p-3">
      <View className="flex-row items-start gap-1">
        <Champ
          className="flex-1"
          value={nom}
          onChangeText={(v) => {
            setNom(v);
            if (erreur) setErreur(null);
          }}
          onBlur={valider}
          onSubmitEditing={valider}
          returnKeyType="done"
          maxLength={30}
          accessibilityLabel={`Nom du tiroir ${tiroir.nom}`}
          erreur={erreur}
          aide={`${nombre} aliment${nombre > 1 ? 's' : ''}`}
        />
        <BoutonIcone icone="chevron-up" libelle={`Monter ${tiroir.nom}`} onPress={onMonter} desactive={premier} />
        <BoutonIcone icone="chevron-down" libelle={`Descendre ${tiroir.nom}`} onPress={onDescendre} desactive={dernier} />
        <BoutonIcone icone="trash-outline" libelle={`Supprimer ${tiroir.nom}`} onPress={onSupprimer} desactive={seul} couleur={c.rouge} />
      </View>
    </Carte>
  );
}
