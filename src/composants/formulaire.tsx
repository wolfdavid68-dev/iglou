import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Écran de formulaire défilant qui reste au-dessus du clavier. */
export function EcranFormulaire({ children, entete, className = '' }: { children: ReactNode; entete?: ReactNode; className?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView className="flex-1 bg-fond" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {entete}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: entete ? 8 : insets.top + 24 }}
        contentContainerClassName="grow px-5">
        <View className={`w-full max-w-lg self-center gap-4 ${className}`}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailValide = (email: string) => EMAIL.test(email.trim());
