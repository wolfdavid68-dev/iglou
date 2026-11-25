import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { IconeAppareil } from '@/composants/appareil';
import { Jauge } from '@/composants/jauge';
import { BoutonIcone, Carte, Chargement, EnTete, EtatVide, Ligne, Separateur, Texte, type NomIcone, type Ton } from '@/composants/ui';
import { etatPeremption, formaterDateCourte, ilYA, libellePeremption } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import { decrementer, estEpuise, incrementer, manque, pasPourUnite } from '@/domaine/quantites';
import { formaterNombre, suffixeUnite } from '@/domaine/texte';
import { choisirTiroir, deplacerAvecAnnulation, supprimerAvecAnnulation } from '@/services/actions-aliment';
import { useDonnees } from '@/services/donnees-maison';
import { choc, tic } from '@/services/haptique';
import { consommerAliment, modifierAliment, type Auteur } from '@/services/inventaire';
import { lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

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
  const suffixe = suffixeUnite(a.unite);
  const unite = suffixe ? ` ${suffixe}` : '';

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
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-2">
        {/* Le stock d'abord : l'aliment, sa quantité en grand et les boutons pour l'ajuster. */}
        <Carte className="items-center gap-5 px-5 pb-5 pt-6">
          <View className="size-24 items-center justify-center rounded-[28px] bg-carte-enfoncee">
            <Text className="text-[56px] leading-[68px]" accessible={false}>
              {emojiPourNom(a.nom)}
            </Text>
          </View>
          <View className="w-full flex-row items-center justify-between">
            <BoutonIcone
              icone="remove"
              libelle={`Retirer ${formaterNombre(pas)}`}
              onPress={() => ajuster(-1)}
              desactive={a.quantite <= 0}
              taille={28}
              className="size-16 bg-carte-enfoncee active:scale-95"
            />
            <View className="flex-1 items-center" accessibilityLiveRegion="polite">
              <Texte poids="titre-gras" ton={epuise ? 'rouge' : 'encre'} className="text-[56px] leading-[62px]" style={{ fontVariant: ['tabular-nums'] }}>
                {formaterNombre(a.quantite)}
              </Texte>
              <Texte ton="secondaire" className="text-sm">
                sur {formaterNombre(a.quantiteMax)}
                {unite}
              </Texte>
            </View>
            <BoutonIcone icone="add" libelle={`Ajouter ${formaterNombre(pas)}`} onPress={() => ajuster(1)} taille={28} className="size-16 bg-carte-enfoncee active:scale-95" />
          </View>
          <Jauge stock={a} className="w-full" />
          {epuise ? (
            <Etat icone="alert-circle" ton="rouge" fond="bg-rouge-pale" texte="Épuisé, dans la liste de courses" />
          ) : aAcheter > 0 ? (
            <Etat icone="cart-outline" ton="courses" fond="bg-courses-pale" texte={`${formaterNombre(aAcheter)}${unite} à racheter`} />
          ) : (
            <Etat icone="checkmark-circle" ton="vert" fond="bg-vert-pale" texte="Stock plein" />
          )}
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
            couleurIcone={peremption === 'depassee' ? c.rougeTexte : peremption === 'proche' ? c.orangeTexte : undefined}
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
                couleurIcone={c.coursesTexte}
                titre="Marquer épuisé"
                sousTitre="Passe la quantité à 0 et l’ajoute aux courses"
                onPress={marquerEpuise}
              />
            </>
          )}
          <Separateur />
          <Ligne icone="trash-outline" titre="Supprimer" danger onPress={supprimer} />
        </Carte>
      </ScrollView>
    </View>
  );
}

/** État du stock : pastille teintée avec icône (vert plein, courses à racheter, rouge épuisé). */
function Etat({ icone, ton, fond, texte }: { icone: NomIcone; ton: Extract<Ton, 'vert' | 'courses' | 'rouge'>; fond: string; texte: string }) {
  const c = useCouleurs();
  const couleur = ton === 'vert' ? c.vertTexte : ton === 'courses' ? c.coursesTexte : c.rougeTexte;
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3.5 ${fond}`}>
      <Ionicons name={icone} size={16} color={couleur} />
      <Texte poids="demi" ton={ton} className="text-sm">
        {texte}
      </Texte>
    </View>
  );
}
