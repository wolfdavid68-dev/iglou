import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { abonnerDialogue, dialogueCourant, repondre, SAISIE, type Dialogue } from '@/services/dialogue';
import { Bouton, Champ, FondModale, Texte } from './ui';

const abonner = (cb: () => void) => abonnerDialogue(cb);

/** Affiche la boîte de dialogue en cours (une seule à la fois, les suivantes attendent). */
export function HoteDialogue() {
  const d = useSyncExternalStore(abonner, dialogueCourant, dialogueCourant);
  if (!d) return null;
  // `key` : le texte saisi repart de zéro à chaque nouvelle boîte.
  return <Boite key={d.id} d={d} />;
}

function Boite({ d }: { d: Dialogue }) {
  const [texte, setTexte] = useState(d.champ?.valeur ?? '');
  const vide = !!d.champ && !(d.champ.secret ? texte : texte.trim());
  const valider = () => {
    if (!vide) repondre(texte);
  };
  const empilees = d.actions.length > 2 || d.actions.some((a) => a.libelle.length > 14);
  return (
    <FondModale onFermer={() => repondre(null)} className="gap-3">
      <Texte poids="gras" className="text-xl" accessibilityRole="header">
        {d.titre}
      </Texte>
      {d.message ? (
        <Texte ton="secondaire" className="text-base">
          {d.message}
        </Texte>
      ) : null}
      {d.champ ? (
        <Champ
          value={texte}
          onChangeText={setTexte}
          placeholder={d.champ.placeholder}
          maxLength={d.champ.maxLength}
          accessibilityLabel={d.titre}
          secureTextEntry={d.champ.secret}
          autoCapitalize={d.champ.secret ? 'none' : undefined}
          autoComplete={d.champ.secret ? 'current-password' : undefined}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={valider}
        />
      ) : null}
      <View className={empilees ? 'mt-2 gap-2' : 'mt-2 flex-row justify-end gap-2'}>
        {d.actions.map((a) => (
          <Bouton
            key={a.libelle}
            titre={a.libelle}
            variante={a.style === 'danger' ? 'danger' : a.style === 'principal' ? 'principal' : 'discret'}
            desactive={a.valeur === SAISIE && vide}
            onPress={() => (a.valeur === SAISIE ? valider() : repondre(a.valeur))}
          />
        ))}
      </View>
    </FondModale>
  );
}
