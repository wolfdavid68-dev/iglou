import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import Animated, { LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconeAppareil } from '@/composants/appareil';
import { BoutonVerre, EnTeteDegrade, PuceVerre } from '@/composants/en-tete-degrade';
import { Bouton, Carte, Champ, Chargement, Compteur, Libelle, Segments, Separateur, Texte, type NomIcone } from '@/composants/ui';
import { ajusterAchat, calculerListeCourses, compterArticles, texteListeCourses, type Article, type GroupeCourses, type TriCourses } from '@/domaine/courses';
import { emojiPourNom } from '@/domaine/emoji';
import { pasPourUnite } from '@/domaine/quantites';
import { formaterQuantite, memeNom, suffixeUnite } from '@/domaine/texte';
import { confirmer } from '@/services/dialogue';
import { useDonnees } from '@/services/donnees-maison';
import { tic } from '@/services/haptique';
import { ajouterLibre, modifierAliment, modifierLibre, rangerCourses, supprimerLibre, type Auteur } from '@/services/inventaire';
import { afficherMessage, lancer, signalerErreur } from '@/services/retours';
import { partagerTexte } from '@/services/partage';
import { useMoi } from '@/services/session';
import { choisirTriCourses, triCoursesEnregistre } from '@/services/tri-courses';
import { useCouleurs } from '@/theme';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Chiffres de même largeur : le compteur ne « danse » pas quand on coche. */
const CHIFFRES: TextStyle = { fontVariant: ['tabular-nums'] };

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
    tic();
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
    } else afficherMessage('Courses rangées');
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
          <Progression panier={panier} total={total} />
        ) : (
          <View className="flex-row">
            <PuceVerre icone="checkmark-circle" texte="Tout est plein" />
          </View>
        )}
      </EnTeteDegrade>

      <AjoutLibre maisonId={maisonId} auteur={auteur} libres={libres} />

      {total === 0 ? (
        <EtatVideIcone icone="checkmark-done" titre="Rien à acheter, tout est plein" texte="Les aliments sous leur stock plein apparaissent ici automatiquement." />
      ) : (
        <ScrollView contentContainerClassName="gap-6 px-4 pb-6 pt-2">
          <Segments
            options={OPTIONS_TRI}
            valeur={tri}
            onChange={(t) => {
              setTri(t);
              choisirTriCourses(t);
            }}
          />
          {/* La coche s'anime quand on coche, pas à l'ouverture de l'écran. */}
          <LayoutAnimationConfig skipEntering>
            <View className="gap-6">
              {groupes.map((g) => (
                <SectionGroupe key={g.cle} groupe={g} onBasculer={basculer} onEditer={setEdition} />
              ))}
            </View>
          </LayoutAnimationConfig>
          <Texte ton="discret" className="px-4 text-center text-sm">
            Touche un article pour le cocher, appui long pour changer la quantité.
          </Texte>
        </ScrollView>
      )}

      {total > 0 && (
        <View className="gap-2 border-t border-contour bg-carte px-4 pb-3 pt-3">
          {panier ? (
            <Bouton titre={`J’ai rangé les courses (${panier})`} icone="bag-check-outline" onPress={ranger} />
          ) : (
            <>
              {/* Désactivé mais lisible : fond enfoncé et encre secondaire (≥ 4,5:1), plutôt qu'un vert délavé. */}
              <View
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel="J’ai rangé les courses"
                accessibilityHint="Coche d’abord ce que tu mets dans le panier."
                className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-[18px] bg-carte-enfoncee px-5">
                <Ionicons name="bag-check-outline" size={20} color={c.encre2} />
                <Texte poids="demi" ton="secondaire" className="text-base" numberOfLines={1}>
                  J’ai rangé les courses
                </Texte>
              </View>
              <Texte ton="discret" className="text-center text-sm" importantForAccessibility="no">
                Coche ce que tu mets dans le panier.
              </Texte>
            </>
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

/* ---------------- Progression (dans l'en-tête) ---------------- */

/** « 3 / 14 dans le panier » : grand chiffre et rail de progression, sur une tuile claire. */
function Progression({ panier, total }: { panier: number; total: number }) {
  const c = useCouleurs();
  const part = total ? panier / total : 0;
  return (
    <View
      style={{ boxShadow: c.ombre.carte }}
      className="gap-3 rounded-[20px] border border-contour bg-carte px-4 pb-4 pt-3"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${panier} sur ${total} dans le panier`}
      accessibilityValue={{ min: 0, max: total, now: panier }}>
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-row items-baseline gap-2">
          <Texte poids="titre-gras" className="text-[40px] leading-[44px]" style={CHIFFRES}>
            {panier}
          </Texte>
          <Texte poids="titre" ton="discret" className="text-xl" style={CHIFFRES}>
            / {total}
          </Texte>
          <Texte poids="moyen" ton="secondaire" className="text-sm">
            dans le panier
          </Texte>
        </View>
        <Texte poids="demi" ton={part === 1 ? 'frigo' : 'discret'} className="pb-1.5 text-sm" style={CHIFFRES}>
          {Math.round(part * 100)} %
        </Texte>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-carte-enfoncee">
        <View className="h-full rounded-full bg-frigo-fort" style={{ width: `${part * 100}%` }} />
      </View>
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
    tic();
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
    <View className="flex-row items-start gap-2 px-4 pb-3 pt-4">
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
        style={{ boxShadow: c.ombre.carte }}
        className="size-[52px] items-center justify-center rounded-2xl bg-frigo-fort active:scale-95 active:opacity-90">
        <Ionicons name="add" size={28} color={c.blanc} />
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
  const coches = groupe.articles.filter((a) => a.dansPanier).length;
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3 px-1" accessibilityRole="header">
        {groupe.type === 'rayon' ? (
          <View className="size-9 items-center justify-center rounded-xl bg-carte-enfoncee">
            <Text className="text-lg" accessible={false}>
              {groupe.emoji}
            </Text>
          </View>
        ) : groupe.type === 'libre' ? (
          <View className="size-9 items-center justify-center rounded-xl bg-carte-enfoncee">
            <Ionicons name="create-outline" size={19} color={c.encre2} />
          </View>
        ) : (
          <IconeAppareil type={groupe.type} taille="petite" />
        )}
        <Texte poids="titre" className="flex-1 text-lg" numberOfLines={1}>
          {groupe.titre}
        </Texte>
        <Texte
          poids="moyen"
          ton="discret"
          className="text-sm"
          style={CHIFFRES}
          accessibilityLabel={`${coches} sur ${groupe.articles.length} cochés`}>
          {coches} / {groupe.articles.length}
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
  const epuise = a.genre === 'aliment' && a.epuise;
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
      className="min-h-16 flex-row items-center gap-3 py-2 pl-4 pr-4 active:bg-carte-enfoncee">
      <CaseACocher coche={a.dansPanier} />
      <Text className={`text-2xl ${a.dansPanier ? 'opacity-50' : ''}`} accessible={false}>
        {emojiPourNom(a.nom)}
      </Text>
      <View className="flex-1 gap-0.5">
        <Texte poids="moyen" ton={a.dansPanier ? 'discret' : 'encre'} className={`text-base ${a.dansPanier ? 'line-through' : ''}`} numberOfLines={1}>
          {a.nom}
        </Texte>
        {sousTitre ? (
          <Texte ton={epuise && !a.dansPanier ? 'rouge' : 'secondaire'} poids={epuise ? 'demi' : 'normal'} className="text-sm" numberOfLines={1}>
            {sousTitre}
          </Texte>
        ) : null}
      </View>
      <View className="items-end">
        <Texte poids="titre-gras" ton={a.dansPanier ? 'discret' : 'courses'} className="text-[17px]" style={CHIFFRES} numberOfLines={1}>
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

/** Case ronde : filet discret, puis pastille sapin avec une coche qui apparaît en douceur. */
function CaseACocher({ coche }: { coche: boolean }) {
  const c = useCouleurs();
  return (
    <View className={`size-7 items-center justify-center rounded-full ${coche ? 'bg-frigo-fort' : 'border-2 border-encre-3'}`}>
      {coche ? (
        <Animated.View entering={ZoomIn.duration(160)}>
          <Ionicons name="checkmark" size={18} color={c.blanc} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** État vide : icône dans une tuile teintée (pas d'emoji d'interface). */
function EtatVideIcone({ icone, titre, texte }: { icone: NomIcone; titre: string; texte: string }) {
  const c = useCouleurs();
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <View className="mb-1 size-16 items-center justify-center rounded-[20px] bg-frigo-pale">
        <Ionicons name={icone} size={30} color={c.frigoTexte} />
      </View>
      <Texte poids="titre" className="text-center text-xl" accessibilityRole="header">
        {titre}
      </Texte>
      <Texte ton="secondaire" className="text-center text-base">
        {texte}
      </Texte>
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
  const suffixe = suffixeUnite(a.unite);

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
          className="w-full max-w-lg gap-5 self-center rounded-t-[28px] border border-b-0 border-contour bg-carte px-6 pt-3"
          style={{ paddingBottom: basEcran + 16, boxShadow: c.ombre.relief }}
          onPress={() => {}}
          accessibilityViewIsModal>
          <View className="items-center">
            <View className="h-1 w-10 rounded-full bg-bordure" />
          </View>
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-2xl bg-carte-enfoncee">
              <Text className="text-[28px]" accessible={false}>
                {emojiPourNom(a.nom)}
              </Text>
            </View>
            <View className="flex-1">
              <Texte poids="titre-gras" className="text-[22px] leading-7" numberOfLines={1} accessibilityRole="header">
                {a.nom}
              </Texte>
              <Texte ton="secondaire" className="text-sm">
                {a.genre === 'aliment' ? `Il manque ${formaterQuantite(a.manque, a.unite)} pour le stock plein` : 'Article ajouté à la main'}
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

          <View className="items-center gap-2 py-1">
            <Libelle>{a.genre === 'aliment' ? 'Quantité achetée' : 'Quantité'}</Libelle>
            <Compteur libelle="quantité achetée" valeur={q} onChange={setQ} min={pas} minSaisie={0.001} pas={pas} suffixe={suffixe} />
            {a.genre === 'aliment' && q > a.manque ? (
              <Texte ton="secondaire" className="text-center text-sm">
                Plus que prévu : le stock plein passera à {formaterQuantite(a.aliment.quantite + q, a.unite)}.
              </Texte>
            ) : a.genre === 'aliment' && q < a.manque ? (
              <Texte ton="secondaire" className="text-center text-sm">
                Moins que prévu : le reste restera dans la liste.
              </Texte>
            ) : null}
          </View>

          <View className="gap-2">
            <Bouton titre={a.genre === 'aliment' ? 'Mettre dans le panier' : 'Enregistrer'} icone="checkmark" onPress={valider} />
            {a.genre === 'aliment' && a.aliment.achatQuantite != null ? (
              <Bouton titre={`Revenir à ${formaterQuantite(a.manque, a.unite)}`} variante="secondaire" onPress={reinitialiser} />
            ) : null}
            {a.genre === 'libre' ? <Bouton titre="Retirer de la liste" icone="trash-outline" variante="danger" onPress={supprimer} /> : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
