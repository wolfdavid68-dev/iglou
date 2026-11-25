import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Degrade } from '@/composants/appareil';
import { emailValide, EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, Texte } from '@/composants/ui';
import { messageErreur } from '@/services/erreurs';
import { connecter } from '@/services/session';
import { useCouleurs } from '@/theme';

export default function Connexion() {
  const router = useRouter();
  const c = useCouleurs();
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
    <EcranFormulaire
      className="flex-1 justify-center"
      // Voile givré, du sapin au glacier, comme en haut de l'accueil.
      decor={<Degrade colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} className="h-[520px]" />}>
      <View className="items-center gap-3 pb-6">
        <View style={{ boxShadow: c.ombre.relief }} className="mb-2 size-[104px] overflow-hidden rounded-[28px]">
          <Image source={require('@/assets/images/icon.png')} style={{ width: 104, height: 104 }} contentFit="cover" accessibilityLabel="Logo Iglou" />
        </View>
        <Texte poids="titre-gras" className="text-[44px] leading-[50px]" accessibilityRole="header">
          Iglou
        </Texte>
        <Texte ton="secondaire" className="max-w-[300px] text-center text-base leading-6">
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

      <View className="mt-6 flex-row items-center gap-3">
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
