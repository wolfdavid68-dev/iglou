<contexte>
Je veux créer une application Android d'inventaire de frigo et de congélateur, destinée au grand public.
Plusieurs personnes (famille, colocataires) rejoignent la même « maison » et voient le même inventaire, synchronisé en temps réel.

Le but :
- savoir à tout moment ce qu'il y a dans chaque appareil et dans quel tiroir, sans ouvrir la porte ;
- générer automatiquement la liste de courses de ce qui manque.

L'interface doit être simple et compréhensible sans explication. L'inventaire ne doit JAMAIS être perdu.
</contexte>

<objectif>
Construis une application Android complète et fonctionnelle qui permet de :
1. Créer un compte, puis créer une maison ou en rejoindre une avec un code d'invitation.
2. Créer un ou plusieurs appareils (frigo, congélateur) et définir le nombre et le nom de leurs tiroirs.
3. Ajouter des aliments en choisissant à la volée l'appareil et le tiroir.
4. Déplacer un aliment d'un tiroir à un autre par glisser-déposer.
5. Mémoriser pour chaque aliment une quantité maximale (le « stock plein ») et calculer ce qui manque.
6. Consulter une liste de courses partagée, générée automatiquement à partir des manques.
7. Voir les changements des autres membres en direct.
8. Conserver l'inventaire de façon permanente dans le cloud, et pouvoir l'exporter.
</objectif>

<stack_technique>
- Android uniquement (aucun réglage spécifique à iOS).
- Expo (dernier SDK stable), React Native, TypeScript en mode strict, expo-router.
- Backend : Supabase (Auth, Postgres, Realtime, Row Level Security).
- Données serveur : TanStack Query.
  - Le cache est persisté localement (expo-sqlite/kv-store) pour le mode hors ligne.
  - Les mutations mises en pause sont rejouées au retour du réseau.
- Glisser-déposer : react-native-gesture-handler + react-native-reanimated.
- Autres modules Expo : expo-haptics, expo-file-system, expo-sharing, expo-document-picker.
- Configuration Supabase :
  - variables `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `.env` ;
  - un fichier `.env.example` versionné ;
  - la clé `service_role` ne doit JAMAIS apparaître dans l'app.
- Si le MCP Supabase est disponible, utilise-le pour créer le projet et appliquer les migrations. Sinon, donne-moi les étapes exactes.
</stack_technique>

<modele_de_donnees>
Tables Postgres, chacune créée par une migration SQL dans `supabase/migrations/` :

- **profils** : id (= auth.users.id), prenom, created_at
- **maisons** : id, nom, code_invitation (6 caractères, unique), created_by, created_at
- **membres** : maison_id, user_id, role (`proprietaire` | `membre`), joined_at. Clé primaire : (maison_id, user_id).
- **appareils** : id, maison_id, nom, type (`frigo` | `congelateur`), ordre, created_at
- **tiroirs** : id, appareil_id, nom, ordre
- **aliments** :
  - id, tiroir_id, nom ;
  - quantite (>= 0), quantite_max (> 0) ;
  - unite (`pièce` | `g` | `kg` | `L` | `portion`) ;
  - date_peremption (facultative), note (facultative) ;
  - dans_panier (booléen, false par défaut : coché pendant les courses) ;
  - ajoute_par, modifie_par, created_at, updated_at.
- **courses_libres** (articles ajoutés à la main, absents de l'inventaire) : id, maison_id, nom, quantite, unite, dans_panier, ajoute_par, created_at

Règles :
- Suppression en cascade : maison → appareils → tiroirs → aliments, et maison → courses_libres.
- `updated_at` est mis à jour automatiquement par un trigger.
- Règle du maximum, appliquée par un trigger Postgres (BEFORE INSERT OR UPDATE sur aliments) pour rester cohérente quel que soit le téléphone :
  - à l'insertion, `quantite_max = quantite` ;
  - à chaque mise à jour, si `quantite > quantite_max`, alors `quantite_max = quantite` ;
  - diminuer `quantite` ne modifie JAMAIS `quantite_max` ;
  - `quantite_max` ne baisse que si l'utilisateur la modifie explicitement dans la fiche de l'aliment.
- Vue SQL `liste_courses` : tous les aliments de la maison avec `quantite < quantite_max`, et le manque calculé `quantite_max - quantite`.

Row Level Security, OBLIGATOIRE sur toutes les tables :
- un utilisateur ne lit et ne modifie que les données des maisons dont il est membre ;
- seul le propriétaire peut supprimer la maison, retirer un membre ou régénérer le code d'invitation.

Rejoindre une maison passe par une fonction RPC `rejoindre_maison(code)` en `security definer`, pour ne jamais exposer la liste des maisons.

Realtime est activé sur : appareils, tiroirs, aliments, courses_libres.
</modele_de_donnees>

<fonctionnalites>
<comptes_et_maisons>
- Inscription et connexion par e-mail et mot de passe, avec « Mot de passe oublié ». La session reste ouverte entre deux lancements.
- Après la première connexion, deux choix : « Créer ma maison » ou « Rejoindre une maison (code) ».
- Écran « Ma maison » :
  - le nom de la maison ;
  - le code d'invitation affiché en grand, avec un bouton « Partager » (WhatsApp, SMS…) ;
  - la liste des membres.
- Le propriétaire peut retirer un membre et régénérer le code.
- Un membre peut quitter la maison.
- Un utilisateur peut appartenir à plusieurs maisons et passer de l'une à l'autre depuis l'en-tête.
</comptes_et_maisons>

<appareils>
- Accueil : la liste des appareils, avec l'icône du type, le nombre d'aliments et un badge « X à racheter ».
- « Ajouter un appareil » : nom, type, nombre de tiroirs (1 à 20). Les tiroirs « Tiroir 1 », « Tiroir 2 »… sont créés automatiquement.
- Modifier un appareil : le renommer ; ajouter, renommer, supprimer et réordonner ses tiroirs.
- Supprimer un appareil : toujours demander confirmation, en indiquant le nombre d'aliments qui seront supprimés.
</appareils>

<aliments>
- Écran d'un appareil : les tiroirs empilés verticalement, et dans chacun les aliments sous forme de cartes.
- Bouton « + » sur chaque tiroir. Bouton flottant « + » global, où le formulaire laisse choisir l'appareil et le tiroir.
- Formulaire d'ajout :
  - nom : obligatoire, avec autocomplétion à partir des aliments déjà saisis dans la maison ;
  - quantité : 1 par défaut ;
  - unité ;
  - date de péremption : facultative ;
  - note : facultative.
- Ajout d'un aliment qui existe déjà dans le même tiroir : proposer « Ajouter à l'existant » plutôt que de créer un doublon.
- Chaque carte affiche :
  - l'emoji, le nom et « quantite / quantite_max » (ex. « 2 / 6 ») ;
  - une petite jauge de remplissage.
- Boutons rapides « − » / « + » sur chaque carte :
  - « − » diminue la quantité et le maximum ne bouge pas ;
  - « + » au-delà du maximum relève automatiquement le maximum.
- À 0, l'aliment N'EST PAS supprimé :
  - la carte passe en grisé avec le badge « Épuisé » ;
  - l'aliment reste dans son tiroir et apparaît dans la liste de courses.
- Fiche de l'aliment (on la touche pour l'ouvrir) :
  - tout est modifiable, y compris le maximum, que l'on peut baisser à la main ;
  - mention « Ajouté par Marie il y a 2 jours » ;
  - bouton « Supprimer », qui affiche le même bandeau « ANNULER » que la corbeille.
- Supprimer est le seul moyen de retirer un aliment de l'inventaire et des courses. Deux façons de le faire :
  - glisser la carte vers la corbeille (voir <glisser_deposer>), c'est la méthode principale ;
  - utiliser le bouton « Supprimer » de la fiche.
- Couleur selon la péremption :
  - date dépassée : rouge ;
  - moins de 3 jours : orange ;
  - sinon : neutre.
</aliments>

<glisser_deposer>
- Appui long sur une carte : la carte se soulève (léger agrandissement, ombre, vibration).
- Pendant le glisser, le tiroir survolé se met en surbrillance.
- Relâcher sur un tiroir :
  - la carte s'y déplace aussitôt (mise à jour optimiste), puis la modification est envoyée à Supabase ;
  - en cas d'échec, la carte retourne à sa place et un message s'affiche.
- Relâcher ailleurs : la carte retourne à sa place, avec une animation.
- La liste défile automatiquement quand le doigt approche du bord de l'écran. Les zones de défilement automatique se trouvent juste au-dessus de la zone corbeille, sans la chevaucher.

Zone corbeille pour supprimer :
- Dès que le glisser commence, une zone « 🗑️ Glisser ici pour supprimer » apparaît en bas de l'écran. Elle monte avec une animation, mesure environ 96 dp de haut et occupe toute la largeur, donc elle est facile à atteindre avec le pouce.
- Au repos, elle est rouge pâle. Quand la carte la survole :
  - elle devient rouge vif et grossit légèrement ;
  - l'icône de la corbeille s'ouvre ;
  - le téléphone vibre (expo-haptics).
- Relâcher la carte sur la corbeille la fait disparaître avec une animation (rétrécissement puis fondu). L'aliment est supprimé immédiatement, sans boîte de dialogue de confirmation.
- Un bandeau en bas de l'écran affiche « Œufs supprimé · ANNULER » pendant 5 secondes. « Annuler » réinsère l'aliment à l'identique : même id, même tiroir, même quantité, même maximum, même auteur, même date d'ajout.
- Quand le glisser se termine, la corbeille disparaît. Elle n'est jamais visible en dehors d'un glisser.
- Alternative obligatoire : l'action « Déplacer vers… » dans le menu de la carte. Elle permet de choisir n'importe quel appareil et tiroir de la maison, par exemple pour passer un aliment du frigo au congélateur.
- Un déplacement ne modifie ni la quantité ni le maximum.
</glisser_deposer>

<liste_de_courses>
- Onglet dédié « Courses », partagé par toute la maison et synchronisé en temps réel.
- Contenu :
  - automatiquement, chaque aliment dont la quantité est inférieure au maximum, avec ce qui manque (ex. « Œufs – 4 pièces ») ;
  - les articles « courses_libres » ajoutés à la main.
- Les articles sont regroupés par appareil (Frigo, Congélateur), puis viennent les articles libres. Les aliments épuisés (0) apparaissent en premier.
- Pendant les courses, cocher un article le passe à `dans_panier = true` (barré). Les autres membres le voient en direct, ce qui évite d'acheter deux fois la même chose.
- Bouton « J'ai rangé les courses » :
  - chaque aliment coché remonte à son maximum (`quantite = quantite_max`) dans son tiroir d'origine, et `dans_panier` repasse à false ;
  - chaque article libre coché ouvre le formulaire d'ajout, pour le ranger dans un tiroir (son maximum devient alors la quantité saisie) ou l'ignorer.
- Un appui long sur un article permet d'ajuster la quantité réellement achetée avant de ranger :
  - si elle dépasse le maximum, le maximum est relevé ;
  - si elle est inférieure, l'article reste dans la liste pour le reste.
- Bouton « Partager la liste » : envoie la liste en texte (WhatsApp, SMS…).
- Si rien ne manque, afficher l'état vide « Rien à acheter, tout est plein 🎉 ».
</liste_de_courses>

<temps_reel_et_hors_ligne>
- Les changements faits par un autre membre apparaissent en moins de 2 secondes, sans rafraîchir (Supabase Realtime filtré sur la maison active).
- Hors ligne :
  - l'inventaire et la liste de courses restent consultables (très utile au supermarché) ;
  - les modifications sont mises en file d'attente puis envoyées au retour du réseau ;
  - un bandeau discret « Hors ligne – synchronisation au retour du réseau » s'affiche.
- En cas de conflit, la modification la plus récente l'emporte (`updated_at`).
</temps_reel_et_hors_ligne>

<recherche>
- Une recherche globale dans la maison trouve un aliment par son nom.
- Chaque résultat affiche l'emplacement (« Appareil › Tiroir ») et la quantité (« 2 / 6 »).
</recherche>

<sauvegarde_permanente>
- La base Supabase est la source de vérité. Changer de téléphone ou réinstaller l'app ne fait rien perdre : il suffit de se reconnecter.
- « Exporter l'inventaire » génère `inventaire-<maison>-AAAA-MM-JJ.json` (aliments avec leur maximum + articles libres) et ouvre la feuille de partage Android.
- « Importer » est réservé au propriétaire :
  - le fichier est d'abord validé ;
  - l'utilisateur choisit ensuite « Remplacer tout » ou « Fusionner » ;
  - l'état actuel est exporté automatiquement avant d'appliquer l'import.
</sauvegarde_permanente>
</fonctionnalites>

<design>
Style « cuisine moderne et fraîche », inspiré de Material 3 :
- Couleurs :
  - fond blanc cassé #F7F9FB ;
  - frigos : accent bleu-vert #14B8A6 ;
  - congélateurs : accent bleu glacé #3B82F6, avec un léger motif de givre dans l'en-tête ;
  - onglet Courses : accent orange chaleureux #F97316.
- Cartes arrondies (16 px) avec une ombre douce. Une jauge de remplissage colorée sur chaque carte : verte si pleine, orange si entamée, rouge si épuisée.
- Emoji automatique selon le nom : 🧈 beurre, 🥛 lait, 🥚 œufs, 🥕 carotte, 🍗 poulet, 🍦 glace… et 🍽️ par défaut.
- Tiroirs présentés comme des « bacs » : en-tête avec le nom et un compteur, cartes en grille de 2 colonnes.
- Navigation par onglets en bas : « Maison », « Courses » (avec un badge du nombre d'articles), « Recherche », « Réglages ».
- Police Inter (expo-font). Mode sombre automatique. Zones tactiles de 48 dp minimum.
- États vides sympathiques. Animations douces avec Reanimated.
- Interface entièrement en français.
</design>

<cas_limites>
- Code d'invitation invalide : message clair. Utilisateur déjà membre : il est redirigé directement vers la maison.
- Membre retiré pendant qu'il utilise l'app : retour à l'écran de choix de maison, avec un message.
- Deux membres modifient le même aliment : la dernière écriture l'emporte, et la règle du maximum reste garantie par le trigger.
- Deux membres cochent le même article en même temps : il reste coché une seule fois, sans doublon.
- L'utilisateur baisse le maximum sous la quantité actuelle : la quantité est ramenée au nouveau maximum, après confirmation.
- Suppression d'un tiroir qui contient des aliments : proposer de les déplacer vers un autre tiroir ou de tout supprimer.
- Le dernier tiroir d'un appareil ne peut pas être supprimé.
- Champs obligatoires vides : erreur affichée sous le champ, enregistrement bloqué.
- Noms longs : tronqués avec « … » sur les cartes, affichés en entier dans la fiche.
- Session expirée : reconnexion silencieuse, sinon retour à l'écran de connexion.
- Bouton retour Android : il doit fonctionner correctement partout.
- Pendant les 5 secondes d'annulation, un autre membre peut modifier ou supprimer le même aliment. « Annuler » ne doit alors ni planter, ni créer de doublon : si l'id existe déjà, ne rien faire et afficher un message.
- Un aliment glissé hors ligne vers la corbeille est supprimé localement. La suppression est envoyée au serveur au retour du réseau.
</cas_limites>

<methode_de_travail>
1. Présente un plan court (arborescence, schéma SQL, écrans, synchronisation), puis lance-toi sans attendre ma validation.
2. Initialise le projet avec `npx create-expo-app@latest` en mode non interactif.
3. Construis dans cet ordre :
   a. schéma Supabase (triggers, vue `liste_courses`, RLS, RPC) ;
   b. authentification ;
   c. maisons et invitations ;
   d. appareils et tiroirs ;
   e. aliments et règle du maximum ;
   f. glisser-déposer ;
   g. liste de courses ;
   h. temps réel et mode hors ligne ;
   i. recherche ;
   j. export et import ;
   k. finitions visuelles.
4. Tests :
   - tests SQL des politiques RLS : un non-membre ne voit RIEN ;
   - tests SQL du trigger du maximum : insertion, hausse, baisse, modification manuelle ;
   - tests Jest de la logique métier : calcul de la liste de courses, « J'ai rangé les courses », déplacement, suppression par la corbeille et annulation, validation et fusion d'import, file d'attente hors ligne.
5. Après chaque étape, vérifie que `npx tsc --noEmit` et les tests passent.
6. Configure `eas.json` avec un profil `preview` qui produit un APK installable.
7. À la fin, donne-moi :
   - la commande pour tester l'app avec Expo Go sur Android ;
   - la commande de build de l'APK (`eas build -p android --profile preview`) ;
   - la liste de ce que je dois configurer moi-même dans Supabase.
</methode_de_travail>

<criteres_de_reussite>
- Je crée un compte et la maison « Chez nous ». Un 2e compte la rejoint avec le code d'invitation.
- Je crée « Frigo » avec 4 tiroirs et « Congélateur » avec 3 tiroirs en moins d'une minute.
- J'ajoute « Œufs, 6 pièces » dans le Tiroir 2 du frigo sur le téléphone A : la carte affiche « 6 / 6 » sur le téléphone B en moins de 2 secondes.
- J'utilise 4 œufs (« − » quatre fois) : la carte affiche « 2 / 6 », et « Œufs – 4 pièces » apparaît dans l'onglet Courses des deux téléphones.
- À 0 œuf, la carte est grisée « Épuisé », mais elle reste dans le tiroir.
- Sur B, je coche « Œufs » puis « J'ai rangé les courses » : la carte repasse à « 6 / 6 » et disparaît de la liste de courses.
- Si j'en range 12, le maximum devient 12.
- J'ajoute « Sopalin » en article libre : il apparaît dans la liste de courses des deux téléphones.
- Je glisse les œufs vers le Tiroir 4 : le déplacement est visible en direct, et la quantité et le maximum sont inchangés.
- Avec « Déplacer vers… », je passe un aliment du frigo au congélateur.
- Je commence à glisser une carte : la corbeille apparaît en bas. Je relâche la carte dessus : l'aliment disparaît sur les deux téléphones.
- Je touche « ANNULER » dans les 5 secondes : l'aliment revient dans son tiroir avec la même quantité et le même maximum.
- Je relâche une carte à côté de la corbeille : rien n'est supprimé.
- En mode avion, la liste de courses reste consultable et cochable, puis se synchronise au retour du réseau.
- Je désinstalle l'app, je la réinstalle et je me reconnecte : tout est là, maximums compris.
- Un compte non membre ne peut lire aucune donnée de la maison (vérifié par les tests RLS).
- Aucune erreur TypeScript, tous les tests passent, aucun crash sur Android.
</criteres_de_reussite>
