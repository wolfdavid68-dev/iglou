import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps, type TextProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHorsLigne } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

export type NomIcone = ComponentProps<typeof Ionicons>['name'];

/* ---------------- Texte ---------------- */

const POIDS = { normal: 'font-inter', moyen: 'font-inter-moyen', demi: 'font-inter-demi', gras: 'font-inter-gras' } as const;
const TONS = {
  encre: 'text-encre',
  secondaire: 'text-encre-2',
  discret: 'text-encre-3',
  blanc: 'text-white',
  rouge: 'text-rouge',
  orange: 'text-orange',
  vert: 'text-vert',
  frigo: 'text-frigo',
  congelateur: 'text-congelateur',
  courses: 'text-courses',
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
  <Texte poids="gras" className={`text-2xl ${className}`} numberOfLines={2}>
    {children}
  </Texte>
);

/* ---------------- Boutons ---------------- */

type Variante = 'principal' | 'secondaire' | 'danger' | 'discret';
const FOND_BOUTON: Record<Variante, string> = {
  principal: 'bg-frigo active:opacity-80',
  secondaire: 'bg-carte border border-bordure active:bg-carte-enfoncee',
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
  /** Remplace la couleur du bouton principal (ex. `bg-courses`). */
  fond?: string;
  icone?: NomIcone;
  chargement?: boolean;
  desactive?: boolean;
  className?: string;
}) {
  const c = useCouleurs();
  const ton = TON_BOUTON[variante];
  const couleurIcone = ton === 'blanc' ? '#fff' : ton === 'rouge' ? c.rouge : ton === 'secondaire' ? c.encre2 : c.encre;
  const inactif = desactive || chargement;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif, busy: chargement }}
      onPress={onPress}
      disabled={inactif}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 ${
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
      {libelle && (
        <Texte poids="moyen" ton="secondaire" className="text-sm">
          {libelle}
        </Texte>
      )}
      <TextInput
        placeholderTextColor={c.encre3}
        accessibilityLabel={libelle}
        {...props}
        className={`min-h-12 rounded-xl border bg-carte px-4 py-3 font-inter text-base text-encre ${
          erreur ? 'border-rouge' : 'border-bordure focus:border-frigo'
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
          <Texte poids="gras" className="text-xl" numberOfLines={1}>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      style={{ position: 'absolute', right: 20, bottom: 20 }}
      className={`h-16 flex-row items-center justify-center gap-2 rounded-2xl bg-frigo shadow-lg active:scale-95 active:opacity-90 ${texte ? 'pl-5 pr-6' : 'w-16'}`}>
      <Ionicons name={icone} size={texte ? 26 : 30} color="#FFFFFF" />
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
  if (!visible) return null;
  return (
    <View className="flex-row items-center gap-2 bg-orange-pale px-4 py-2" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={18} color="#F59E0B" />
      <Texte poids="moyen" className="flex-1 text-sm">
        Hors ligne – synchronisation au retour du réseau
      </Texte>
    </View>
  );
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-bordure bg-carte ${className}`}>{children}</View>;
}

export function EtatVide({ emoji, titre, texte, children }: { emoji: string; titre: string; texte?: string; children?: ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <Text className="text-6xl">{emoji}</Text>
      <Texte poids="demi" className="text-center text-lg">
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
      <ActivityIndicator size="large" color={c.frigo} />
    </View>
  );
}

/** Choix segmenté (unités, type d'appareil…). */
export function Segments<T extends string>({
  options,
  valeur,
  onChange,
  libelle,
}: {
  options: { valeur: T; libelle: string }[];
  valeur: T;
  onChange: (v: T) => void;
  libelle?: string;
}) {
  return (
    <View className="gap-1.5">
      {libelle && (
        <Texte poids="moyen" ton="secondaire" className="text-sm">
          {libelle}
        </Texte>
      )}
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {options.map((o) => {
          const actif = o.valeur === valeur;
          return (
            <Pressable
              key={o.valeur}
              accessibilityRole="radio"
              accessibilityState={{ checked: actif }}
              onPress={() => onChange(o.valeur)}
              className={`min-h-12 min-w-12 items-center justify-center rounded-xl border px-4 ${
                actif ? 'border-frigo bg-frigo-pale' : 'border-bordure bg-carte active:bg-carte-enfoncee'
              }`}>
              <Texte poids={actif ? 'demi' : 'normal'} ton={actif ? 'frigo' : 'encre'}>
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
      {icone && <Ionicons name={icone} size={22} color={danger ? c.rouge : (couleurIcone ?? c.encre2)} />}
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

export const Separateur = () => <View className="ml-4 h-px bg-bordure" />;

export function TitreSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Texte poids="demi" ton="secondaire" className={`px-1 pb-2 pt-6 text-xs uppercase tracking-wider ${className}`}>
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
        className={`size-12 items-center justify-center rounded-xl border border-bordure bg-carte active:bg-carte-enfoncee ${valeur <= min ? 'opacity-40' : ''}`}>
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
          className="h-12 w-24 rounded-xl border border-bordure bg-carte px-2 text-center font-inter-demi text-lg text-encre focus:border-frigo"
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
        className={`size-12 items-center justify-center rounded-xl border border-bordure bg-carte active:bg-carte-enfoncee ${valeur >= max ? 'opacity-40' : ''}`}>
        <Ionicons name="add" size={22} color={c.encre} />
      </Pressable>
    </View>
  );
}
