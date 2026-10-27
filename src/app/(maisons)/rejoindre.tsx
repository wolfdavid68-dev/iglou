import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, EnTete, Texte } from '@/composants/ui';
import { LONGUEUR_CODE, normaliserCode } from '@/domaine/invitation';
import { messageErreur } from '@/services/erreurs';
import { rejoindreMaison, useMaisons } from '@/services/maisons';
import { afficherMessage } from '@/services/retours';
import { useMoi } from '@/services/session';

export default function RejoindreMaison() {
  const moi = useMoi();
  const params = useLocalSearchParams<{ code?: string }>();
  const { adhesions, choisirMaison } = useMaisons();
  const [code, setCode] = useState(params.code ? normaliserCode(params.code) : '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await rejoindreMaison(code, moi.uid, moi.prenom, adhesions);
      if (!r.ok) {
        setErreur(r.message);
        setEnvoi(false);
        return;
      }
      if (r.dejaMembre) afficherMessage('Tu fais déjà partie de cette maison : la voici.');
      choisirMaison(r.maisonId);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  }

  return (
    <EcranFormulaire entete={<EnTete titre="Rejoindre une maison" />}>
      <Texte ton="secondaire" className="text-base">
        Demande le code d’invitation à un membre de la maison : il le trouve dans Réglages.
      </Texte>
      <Champ
        libelle="Code d’invitation"
        placeholder="ABC234"
        value={code}
        onChangeText={(t) => {
          setCode(normaliserCode(t).slice(0, LONGUEUR_CODE));
          setErreur(null);
        }}
        erreur={erreur}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={LONGUEUR_CODE + 2}
        autoFocus={!params.code}
        returnKeyType="go"
        onSubmitEditing={valider}
      />
      <Bouton titre="Rejoindre" icone="key" onPress={valider} chargement={envoi} desactive={code.length < LONGUEUR_CODE} />
    </EcranFormulaire>
  );
}
