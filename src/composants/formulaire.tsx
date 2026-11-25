import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCouleurs } from '@/theme';
import { Libelle, Texte } from './ui';

/** Écran de formulaire défilant qui reste au-dessus du clavier. */
export function EcranFormulaire({
  children,
  entete,
  decor,
  className = '',
}: {
  children: ReactNode;
  entete?: ReactNode;
  /** Décor posé derrière le contenu, en haut de l'écran (voile de l'écran de connexion). */
  decor?: ReactNode;
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView className="flex-1 bg-fond" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {decor ? (
        <View pointerEvents="none" className="absolute inset-x-0 top-0">
          {decor}
        </View>
      ) : null}
      {entete}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: entete ? 8 : insets.top + 24 }}
        contentContainerClassName="grow px-4">
        <View className={`w-full max-w-lg self-center gap-4 ${className}`}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Groupe de champs d'un formulaire : petit titre en police de titre, champs espacés en dessous. */
export function GroupeChamps({ titre, aide, children, className = '' }: { titre: string; aide?: string; children: ReactNode; className?: string }) {
  return (
    <View className={`gap-3 pt-2 ${className}`}>
      <View className="gap-0.5 px-1">
        <Texte poids="titre" className="text-lg" accessibilityRole="header">
          {titre}
        </Texte>
        {aide ? (
          <Texte ton="secondaire" className="text-sm">
            {aide}
          </Texte>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Champ de code (invitation, réinitialisation) : grands caractères espacés,
 * centrés, en police de titre, pour se lire et se recopier sans erreur.
 */
export function ChampCode({
  libelle,
  erreur,
  aide,
  ...props
}: Omit<TextInputProps, 'className' | 'style'> & { libelle: string; erreur?: string | null; aide?: string }) {
  const c = useCouleurs();
  return (
    <View className="gap-1.5">
      <Libelle>{libelle}</Libelle>
      <TextInput
        placeholderTextColor={c.encre3}
        accessibilityLabel={libelle}
        {...props}
        style={{ fontVariant: ['tabular-nums'], boxShadow: c.ombre.carte }}
        className={`min-h-[72px] rounded-[20px] border bg-carte px-4 py-3 text-center font-titre-gras text-[32px] tracking-[6px] text-encre ${
          erreur ? 'border-rouge-texte' : 'border-contour focus:border-frigo-texte'
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailValide = (email: string) => EMAIL.test(email.trim());
