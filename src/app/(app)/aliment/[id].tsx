import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { IconeAppareil } from '@/composants/appareil';
import { Jauge } from '@/composants/jauge';
import { BoutonIcone, Carte, Chargement, EnTete, EtatVide, Ligne, Separateur, Texte } from '@/composants/ui';
import { etatPeremption, formaterDateCourte, ilYA, libellePeremption } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import { decrementer, estEpuise, incrementer, manque, pasPourUnite } from '@/domaine/quantites';
import { choisirTiroir, deplacerAvecAnnulation, supprimerAvecAnnulation } from '@/services/actions-aliment';
import { useDonnees } from '@/services/donnees-maison';
import { choc, tic } from '@/services/haptique';
import { consommerAliment, modifierAliment, type Auteur } from '@/services/inventaire';
import { lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

const nombre = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR'));

/** Fiche d'un aliment : stock, emplacement, péremption et actions. */
export default function FicheAliment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useCouleurs();
  const { maisonId, appareils, tiroirs, aliments, chargement } = useDonnees();
  const moi = useMoi();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };

  const a = aliments.find((x) => x.id === id);
  if (chargement) return <Chargement />;
  if (!a) {
    return (
      <View className="flex-1 bg-fond">
        <EnTete titre="Aliment" />
        <EtatVide emoji="🤷" titre="Cet aliment n’existe plus" texte="Il a peut-être été supprimé ou déplacé par un autre membre." />
      </View>
    );
  }

  const tiroir = tiroirs.find((t) => t.id === a.tiroirId);
  const appareil = appareils.find((x) => x.id === a.appareilId);
  const pas = pasPourUnite(a.unite);
  const epuise = estEpuise(a);
  const aAcheter = manque(a);
  const peremption = etatPeremption(a.datePeremption);
  const unite = a.unite === 'pièce' || a.unite === 'portion' ? '' : ` ${a.unite}`;

  const ajuster = (sens: 1 | -1) => {
    if (sens === 1) {
      tic();
      const s = incrementer(a, pas);
      lancer(modifierAliment(maisonId, a.id, { quantite: s.quantite, quantiteMax: s.quantiteMax }, auteur));
    } else {
      const s = decrementer(a, pas);
      // Le stock qui tombe à zéro mérite un retour un peu plus marqué.
      if (s.quantite <= 0) choc();
      else tic();
      lancer(consommerAliment(maisonId, a, s.quantite, auteur));
    }
  };

  const marquerEpuise = () => {
    choc();
    lancer(consommerAliment(maisonId, a, 0, auteur));
  };

  const deplacer = async () => {
    const cible = await choisirTiroir('Déplacer vers…', appareils, tiroirs, a.tiroirId);
    if (cible) deplacerAvecAnnulation(maisonId, a, cible, tiroirs, auteur);
  };

  const supprimer = () => {
    supprimerAvecAnnulation(maisonId, a, auteur);
    router.back();
  };

  return (
    <View className="flex-1 bg-fond">
      <EnTete
        titre={a.nom}
        sousTitre={appareil && tiroir ? `${appareil.nom} › ${tiroir.nom}` : undefined}
        actions={
          <BoutonIcone icone="create-outline" libelle="Modifier" onPress={() => router.push({ pathname: '/aliment/editer', params: { id: a.id } })} />
        }
      />
      <View className="flex-1 gap-4 px-4 pb-8">
        <Carte className="items-center gap-4 p-5">
          <Text className="text-6xl" accessible={false}>
            {emojiPourNom(a.nom)}
          </Text>
          <View className="flex-row items-center gap-6">
            <BoutonIcone icone="remove" libelle={`Retirer ${nombre(pas)}`} onPress={() => ajuster(-1)} desactive={a.quantite <= 0} taille={28} className="size-14 bg-carte-enfoncee" />
            <View className="min-w-28 items-center" accessibilityLiveRegion="polite">
              <Texte poids="gras" ton={epuise ? 'rouge' : 'encre'} className="text-4xl">
                {nombre(a.quantite)}
              </Texte>
              <Texte ton="secondaire" className="text-sm">
                sur {nombre(a.quantiteMax)}
                {unite}
              </Texte>
            </View>
            <BoutonIcone icone="add" libelle={`Ajouter ${nombre(pas)}`} onPress={() => ajuster(1)} taille={28} className="size-14 bg-carte-enfoncee" />
          </View>
          <Jauge stock={a} className="w-full" />
          <Texte ton={epuise ? 'rouge' : aAcheter > 0 ? 'orange' : 'vert'} poids="moyen" className="text-sm">
            {epuise ? 'Épuisé · dans la liste de courses' : aAcheter > 0 ? `${nombre(aAcheter)}${unite} à racheter` : 'Stock plein'}
          </Texte>
        </Carte>

        <Carte className="overflow-hidden p-0">
          <Ligne
            icone="file-tray-outline"
            titre={tiroir ? tiroir.nom : 'Tiroir introuvable'}
            sousTitre={appareil?.nom}
            onPress={deplacer}
            droite={appareil ? <IconeAppareil type={appareil.type} taille="petite" /> : undefined}
          />
          <Separateur />
          <Ligne
            icone="time-outline"
            couleurIcone={peremption === 'depassee' ? c.rouge : peremption === 'proche' ? c.orange : undefined}
            titre={a.datePeremption ? libellePeremption(a.datePeremption) : 'Pas de date de péremption'}
            sousTitre={a.datePeremption && !libellePeremption(a.datePeremption).includes('/') ? formaterDateCourte(a.datePeremption) : undefined}
            onPress={() => router.push({ pathname: '/aliment/editer', params: { id: a.id } })}
          />
          <Separateur />
          <Ligne icone="person-outline" titre={`Ajouté par ${a.ajouteParPrenom || 'un membre'}`} sousTitre={ilYA(a.createdAt)} />
          {a.note ? (
            <>
              <Separateur />
              <Ligne icone="document-text-outline" titre={a.note} />
            </>
          ) : null}
        </Carte>

        <Carte className="overflow-hidden p-0">
          <Ligne icone="swap-horizontal" titre="Déplacer vers…" onPress={deplacer} />
          {!epuise && (
            <>
              <Separateur />
              <Ligne
                icone="cart-outline"
                couleurIcone={c.courses}
                titre="Marquer épuisé"
                sousTitre="Passe la quantité à 0 et l’ajoute aux courses"
                onPress={marquerEpuise}
              />
            </>
          )}
          <Separateur />
          <Ligne icone="trash-outline" titre="Supprimer" danger onPress={supprimer} />
        </Carte>
      </View>
    </View>
  );
}
