import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { abonnerDialogue, dialogueCourant, repondre, SAISIE, type Dialogue } from '@/services/dialogue';
import { Champ, Texte } from './ui';

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
    <Modal transparent visible animationType="fade" onRequestClose={() => repondre(null)} statusBarTranslucent>
      <Pressable className="flex-1 items-center justify-center bg-voile px-6" onPress={() => repondre(null)} accessibilityLabel="Fermer">
        <Pressable className="w-full max-w-sm gap-3 rounded-3xl bg-carte p-6" onPress={() => {}} accessibilityViewIsModal>
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
              <Pressable
                key={a.libelle}
                accessibilityRole="button"
                disabled={a.valeur === SAISIE && vide}
                accessibilityState={{ disabled: a.valeur === SAISIE && vide }}
                onPress={() => (a.valeur === SAISIE ? valider() : repondre(a.valeur))}
                className={`min-h-12 items-center justify-center rounded-2xl px-4 ${a.valeur === SAISIE && vide ? 'opacity-50' : ''} ${
                  a.style === 'danger'
                    ? 'bg-rouge-pale active:opacity-80'
                    : a.style === 'principal'
                      ? 'bg-frigo active:opacity-80'
                      : 'active:bg-carte-enfoncee'
                }`}>
                <Texte poids="demi" ton={a.style === 'danger' ? 'rouge' : a.style === 'principal' ? 'blanc' : 'secondaire'} className="text-base">
                  {a.libelle}
                </Texte>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
