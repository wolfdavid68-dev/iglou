import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { EcranFormulaire, GroupeChamps } from '@/composants/formulaire';
import { Bouton, Champ, Compteur, EnTete, Texte } from '@/composants/ui';
import type { TypeAppareil } from '@/domaine/types';
import { confirmer } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { creerAppareil, modifierAppareil, supprimerAppareil } from '@/services/inventaire';
import { lancer } from '@/services/retours';
import { classesAppareil, couleurTexteAppareil, useCouleurs } from '@/theme';

const TYPES: { valeur: TypeAppareil; libelle: string; texte: string; icone: 'fridge-outline' | 'snowflake' }[] = [
  { valeur: 'frigo', libelle: 'Frigo', texte: 'Produits frais', icone: 'fridge-outline' },
  { valeur: 'congelateur', libelle: 'Congélateur', texte: 'Surgelés', icone: 'snowflake' },
];

export default function EditerAppareil() {
  const router = useRouter();
  const { id, type: typeInitial } = useLocalSearchParams<{ id?: string; type?: TypeAppareil }>();
  const { maisonId, appareils, tiroirs, aliments } = useDonnees();
  const existant = id ? appareils.find((a) => a.id === id) : undefined;

  const [nom, setNom] = useState(existant?.nom ?? '');
  const [type, setType] = useState<TypeAppareil>(existant?.type ?? typeInitial ?? 'frigo');
  const [nbTiroirs, setNbTiroirs] = useState(type === 'congelateur' ? 3 : 4);
  const [erreur, setErreur] = useState<string | null>(null);
  const [creeId, setCreeId] = useState<string | null>(null);
  const ouvert = useRef(false);

  // Le nouvel appareil peut n'apparaître qu'un instant après l'écriture :
  // on n'ouvre son écran qu'une fois qu'il est dans la liste (sinon « introuvable »).
  useEffect(() => {
    if (!creeId || ouvert.current || !appareils.some((a) => a.id === creeId)) return;
    ouvert.current = true;
    router.replace({ pathname: '/appareil/[id]', params: { id: creeId } });
  }, [creeId, appareils, router]);

  function valider() {
    if (creeId) return;
    const propre = nom.trim();
    if (!propre) return setErreur('Donne un nom à cet appareil (ex. « Frigo cuisine »).');
    if (propre.length > 40) return setErreur('40 caractères maximum.');
    if (existant) {
      lancer(modifierAppareil(maisonId, existant, { nom: propre, type }));
      router.back();
    } else {
      const { appareilId, ecriture } = creerAppareil(maisonId, propre, type, nbTiroirs, appareils.length);
      setCreeId(appareilId);
      lancer(
        ecriture.catch((e) => {
          setCreeId(null);
          throw e;
        }),
      );
    }
  }

  async function supprimer() {
    if (!existant) return;
    const contenu = aliments.filter((a) => a.appareilId === existant.id).length;
    const ok = await confirmer(
      `Supprimer « ${existant.nom} » ?`,
      contenu
        ? `Ses tiroirs et les ${contenu} aliment${contenu > 1 ? 's' : ''} qu’il contient seront supprimés pour tous les membres.`
        : 'Ses tiroirs seront supprimés pour tous les membres.',
      'Supprimer',
      true,
    );
    if (!ok) return;
    lancer(supprimerAppareil(maisonId, existant, tiroirs, aliments));
    router.dismissTo('/');
  }

  return (
    <EcranFormulaire entete={<EnTete titre={existant ? 'Modifier l’appareil' : 'Nouvel appareil'} />}>
      <GroupeChamps titre="Type d’appareil">
        {/* Choix exclusif illustré : la tuile choisie prend la couleur de l'appareil. */}
        <View className="flex-row gap-3" accessibilityRole="radiogroup">
          {TYPES.map((t) => (
            <TuileType key={t.valeur} type={t} actif={type === t.valeur} onPress={() => setType(t.valeur)} />
          ))}
        </View>
      </GroupeChamps>
      <GroupeChamps titre="Nom">
        <Champ
          accessibilityLabel="Nom"
          placeholder={type === 'congelateur' ? 'Ex. Congélateur garage' : 'Ex. Frigo cuisine'}
          value={nom}
          onChangeText={(t) => {
            setNom(t);
            setErreur(null);
          }}
          erreur={erreur}
          maxLength={40}
          autoFocus={!existant}
          returnKeyType="done"
          onSubmitEditing={valider}
        />
      </GroupeChamps>
      {!existant && (
        <GroupeChamps titre="Tiroirs" aide="De 1 à 20. Tu pourras les renommer, en ajouter ou en retirer ensuite.">
          <Compteur libelle="nombre de tiroirs" valeur={nbTiroirs} onChange={setNbTiroirs} min={1} max={20} entier />
        </GroupeChamps>
      )}
      <Bouton
        titre={existant ? 'Enregistrer' : 'Créer l’appareil'}
        icone={existant ? 'checkmark' : 'add'}
        onPress={valider}
        chargement={creeId != null}
        fond={type === 'congelateur' ? 'bg-congelateur-fort' : undefined}
        className="mt-4"
      />
      {existant && <Bouton titre="Supprimer l’appareil" icone="trash-outline" variante="danger" onPress={supprimer} />}
    </EcranFormulaire>
  );
}

function TuileType({
  type: t,
  actif,
  onPress,
}: {
  type: (typeof TYPES)[number];
  actif: boolean;
  onPress: () => void;
}) {
  const c = useCouleurs();
  const classes = classesAppareil[t.valeur];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      accessibilityLabel={t.libelle}
      onPress={() => {
        if (!actif) tic();
        onPress();
      }}
      style={actif ? { boxShadow: c.ombre.carte } : undefined}
      className={`min-h-[120px] flex-1 justify-between gap-3 rounded-[20px] border-2 p-4 active:scale-[0.98] ${
        actif ? `${classes.bordure} bg-carte` : 'border-transparent bg-carte-enfoncee'
      }`}>
      <View className={`size-12 items-center justify-center rounded-2xl ${actif ? classes.pale : 'bg-carte'}`}>
        <MaterialCommunityIcons name={t.icone} size={26} color={actif ? couleurTexteAppareil(c, t.valeur) : c.encre2} />
      </View>
      <View>
        <Texte poids="titre" className="text-[17px]">
          {t.libelle}
        </Texte>
        <Texte ton="secondaire" className="text-sm">
          {t.texte}
        </Texte>
      </View>
    </Pressable>
  );
}
