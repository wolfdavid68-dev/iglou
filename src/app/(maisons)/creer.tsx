import { useState } from 'react';

import { EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, EnTete, Texte } from '@/composants/ui';
import { creerMaison, useMaisons } from '@/services/maisons';
import { lancer } from '@/services/retours';
import { useMoi } from '@/services/session';

export default function CreerMaison() {
  const moi = useMoi();
  const { choisirMaison } = useMaisons();
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  function valider() {
    const propre = nom.trim();
    if (!propre) return setErreur('Donne un nom à ta maison.');
    if (propre.length > 40) return setErreur('40 caractères maximum.');
    const { maisonId, ecriture } = creerMaison(propre, moi.uid, moi.prenom);
    lancer(ecriture);
    choisirMaison(maisonId);
  }

  return (
    <EcranFormulaire entete={<EnTete titre="Créer une maison" />}>
      <Texte ton="secondaire" className="text-base">
        Ta maison regroupe tes frigos, congélateurs et la liste de courses. Tu pourras ensuite inviter les autres membres du foyer avec un code.
      </Texte>
      <Champ
        libelle="Nom de la maison"
        placeholder="Ex. Maison Dupont"
        value={nom}
        onChangeText={(t) => {
          setNom(t);
          setErreur(null);
        }}
        erreur={erreur}
        maxLength={40}
        autoCapitalize="sentences"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={valider}
      />
      <Bouton titre="Créer la maison" icone="home" onPress={valider} />
    </EcranFormulaire>
  );
}
