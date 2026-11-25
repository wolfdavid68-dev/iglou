import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BoutonVerre, EnTeteDegrade } from '@/composants/en-tete-degrade';
import { EcranFormulaire } from '@/composants/formulaire';
import { BoutonIcone, Carte, Chargement, Ligne, Separateur, Texte, type NomIcone } from '@/composants/ui';
import { tic } from '@/services/haptique';
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
    <EcranFormulaire
      entete={
        <EnTeteDegrade
          couleurs={c.hero}
          motif="home-heart"
          retour={false}
          surTitre={`Bonjour ${moi.prenom}`}
          titre={adhesions.length ? 'Choisis ta maison' : 'Bienvenue !'}
          actions={<BoutonVerre icone="log-out-outline" libelle="Se déconnecter" onPress={deconnecter} />}
        />
      }>
      {messageRetrait ? (
        <View className="flex-row items-center gap-3 rounded-[20px] bg-rouge-pale py-2 pl-4 pr-1" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={22} color={c.rougeTexte} />
          <Texte className="flex-1 text-base">{messageRetrait}</Texte>
          <BoutonIcone icone="close" libelle="Fermer le message" onPress={effacerMessageRetrait} taille={20} />
        </View>
      ) : null}

      {adhesions.length > 0 ? (
        <View>
          <Texte poids="titre" className="px-1 pb-2.5 text-lg" accessibilityRole="header">
            Mes maisons
          </Texte>
          <Carte className="overflow-hidden">
            {adhesions.map((a, i) => (
              <View key={a.maisonId}>
                {i > 0 && <Separateur />}
                <Ligne
                  icone="home-outline"
                  couleurIcone={c.frigoTexte}
                  titre={a.nom}
                  sousTitre={a.role === 'proprietaire' ? 'Propriétaire' : 'Membre'}
                  onPress={() => {
                    tic();
                    choisirMaison(a.maisonId);
                  }}
                />
              </View>
            ))}
          </Carte>
        </View>
      ) : (
        <Texte ton="secondaire" className="px-1 text-base leading-6">
          Pour commencer, crée la maison de ton foyer ou rejoins-en une avec le code d’invitation qu’un membre t’a envoyé.
        </Texte>
      )}

      <View className="gap-3">
        {adhesions.length > 0 ? (
          <Texte poids="titre" className="px-1 pt-3 text-lg" accessibilityRole="header">
            Une autre maison
          </Texte>
        ) : null}
        <Choix
          icone="add"
          titre="Créer une maison"
          texte="Tu en deviens propriétaire et tu invites ta famille."
          onPress={() => router.push('/creer')}
        />
        <Choix icone="key-outline" titre="Rejoindre une maison" texte="Avec un code à 6 caractères." onPress={() => router.push('/rejoindre')} />
      </View>
    </EcranFormulaire>
  );
}

function Choix({ icone, titre, texte, onPress }: { icone: NomIcone; titre: string; texte: string; onPress: () => void }) {
  const c = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ boxShadow: c.ombre.carte }}
      className="min-h-20 flex-row items-center gap-4 rounded-[20px] border border-contour bg-carte p-4 active:scale-[0.98] active:bg-carte-enfoncee">
      <View className="size-12 items-center justify-center rounded-2xl bg-frigo-pale">
        <Ionicons name={icone} size={24} color={c.frigoTexte} />
      </View>
      <View className="flex-1">
        <Texte poids="titre" className="text-[17px]">
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
