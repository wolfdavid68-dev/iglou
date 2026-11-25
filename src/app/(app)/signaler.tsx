import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Carte, Champ, EnTete, Libelle, Ligne, Separateur, Texte } from '@/composants/ui';
import { useDonnees } from '@/services/donnees-maison';
import { afficherMessage, lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { contexteTechnique, envoyerSignalement } from '@/services/signalements';

const MAX = 2000;

/** Bug ou idée : envoyé au développeur avec les infos du téléphone. */
export default function EcranSignaler() {
  const router = useRouter();
  const moi = useMoi();
  const { maisonId } = useDonnees();
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const { appareil, systeme, versionApp } = contexteTechnique();

  function envoyer() {
    const propre = message.trim();
    if (propre.length < 5) return setErreur('Décris le problème en quelques mots.');
    lancer(envoyerSignalement(propre, moi, maisonId));
    afficherMessage('Merci ! Ton message a bien été envoyé.');
    router.back();
  }

  return (
    <EcranFormulaire entete={<EnTete titre="Signaler un problème" />}>
      <Texte ton="secondaire" className="text-base leading-6">
        Un bug, quelque chose de bizarre ou une idée ? Raconte ce que tu faisais et ce qui s’est passé : ça aide à corriger plus vite.
      </Texte>
      <Champ
        libelle="Ton message"
        placeholder="ex. Quand je crée un congélateur, l’écran reste blanc…"
        value={message}
        onChangeText={(t) => {
          setMessage(t);
          setErreur(null);
        }}
        erreur={erreur}
        multiline
        textAlignVertical="top"
        maxLength={MAX}
        autoFocus
        style={{ minHeight: 160 }}
        aide={`${message.length} / ${MAX}`}
      />
      <View className="gap-1.5">
        <Libelle>Joint automatiquement</Libelle>
        <Carte className="overflow-hidden">
          <Ligne icone="phone-portrait-outline" titre={`${appareil}, ${systeme}`} sousTitre={`Version ${versionApp} de l’appli`} />
          <Separateur />
          <Ligne icone="mail-outline" titre={moi.email} sousTitre="Ton e-mail, pour pouvoir te répondre" />
        </Carte>
      </View>
      <Bouton titre="Envoyer" icone="send" onPress={envoyer} className="mt-2" />
    </EcranFormulaire>
  );
}
