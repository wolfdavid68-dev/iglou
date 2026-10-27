import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Bouton, Carte, Chargement, EnTete, Ligne, Pastille, Segments, Separateur, Texte, TitreSection } from '@/composants/ui';
import { construireExport, nomFichierExport, planImport, resumeFichier, validerImport, type ModeImport } from '@/domaine/import-export';
import { messageInvitation } from '@/domaine/invitation';
import type { Membre } from '@/domaine/types';
import { apparenceEnregistree, choisirApparence, type Apparence } from '@/services/apparence';
import { changerDeMaison } from '@/services/changer-maison';
import { supprimerCompte } from '@/services/compte';
import { confirmer, demander, saisir } from '@/services/dialogue';
import { useDonnees, useEstProprietaire } from '@/services/donnees-maison';
import { choisirJson, partagerJson } from '@/services/fichiers';
import { nouvelId } from '@/services/convex';
import { appliquerImport, type Auteur } from '@/services/inventaire';
import { LIEN_CONFIDENTIALITE, ouvrirLien } from '@/services/liens';
import {
  changerPrenomMembre,
  quitterMaison,
  regenererCode,
  renommerMaison,
  retirerMembre,
  supprimerMaison,
  useMaisons,
} from '@/services/maisons';
import { partagerTexte } from '@/services/partage';
import { afficherMessage, lancer, signalerErreur } from '@/services/retours';
import { changerPrenom, deconnecter, useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

const OPTIONS_APPARENCE: { valeur: Apparence; libelle: string }[] = [
  { valeur: 'system', libelle: 'Automatique' },
  { valeur: 'light', libelle: 'Clair' },
  { valeur: 'dark', libelle: 'Sombre' },
];

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Ma maison (code, membres), mon compte, sauvegarde. */
export default function EcranReglages() {
  const c = useCouleurs();
  const router = useRouter();
  const moi = useMoi();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };
  const { maisonId, maison, membres, appareils, tiroirs, aliments, libres, chargement } = useDonnees();
  const { adhesions, maisonActiveId, choisirMaison } = useMaisons();
  const proprietaire = useEstProprietaire();
  const [occupe, setOccupe] = useState<string | null>(null);
  const [apparence, setApparence] = useState(apparenceEnregistree);

  if (chargement || !maison) return <Chargement />;

  const inventaire = { appareils, tiroirs, aliments, libres };

  /* ---------- Ma maison ---------- */

  const renommer = async () => {
    const nom = await saisir('Renommer la maison', { valeur: maison.nom, maxLength: 40, placeholder: 'ex. Chez nous' });
    if (nom && nom !== maison.nom) lancer(renommerMaison(maisonId, nom));
  };

  const regenerer = async () => {
    const ok = await confirmer(
      'Nouveau code d’invitation ?',
      `L’ancien code (${maison.codeInvitation}) ne fonctionnera plus. Les membres actuels restent dans la maison.`,
      'Régénérer',
    );
    if (!ok) return;
    const { code, ecriture } = regenererCode(maisonId, maison.codeInvitation);
    lancer(ecriture);
    afficherMessage(`Nouveau code : ${code}`);
  };

  const retirer = async (m: Membre) => {
    const ok = await confirmer(`Retirer ${m.prenom} ?`, `${m.prenom} n’aura plus accès à « ${maison.nom} ». Tu pourras l’inviter à nouveau avec le code.`, 'Retirer', true);
    if (ok) lancer(retirerMembre(maisonId, m.uid));
  };

  const changerApparence = (a: Apparence) => {
    setApparence(a);
    choisirApparence(a);
  };

  /* ---------- Mon compte ---------- */

  const changerMonPrenom = async () => {
    const prenom = await saisir('Mon prénom', { valeur: moi.prenom, maxLength: 30, message: 'Visible par les membres de tes maisons.' });
    if (!prenom || prenom === moi.prenom) return;
    lancer(changerPrenom(moi.uid, prenom));
    adhesions.forEach((a) => lancer(changerPrenomMembre(a.maisonId, moi.uid, prenom)));
  };

  const seDeconnecter = async () => {
    if (!(await confirmer('Se déconnecter ?', 'Tes données restent dans le cloud : il suffira de te reconnecter.', 'Se déconnecter'))) return;
    choisirMaison(null);
    lancer(deconnecter());
  };

  const supprimerMonCompte = async () => {
    const ok = await confirmer(
      'Supprimer mon compte ?',
      'Ton compte et ton profil seront effacés définitivement.\n\n' +
        '• Les maisons où tu es seul(e) seront supprimées avec leur inventaire.\n' +
        '• Dans une maison partagée, l’inventaire reste aux autres membres ; si tu en es propriétaire, le membre le plus ancien le devient.\n\n' +
        'Pense à exporter l’inventaire avant.',
      'Continuer',
      true,
    );
    if (!ok) return;
    const mdp = await saisir('Confirme avec ton mot de passe', {
      message: `Compte : ${moi.email}`,
      placeholder: 'Mot de passe',
      libelleOk: 'Supprimer',
      secret: true,
      danger: true,
    });
    if (!mdp) return;
    setOccupe('compte');
    try {
      // Une fois le mot de passe accepté, on quitte la maison ouverte avant d'effacer quoi que ce soit.
      await supprimerCompte(moi.email, mdp, adhesions, () => choisirMaison(null));
      afficherMessage('Ton compte a été supprimé.');
    } catch (e) {
      signalerErreur(e);
      setOccupe(null);
    }
  };

  /* ---------- Sauvegarde ---------- */

  const exporter = async () => {
    setOccupe('export');
    try {
      await partagerJson(nomFichierExport(maison.nom), construireExport(maison.nom, inventaire));
    } catch (e) {
      signalerErreur(e);
    } finally {
      setOccupe(null);
    }
  };

  const importer = async () => {
    let brut: string | null;
    try {
      brut = await choisirJson();
    } catch (e) {
      return signalerErreur(e);
    }
    if (brut == null) return;

    let json: unknown;
    try {
      json = JSON.parse(brut);
    } catch {
      return void demander('Fichier illisible', 'Ce fichier n’est pas un export de l’application (JSON invalide).', [{ libelle: 'OK', valeur: null, style: 'principal' }]);
    }
    const v = validerImport(json);
    if (!v.ok) {
      return void demander('Import impossible', v.erreurs.slice(0, 5).join('\n'), [{ libelle: 'OK', valeur: null, style: 'principal' }]);
    }

    const r = resumeFichier(v.fichier);
    const mode = await demander<ModeImport | null>(
      'Importer ce fichier ?',
      `« ${v.fichier.maison} » : ${pluriel(r.appareils, 'appareil')}, ${pluriel(r.tiroirs, 'tiroir')}, ${pluriel(r.aliments, 'aliment')}, ${pluriel(r.libres, 'article')} de courses.\n\n` +
        '« Fusionner » ajoute ce qui manque. « Remplacer tout » efface d’abord l’inventaire actuel.\n\n' +
        'L’inventaire actuel sera d’abord exporté, par sécurité.',
      [
        { libelle: 'Fusionner', valeur: 'fusionner', style: 'principal' },
        { libelle: 'Remplacer tout', valeur: 'remplacer', style: 'danger' },
        { libelle: 'Annuler', valeur: null, style: 'annuler' },
      ],
    );
    if (!mode) return;
    if (mode === 'remplacer' && !(await confirmer('Tout remplacer ?', `Les ${pluriel(aliments.length, 'aliment')} actuels seront effacés pour tous les membres.`, 'Remplacer', true))) return;

    setOccupe('import');
    try {
      // Copie de sécurité de l'état actuel avant toute écriture.
      await partagerJson(nomFichierExport(`${maison.nom}-avant-import`), construireExport(maison.nom, inventaire));
      const operations = planImport(mode, inventaire, v.fichier, () => nouvelId());
      await appliquerImport(maisonId, operations, auteur);
      afficherMessage(mode === 'remplacer' ? 'Inventaire remplacé ✔' : 'Inventaire fusionné ✔');
    } catch (e) {
      signalerErreur(e);
    } finally {
      setOccupe(null);
    }
  };

  /* ---------- Quitter / supprimer ---------- */

  const quitter = async () => {
    const ok = await confirmer(`Quitter « ${maison.nom} » ?`, 'Tu n’auras plus accès à son inventaire. Pour revenir, il te faudra un nouveau code d’invitation.', 'Quitter', true);
    if (!ok) return;
    choisirMaison(null);
    lancer(quitterMaison(maisonId, moi.uid));
  };

  const supprimer = async () => {
    const ok = await confirmer(
      `Supprimer « ${maison.nom} » ?`,
      `Tout son contenu (${pluriel(appareils.length, 'appareil')}, ${pluriel(aliments.length, 'aliment')}, la liste de courses) sera effacé définitivement, pour tous les membres. Pense à exporter l’inventaire avant.`,
      'Supprimer',
      true,
    );
    if (!ok) return;
    const nom = maison.nom;
    const code = maison.codeInvitation;
    choisirMaison(null);
    afficherMessage('Suppression en cours…');
    supprimerMaison(maisonId, moi.uid, code)
      .then(() => afficherMessage(`« ${nom} » a été supprimée.`))
      .catch(signalerErreur);
  };

  return (
    <View className="flex-1 bg-fond">
      <EnTete titre="Réglages" sousTitre={maison.nom} retour={false} />
      <ScrollView contentContainerClassName="px-4 pb-10">
        <TitreSection className="pt-2">Ma maison</TitreSection>
        <Carte className="overflow-hidden p-0">
          <Ligne
            icone="home-outline"
            couleurIcone={c.frigo}
            titre={maison.nom}
            sousTitre={proprietaire ? 'Toucher pour renommer' : 'Nom de la maison'}
            onPress={proprietaire ? renommer : undefined}
            droite={proprietaire ? undefined : <View />}
          />
          {adhesions.length > 0 && (
            <>
              <Separateur />
              <Ligne
                icone="swap-horizontal"
                titre="Changer de maison"
                sousTitre={adhesions.length > 1 ? `${adhesions.length} maisons` : 'Créer ou rejoindre une autre maison'}
                onPress={() => changerDeMaison(adhesions, maisonActiveId, choisirMaison, maison.nom)}
              />
            </>
          )}
        </Carte>

        <TitreSection>Code d’invitation</TitreSection>
        <Carte className="items-center gap-4 p-5">
          <Texte
            poids="gras"
            className="text-4xl tracking-[0.25em]"
            selectable
            accessibilityLabel={`Code d’invitation : ${maison.codeInvitation.split('').join(' ')}`}>
            {maison.codeInvitation}
          </Texte>
          <Texte ton="secondaire" className="text-center text-sm">
            À saisir dans « Rejoindre une maison » sur le téléphone de la personne à inviter.
          </Texte>
          <View className="w-full gap-2">
            <Bouton titre="Partager le code" icone="share-social-outline" onPress={() => partagerTexte(messageInvitation(maison.nom, maison.codeInvitation))} />
            {proprietaire && <Bouton titre="Régénérer le code" icone="refresh" variante="discret" onPress={regenerer} />}
          </View>
        </Carte>

        <TitreSection>Membres ({membres.length})</TitreSection>
        <Carte className="overflow-hidden p-0">
          {membres.map((m, i) => {
            const estMoi = m.uid === moi.uid;
            const retirable = proprietaire && !estMoi && m.role !== 'proprietaire';
            return (
              <View key={m.uid}>
                {i > 0 && <Separateur />}
                <Ligne
                  icone={m.role === 'proprietaire' ? 'star-outline' : 'person-outline'}
                  couleurIcone={m.role === 'proprietaire' ? c.orange : undefined}
                  titre={estMoi ? `${m.prenom} (toi)` : m.prenom}
                  sousTitre={m.role === 'proprietaire' ? 'Propriétaire' : 'Membre'}
                  onPress={retirable ? () => retirer(m) : undefined}
                  droite={retirable ? <Pastille fond="bg-rouge-pale" ton="rouge" texte="Retirer" /> : undefined}
                />
              </View>
            );
          })}
        </Carte>

        <TitreSection>Apparence</TitreSection>
        <Carte className="gap-2 p-4">
          <Segments options={OPTIONS_APPARENCE} valeur={apparence} onChange={changerApparence} />
          <Texte ton="discret" className="text-sm">
            {apparence === 'system' ? 'Suit le thème du téléphone.' : 'Choix mémorisé sur ce téléphone.'}
          </Texte>
        </Carte>

        <TitreSection>Mon compte</TitreSection>
        <Carte className="overflow-hidden p-0">
          <Ligne icone="person-circle-outline" titre={moi.prenom || 'Mon prénom'} sousTitre="Mon prénom · toucher pour modifier" onPress={changerMonPrenom} />
          <Separateur />
          <Ligne icone="mail-outline" titre={moi.email} sousTitre="Adresse e-mail" />
          <Separateur />
          <Ligne icone="log-out-outline" titre="Se déconnecter" onPress={seDeconnecter} droite={<View />} />
          <Separateur />
          <Ligne icone="shield-checkmark-outline" titre="Politique de confidentialité" sousTitre="Quelles données, pourquoi, tes droits" onPress={() => ouvrirLien(LIEN_CONFIDENTIALITE)} />
        </Carte>

        <TitreSection>Sauvegarde</TitreSection>
        <Carte className="overflow-hidden p-0">
          <Ligne
            icone="download-outline"
            titre="Exporter l’inventaire"
            sousTitre="Fichier JSON : aliments, stocks pleins et articles libres"
            onPress={occupe ? undefined : exporter}
            droite={occupe === 'export' ? <ActivityIndicator color={c.encre2} /> : undefined}
          />
          {proprietaire && (
            <>
              <Separateur />
              <Ligne
                icone="cloud-upload-outline"
                titre="Importer un inventaire"
                sousTitre="Remplacer tout ou fusionner (propriétaire)"
                onPress={occupe ? undefined : importer}
                droite={occupe === 'import' ? <ActivityIndicator color={c.encre2} /> : undefined}
              />
            </>
          )}
        </Carte>
        <Texte ton="discret" className="px-1 pt-2 text-sm">
          L’inventaire est enregistré dans le cloud : changer de téléphone ne fait rien perdre, il suffit de se reconnecter.
        </Texte>

        <TitreSection>Un souci ?</TitreSection>
        <Carte className="overflow-hidden p-0">
          <Ligne icone="bug-outline" titre="Signaler un problème" sousTitre="Un bug, une idée : écris-nous" onPress={() => router.push('/signaler')} />
        </Carte>

        <TitreSection>Zone sensible</TitreSection>
        <Carte className="overflow-hidden p-0">
          {proprietaire ? (
            <Ligne icone="trash-outline" titre="Supprimer la maison" sousTitre="Efface tout son contenu pour tous les membres" danger onPress={supprimer} />
          ) : (
            <Ligne icone="exit-outline" titre="Quitter la maison" danger onPress={quitter} />
          )}
          <Separateur />
          <Ligne
            icone="person-remove-outline"
            titre="Supprimer mon compte"
            sousTitre="Efface ton compte et tes données"
            danger
            onPress={occupe ? undefined : supprimerMonCompte}
            droite={occupe === 'compte' ? <ActivityIndicator color={c.rouge} /> : undefined}
          />
        </Carte>
      </ScrollView>
    </View>
  );
}
