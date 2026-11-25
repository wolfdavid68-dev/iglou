import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { ChampCode, emailValide, EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, Texte } from '@/composants/ui';
import { codeErreur, messageErreur } from '@/services/erreurs';
import { envoyerCodeReinitialisation, reinitialiserMotDePasse } from '@/services/session';
import { useCouleurs } from '@/theme';

/**
 * Mot de passe oublié, en deux temps : un code à 8 chiffres part par e-mail,
 * puis on le saisit avec le nouveau mot de passe (ce qui connecte).
 */
export default function MotDePasse() {
  const c = useCouleurs();
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
    <EcranFormulaire entete={<EnTeteDegrade couleurs={c.hero} motif="lock-reset" titre="Mot de passe oublié" />}>
      {envoye ? (
        <>
          <Texte ton="secondaire" className="px-1 text-base leading-6">
            Si un compte existe pour {email.trim()}, un e-mail vient de partir avec un code à 8 chiffres. Pense à regarder dans les indésirables.
          </Texte>
          <ChampCode
            libelle="Code reçu"
            placeholder="12345678"
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
          <Bouton titre="Changer le mot de passe" onPress={changer} chargement={envoi} className="mt-2" />
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
          <Texte ton="secondaire" className="px-1 text-base leading-6">
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
          <Bouton titre="Recevoir un code" icone="mail-outline" onPress={demanderCode} chargement={envoi} className="mt-2" />
        </>
      )}
    </EcranFormulaire>
  );
}
