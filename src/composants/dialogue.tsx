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
  const empilees = d.actions.length > 2 || d.actions.some((a) => a.libelle.length > 11);
  // Empilées : l'action principale en haut, « Annuler » en bas. Côte à côte : l'action à droite.
  const actions = empilees ? [...d.actions].sort((a, b) => rang(a.style) - rang(b.style)) : d.actions;
  return (
    <FondModale onFermer={() => repondre(null)} className="gap-2">
      <Texte poids="titre-gras" className="text-[22px] leading-7" accessibilityRole="header">
        {d.titre}
      </Texte>
      {d.message ? (
        <Texte ton="secondaire" className="text-base leading-6">
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
          className="mt-2"
        />
      ) : null}
      <View className={empilees ? 'mt-4 gap-2' : 'mt-4 flex-row gap-3'}>
        {actions.map((a) => (
          <Bouton
            key={a.libelle}
            titre={a.libelle}
            // Action destructrice : rouge plein, texte blanc ; « Annuler » reste discret quand les boutons sont empilés.
            variante={a.style === 'danger' || a.style === 'principal' ? 'principal' : a.style === 'annuler' && empilees ? 'discret' : 'secondaire'}
            fond={a.style === 'danger' ? 'bg-rouge-fort' : undefined}
            desactive={a.valeur === SAISIE && vide}
            onPress={() => (a.valeur === SAISIE ? valider() : repondre(a.valeur))}
            className={empilees ? '' : 'flex-1 px-3'}
          />
        ))}
      </View>
    </FondModale>
  );
}

/** Ordre des boutons empilés : principal, danger, autres, puis annuler. */
const rang = (style?: string) => (style === 'principal' ? 0 : style === 'danger' ? 1 : style === 'annuler' ? 3 : 2);
