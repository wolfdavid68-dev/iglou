import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Champ, Compteur, EnTete, Libelle, Segments, Texte } from '@/composants/ui';
import type { TypeAppareil } from '@/domaine/types';
import { confirmer } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { creerAppareil, modifierAppareil, supprimerAppareil } from '@/services/inventaire';
import { lancer } from '@/services/retours';

const TYPES: { valeur: TypeAppareil; libelle: string }[] = [
  { valeur: 'frigo', libelle: 'Frigo' },
  { valeur: 'congelateur', libelle: 'Congélateur' },
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
      <Segments libelle="Type" options={TYPES} valeur={type} onChange={setType} teinte={type === 'congelateur' ? 'congelateur' : 'frigo'} />
      <Champ
        libelle="Nom"
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
      {!existant && (
        <View className="gap-1.5">
          <Libelle>Nombre de tiroirs</Libelle>
          <Compteur libelle="nombre de tiroirs" valeur={nbTiroirs} onChange={setNbTiroirs} min={1} max={20} entier />
          <Texte ton="discret" className="text-sm">
            De 1 à 20. Tu pourras les renommer, en ajouter ou en retirer ensuite.
          </Texte>
        </View>
      )}
      <Bouton
        titre={existant ? 'Enregistrer' : 'Créer l’appareil'}
        onPress={valider}
        chargement={creeId != null}
        fond={type === 'congelateur' ? 'bg-congelateur-fort' : undefined}
        className="mt-2"
      />
      {existant && <Bouton titre="Supprimer l’appareil" icone="trash-outline" variante="danger" onPress={supprimer} />}
    </EcranFormulaire>
  );
}
