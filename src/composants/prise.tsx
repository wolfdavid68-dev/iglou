import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { emojiPourNom } from '@/domaine/emoji';
import { lireQuantite, pasPourUnite } from '@/domaine/quantites';
import { arrondir, formaterQuantite } from '@/domaine/texte';
import { abonnerPrise, priseCourante, repondrePrise, type DemandePrise } from '@/services/prise';
import { tic } from '@/services/haptique';
import { useCouleurs } from '@/theme';
import { Jauge } from './jauge';
import { Bouton, BoutonIcone, Texte } from './ui';

const abonner = (cb: () => void) => abonnerPrise(cb);
const nombre = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR'));

/** Affiche la fenêtre « Combien en as-tu pris ? » en cours. */
export function HotePrise() {
  const d = useSyncExternalStore(abonner, priseCourante, priseCourante);
  if (!d) return null;
  // `key` : la quantité repart de zéro à chaque nouvel aliment.
  return <Fenetre key={d.id} d={d} />;
}

function Fenetre({ d }: { d: DemandePrise }) {
  const c = useCouleurs();
  const a = d.aliment;
  const pas = pasPourUnite(a.unite);
  const [texte, setTexte] = useState(nombre(Math.min(pas, a.quantite)));
  // Sur téléphone, le navigateur envoie un clic juste après le toucher qui a ouvert la fenêtre :
  // sans ce délai, il tomberait sur un bouton (« J'ai tout pris »).
  const [protege, setProtege] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setProtege(false), 450);
    return () => clearTimeout(t);
  }, []);
  const prise = lireQuantite(texte);
  const trop = prise != null && prise > a.quantite;
  const valide = prise != null && !trop;
  const reste = valide ? arrondir(a.quantite - prise) : null;
  const unite = a.unite === 'pièce' || a.unite === 'portion' ? null : a.unite;

  const ajuster = (sens: 1 | -1) => {
    tic();
    const base = prise ?? 0;
    const q = sens === 1 ? Math.min(a.quantite, arrondir(base + pas)) : Math.max(Math.min(pas, a.quantite), arrondir(base - pas));
    setTexte(nombre(q));
  };

  const valider = () => {
    if (valide) repondrePrise({ quantite: prise });
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => repondrePrise(null)} statusBarTranslucent>
      <Pressable className="flex-1 items-center justify-center bg-voile px-6" onPress={() => repondrePrise(null)} accessibilityLabel="Fermer">
        <Pressable className="w-full max-w-sm gap-4 rounded-3xl bg-carte p-6" onPress={() => {}} accessibilityViewIsModal>
          <BoutonIcone icone="close" libelle="Fermer" couleur={c.encre2} onPress={() => repondrePrise(null)} className="absolute right-2 top-2 z-10" />

          {/* En-tête : toucher l'aliment ouvre sa fiche complète. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${a.nom}, il en reste ${formaterQuantite(a.quantite, a.unite)}. Voir la fiche complète`}
            onPress={() => repondrePrise('fiche')}
            className="items-center gap-1 rounded-2xl py-1 active:bg-carte-enfoncee">
            <Text className="text-6xl" accessible={false}>
              {emojiPourNom(a.nom)}
            </Text>
            <Texte poids="gras" className="text-center text-xl" numberOfLines={2}>
              {a.nom}
            </Texte>
            <Texte ton="secondaire" className="text-sm">
              Il en reste {formaterQuantite(a.quantite, a.unite)}
            </Texte>
            <View className="mt-1 flex-row items-center gap-1.5 rounded-full bg-carte-enfoncee px-3 py-1.5">
              <Ionicons name="document-text-outline" size={16} color={c.frigo} />
              <Texte poids="demi" ton="frigo" className="text-sm">
                Voir la fiche complète
              </Texte>
              <Ionicons name="chevron-forward" size={16} color={c.frigo} />
            </View>
          </Pressable>
          <Jauge stock={a} />

          <Texte poids="demi" className="text-center text-base">
            Combien en as-tu pris ?
          </Texte>
          <View className="flex-row items-center justify-center gap-4">
            <BoutonIcone
              icone="remove"
              libelle={`Retirer ${nombre(pas)}`}
              onPress={() => ajuster(-1)}
              desactive={prise == null || prise <= pas}
              taille={28}
              className="size-14 bg-carte-enfoncee"
            />
            <View className="min-w-24 items-center">
              <TextInput
                value={texte}
                onChangeText={setTexte}
                keyboardType="decimal-pad"
                selectTextOnFocus
                maxLength={8}
                returnKeyType="done"
                onSubmitEditing={valider}
                accessibilityLabel="Quantité prise"
                className={`min-w-24 rounded-xl px-2 py-1 text-center font-inter-gras text-4xl ${trop || prise == null ? 'text-rouge' : 'text-encre'}`}
              />
              {unite ? (
                <Texte ton="secondaire" className="text-sm">
                  {unite}
                </Texte>
              ) : null}
            </View>
            <BoutonIcone
              icone="add"
              libelle={`Ajouter ${nombre(pas)}`}
              onPress={() => ajuster(1)}
              desactive={prise != null && prise >= a.quantite}
              taille={28}
              className="size-14 bg-carte-enfoncee"
            />
          </View>

          <Texte
            ton={!valide ? 'rouge' : reste === 0 ? 'courses' : 'secondaire'}
            poids="moyen"
            className="text-center text-sm"
            accessibilityLiveRegion="polite">
            {trop
              ? `Il n’en reste que ${formaterQuantite(a.quantite, a.unite)}`
              : prise == null
                ? 'Indique une quantité'
                : reste === 0
                  ? 'Plus rien · ajouté aux courses'
                  : `Il en restera ${formaterQuantite(reste ?? 0, a.unite)}`}
          </Texte>

          <View className="gap-2">
            <Bouton titre={valide ? `Retirer ${formaterQuantite(prise, a.unite)}` : 'Retirer'} icone="checkmark" onPress={valider} desactive={!valide} />
            {prise !== a.quantite ? (
              <Bouton titre={`J’ai tout pris (${nombre(a.quantite)})`} variante="secondaire" onPress={() => repondrePrise({ quantite: a.quantite })} />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
      {protege ? <View className="absolute inset-0" /> : null}
    </Modal>
  );
}
