import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { emailValide, EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, Texte } from '@/composants/ui';
import { messageErreur } from '@/services/firebase';
import { connecter } from '@/services/session';

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreurs, setErreurs] = useState<{ email?: string; motDePasse?: string; general?: string }>({});
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    const e: typeof erreurs = {};
    if (!emailValide(email)) e.email = 'Saisis une adresse e-mail valide.';
    if (!motDePasse) e.motDePasse = 'Saisis ton mot de passe.';
    setErreurs(e);
    if (e.email || e.motDePasse) return;
    setEnvoi(true);
    try {
      await connecter(email.trim(), motDePasse);
    } catch (err) {
      setErreurs({ general: messageErreur(err) });
      setEnvoi(false);
    }
  }

  return (
    <EcranFormulaire className="flex-1 justify-center">
      <View className="items-center gap-2 pb-4">
        <View className="size-20 items-center justify-center rounded-3xl bg-congelateur-pale">
          <Text className="text-5xl">🧊</Text>
        </View>
        <Texte poids="gras" className="text-3xl">
          Congélateur
        </Texte>
        <Texte ton="secondaire" className="text-center text-base">
          Le frigo et le congélateur de toute la maison, toujours à jour.
        </Texte>
      </View>

      <Champ
        libelle="E-mail"
        value={email}
        onChangeText={setEmail}
        erreur={erreurs.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <Champ
        libelle="Mot de passe"
        value={motDePasse}
        onChangeText={setMotDePasse}
        erreur={erreurs.motDePasse}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={valider}
      />
      {erreurs.general ? (
        <Texte ton="rouge" className="text-center text-sm" accessibilityLiveRegion="polite">
          {erreurs.general}
        </Texte>
      ) : null}

      <Bouton titre="Se connecter" onPress={valider} chargement={envoi} className="mt-2" />
      <Bouton titre="Mot de passe oublié ?" variante="discret" onPress={() => router.push({ pathname: '/mot-de-passe', params: { email } })} />

      <View className="mt-4 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-bordure" />
        <Texte ton="discret" className="text-sm">
          Pas encore de compte ?
        </Texte>
        <View className="h-px flex-1 bg-bordure" />
      </View>
      <Bouton titre="Créer un compte" variante="secondaire" onPress={() => router.push('/inscription')} />
    </EcranFormulaire>
  );
}
