import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { EcranFormulaire } from '@/composants/formulaire';
import { BoutonIcone, Carte, Chargement, Ligne, Separateur, Texte, TitreSection } from '@/composants/ui';
import { useMaisons } from '@/services/maisons';
import { deconnecter, useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

export default function ChoisirMaison() {
  const router = useRouter();
  const c = useCouleurs();
  const moi = useMoi();
  const { chargement, adhesions, choisirMaison, messageRetrait, effacerMessageRetrait } = useMaisons();

  if (chargement) return <Chargement />;

  return (
    <EcranFormulaire>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Texte ton="secondaire" className="text-base">
            Bonjour {moi.prenom} 👋
          </Texte>
          <Texte poids="gras" className="text-3xl">
            {adhesions.length ? 'Choisis ta maison' : 'Bienvenue !'}
          </Texte>
        </View>
        <BoutonIcone icone="log-out-outline" libelle="Se déconnecter" onPress={deconnecter} couleur={c.encre2} />
      </View>

      {messageRetrait ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-rouge-pale p-4" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={22} color={c.rouge} />
          <Texte className="flex-1 text-base">{messageRetrait}</Texte>
          <BoutonIcone icone="close" libelle="Fermer le message" onPress={effacerMessageRetrait} taille={20} />
        </View>
      ) : null}

      {adhesions.length > 0 ? (
        <View>
          <TitreSection>Mes maisons</TitreSection>
          <Carte className="overflow-hidden">
            {adhesions.map((a, i) => (
              <View key={a.maisonId}>
                {i > 0 && <Separateur />}
                <Ligne
                  icone="home-outline"
                  couleurIcone={c.frigo}
                  titre={a.nom}
                  sousTitre={a.role === 'proprietaire' ? 'Propriétaire' : 'Membre'}
                  onPress={() => choisirMaison(a.maisonId)}
                />
              </View>
            ))}
          </Carte>
        </View>
      ) : (
        <Texte ton="secondaire" className="text-base">
          Pour commencer, crée la maison de ton foyer ou rejoins-en une avec le code d’invitation qu’un membre t’a envoyé.
        </Texte>
      )}

      <View className="gap-3 pt-2">
        <Choix
          emoji="🏠"
          titre="Créer une maison"
          texte="Tu en deviens propriétaire et tu invites ta famille."
          onPress={() => router.push('/creer')}
        />
        <Choix emoji="🔑" titre="Rejoindre une maison" texte="Avec un code à 6 caractères." onPress={() => router.push('/rejoindre')} />
      </View>
    </EcranFormulaire>
  );
}

function Choix({ emoji, titre, texte, onPress }: { emoji: string; titre: string; texte: string; onPress: () => void }) {
  const c = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-20 flex-row items-center gap-4 rounded-2xl border border-bordure bg-carte p-4 active:bg-carte-enfoncee">
      <View className="size-12 items-center justify-center rounded-xl bg-frigo-pale">
        <Text className="text-2xl">{emoji}</Text>
      </View>
      <View className="flex-1">
        <Texte poids="demi" className="text-base">
          {titre}
        </Texte>
        <Texte ton="secondaire" className="text-sm">
          {texte}
        </Texte>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.encre3} />
    </Pressable>
  );
}
