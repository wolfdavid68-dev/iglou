import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View, type TextInputProps, type TextProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHorsLigne } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

export type NomIcone = ComponentProps<typeof Ionicons>['name'];

/* ---------------- Texte ---------------- */

const POIDS = {
  normal: 'font-inter',
  moyen: 'font-inter-moyen',
  demi: 'font-inter-demi',
  gras: 'font-inter-gras',
  /** Bricolage Grotesque : titres, grands chiffres. */
  titre: 'font-titre tracking-tight',
  'titre-gras': 'font-titre-gras tracking-tight',
} as const;
const TONS = {
  encre: 'text-encre',
  secondaire: 'text-encre-2',
  discret: 'text-encre-3',
  blanc: 'text-white',
  // Variantes « -texte » : contraste ≥ 4,5:1 (les teintes vives restent pour fonds et icônes).
  rouge: 'text-rouge-texte',
  orange: 'text-orange-texte',
  vert: 'text-vert-texte',
  frigo: 'text-frigo-texte',
  congelateur: 'text-congelateur-texte',
  courses: 'text-courses-texte',
  aucun: '',
} as const;

export type Ton = keyof typeof TONS;

/**
 * Texte de l'application : police Inter et couleur du thème. `className` sert
 * à la taille et à la mise en page ; la couleur et la graisse passent par
 * `ton` et `poids` pour éviter les conflits de classes.
 */
export function Texte({
  poids = 'normal',
  ton = 'encre',
  className = '',
  ...props
}: TextProps & { poids?: keyof typeof POIDS; ton?: Ton; className?: string }) {
  return <Text {...props} className={`${POIDS[poids]} ${TONS[ton]} ${className}`} />;
}

export const Titre = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <Texte poids="titre-gras" className={`text-[26px] leading-8 ${className}`} numberOfLines={2}>
    {children}
  </Texte>
);

/* ---------------- Boutons ---------------- */

type Variante = 'principal' | 'secondaire' | 'danger' | 'discret';
const FOND_BOUTON: Record<Variante, string> = {
  principal: 'bg-frigo-fort active:opacity-90',
  secondaire: 'bg-carte border border-contour active:bg-carte-enfoncee',
  danger: 'bg-rouge-pale active:opacity-80',
  discret: 'active:bg-carte-enfoncee',
};
const TON_BOUTON: Record<Variante, Ton> = { principal: 'blanc', secondaire: 'encre', danger: 'rouge', discret: 'secondaire' };

export function Bouton({
  titre,
  onPress,
  variante = 'principal',
  fond,
  icone,
  chargement = false,
  desactive = false,
  className = '',
}: {
  titre: string;
  onPress: () => void;
  variante?: Variante;
  /** Remplace la couleur du bouton principal (ex. `bg-courses-fort`). */
  fond?: string;
  icone?: NomIcone;
  chargement?: boolean;
  desactive?: boolean;
  className?: string;
}) {
  const c = useCouleurs();
  const ton = TON_BOUTON[variante];
  const couleurIcone = ton === 'blanc' ? c.blanc : ton === 'rouge' ? c.rougeTexte : ton === 'secondaire' ? c.encre2 : c.encre;
  const inactif = desactive || chargement;
  // Relief : ombre teintée sous l'action principale, ombre douce sous le bouton secondaire.
  const ombre = inactif ? undefined : variante === 'principal' ? (fond ? c.ombre.carte : c.ombre.flottant) : variante === 'secondaire' ? c.ombre.carte : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif, busy: chargement }}
      onPress={() => {
        if (variante === 'principal') tic();
        onPress();
      }}
      disabled={inactif}
      style={ombre ? { boxShadow: ombre } : undefined}
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-[18px] px-5 active:scale-[0.98] ${
        variante === 'principal' && fond ? `${fond} active:opacity-80` : FOND_BOUTON[variante]
      } ${inactif ? 'opacity-50' : ''} ${className}`}>
      {chargement ? (
        <ActivityIndicator color={couleurIcone} />
      ) : (
        <>
          {icone && <Ionicons name={icone} size={20} color={couleurIcone} />}
          <Texte poids="demi" ton={ton} className="text-base" numberOfLines={1}>
            {titre}
          </Texte>
        </>
      )}
    </Pressable>
  );
}

/** Bouton rond à icône seule, 48 dp. */
export function BoutonIcone({
  icone,
  onPress,
  libelle,
  couleur,
  taille = 24,
  className = '',
  desactive = false,
}: {
  icone: NomIcone;
  onPress: () => void;
  libelle: string;
  couleur?: string;
  taille?: number;
  className?: string;
  desactive?: boolean;
}) {
  const c = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      hitSlop={4}
      onPress={onPress}
      disabled={desactive}
      className={`size-12 items-center justify-center rounded-full active:bg-carte-enfoncee ${desactive ? 'opacity-40' : ''} ${className}`}>
      <Ionicons name={icone} size={taille} color={couleur ?? c.encre} />
    </Pressable>
  );
}

/* ---------------- Champs ---------------- */

export function Champ({
  libelle,
  erreur,
  aide,
  className = '',
  ...props
}: TextInputProps & { libelle?: string; erreur?: string | null; aide?: string; className?: string }) {
  const c = useCouleurs();
  return (
    <View className={`gap-1.5 ${className}`}>
      {libelle && <Libelle>{libelle}</Libelle>}
      <TextInput
        placeholderTextColor={c.encre3}
        accessibilityLabel={libelle}
        {...props}
        className={`min-h-[52px] rounded-2xl border bg-carte px-4 py-3 font-inter text-base text-encre ${
          erreur ? 'border-rouge-texte' : 'border-bordure focus:border-frigo-texte'
        }`}
      />
      {erreur ? (
        <Texte ton="rouge" className="text-sm" accessibilityLiveRegion="polite">
          {erreur}
        </Texte>
      ) : aide ? (
        <Texte ton="discret" className="text-sm">
          {aide}
        </Texte>
      ) : null}
    </View>
  );
}

/* ---------------- Mise en page ---------------- */

/** En-tête d'écran avec retour, titre et actions. */
export function EnTete({
  titre,
  sousTitre,
  retour = true,
  actions,
  transparent = false,
  className = '',
}: {
  titre: string;
  sousTitre?: string;
  retour?: boolean;
  actions?: ReactNode;
  /** Laisse voir le fond derrière (en-tête givré du congélateur). */
  transparent?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const horsLigne = useHorsLigne();
  return (
    <View style={{ paddingTop: insets.top }} className={`${transparent ? '' : 'bg-fond'} ${className}`}>
      <View className="min-h-14 flex-row items-center gap-1 px-2">
        {retour ? (
          <BoutonIcone icone="arrow-back" libelle="Retour" onPress={() => router.back()} />
        ) : (
          <View className="w-2" />
        )}
        <View className="flex-1 py-2">
          <Texte poids="titre-gras" className="text-[22px] leading-7" numberOfLines={1}>
            {titre}
          </Texte>
          {sousTitre ? (
            <Texte ton="secondaire" className="text-sm" numberOfLines={1}>
              {sousTitre}
            </Texte>
          ) : null}
        </View>
        {actions}
      </View>
      <BandeauHorsLigne visible={horsLigne} />
    </View>
  );
}

/** Bouton d'action principal, flottant en bas à droite de l'écran. */
export function BoutonFlottant({ icone = 'add', libelle, texte, onPress }: { icone?: NomIcone; libelle: string; texte?: string; onPress: () => void }) {
  const c = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={() => {
        tic();
        onPress();
      }}
      style={{ boxShadow: c.ombre.flottant }}
      className={`absolute bottom-5 right-5 h-16 flex-row items-center justify-center gap-2 rounded-[22px] bg-frigo-fort active:scale-95 active:opacity-90 ${texte ? 'pl-5 pr-6' : 'w-16'}`}>
      <Ionicons name={icone} size={texte ? 26 : 30} color={c.blanc} />
      {texte ? (
        <Texte poids="demi" ton="blanc" className="text-base">
          {texte}
        </Texte>
      ) : null}
    </Pressable>
  );
}

/** « Hors ligne – synchronisation au retour du réseau » */
export function BandeauHorsLigne({ visible }: { visible: boolean }) {
  const c = useCouleurs();
  if (!visible) return null;
  return (
    <View className="flex-row items-center gap-2 bg-orange-pale px-4 py-2" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={18} color={c.orangeTexte} />
      <Texte poids="moyen" className="flex-1 text-sm">
        Hors ligne – synchronisation au retour du réseau
      </Texte>
    </View>
  );
}

/** Surface blanche : filet très fin et ombre douce en clair, filet seul en sombre. */
export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  const c = useCouleurs();
  return (
    <View style={{ boxShadow: c.ombre.carte }} className={`rounded-[20px] border border-contour bg-carte ${className}`}>
      {children}
    </View>
  );
}

export function EtatVide({ emoji, titre, texte, children }: { emoji: string; titre: string; texte?: string; children?: ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <Text className="text-6xl" accessible={false}>
        {emoji}
      </Text>
      <Texte poids="titre" className="text-center text-xl">
        {titre}
      </Texte>
      {texte ? (
        <Texte ton="secondaire" className="text-center text-base">
          {texte}
        </Texte>
      ) : null}
      {children}
    </View>
  );
}

export function Chargement() {
  const c = useCouleurs();
  return (
    <View className="flex-1 items-center justify-center bg-fond">
      <ActivityIndicator size="large" color={c.frigoTexte} />
    </View>
  );
}

/** Teintes de sélection : bordure, fond pâle et texte, écrites en entier pour Tailwind. */
export type Teinte = 'frigo' | 'congelateur' | 'courses' | 'orange';
const TEINTES: Record<Teinte, { actif: string; pale: string; ton: Ton }> = {
  frigo: { actif: 'border-frigo bg-frigo-pale', pale: 'bg-frigo-pale', ton: 'frigo' },
  congelateur: { actif: 'border-congelateur bg-congelateur-pale', pale: 'bg-congelateur-pale', ton: 'congelateur' },
  courses: { actif: 'border-courses bg-courses-pale', pale: 'bg-courses-pale', ton: 'courses' },
  orange: { actif: 'border-orange bg-orange-pale', pale: 'bg-orange-pale', ton: 'orange' },
};

/** Choix segmenté (unités, type d'appareil…). */
export function Segments<T extends string>({
  options,
  valeur,
  onChange,
  libelle,
  teinte = 'frigo',
}: {
  options: { valeur: T; libelle: string }[];
  valeur: T;
  onChange: (v: T) => void;
  libelle?: string;
  /** Couleur de l'option choisie (ex. bleu quand on choisit « Congélateur »). */
  teinte?: Teinte;
}) {
  const t = TEINTES[teinte];
  const c = useCouleurs();
  return (
    <View className="gap-1.5">
      {libelle && <Libelle>{libelle}</Libelle>}
      {/* Rail enfoncé, option choisie en relief (contrôle segmenté). */}
      <View className="flex-row flex-wrap gap-1 self-start rounded-[18px] bg-carte-enfoncee p-1" accessibilityRole="radiogroup">
        {options.map((o) => {
          const actif = o.valeur === valeur;
          return (
            <Pressable
              key={o.valeur}
              accessibilityRole="radio"
              accessibilityState={{ checked: actif }}
              onPress={() => {
                if (!actif) tic();
                onChange(o.valeur);
              }}
              style={actif ? { boxShadow: c.ombre.carte } : undefined}
              className={`min-h-12 min-w-12 items-center justify-center rounded-[14px] px-4 ${actif ? 'bg-carte' : 'active:opacity-70'}`}>
              <Texte poids={actif ? 'demi' : 'normal'} ton={actif ? t.ton : 'encre'}>
                {o.libelle}
              </Texte>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Ligne de liste cliquable (réglages, choix). */
export function Ligne({
  icone,
  titre,
  sousTitre,
  onPress,
  droite,
  danger = false,
  couleurIcone,
}: {
  icone?: NomIcone;
  titre: string;
  sousTitre?: string;
  onPress?: () => void;
  droite?: ReactNode;
  danger?: boolean;
  couleurIcone?: string;
}) {
  const c = useCouleurs();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-carte-enfoncee">
      {icone && (
        <View className={`size-9 items-center justify-center rounded-xl ${danger ? 'bg-rouge-pale' : 'bg-carte-enfoncee'}`}>
          <Ionicons name={icone} size={19} color={danger ? c.rougeTexte : (couleurIcone ?? c.encre2)} />
        </View>
      )}
      <View className="flex-1">
        <Texte ton={danger ? 'rouge' : 'encre'} poids="moyen" className="text-base" numberOfLines={1}>
          {titre}
        </Texte>
        {sousTitre ? (
          <Texte ton="secondaire" className="text-sm" numberOfLines={2}>
            {sousTitre}
          </Texte>
        ) : null}
      </View>
      {droite ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={c.encre3} /> : null)}
    </Pressable>
  );
}

export const Separateur = () => <View className="ml-4 h-px bg-contour" />;

export function TitreSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Texte poids="titre" className={`px-1 pb-2.5 pt-7 text-lg ${className}`} accessibilityRole="header">
      {children}
    </Texte>
  );
}

/** Petite étiquette colorée (épuisé, entamé, périmé…). */
export function Pastille({ fond, ton, texte }: { fond: string; ton: Ton; texte: string }) {
  return (
    <View className={`rounded-full px-3 py-1 ${fond}`}>
      <Texte poids="moyen" ton={ton} className="text-xs">
        {texte}
      </Texte>
    </View>
  );
}

/** Nombre tel qu'on le tape : « 1,5 » plutôt que « 1.5 ». */
const ecrireNombre = (v: number) => String(v).replace('.', ',');

/**
 * Compteur « − valeur + » avec boutons de 48 dp.
 * La valeur se tape aussi au clavier : elle est prise en compte à chaque chiffre
 * (un bouton pressé sans fermer le clavier garde donc la bonne valeur),
 * puis remise dans les bornes quand on quitte le champ.
 */
export function Compteur({
  valeur,
  onChange,
  min = 0,
  max = Infinity,
  pas = 1,
  minSaisie = min,
  entier = false,
  libelle,
  suffixe,
}: {
  valeur: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  pas?: number;
  /** Plus petite valeur acceptée au clavier (par défaut `min`, la butée du bouton « − »). */
  minSaisie?: number;
  /** Nombres entiers seulement (ex. nombre de tiroirs). */
  entier?: boolean;
  libelle: string;
  suffixe?: string;
}) {
  const c = useCouleurs();
  // Texte en cours de frappe ; `null` hors saisie : le champ affiche alors la valeur.
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const texte = brouillon ?? ecrireNombre(valeur);
  const arrondi = (v: number) => (entier ? Math.round(v) : Math.round(v * 1000) / 1000);

  const lire = (t: string) => {
    const n = Number(t.replace(/\s/g, '').replace(',', '.'));
    return t.trim() && Number.isFinite(n) ? arrondi(n) : null;
  };

  const taper = (t: string) => {
    const propre = t.replace(entier ? /[^0-9]/g : /[^0-9.,]/g, '');
    setBrouillon(propre);
    const n = lire(propre);
    if (n !== null && n >= minSaisie) onChange(Math.min(max, n));
  };

  const valider = () => {
    if (brouillon === null) return;
    setBrouillon(null);
    const n = lire(brouillon);
    // Saisie vide ou trop petite : on garde la dernière valeur valable.
    const v = n === null || n < minSaisie ? valeur : Math.min(max, n);
    if (v !== valeur) onChange(v);
  };

  const regler = (v: number) => {
    tic();
    onChange(v);
    setBrouillon(null);
  };

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Diminuer ${libelle}`}
        disabled={valeur <= min}
        onPress={() => regler(Math.max(min, arrondi(valeur - pas)))}
        className={`size-12 items-center justify-center rounded-full bg-carte-enfoncee active:scale-95 active:opacity-70 ${valeur <= min ? 'opacity-40' : ''}`}>
        <Ionicons name="remove" size={22} color={c.encre} />
      </Pressable>
      <View className="flex-row items-center gap-1.5">
        <TextInput
          value={texte}
          onChangeText={taper}
          onBlur={valider}
          onSubmitEditing={valider}
          selectTextOnFocus
          inputMode={entier ? 'numeric' : 'decimal'}
          returnKeyType="done"
          maxLength={9}
          accessibilityLabel={libelle}
          accessibilityHint="Tape un nombre ou utilise les boutons moins et plus."
          className="h-12 w-24 rounded-2xl border border-bordure bg-carte px-2 text-center font-titre text-xl text-encre focus:border-frigo-texte"
        />
        {suffixe ? (
          <Texte poids="demi" className="text-lg">
            {suffixe}
          </Texte>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Augmenter ${libelle}`}
        disabled={valeur >= max}
        onPress={() => regler(Math.min(max, arrondi(valeur + pas)))}
        className={`size-12 items-center justify-center rounded-full bg-carte-enfoncee active:scale-95 active:opacity-70 ${valeur >= max ? 'opacity-40' : ''}`}>
        <Ionicons name="add" size={22} color={c.encre} />
      </Pressable>
    </View>
  );
}

/* ---------------- Composants communs (puces, encarts, recherche…) ---------------- */

/** Libellé au-dessus d'un champ ou d'un groupe de choix. */
export function Libelle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Texte poids="moyen" ton="secondaire" className={`text-sm ${className}`}>
      {children}
    </Texte>
  );
}

/**
 * Puce arrondie touchable : suggestion, raccourci, filtre.
 * `actif` la colore avec `teinte` ; `nombre` ajoute un compteur discret à droite.
 */
export function Puce({
  libelle,
  onPress,
  emoji,
  nombre,
  actif,
  teinte = 'frigo',
  discrete = false,
  compacte = false,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  libelle: string;
  onPress: () => void;
  emoji?: string;
  nombre?: number;
  /** Puce sélectionnable : `true` / `false`. Laisser `undefined` pour un simple bouton. */
  actif?: boolean;
  teinte?: Teinte;
  /** Sans bordure ni fond (action secondaire, ex. « Effacer »). */
  discrete?: boolean;
  /** 40 dp au lieu de 48 (rangée de filtres défilante, avec `hitSlop`). */
  compacte?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'radio';
}) {
  const t = TEINTES[teinte];
  const fond = discrete ? 'active:bg-carte-enfoncee' : actif ? t.actif : 'border-contour bg-carte active:bg-carte-enfoncee';
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={actif === undefined ? undefined : { checked: actif }}
      hitSlop={compacte ? 4 : undefined}
      onPress={onPress}
      className={`${compacte ? 'h-10 px-3.5' : 'min-h-12 px-4'} flex-row items-center gap-1.5 rounded-full ${discrete ? '' : 'border'} ${fond}`}>
      {emoji ? (
        <Text className="text-base" accessible={false}>
          {emoji}
        </Text>
      ) : null}
      <Texte poids={actif ? 'demi' : 'moyen'} ton={actif ? t.ton : discrete ? 'secondaire' : 'encre'} className="shrink text-sm" numberOfLines={1}>
        {libelle}
      </Texte>
      {nombre != null ? (
        <Texte ton={actif ? t.ton : 'discret'} className="text-xs">
          {nombre}
        </Texte>
      ) : null}
    </Pressable>
  );
}

/** Pastille ronde avec un nombre (contenu d'un tiroir, d'une liste…). */
export function PastilleCompte({ nombre, teinte = 'frigo' }: { nombre: number; teinte?: Teinte }) {
  const t = TEINTES[teinte];
  return (
    <View className={`rounded-full px-2 py-0.5 ${t.pale}`}>
      <Texte poids="demi" ton={t.ton} className="text-xs">
        {nombre}
      </Texte>
    </View>
  );
}

/** Encart d'information : emoji, titre et texte sur fond pâle (anti-gaspi, priorités…). */
export function Encart({
  emoji,
  titre,
  texte,
  fond = 'bg-orange-pale',
  compact = false,
  lignes,
  children,
  className = '',
}: {
  emoji: string;
  titre?: string;
  texte?: ReactNode;
  /** Nombre maximal de lignes du texte. */
  lignes?: number;
  /** Classe de fond (ex. `bg-frigo-pale`). */
  fond?: string;
  /** Emoji plus petit et marges réduites (dans une carte). */
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center gap-3 rounded-[20px] ${compact ? 'p-3' : 'p-4'} ${fond} ${className}`}>
      <Text className={compact ? 'text-2xl' : 'text-3xl'} accessible={false}>
        {emoji}
      </Text>
      <View className="flex-1 gap-0.5">
        {titre ? (
          <Texte poids="demi" className="text-base">
            {titre}
          </Texte>
        ) : null}
        {texte ? (
          <Texte ton="secondaire" className="text-sm" numberOfLines={lignes}>
            {texte}
          </Texte>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** Champ de recherche : loupe, saisie et bouton pour effacer. */
export function ChampRecherche({
  valeur,
  onChange,
  placeholder,
  libelle,
  autoFocus,
}: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
  libelle: string;
  autoFocus?: boolean;
}) {
  const c = useCouleurs();
  return (
    <View style={{ boxShadow: c.ombre.carte }} className="min-h-[52px] flex-row items-center gap-2 rounded-2xl border border-contour bg-carte pl-4">
      <Ionicons name="search" size={20} color={c.encre3} />
      <TextInput
        value={valeur}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.encre3}
        accessibilityLabel={libelle}
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        className="flex-1 py-3 font-inter text-base text-encre"
      />
      {valeur ? <BoutonIcone icone="close-circle" libelle="Effacer la recherche" onPress={() => onChange('')} couleur={c.encre3} taille={20} /> : null}
    </View>
  );
}

/**
 * Fenêtre modale centrée : voile, carte arrondie, fermeture en touchant à côté
 * ou avec le bouton retour d'Android.
 */
export function FondModale({
  onFermer,
  children,
  className = '',
  calque,
}: {
  onFermer: () => void;
  children: ReactNode;
  className?: string;
  /** Posé par-dessus toute la fenêtre (ex. calque qui absorbe un clic fantôme). */
  calque?: ReactNode;
}) {
  const c = useCouleurs();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <Pressable className="flex-1 items-center justify-center bg-voile px-6" onPress={onFermer} accessibilityLabel="Fermer">
        <Pressable
          style={{ boxShadow: c.ombre.relief }}
          className={`w-full max-w-sm rounded-[28px] border border-contour bg-carte p-6 ${className}`}
          onPress={() => {}}
          accessibilityViewIsModal>
          {children}
        </Pressable>
      </Pressable>
      {calque}
    </Modal>
  );
}
