import '../global.css';

import { Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BandeauBas } from '@/composants/bandeaux';
import { HoteDialogue } from '@/composants/dialogue';
import { HoteFeuille } from '@/composants/feuille';
import { HotePrise } from '@/composants/prise';
import { useAccesDirectDev } from '@/services/acces-dev';
import { restaurerApparence } from '@/services/apparence';
import { MaisonsProvider, useMaisons } from '@/services/maisons';
import { SessionProvider, useSession } from '@/services/session';
import { useCouleurs } from '@/theme';

SplashScreen.preventAutoHideAsync();
restaurerApparence();

export default function Racine() {
  const [policesChargees, erreurPolices] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Caveat_700Bold });
  const c = useCouleurs();
  const base = c.sombre ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.fond, card: c.carte, text: c.encre, border: c.bordure, primary: c.frigo },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.fond }}>
      <ThemeProvider value={theme}>
        <SessionProvider>
          <MaisonsProvider>
            {(policesChargees || erreurPolices) && <Navigation />}
            <BandeauBas decalage={64} />
            <HoteFeuille />
            <HotePrise />
            <HoteDialogue />
            <StatusBar style={c.sombre ? 'light' : 'dark'} />
          </MaisonsProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const c = useCouleurs();
  const session = useSession();
  const maisons = useMaisons();
  const accesDirect = useAccesDirectDev();
  const connecte = !!session.utilisateur;
  const maisonActive = connecte && !!maisons.maisonActiveId;
  const pret = !session.chargement && !accesDirect && (!connecte || maisonActive || !maisons.chargement);

  useEffect(() => {
    if (pret) SplashScreen.hideAsync();
  }, [pret]);

  if (session.chargement || accesDirect) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fond }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!connecte}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={connecte && !maisonActive}>
        <Stack.Screen name="(maisons)" />
      </Stack.Protected>
      <Stack.Protected guard={maisonActive}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
