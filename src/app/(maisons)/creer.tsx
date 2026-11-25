import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { EnTeteDegrade } from '@/composants/en-tete-degrade';
import { EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Carte, Champ, Separateur, Texte, type NomIcone } from '@/composants/ui';
import { creerMaison, useMaisons } from '@/services/maisons';
import { lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

const CONTENU: { icone: NomIcone; texte: string }[] = [
  { icone: 'snow-outline', texte: 'Tes frigos et congélateurs, tiroir par tiroir' },
  { icone: 'cart-outline', texte: 'La liste de courses, tenue à jour toute seule' },
  { icone: 'people-outline', texte: 'Les membres du foyer, invités avec un code' },
];

export default function CreerMaison() {
  const moi = useMoi();
  const c = useCouleurs();
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
    <EcranFormulaire entete={<EnTeteDegrade couleurs={c.hero} motif="home-plus-outline" titre="Créer une maison" />}>
      <Texte ton="secondaire" className="px-1 text-base leading-6">
        Tu en deviens propriétaire. Ta maison regroupe :
      </Texte>
      <Carte className="overflow-hidden">
        {CONTENU.map((l, i) => (
          <View key={l.icone}>
            {i > 0 ? <Separateur /> : null}
            <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
              <View className="size-9 items-center justify-center rounded-xl bg-frigo-pale">
                <Ionicons name={l.icone} size={19} color={c.frigoTexte} />
              </View>
              <Texte className="flex-1 text-base">{l.texte}</Texte>
            </View>
          </View>
        ))}
      </Carte>
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
        className="mt-2"
      />
      <Bouton titre="Créer la maison" icone="home-outline" onPress={valider} className="mt-2" />
    </EcranFormulaire>
  );
}
