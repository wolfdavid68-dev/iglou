import { normaliser } from './texte';

/** Mots-clés (normalisés, sans accents) → emoji. Le premier mot-clé trouvé l'emporte. */
const CORRESPONDANCES: [string[], string][] = [
  [['beurre'], '🧈'],
  [['glace', 'sorbet', 'esquimau'], '🍦'],
  [['salade', 'laitue', 'mache', 'roquette', 'epinard'], '🥬'],
  [['yaourt', 'yogourt', 'skyr', 'fromage blanc'], '🥣'],
  [['lait', 'creme'], '🥛'],
  [['oeuf'], '🥚'],
  [['carotte'], '🥕'],
  [['poulet', 'volaille', 'dinde', 'cuisse'], '🍗'],
  [['fromage', 'emmental', 'comte', 'camembert', 'gruyere', 'mozzarella', 'raclette', 'parmesan'], '🧀'],
  [['jambon', 'lardon', 'bacon', 'porc'], '🥓'],
  [['saucisse', 'merguez', 'chipolata', 'knack'], '🌭'],
  [['steak', 'boeuf', 'viande', 'hache', 'veau', 'agneau'], '🥩'],
  [['poisson', 'saumon', 'cabillaud', 'colin', 'thon', 'truite', 'merlu'], '🐟'],
  [['crevette', 'gambas'], '🦐'],
  [['pizza'], '🍕'],
  [['frite', 'pomme de terre', 'pommes de terre', 'patate'], '🍟'],
  [['pain', 'baguette', 'brioche'], '🥖'],
  [['croissant', 'viennoiserie'], '🥐'],
  [['tomate'], '🍅'],
  [['concombre', 'cornichon'], '🥒'],
  [['brocoli', 'chou'], '🥦'],
  [['poivron', 'piment'], '🫑'],
  [['champignon'], '🍄'],
  [['oignon', 'echalote'], '🧅'],
  [['ail'], '🧄'],
  [['mais'], '🌽'],
  [['petit pois', 'haricot', 'pois'], '🫛'],
  [['avocat'], '🥑'],
  [['citron'], '🍋'],
  [['pomme'], '🍎'],
  [['poire'], '🍐'],
  [['banane'], '🍌'],
  [['fraise'], '🍓'],
  [['framboise', 'myrtille', 'fruits rouges', 'mure'], '🫐'],
  [['raisin'], '🍇'],
  [['orange', 'clementine', 'mandarine'], '🍊'],
  [['peche', 'abricot', 'nectarine'], '🍑'],
  [['melon'], '🍈'],
  [['pasteque'], '🍉'],
  [['ananas'], '🍍'],
  [['jus'], '🧃'],
  [['eau'], '💧'],
  [['biere'], '🍺'],
  [['vin', 'champagne'], '🍷'],
  [['soda', 'coca', 'limonade'], '🥤'],
  [['soupe', 'veloute', 'bouillon'], '🍲'],
  [['pate', 'lasagne', 'ravioli', 'spaghetti', 'tagliatelle'], '🍝'],
  [['riz'], '🍚'],
  [['gateau', 'tarte', 'dessert'], '🍰'],
  [['chocolat'], '🍫'],
  [['miel'], '🍯'],
  [['confiture'], '🫙'],
  [['sauce', 'ketchup', 'mayonnaise', 'moutarde'], '🥫'],
  [['quiche', 'tourte'], '🥧'],
  [['burger', 'hamburger'], '🍔'],
  [['nugget', 'pane'], '🍤'],
  [['glacon'], '🧊'],
  [['herbe', 'persil', 'basilic', 'ciboulette', 'coriandre', 'menthe'], '🌿'],
  // Articles ménagers (courses libres).
  [['eponge'], '🧽'],
  [['papier toilette', 'essuie-tout', 'sopalin', 'mouchoir'], '🧻'],
  [['savon', 'gel douche', 'shampo', 'liquide vaisselle'], '🧼'],
  [['lessive', 'adoucissant'], '🧺'],
];

export const EMOJI_PAR_DEFAUT = '🍽️';

export function emojiPourNom(nom: string): string {
  const n = ` ${normaliser(nom)} `;
  for (const [motsCles, emoji] of CORRESPONDANCES) {
    for (const mot of motsCles) {
      // Début de mot : « pomme » ne doit pas matcher « pommes de terre » avant la règle dédiée.
      if (n.includes(` ${mot}`)) return emoji;
    }
  }
  return EMOJI_PAR_DEFAUT;
}
