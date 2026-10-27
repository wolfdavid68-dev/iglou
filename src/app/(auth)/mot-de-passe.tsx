import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { emailValide, EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, EnTete, Texte } from '@/composants/ui';
import { codeErreur, messageErreur } from '@/services/erreurs';
import { envoyerCodeReinitialisation, reinitialiserMotDePasse } from '@/services/session';

/**
 * Mot de passe oublié, en deux temps : un code à 8 chiffres part par e-mail,
 * puis on le saisit avec le nouveau mot de passe (ce qui connecte).
 */
export default function MotDePasse() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function demanderCode() {
    if (!emailValide(email)) return setErreur('Saisis une adresse e-mail valide.');
    setErreur(null);
    setEnvoi(true);
    try {
      await envoyerCodeReinitialisation(email.trim());
      setEnvoye(true);
    } catch (err) {
      // On ne révèle pas si un compte existe pour cette adresse.
      if (codeErreur(err) === 'identifiants') setEnvoye(true);
      else setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function changer() {
    if (code.replace(/\s/g, '').length !== 8) return setErreur('Le code contient 8 chiffres.');
    if (mdp.length < 6) return setErreur('6 caractères minimum pour le mot de passe.');
    setErreur(null);
    setEnvoi(true);
    try {
      // Une fois le mot de passe changé, la session s'ouvre et la navigation suit.
      await reinitialiserMotDePasse(email.trim(), code, mdp);
    } catch (err) {
      setErreur(messageErreur(err));
      setEnvoi(false);
    }
  }

  return (
    <EcranFormulaire entete={<EnTete titre="Mot de passe oublié" />}>
      {envoye ? (
        <>
          <Texte ton="secondaire" className="text-base">
            Si un compte existe pour {email.trim()}, un e-mail vient de partir avec un code à 8 chiffres. Pense à regarder dans les indésirables.
          </Texte>
          <Champ
            libelle="Code reçu"
            value={code}
            onChangeText={setCode}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="number-pad"
            maxLength={9}
            returnKeyType="next"
          />
          <Champ
            libelle="Nouveau mot de passe"
            value={mdp}
            onChangeText={setMdp}
            erreur={erreur}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={changer}
          />
          <Bouton titre="Changer le mot de passe" onPress={changer} chargement={envoi} />
          <Bouton
            titre="Renvoyer un code"
            variante="secondaire"
            onPress={() => {
              setCode('');
              void demanderCode();
            }}
            desactive={envoi}
          />
        </>
      ) : (
        <>
          <Texte ton="secondaire" className="text-base">
            Indique ton e-mail : tu recevras un code pour choisir un nouveau mot de passe.
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
            onSubmitEditing={demanderCode}
          />
          <Bouton titre="Recevoir un code" onPress={demanderCode} chargement={envoi} />
        </>
      )}
    </EcranFormulaire>
  );
}
