import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { texteStock } from '@/composants/aliment';
import { IconeAppareil } from '@/composants/appareil';
import { EcranFormulaire, GroupeChamps } from '@/composants/formulaire';
import { Bouton, Champ, Compteur, EnTete, EtatVide, Libelle, Puce, Segments, Texte } from '@/composants/ui';
import { formaterDateCourte, lireDateSaisie, versDateISO } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import { suggestionsNoms, tiroirParDefaut, trouverDoublon } from '@/domaine/inventaire';
import { ajouterALExistant, fixerQuantite, modifierMaximum, pasPourUnite, stockInitial } from '@/domaine/quantites';
import { suffixeUnite } from '@/domaine/texte';
import { UNITES, type Aliment, type CourseLibre, type Tiroir, type Unite } from '@/domaine/types';
import { choisirTiroir } from '@/services/actions-aliment';
import { confirmer, demander } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { creerAliment, modifierAliment, supprimerLibre, type Auteur } from '@/services/inventaire';
import { afficherMessage, lancer } from '@/services/retours';
import { useMoi } from '@/services/session';
import { useCouleurs } from '@/theme';

const OPTIONS_UNITES = UNITES.map((u) => ({ valeur: u, libelle: u === 'pièce' ? 'pièces' : u === 'portion' ? 'portions' : u }));

/** File d'articles libres à ranger après les courses (ids séparés par des virgules). */
interface FileLibres {
  reste: string[];
  position: number;
  total: number;
}

/**
 * Ajout (`tiroirId`, ou tiroir par défaut), modification (`id`) d'un aliment,
 * ou rangement des articles libres cochés (`libres`), un par un.
 */
export default function EditerAliment() {
  const params = useLocalSearchParams<{ id?: string; tiroirId?: string; libres?: string; total?: string }>();
  const router = useRouter();
  const { aliments, appareils, tiroirs, libres, chargement } = useDonnees();
  const ids = params.libres ? params.libres.split(',').filter(Boolean) : [];
  const libre = ids.length ? libres.find((l) => l.id === ids[0]) : undefined;
  const total = Math.max(Number(params.total) || ids.length, ids.length);
  const file: FileLibres | undefined = ids.length ? { reste: ids.slice(1), position: total - ids.length + 1, total } : undefined;
  const existant = params.id ? aliments.find((a) => a.id === params.id) : undefined;
  const tiroir = params.id
    ? tiroirs.find((t) => t.id === existant?.tiroirId)
    : (tiroirs.find((t) => t.id === params.tiroirId) ?? (params.tiroirId ? undefined : tiroirParDefaut(appareils, tiroirs, aliments, libre?.nom)));

  // Article libre supprimé entre-temps (par un autre membre) : on passe au suivant.
  const libreDisparu = !!file && !libre && !chargement;
  useEffect(() => {
    if (libreDisparu && file) allerAuSuivant(router, file);
  }, [libreDisparu]); // eslint-disable-line react-hooks/exhaustive-deps

  if (libreDisparu) return null;
  if ((params.id && !existant) || !tiroir) {
    return (
      <View className="flex-1 bg-fond">
        <EnTete titre={params.id ? 'Modifier' : 'Ajouter un aliment'} />
        {params.id || params.tiroirId ? (
          <EtatVide emoji="🤷" titre={params.id ? 'Cet aliment n’existe plus' : 'Ce tiroir n’existe plus'} texte="Il a peut-être été supprimé par un autre membre." />
        ) : (
          <EtatVide emoji="🧊" titre="Aucun tiroir pour l’instant" texte="Ajoute d’abord un frigo ou un congélateur depuis l’accueil." />
        )}
      </View>
    );
  }
  return <Formulaire key={libre?.id ?? 'unique'} existant={existant} tiroirInitial={tiroir} libre={libre} file={file} />;
}

function allerAuSuivant(router: ReturnType<typeof useRouter>, file: FileLibres) {
  if (file.reste.length) router.replace({ pathname: '/aliment/editer', params: { libres: file.reste.join(','), total: String(file.total) } });
  else {
    router.back();
    afficherMessage('Courses rangées ✔');
  }
}

function Formulaire({ existant, tiroirInitial, libre, file }: { existant?: Aliment; tiroirInitial: Tiroir; libre?: CourseLibre; file?: FileLibres }) {
  const router = useRouter();
  const c = useCouleurs();
  const { maisonId, appareils, tiroirs, aliments } = useDonnees();
  const moi = useMoi();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };

  const [nom, setNom] = useState(existant?.nom ?? libre?.nom ?? '');
  const [tiroir, setTiroir] = useState<Tiroir>(tiroirInitial);
  const [unite, setUnite] = useState<Unite>(existant?.unite ?? libre?.unite ?? 'pièce');
  const [stock, setStock] = useState(existant ? { quantite: existant.quantite, quantiteMax: existant.quantiteMax } : stockInitial(libre?.quantite ?? 1));
  const [date, setDate] = useState(existant?.datePeremption ? formaterDateCourte(existant.datePeremption) : '');
  const [note, setNote] = useState(existant?.note ?? '');
  const [erreurs, setErreurs] = useState<{ nom?: string; date?: string }>({});
  const [focusNom, setFocusNom] = useState(false);

  const appareil = appareils.find((a) => a.id === tiroir.appareilId);
  const pas = pasPourUnite(unite);
  const doublon = existant ? undefined : trouverDoublon(aliments, tiroir.id, nom);
  const suggestions = focusNom ? suggestionsNoms(aliments, nom, 5) : [];

  const changerQuantite = (q: number) => setStock((s) => (existant ? fixerQuantite(s, q) : stockInitial(q)));

  // Le stock plein se tape chiffre par chiffre : la quantité n'est ramenée qu'à l'enregistrement.
  const changerMaximum = (max: number) => {
    if (max > 0) setStock((s) => ({ ...s, quantiteMax: max }));
  };

  const changerTiroir = async () => {
    const t = await choisirTiroir('Ranger dans…', appareils, tiroirs, tiroir.id);
    if (t) setTiroir(t);
  };

  /** Fin : retour, ou article libre suivant (celui-ci quitte la liste de courses). */
  const terminer = () => {
    if (libre && file) {
      lancer(supprimerLibre(maisonId, libre.id));
      allerAuSuivant(router, file);
    } else router.back();
  };

  const ajouterAExistant = (cible: Aliment) => {
    const nouveau = ajouterALExistant(cible, stock.quantite);
    lancer(modifierAliment(maisonId, cible.id, nouveau, auteur));
    terminer();
  };

  async function enregistrer() {
    const propre = nom.trim();
    const e: typeof erreurs = {};
    if (!propre) e.nom = 'Donne un nom à cet aliment.';
    else if (propre.length > 40) e.nom = '40 caractères maximum.';
    const datePeremption = date.trim() ? lireDateSaisie(date) : null;
    if (date.trim() && !datePeremption) e.date = 'Date invalide. Exemple : 31/12/2026.';
    setErreurs(e);
    if (e.nom || e.date) return;

    // Taper une quantité relève le stock plein ; s'il est encore en dessous, c'est qu'on l'a baissé ensuite.
    let { quantite, quantiteMax } = stock;
    if (existant && quantite > quantiteMax) {
      const r = modifierMaximum(stock, quantiteMax);
      const ok = await confirmer(
        'Baisser le stock plein ?',
        `La quantité actuelle (${quantite}) dépasse ${quantiteMax}. Elle sera ramenée à ${quantiteMax}.`,
        'Baisser',
      );
      if (!ok) return;
      ({ quantite, quantiteMax } = r);
    }

    const champs = {
      nom: propre,
      unite,
      quantite,
      quantiteMax: Math.max(quantiteMax, quantite),
      datePeremption,
      note: note.trim() ? note.trim().slice(0, 200) : null,
    };

    if (existant) {
      lancer(modifierAliment(maisonId, existant.id, { ...champs, tiroirId: tiroir.id, appareilId: tiroir.appareilId }, auteur));
      router.back();
      return;
    }

    if (doublon) {
      const choix = await demander(`« ${doublon.nom} » est déjà dans ${tiroir.nom}`, `Stock actuel : ${texteStock(doublon)}.`, [
        { libelle: `Ajouter à l’existant (+${stock.quantite})`, valeur: 'ajouter' as const, style: 'principal' },
        { libelle: 'Créer un second', valeur: 'creer' as const },
        { libelle: 'Annuler', valeur: null, style: 'annuler' },
      ]);
      if (choix === 'ajouter') return ajouterAExistant(doublon);
      if (choix !== 'creer') return;
    }
    const { ecriture } = creerAliment(maisonId, { ...champs, tiroirId: tiroir.id, appareilId: tiroir.appareilId }, auteur);
    lancer(ecriture);
    terminer();
  }

  const raccourcisDate = [
    { libelle: '+3 j', jours: 3 },
    { libelle: '+1 sem.', jours: 7 },
    { libelle: '+1 mois', jours: 30 },
    { libelle: '+6 mois', jours: 182 },
  ];

  return (
    <EcranFormulaire
      entete={
        <EnTete
          titre={existant ? 'Modifier l’aliment' : libre ? `Ranger « ${libre.nom} »` : 'Ajouter un aliment'}
          sousTitre={file && file.total > 1 ? `Article ${file.position} sur ${file.total} de tes courses` : libre ? 'Article de tes courses' : undefined}
        />
      }>
      {/* L'aliment : son emoji se met à jour pendant la frappe. */}
      <View className="flex-row items-start gap-3">
        <View style={{ boxShadow: c.ombre.carte }} className="mt-[26px] size-[52px] items-center justify-center rounded-2xl border border-contour bg-carte">
          <Text className="text-[28px] leading-9" accessible={false}>
            {emojiPourNom(nom)}
          </Text>
        </View>
        <View className="flex-1">
          <Champ
            libelle="Nom"
            value={nom}
            onChangeText={(v) => {
              setNom(v);
              if (erreurs.nom) setErreurs((e) => ({ ...e, nom: undefined }));
            }}
            onFocus={() => setFocusNom(true)}
            onBlur={() => setTimeout(() => setFocusNom(false), 150)}
            placeholder="ex. Steaks hachés"
            autoFocus={!existant && !libre}
            autoCapitalize="sentences"
            maxLength={40}
            returnKeyType="done"
            erreur={erreurs.nom}
          />
        </View>
      </View>

      {suggestions.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {suggestions.map((s) => (
            <Puce
              key={s}
              emoji={emojiPourNom(s)}
              libelle={s}
              accessibilityLabel={`Suggestion : ${s}`}
              onPress={() => {
                tic();
                setNom(s);
                setFocusNom(false);
              }}
            />
          ))}
        </View>
      )}

      {doublon && (
        <View className="gap-3 rounded-[20px] border border-orange bg-orange-pale p-4">
          <View className="flex-row items-center gap-3">
            <Ionicons name="copy-outline" size={20} color={c.orangeTexte} />
            <Texte poids="demi" className="flex-1 text-base">
              Déjà dans ce tiroir : {doublon.nom} ({texteStock(doublon)})
            </Texte>
          </View>
          <Bouton titre={`Ajouter à l’existant (+${stock.quantite})`} icone="add-circle-outline" onPress={() => ajouterAExistant(doublon)} />
        </View>
      )}

      <GroupeChamps titre="Rangement">
        <View className="gap-1.5">
          <Libelle>Emplacement</Libelle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Emplacement : ${appareil?.nom ?? ''}, ${tiroir.nom}. Changer`}
            onPress={changerTiroir}
            style={{ boxShadow: c.ombre.carte }}
            className="min-h-[60px] flex-row items-center gap-3 rounded-2xl border border-contour bg-carte py-2 pl-2.5 pr-4 active:bg-carte-enfoncee">
            <IconeAppareil type={appareil?.type ?? 'frigo'} taille="petite" />
            <View className="flex-1">
              <Texte poids="moyen" className="text-base" numberOfLines={1}>
                {tiroir.nom}
              </Texte>
              <Texte ton="secondaire" className="text-sm" numberOfLines={1}>
                {appareil?.nom ?? '?'}
              </Texte>
            </View>
            <Texte poids="demi" ton="frigo" className="text-sm">
              Changer
            </Texte>
          </Pressable>
        </View>
        <Segments libelle="Unité" options={OPTIONS_UNITES} valeur={unite} onChange={setUnite} teinte={appareil?.type ?? 'frigo'} />
      </GroupeChamps>

      <GroupeChamps
        titre="Quantité"
        aide={
          existant
            ? 'Ce qui manque pour revenir au stock plein part dans la liste de courses.'
            : 'Cette quantité devient le « stock plein » : ce qui manquera ensuite ira dans la liste de courses.'
        }>
        <View className="gap-1.5">
          {existant ? <Libelle>En stock</Libelle> : null}
          <Compteur libelle="quantité" valeur={stock.quantite} onChange={changerQuantite} pas={pas} suffixe={suffixeUnite(unite)} />
        </View>
        {existant ? (
          <View className="gap-1.5">
            <Libelle>Stock plein</Libelle>
            <Compteur
              libelle="stock plein"
              valeur={stock.quantiteMax}
              onChange={changerMaximum}
              min={pas}
              minSaisie={0.001}
              pas={pas}
              suffixe={suffixeUnite(unite)}
            />
          </View>
        ) : null}
      </GroupeChamps>

      <GroupeChamps titre="Conservation">
        <View className="gap-2.5">
          <Champ
            libelle="Date de péremption (facultatif)"
            value={date}
            onChangeText={(v) => {
              setDate(v);
              if (erreurs.date) setErreurs((e) => ({ ...e, date: undefined }));
            }}
            placeholder="JJ/MM/AAAA"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            erreur={erreurs.date}
          />
          <View className="flex-row flex-wrap gap-2">
            {raccourcisDate.map((r) => (
              <Puce
                key={r.libelle}
                compacte
                libelle={r.libelle}
                accessibilityLabel={`Péremption dans ${r.libelle}`}
                onPress={() => {
                  tic();
                  const d = new Date();
                  d.setDate(d.getDate() + r.jours);
                  setDate(formaterDateCourte(versDateISO(d)));
                  setErreurs((e) => ({ ...e, date: undefined }));
                }}
              />
            ))}
            {date ? <Puce compacte discrete libelle="Effacer" onPress={() => setDate('')} /> : null}
          </View>
        </View>
        <Champ
          libelle="Note (facultatif)"
          value={note}
          onChangeText={setNote}
          placeholder="ex. pour le gratin de dimanche"
          multiline
          maxLength={200}
        />
      </GroupeChamps>

      <Bouton titre={existant ? 'Enregistrer' : libre ? 'Ranger dans ce tiroir' : 'Ajouter'} icone={existant ? 'checkmark' : 'add'} onPress={enregistrer} className="mt-4" />
      {libre ? <Bouton titre="Ignorer (ne pas ranger)" variante="discret" onPress={terminer} /> : null}
    </EcranFormulaire>
  );
}
