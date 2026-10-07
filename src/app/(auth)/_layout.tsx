import { Stack } from 'expo-router';

import { useCouleurs } from '@/theme';

export default function LayoutAuth() {
  const c = useCouleurs();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fond } }}>
      <Stack.Screen name="connexion" />
      <Stack.Screen name="inscription" />
      <Stack.Screen name="mot-de-passe" />
    </Stack>
  );
}
