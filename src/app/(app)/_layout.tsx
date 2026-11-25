import { Stack } from 'expo-router';

import { Chargement } from '@/composants/ui';
import { DonneesMaisonProvider } from '@/services/donnees-maison';
import { useMaisons } from '@/services/maisons';
import { useCouleurs } from '@/theme';

export default function LayoutApp() {
  const c = useCouleurs();
  const { maisonActiveId } = useMaisons();
  if (!maisonActiveId) return <Chargement />;
  return (
    <DonneesMaisonProvider key={maisonActiveId} maisonId={maisonActiveId}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fond } }}>
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="appareil/[id]" />
        <Stack.Screen name="appareil/editer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="aliment/[id]" />
        <Stack.Screen name="aliment/editer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recette/[id]" />
        <Stack.Screen name="recherche" />
        <Stack.Screen name="reglages" />
        <Stack.Screen name="signaler" options={{ presentation: 'modal' }} />
      </Stack>
    </DonneesMaisonProvider>
  );
}
