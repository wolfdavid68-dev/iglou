import { Stack } from 'expo-router';

import { useCouleurs } from '@/theme';

export default function LayoutMaisons() {
  const c = useCouleurs();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fond } }}>
      <Stack.Screen name="choisir" />
      <Stack.Screen name="creer" />
      <Stack.Screen name="rejoindre" />
    </Stack>
  );
}
