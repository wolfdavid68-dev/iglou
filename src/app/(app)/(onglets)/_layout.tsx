import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';

import type { NomIcone } from '@/composants/ui';
import { calculerListeCourses, compterArticles } from '@/domaine/courses';
import { useDonnees } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';

/** Icône d'onglet avec pastille de fond quand l'onglet est actif (Material 3). */
function IconeOnglet({ icone, focused, color, pastille }: { icone: string; focused: boolean; color: ColorValue; pastille: string }) {
  return (
    <View className={`h-8 w-16 items-center justify-center rounded-full ${focused ? pastille : ''}`}>
      <Ionicons name={(focused ? icone : `${icone}-outline`) as NomIcone} size={22} color={color} />
    </View>
  );
}

export default function LayoutOnglets() {
  const c = useCouleurs();
  const { aliments, appareils, libres } = useDonnees();
  const aAcheter = compterArticles(calculerListeCourses(aliments, appareils, libres));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.frigoTexte,
        tabBarInactiveTintColor: c.encre2,
        // Une seule couleur active pour tous les onglets (couleur signature).
        tabBarStyle: { backgroundColor: c.carte, borderTopWidth: 0, boxShadow: c.ombre.barre, minHeight: 72, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 2 },
        sceneStyle: { backgroundColor: c.fond },
      }}
      // Petit retour haptique à chaque changement d'onglet.
      screenListeners={{ tabPress: () => tic() }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Maison',
          tabBarIcon: (p) => <IconeOnglet icone="home" pastille="bg-frigo-pale" {...p} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Courses',
          tabBarBadge: aAcheter > 0 ? (aAcheter > 99 ? '99+' : aAcheter) : undefined,
          tabBarBadgeStyle: { backgroundColor: c.coursesFort, color: c.blanc, fontFamily: 'Inter_600SemiBold' },
          tabBarIcon: (p) => <IconeOnglet icone="cart" pastille="bg-frigo-pale" {...p} />,
        }}
      />
      <Tabs.Screen
        name="recettes"
        options={{
          title: 'Recettes',
          tabBarIcon: (p) => <IconeOnglet icone="restaurant" pastille="bg-frigo-pale" {...p} />,
        }}
      />
      <Tabs.Screen
        name="recherche"
        options={{
          title: 'Recherche',
          tabBarIcon: (p) => <IconeOnglet icone="search" pastille="bg-frigo-pale" {...p} />,
        }}
      />
      <Tabs.Screen
        name="reglages"
        options={{
          title: 'Réglages',
          tabBarIcon: (p) => <IconeOnglet icone="settings" pastille="bg-frigo-pale" {...p} />,
        }}
      />
    </Tabs>
  );
}
