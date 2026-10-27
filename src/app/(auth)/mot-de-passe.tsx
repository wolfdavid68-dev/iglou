import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { emailValide, EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, EnTete, Texte } from '@/composants/ui';
import { messageErreur } from '@/services/erreurs';
import { choisirNouveauMotDePasse, demanderCodeMotDePasse } from '@/services/session';

type Erreurs = { email?: string; code?: string; motDePasse?: string; confirmation?: string; general?: string };

/** Mot de passe oublié : un code à 8 chiffres par e-mail, puis le nouveau mot de passe. */
export default function MotDePasse() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [etape, setEtape] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [envoi, setEnvoi] = useState(false);

  async function envoyerCode() {
    if (!emailValide(email)) return setErreurs({ email: 'Saisis une adresse e-mail valide.' });
    setErreurs({});
    setEnvoi(true);
    try {
      await demanderCodeMotDePasse(email);
      setEtape('code');
    } catch (err) {
      const c = (err as { code?: string }).code;
      // On ne révèle pas si un compte existe pour cette adresse.
      if (c === 'auth/user-not-found') setEtape('code');
      else setErreurs({ general: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  async function valider() {
    const e: Erreurs = {};
    if (!/^\d{8}$/.test(code.trim())) e.code = 'Le code reçu contient 8 chiffres.';
    if (motDePasse.length < 6) e.motDePasse = '6 caractères minimum.';
    if (confirmation !== motDePasse) e.confirmation = 'Les deux mots de passe ne correspondent pas.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEnvoi(true);
    try {
      // Réussi : l'utilisateur est connecté et l'app s'ouvre.
      await choisirNouveauMotDePasse(email, code, motDePasse);
    } catch (err) {
      const c = (err as { code?: string }).code;
      if (c === 'auth/invalid-code' || c === 'auth/user-not-found') setErreurs({ code: 'Code incorrect ou expiré.' });
      else if (c === 'auth/weak-password') setErreurs({ motDePasse: messageErreur(err) });
      else setErreurs({ general: messageErreur(err) });
      setEnvoi(false);
    }
  }

  const general = erreurs.general ? (
    <Texte ton="rouge" className="text-center text-sm" accessibilityLiveRegion="polite">
      {erreurs.general}
    </Texte>
  ) : null;

  if (etape === 'email') {
    return (
      <EcranFormulaire entete={<EnTete titre="Mot de passe oublié" />}>
        <Texte ton="secondaire" className="text-base">
          Indique ton e-mail : tu recevras un code pour choisir un nouveau mot de passe.
        </Texte>
        <Champ
          libelle="E-mail"
          value={email}
          onChangeText={setEmail}
          erreur={erreurs.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={envoyerCode}
        />
        {general}
        <Bouton titre="Recevoir un code" onPress={envoyerCode} chargement={envoi} />
      </EcranFormulaire>
    );
  }

  return (
    <EcranFormulaire entete={<EnTete titre="Nouveau mot de passe" />}>
      <Texte className="text-base">
        Si un compte existe pour {email.trim()}, un code à 8 chiffres vient de partir (valable 15 minutes). Pense à regarder dans les
        indésirables.
      </Texte>
      <Champ
        libelle="Code reçu par e-mail"
        value={code}
        onChangeText={setCode}
        erreur={erreurs.code}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={8}
      />
      <Champ
        libelle="Nouveau mot de passe"
        value={motDePasse}
        onChangeText={setMotDePasse}
        erreur={erreurs.motDePasse}
        aide="6 caractères minimum."
        secureTextEntry
        autoComplete="new-password"
      />
      <Champ
        libelle="Confirme le mot de passe"
        value={confirmation}
        onChangeText={setConfirmation}
        erreur={erreurs.confirmation}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={valider}
      />
      {general}
      <Bouton titre="Changer mon mot de passe" onPress={valider} chargement={envoi} className="mt-2" />
      <Bouton titre="Renvoyer un code" variante="secondaire" onPress={envoyerCode} />
    </EcranFormulaire>
  );
}
