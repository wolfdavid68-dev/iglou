import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { emailValide, EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, EnTete, Texte } from '@/composants/ui';
import { messageErreur } from '@/services/erreurs';
import { reinitialiserMotDePasse } from '@/services/session';

export default function MotDePasse() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    if (!emailValide(email)) return setErreur('Saisis une adresse e-mail valide.');
    setErreur(null);
    setEnvoi(true);
    try {
      await reinitialiserMotDePasse(email.trim());
      setEnvoye(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // On ne révèle pas si un compte existe pour cette adresse.
      if (code === 'auth/user-not-found') setEnvoye(true);
      else setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <EcranFormulaire entete={<EnTete titre="Mot de passe oublié" />}>
      {envoye ? (
        <Texte className="text-base">
          Si un compte existe pour {email.trim()}, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe. Pense à regarder
          dans les indésirables.
        </Texte>
      ) : (
        <>
          <Texte ton="secondaire" className="text-base">
            Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.
          </Texte>
          <Champ
            libelle="E-mail"
            value={email}
            onChangeText={setEmail}
            erreur={erreur}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={valider}
          />
          <Bouton titre="Envoyer le lien" onPress={valider} chargement={envoi} />
        </>
      )}
    </EcranFormulaire>
  );
}
