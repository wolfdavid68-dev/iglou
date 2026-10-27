import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { texteStock } from '@/composants/aliment';
import { EcranFormulaire } from '@/composants/formulaire';
import { Bouton, Carte, Champ, Compteur, EnTete, EtatVide, Segments, Texte } from '@/composants/ui';
import { formaterDateCourte, lireDateSaisie, versDateISO } from '@/domaine/dates';
import { emojiPourNom } from '@/domaine/emoji';
import { suggestionsNoms, tiroirParDefaut, trouverDoublon } from '@/domaine/inventaire';
import { ajouterALExistant, fixerQuantite, modifierMaximum, pasPourUnite, stockInitial } from '@/domaine/quantites';
import { UNITES, type Aliment, type CourseLibre, type Tiroir, type Unite } from '@/domaine/types';
import { choisirTiroir } from '@/services/actions-aliment';
import { confirmer, demander } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { creerAliment, modifierAliment, supprimerLibre, type Auteur } from '@/services/inventaire';
import { afficherMessage, lancer } from '@/services/retours';
import { useMoi } from '@/services/session';

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

  const changerMaximum = async (max: number) => {
    if (!(max > 0)) return;
    const r = modifierMaximum(stock, max);
    if (r.quantiteReduite) {
      const ok = await confirmer(
        'Baisser le stock plein ?',
        `La quantité actuelle (${stock.quantite}) dépasse ${max}. Elle sera ramenée à ${max}.`,
        'Baisser',
      );
      if (!ok) return;
    }
    setStock({ quantite: r.quantite, quantiteMax: r.quantiteMax });
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
    lancer(modifierAliment(maisonId, cible.id, nouveau));
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

    const champs = {
      nom: propre,
      unite,
      quantite: stock.quantite,
      quantiteMax: Math.max(stock.quantiteMax, stock.quantite),
      datePeremption,
      note: note.trim() ? note.trim().slice(0, 200) : null,
    };

    if (existant) {
      lancer(modifierAliment(maisonId, existant.id, { ...champs, tiroirId: tiroir.id, appareilId: tiroir.appareilId }));
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
      <View className="flex-row items-start gap-3">
        <View className="size-14 items-center justify-center rounded-2xl bg-carte-enfoncee">
          <Text className="text-3xl">{emojiPourNom(nom)}</Text>
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
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Suggestion : ${s}`}
              onPress={() => {
                setNom(s);
                setFocusNom(false);
              }}
              className="min-h-12 flex-row items-center gap-1 rounded-full border border-bordure bg-carte px-4 active:bg-carte-enfoncee">
              <Text>{emojiPourNom(s)}</Text>
              <Texte className="text-sm" numberOfLines={1}>
                {s}
              </Texte>
            </Pressable>
          ))}
        </View>
      )}

      {doublon && (
        <Carte className="gap-2 border-orange bg-orange-pale p-4">
          <Texte poids="demi" className="text-base">
            Déjà dans ce tiroir : {doublon.nom} ({texteStock(doublon)})
          </Texte>
          <Bouton titre={`Ajouter à l’existant (+${stock.quantite})`} icone="add-circle-outline" onPress={() => ajouterAExistant(doublon)} />
        </Carte>
      )}

      <View className="gap-1.5">
        <Texte poids="moyen" ton="secondaire" className="text-sm">
          Emplacement
        </Texte>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Emplacement : ${appareil?.nom ?? ''}, ${tiroir.nom}. Changer`}
          onPress={changerTiroir}
          className="min-h-12 flex-row items-center rounded-xl border border-bordure bg-carte px-4 py-3 active:bg-carte-enfoncee">
          <Texte className="flex-1 text-base" numberOfLines={1}>
            {appareil?.nom ?? '?'} › {tiroir.nom}
          </Texte>
          <Texte poids="demi" ton="frigo" className="text-sm">
            Changer
          </Texte>
        </Pressable>
      </View>

      <Segments libelle="Unité" options={OPTIONS_UNITES} valeur={unite} onChange={setUnite} />

      <View className="gap-1.5">
        <Texte poids="moyen" ton="secondaire" className="text-sm">
          Quantité
        </Texte>
        <Compteur libelle="quantité" valeur={stock.quantite} onChange={changerQuantite} pas={pas} suffixe={unite === 'pièce' || unite === 'portion' ? undefined : unite} />
      </View>

      {existant ? (
        <View className="gap-1.5">
          <Texte poids="moyen" ton="secondaire" className="text-sm">
            Stock plein
          </Texte>
          <Compteur
            libelle="stock plein"
            valeur={stock.quantiteMax}
            onChange={changerMaximum}
            min={pas}
            pas={pas}
            suffixe={unite === 'pièce' || unite === 'portion' ? undefined : unite}
          />
          <Texte ton="discret" className="text-sm">
            Ce qui manque pour revenir au stock plein part dans la liste de courses.
          </Texte>
        </View>
      ) : (
        <Texte ton="discret" className="-mt-2 text-sm">
          Cette quantité devient le « stock plein » : ce qui manquera ensuite ira dans la liste de courses.
        </Texte>
      )}

      <View className="gap-2">
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
            <Pressable
              key={r.libelle}
              accessibilityRole="button"
              accessibilityLabel={`Péremption dans ${r.libelle}`}
              onPress={() => {
                const d = new Date();
                d.setDate(d.getDate() + r.jours);
                setDate(formaterDateCourte(versDateISO(d)));
                setErreurs((e) => ({ ...e, date: undefined }));
              }}
              className="min-h-12 justify-center rounded-full border border-bordure bg-carte px-4 active:bg-carte-enfoncee">
              <Texte className="text-sm">{r.libelle}</Texte>
            </Pressable>
          ))}
          {date ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setDate('')}
              className="min-h-12 justify-center rounded-full px-4 active:bg-carte-enfoncee">
              <Texte ton="secondaire" className="text-sm">
                Effacer
              </Texte>
            </Pressable>
          ) : null}
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

      <Bouton titre={existant ? 'Enregistrer' : libre ? 'Ranger dans ce tiroir' : 'Ajouter'} icone={existant ? 'checkmark' : 'add'} onPress={enregistrer} className="mt-2" />
      {libre ? <Bouton titre="Ignorer (ne pas ranger)" variante="discret" onPress={terminer} /> : null}
    </EcranFormulaire>
  );
}
