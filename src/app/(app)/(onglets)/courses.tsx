import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconeAppareil } from '@/composants/appareil';
import { BoutonVerre, EnTeteDegrade, PuceVerre } from '@/composants/en-tete-degrade';
import { Bouton, Carte, Champ, Chargement, Compteur, EtatVide, Segments, Separateur, Texte } from '@/composants/ui';
import { ajusterAchat, calculerListeCourses, compterArticles, texteListeCourses, type Article, type GroupeCourses, type TriCourses } from '@/domaine/courses';
import { emojiPourNom } from '@/domaine/emoji';
import { pasPourUnite } from '@/domaine/quantites';
import { formaterQuantite, memeNom } from '@/domaine/texte';
import { confirmer } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { ajouterLibre, modifierAliment, modifierLibre, rangerCourses, supprimerLibre, type Auteur } from '@/services/inventaire';
import { afficherMessage, lancer, signalerErreur } from '@/services/retours';
import { partagerTexte } from '@/services/partage';
import { useMoi } from '@/services/session';
import { choisirTriCourses, triCoursesEnregistre } from '@/services/tri-courses';
import { useCouleurs } from '@/theme';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Liste de courses partagée, en temps réel : tout ce qui est sous son stock plein. */
export default function EcranCourses() {
  const router = useRouter();
  const { maisonId, maison, appareils, tiroirs, aliments, libres, chargement } = useDonnees();
  const moi = useMoi();
  const auteur: Auteur = { uid: moi.uid, prenom: moi.prenom };
  const insets = useSafeAreaInsets();
  const [edition, setEdition] = useState<Article | null>(null);
  const [tri, setTri] = useState<TriCourses>(triCoursesEnregistre);
  const c = useCouleurs();

  if (chargement) return <Chargement />;

  const groupes = calculerListeCourses(aliments, appareils, libres, tri);
  const total = compterArticles(groupes);
  const articles = groupes.flatMap((g) => g.articles);
  const panier = articles.filter((a) => a.dansPanier).length;

  const basculer = (a: Article) => {
    if (a.genre === 'aliment') lancer(modifierAliment(maisonId, a.id, { dansPanier: !a.dansPanier }, auteur));
    else lancer(modifierLibre(maisonId, a.id, { dansPanier: !a.dansPanier }));
  };

  const partager = () => partagerTexte(texteListeCourses(groupes, maison?.nom ?? 'Maison'));

  const ranger = async () => {
    const nAliments = articles.filter((a) => a.genre === 'aliment' && a.dansPanier).length;
    const libresCoches = libres.filter((l) => l.dansPanier);
    // Sans aucun tiroir, impossible de ranger les articles libres : ils quittent simplement la liste.
    const rangeables = tiroirs.length > 0;
    const details = [
      nAliments ? `${pluriel(nAliments, 'aliment')} remis à leur stock plein.` : null,
      libresCoches.length
        ? rangeables
          ? `${nAliments ? 'Ensuite, pour' : 'Pour'} ${libresCoches.length > 1 ? `chacun des ${libresCoches.length} articles ajoutés à la main` : `« ${libresCoches[0].nom} »`}, tu choisiras un tiroir (ou tu l’ignoreras).`
          : `${pluriel(libresCoches.length, 'article')} retiré${libresCoches.length > 1 ? 's' : ''} de la liste.`
        : null,
    ].filter(Boolean);
    const ok = await confirmer('Ranger les courses ?', details.join(' '), 'Ranger');
    if (!ok) return;
    lancer(rangerCourses(maisonId, aliments, rangeables ? [] : libres, auteur));
    if (rangeables && libresCoches.length) {
      router.push({ pathname: '/aliment/editer', params: { libres: libresCoches.map((l) => l.id).join(','), total: String(libresCoches.length) } });
    } else afficherMessage('Courses rangées ✔');
  };

  return (
    <View className="flex-1 bg-fond">
      <EnTeteDegrade
        couleurs={c.heroCourses}
        motif="cart-outline"
        titre="Courses"
        retour={false}
        actions={total ? <BoutonVerre icone="share-social-outline" libelle="Partager la liste" onPress={partager} /> : undefined}>
        {total ? (
          <View className="gap-2" accessible accessibilityLabel={`${panier} sur ${total} dans le panier`}>
            <View className="flex-row items-baseline justify-between">
              <Texte poids="gras" ton="blanc" className="text-lg">
                {panier} / {total} dans le panier
              </Texte>
              <Texte poids="demi" ton="aucun" className="text-sm text-white/80">
                {Math.round((panier / total) * 100)} %
              </Texte>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-white/25">
              <View className="h-full rounded-full bg-white" style={{ width: `${(panier / total) * 100}%` }} />
            </View>
          </View>
        ) : (
          <View className="flex-row">
            <PuceVerre icone="checkmark-circle" texte="Tout est plein" />
          </View>
        )}
      </EnTeteDegrade>

      <AjoutLibre maisonId={maisonId} auteur={auteur} libres={libres} />

      {total === 0 ? (
        <EtatVide emoji="🛒" titre="Rien à acheter, tout est plein 🎉" texte="Les aliments sous leur stock plein apparaissent ici automatiquement." />
      ) : (
        <ScrollView contentContainerClassName="gap-5 px-4 pb-6 pt-2">
          <Segments
            options={OPTIONS_TRI}
            valeur={tri}
            onChange={(t) => {
              setTri(t);
              choisirTriCourses(t);
            }}
          />
          {groupes.map((g) => (
            <SectionGroupe key={g.cle} groupe={g} onBasculer={basculer} onEditer={setEdition} />
          ))}
          <Texte ton="discret" className="text-center text-sm">
            Touche pour cocher · appui long pour changer la quantité
          </Texte>
        </ScrollView>
      )}

      {total > 0 && (
        <View className="border-t border-bordure bg-carte px-4 pt-3" style={{ paddingBottom: 12 }}>
          <Bouton
            titre={panier ? `J’ai rangé les courses (${panier})` : 'J’ai rangé les courses'}
            icone="bag-check-outline"
            fond="bg-courses"
            desactive={panier === 0}
            onPress={ranger}
          />
          {panier === 0 && (
            <Texte ton="discret" className="pt-2 text-center text-sm">
              Coche ce que tu mets dans le panier.
            </Texte>
          )}
        </View>
      )}

      {edition && (
        <FeuilleQuantite
          key={edition.id}
          article={edition}
          basEcran={insets.bottom}
          onFermer={() => setEdition(null)}
          maisonId={maisonId}
          auteur={auteur}
        />
      )}
    </View>
  );
}

/* ---------------- Ajout d'un article libre ---------------- */

function AjoutLibre({ maisonId, auteur, libres }: { maisonId: string; auteur: Auteur; libres: ReturnType<typeof useDonnees>['libres'] }) {
  const c = useCouleurs();
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const ajouter = () => {
    const propre = nom.trim();
    if (!propre) return setErreur('Écris le nom de l’article.');
    if (propre.length > 40) return setErreur('40 caractères maximum.');
    const existant = libres.find((l) => memeNom(l.nom, propre));
    if (existant) {
      lancer(modifierLibre(maisonId, existant.id, { quantite: existant.quantite + 1, dansPanier: false }));
      afficherMessage(`${existant.nom} : ${formaterQuantite(existant.quantite + 1, existant.unite)}`);
    } else {
      lancer(ajouterLibre(maisonId, propre, 1, 'pièce', auteur));
    }
    setNom('');
    setErreur(null);
  };

  return (
    <View className="flex-row items-start gap-2 px-4 pb-2 pt-4">
      <Champ
        className="flex-1"
        value={nom}
        onChangeText={(v) => {
          setNom(v);
          if (erreur) setErreur(null);
        }}
        placeholder="Ajouter un article (éponges, pain…)"
        maxLength={40}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={ajouter}
        erreur={erreur}
        accessibilityLabel="Nouvel article de courses"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter l’article"
        onPress={ajouter}
        className="size-12 items-center justify-center rounded-xl bg-courses active:opacity-80">
        <Ionicons name="add" size={26} color={c.blanc ?? '#fff'} />
      </Pressable>
    </View>
  );
}

/* ---------------- Groupes et lignes ---------------- */

const OPTIONS_TRI: { valeur: TriCourses; libelle: string }[] = [
  { valeur: 'appareil', libelle: 'Par appareil' },
  { valeur: 'rayon', libelle: 'Par rayon' },
];

function SectionGroupe({ groupe, onBasculer, onEditer }: { groupe: GroupeCourses; onBasculer: (a: Article) => void; onEditer: (a: Article) => void }) {
  const c = useCouleurs();
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2" accessibilityRole="header">
        {groupe.type === 'rayon' ? (
          <View className="size-9 items-center justify-center rounded-xl bg-courses-pale">
            <Text style={{ fontSize: 18 }}>{groupe.emoji}</Text>
          </View>
        ) : groupe.type === 'libre' ? (
          <View className="size-9 items-center justify-center rounded-xl bg-courses-pale">
            <Ionicons name="list" size={20} color={c.courses} />
          </View>
        ) : (
          <IconeAppareil type={groupe.type} taille="petite" />
        )}
        <Texte poids="demi" className="flex-1 text-base" numberOfLines={1}>
          {groupe.titre}
        </Texte>
        <Texte ton="secondaire" className="text-sm">
          {groupe.articles.length}
        </Texte>
      </View>
      <Carte className="overflow-hidden">
        {groupe.articles.map((a, i) => (
          <View key={a.id}>
            {i > 0 && <Separateur />}
            <LigneArticle article={a} onBasculer={() => onBasculer(a)} onEditer={() => onEditer(a)} />
          </View>
        ))}
      </Carte>
    </View>
  );
}

function LigneArticle({ article: a, onBasculer, onEditer }: { article: Article; onBasculer: () => void; onEditer: () => void }) {
  const quantite = a.genre === 'aliment' ? a.aRanger : a.quantite;
  const ajuste = a.genre === 'aliment' && a.aliment.achatQuantite != null;
  const sousTitre =
    a.genre === 'aliment'
      ? a.epuise
        ? 'Épuisé'
        : `Reste ${formaterQuantite(a.aliment.quantite, a.unite)} sur ${formaterQuantite(a.aliment.quantiteMax, a.unite)}`
      : null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: a.dansPanier }}
      accessibilityLabel={`${a.nom}, ${formaterQuantite(quantite, a.unite)}${sousTitre ? `, ${sousTitre}` : ''}`}
      accessibilityHint="Appui long pour changer la quantité"
      accessibilityActions={[{ name: 'longpress', label: 'Changer la quantité' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onEditer()}
      onPress={onBasculer}
      onLongPress={onEditer}
      delayLongPress={400}
      className="min-h-16 flex-row items-center gap-3 px-3 py-2 active:bg-carte-enfoncee">
      <CaseACocher coche={a.dansPanier} />
      <Text className="text-2xl" accessible={false}>
        {emojiPourNom(a.nom)}
      </Text>
      <View className="flex-1">
        <Texte poids="moyen" ton={a.dansPanier ? 'discret' : 'encre'} className={`text-base ${a.dansPanier ? 'line-through' : ''}`} numberOfLines={1}>
          {a.nom}
        </Texte>
        {sousTitre ? (
          <Texte ton={a.genre === 'aliment' && a.epuise ? 'rouge' : 'secondaire'} poids={a.genre === 'aliment' && a.epuise ? 'demi' : 'normal'} className="text-sm" numberOfLines={1}>
            {sousTitre}
          </Texte>
        ) : null}
      </View>
      <View className="items-end">
        <Texte poids="demi" ton={a.dansPanier ? 'discret' : 'courses'} className="text-base" numberOfLines={1}>
          {a.genre === 'aliment' ? '+' : '×'}
          {formaterQuantite(quantite, a.unite).replace(/ pièces?$/, '')}
        </Texte>
        {ajuste ? (
          <Texte ton="discret" className="text-xs">
            ajusté
          </Texte>
        ) : null}
      </View>
    </Pressable>
  );
}

function CaseACocher({ coche }: { coche: boolean }) {
  return (
    <View className={`size-7 items-center justify-center rounded-lg border-2 ${coche ? 'border-courses bg-courses' : 'border-encre-3'}`}>
      {coche ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
    </View>
  );
}

/* ---------------- Appui long : quantité achetée ---------------- */

function FeuilleQuantite({
  article: a,
  basEcran,
  onFermer,
  maisonId,
  auteur,
}: {
  article: Article;
  basEcran: number;
  onFermer: () => void;
  maisonId: string;
  auteur: Auteur;
}) {
  const c = useCouleurs();
  const pas = pasPourUnite(a.unite);
  const [q, setQ] = useState(a.genre === 'aliment' ? a.aRanger : a.quantite);
  const suffixe = a.unite === 'pièce' || a.unite === 'portion' ? undefined : a.unite;

  const valider = () => {
    try {
      if (a.genre === 'aliment') {
        lancer(modifierAliment(maisonId, a.id, { achatQuantite: ajusterAchat(a.aliment, q), dansPanier: true }, auteur));
      } else {
        lancer(modifierLibre(maisonId, a.id, { quantite: q }));
      }
      onFermer();
    } catch (e) {
      signalerErreur(e);
    }
  };

  const reinitialiser = () => {
    if (a.genre !== 'aliment') return;
    lancer(modifierAliment(maisonId, a.id, { achatQuantite: null }, auteur));
    onFermer();
  };

  const supprimer = () => {
    lancer(supprimerLibre(maisonId, a.id));
    onFermer();
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onFermer} statusBarTranslucent>
      <Pressable className="flex-1 justify-end bg-voile" onPress={onFermer} accessibilityLabel="Fermer">
        <Pressable
          className="w-full max-w-lg gap-4 self-center rounded-t-3xl bg-carte px-6 pt-3"
          style={{ paddingBottom: basEcran + 16 }}
          onPress={() => {}}
          accessibilityViewIsModal>
          <View className="items-center">
            <View className="h-1 w-10 rounded-full bg-bordure" />
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">{emojiPourNom(a.nom)}</Text>
            <View className="flex-1">
              <Texte poids="gras" className="text-xl" numberOfLines={1} accessibilityRole="header">
                {a.nom}
              </Texte>
              <Texte ton="secondaire" className="text-sm">
                {a.genre === 'aliment' ? `Il manque ${formaterQuantite(a.manque, a.unite)} pour le stock plein` : 'Article libre'}
              </Texte>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onFermer}
              className="size-12 items-center justify-center rounded-full active:bg-carte-enfoncee">
              <Ionicons name="close" size={24} color={c.encre2} />
            </Pressable>
          </View>

          <View className="items-center gap-2">
            <Texte poids="moyen" ton="secondaire" className="text-sm">
              {a.genre === 'aliment' ? 'Quantité achetée' : 'Quantité'}
            </Texte>
            <Compteur libelle="quantité achetée" valeur={q} onChange={setQ} min={pas} minSaisie={0.001} pas={pas} suffixe={suffixe} />
            {a.genre === 'aliment' && q > a.manque ? (
              <Texte ton="discret" className="text-center text-sm">
                Plus que prévu : le stock plein passera à {formaterQuantite(a.aliment.quantite + q, a.unite)}.
              </Texte>
            ) : a.genre === 'aliment' && q < a.manque ? (
              <Texte ton="discret" className="text-center text-sm">
                Moins que prévu : le reste restera dans la liste.
              </Texte>
            ) : null}
          </View>

          <Bouton titre={a.genre === 'aliment' ? 'Mettre dans le panier' : 'Enregistrer'} icone="checkmark" fond="bg-courses" onPress={valider} />
          {a.genre === 'aliment' && a.aliment.achatQuantite != null ? (
            <Bouton titre={`Revenir à ${formaterQuantite(a.manque, a.unite)}`} variante="secondaire" onPress={reinitialiser} />
          ) : null}
          {a.genre === 'libre' ? <Bouton titre="Retirer de la liste" icone="trash-outline" variante="danger" onPress={supprimer} /> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
