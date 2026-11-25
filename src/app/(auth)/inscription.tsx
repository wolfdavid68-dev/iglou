import { useState } from 'react';

import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { emailValide, EcranFormulaire, GroupeChamps } from '@/composants/formulaire';
import { Bouton, Champ, Texte } from '@/composants/ui';
import { codeErreur, messageErreur } from '@/services/erreurs';
import { LIEN_CONFIDENTIALITE, ouvrirLien } from '@/services/liens';
import { inscrire } from '@/services/session';
import { useCouleurs } from '@/theme';

type Erreurs = { prenom?: string; email?: string; motDePasse?: string; confirmation?: string; general?: string };

export default function Inscription() {
  const c = useCouleurs();
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    const e: Erreurs = {};
    if (!prenom.trim()) e.prenom = 'Indique ton prénom : il est affiché aux autres membres.';
    else if (prenom.trim().length > 40) e.prenom = '40 caractères maximum.';
    if (!emailValide(email)) e.email = 'Saisis une adresse e-mail valide.';
    if (motDePasse.length < 6) e.motDePasse = '6 caractères minimum.';
    if (confirmation !== motDePasse) e.confirmation = 'Les deux mots de passe ne correspondent pas.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEnvoi(true);
    try {
      await inscrire(email.trim(), motDePasse, prenom.trim());
    } catch (err) {
      const code = codeErreur(err);
      if (code === 'compte-existant') setErreurs({ email: messageErreur(err) });
      else if (code === 'mot-de-passe-faible') setErreurs({ motDePasse: messageErreur(err) });
      else setErreurs({ general: messageErreur(err) });
      setEnvoi(false);
    }
  }

  return (
    <EcranFormulaire entete={<EnTeteDegrade couleurs={c.hero} motif="account-plus-outline" titre="Créer un compte" />}>
      <Texte ton="secondaire" className="px-1 text-base leading-6">
        Un compte par personne : tu pourras ensuite créer ta maison ou rejoindre celle de ta famille.
      </Texte>
      <GroupeChamps titre="Ton profil" aide="Ton prénom est affiché aux autres membres de la maison.">
        <Champ libelle="Prénom" value={prenom} onChangeText={setPrenom} erreur={erreurs.prenom} autoComplete="given-name" autoCapitalize="words" maxLength={40} />
      </GroupeChamps>
      <GroupeChamps titre="Connexion">
        <Champ
          libelle="E-mail"
          value={email}
          onChangeText={setEmail}
          erreur={erreurs.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Champ
          libelle="Mot de passe"
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
      </GroupeChamps>
      {erreurs.general ? (
        <Texte ton="rouge" className="text-center text-sm" accessibilityLiveRegion="polite">
          {erreurs.general}
        </Texte>
      ) : null}
      <Bouton titre="Créer mon compte" onPress={valider} chargement={envoi} className="mt-4" />
      <Texte ton="discret" className="text-center text-sm">
        En créant un compte, tu acceptes la{' '}
        <Texte ton="frigo" className="text-sm underline" onPress={() => ouvrirLien(LIEN_CONFIDENTIALITE)} accessibilityRole="link">
          politique de confidentialité
        </Texte>
        .
      </Texte>
    </EcranFormulaire>
  );
}
