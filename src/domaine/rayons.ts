import { normaliser } from './texte';

/** Rayon de magasin, pour trier la liste de courses par type d'aliment. */
export interface Rayon {
  cle: string;
  nom: string;
  emoji: string;
}

/** Dans l'ordre d'affichage. */
export const RAYONS = [
  { cle: 'fruits', nom: 'Fruits', emoji: '🍎' },
  { cle: 'legumes', nom: 'Légumes', emoji: '🥕' },
  { cle: 'viandes', nom: 'Viandes et charcuterie', emoji: '🥩' },
  { cle: 'poissons', nom: 'Poissons et fruits de mer', emoji: '🐟' },
  { cle: 'cremerie', nom: 'Crèmerie, œufs et fromages', emoji: '🧀' },
  { cle: 'feculents', nom: 'Pâtes, riz et féculents', emoji: '🍝' },
  { cle: 'boulangerie', nom: 'Pain et viennoiseries', emoji: '🥖' },
  { cle: 'plats', nom: 'Plats préparés', emoji: '🍕' },
  { cle: 'surgeles', nom: 'Glaces et surgelés', emoji: '🍦' },
  { cle: 'sucre', nom: 'Sucré et desserts', emoji: '🍫' },
  { cle: 'epicerie', nom: 'Épicerie et condiments', emoji: '🥫' },
  { cle: 'boissons', nom: 'Boissons', emoji: '🥤' },
  { cle: 'maison', nom: 'Hygiène et entretien', emoji: '🧽' },
  { cle: 'autres', nom: 'Autres', emoji: '🛒' },
] as const satisfies readonly Rayon[];

export type CleRayon = (typeof RAYONS)[number]['cle'];

/**
 * Mots-clés (normalisés, sans accents) → rayon. La première règle trouvée
 * l'emporte : les expressions précises passent avant les mots courts
 * (« pomme de terre » avant « pomme », « jus d'orange » avant « orange »).
 */
const REGLES: [string[], CleRayon][] = [
  [['vinaigre'], 'epicerie'],
  [['laitue'], 'legumes'],
  [['jus', 'eau', 'biere', 'vin ', 'vins', 'champagne', 'cidre', 'soda', 'coca', 'limonade', 'sirop', 'cafe', 'the ', 'infusion', 'tisane'], 'boissons'],
  [['glace', 'creme glacee', 'sorbet', 'esquimau', 'glacon', 'cone'], 'surgeles'],
  [['pate de campagne', 'pate en croute', 'rillette', 'terrine', 'foie gras'], 'viandes'],
  [['pate feuilletee', 'pate brisee', 'pate sablee', 'pate a pizza'], 'epicerie'],
  [['pate a tartiner', 'pates a tartiner'], 'sucre'],
  [['pates'], 'feculents'],
  [['fromage blanc', 'petit suisse', 'creme fraiche'], 'cremerie'],
  [['pomme de terre', 'pommes de terre', 'patate', 'frite', 'puree', 'gnocchi'], 'feculents'],
  [['pizza', 'quiche', 'tourte', 'lasagne', 'hachis', 'gratin', 'burger', 'hamburger', 'nugget', 'cordon bleu', 'pane', 'soupe', 'veloute', 'plat', 'sandwich', 'croque', 'nem', 'samoussa', 'tarte salee'], 'plats'],
  [['poisson', 'saumon', 'cabillaud', 'colin', 'thon', 'truite', 'merlu', 'sardine', 'maquereau', 'lieu', 'sole', 'dorade', 'bar ', 'crevette', 'gambas', 'moule', 'huitre', 'calamar', 'surimi', 'fruits de mer', 'crabe', 'homard', 'saint jacques'], 'poissons'],
  [['poulet', 'volaille', 'dinde', 'canard', 'cuisse', 'escalope', 'jambon', 'lardon', 'bacon', 'porc', 'saucisse', 'saucisson', 'merguez', 'chipolata', 'knack', 'chorizo', 'steak', 'boeuf', 'viande', 'hache', 'veau', 'agneau', 'roti', 'cote', 'filet mignon', 'boulette', 'blanquette', 'bourguignon', 'lapin', 'pate'], 'viandes'],
  [['beurre', 'lait', 'creme', 'yaourt', 'yogourt', 'skyr', 'oeuf', 'fromage', 'emmental', 'comte', 'camembert', 'gruyere', 'mozzarella', 'raclette', 'parmesan', 'chevre', 'feta', 'brie', 'reblochon', 'roquefort', 'ricotta', 'mascarpone'], 'cremerie'],
  [['spaghetti', 'tagliatelle', 'ravioli', 'penne', 'coquillette', 'macaroni', 'fusilli', 'riz', 'semoule', 'quinoa', 'boulgour', 'ble ', 'lentille', 'pois chiche', 'nouille', 'couscous'], 'feculents'],
  [['pain', 'baguette', 'brioche', 'croissant', 'viennoiserie', 'pain au chocolat', 'biscotte', 'tortilla', 'wrap'], 'boulangerie'],
  [['gateau', 'tarte', 'dessert', 'chocolat', 'biscuit', 'cookie', 'bonbon', 'miel', 'confiture', 'nutella', 'compote', 'cereale', 'sucre', 'madeleine', 'crepe', 'gaufre'], 'sucre'],
  [['citron', 'pomme', 'poire', 'banane', 'fraise', 'framboise', 'myrtille', 'fruits rouges', 'mure', 'cerise', 'raisin', 'orange', 'clementine', 'mandarine', 'pamplemousse', 'peche', 'abricot', 'nectarine', 'prune', 'melon', 'pasteque', 'ananas', 'kiwi', 'mangue', 'fruit'], 'fruits'],
  [['salade', 'laitue', 'mache', 'roquette', 'epinard', 'carotte', 'tomate', 'concombre', 'courgette', 'aubergine', 'brocoli', 'chou', 'poivron', 'piment', 'champignon', 'oignon', 'echalote', 'ail', 'poireau', 'navet', 'radis', 'betterave', 'celeri', 'fenouil', 'mais', 'petit pois', 'haricot', 'pois', 'avocat', 'asperge', 'artichaut', 'potiron', 'courge', 'legume', 'herbe', 'persil', 'basilic', 'ciboulette', 'coriandre', 'menthe', 'thym', 'gingembre'], 'legumes'],
  [['sauce', 'ketchup', 'mayonnaise', 'moutarde', 'huile', 'sel', 'poivre', 'epice', 'farine', 'levure', 'bouillon', 'conserve', 'olive', 'cornichon', 'chips', 'apero', 'cacahuete', 'noix', 'amande'], 'epicerie'],
  [['eponge', 'papier toilette', 'essuie tout', 'essuie-tout', 'sopalin', 'mouchoir', 'savon', 'gel douche', 'shampo', 'dentifrice', 'brosse', 'liquide vaisselle', 'pastille', 'lessive', 'adoucissant', 'sac poubelle', 'javel', 'nettoyant', 'deodorant', 'couche', 'coton', 'rasoir'], 'maison'],
];

export function rayonPourNom(nom: string): CleRayon {
  const n = ` ${normaliser(nom).replace(/['’]/g, ' ')} `;
  for (const [motsCles, rayon] of REGLES) {
    for (const mot of motsCles) {
      // Début de mot, comme pour les emojis : « ail » ne doit pas matcher « volaille ».
      if (n.includes(` ${mot}`)) return rayon;
    }
  }
  return 'autres';
}
