import {
  HEALTHY_EXISTANTES,
  RECETTES,
  RECETTES_REPAS,
  adapterQuantite,
  analyserRecettes,
  correspond,
  estPrete,
  manquantsAAjouter,
  mots,
  recetteDuJour,
  rechercherRecettes,
  suggererRecettes,
  trouverRecette,
} from '../recettes';
import { INGREDIENTS } from '../recettes-ingredients';
import { aliment, libre } from './fabriques';

const AUJOURDHUI = new Date(2026, 9, 7);

describe('base de recettes', () => {
  it('a des identifiants uniques', () => {
    const ids = RECETTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contient au moins 350 recettes complètes', () => {
    expect(RECETTES.length).toBeGreaterThanOrEqual(350);
    for (const r of RECETTES) {
      expect(r.etapes.length).toBeGreaterThan(0);
      expect(r.ingredients.length).toBeGreaterThan(0);
      expect(r.ingredients.every((i) => i.cle in INGREDIENTS)).toBe(true);
      // Chaque recette a au moins un ingrédient frais indispensable : sinon elle ne serait jamais proposée.
      expect(r.ingredients.some((i) => !i.placard && !i.optionnel)).toBe(true);
    }
  });

  it('ne garde que les repas du midi et du soir', () => {
    expect(RECETTES_REPAS.length).toBeGreaterThan(290);
    expect(RECETTES_REPAS.some((r) => r.categorie === 'dessert' || r.categorie === 'petit-dej')).toBe(false);
    const s = suggererRecettes([aliment({ nom: 'Pommes', quantite: 6 })], AUJOURDHUI, RECETTES_REPAS);
    expect(s.find((x) => x.recette.id === 'compote')).toBeUndefined();
  });

  it('propose des repas healthy', () => {
    for (const id of HEALTHY_EXISTANTES) expect(trouverRecette(id)?.healthy).toBe(true);
    const healthy = RECETTES_REPAS.filter((r) => r.healthy);
    expect(healthy.length).toBeGreaterThanOrEqual(260);
    expect(trouverRecette('bowl-quinoa-poulet-avocat')?.healthy).toBe(true);
    expect(trouverRecette('tartiflette')?.healthy).toBe(false);
  });

  it('lit quantités et ingrédients facultatifs', () => {
    const r = trouverRecette('oeufs-brouilles')!;
    expect(r.ingredients[0]).toMatchObject({ cle: 'oeuf', quantite: '6', optionnel: false });
    expect(r.ingredients.find((i) => i.cle === 'creme')).toMatchObject({ quantite: '2 c. à s.', optionnel: true });
    expect(r.ingredients.find((i) => i.cle === 'sel')).toMatchObject({ quantite: null, placard: true });
  });
});

describe('correspondance des noms', () => {
  it('met au singulier et retire les accents', () => {
    expect(mots('Œufs frais')).toEqual(['oeuf', 'frai']);
    expect(mots('Chou-fleur')).toEqual(['chou', 'fleur']);
  });

  it('distingue les pommes des pommes de terre', () => {
    expect(correspond(INGREDIENTS.pomme, 'Pommes Golden')).toBe(true);
    expect(correspond(INGREDIENTS.pomme, 'Pommes de terre')).toBe(false);
    expect(correspond(INGREDIENTS.pommeDeTerre, 'Pommes de terre')).toBe(true);
    expect(correspond(INGREDIENTS.pommeDeTerre, 'Frites surgelées')).toBe(false);
  });

  it('ignore les produits préparés', () => {
    expect(correspond(INGREDIENTS.fraise, 'Yaourt à la fraise')).toBe(false);
    expect(correspond(INGREDIENTS.fraise, 'Fraises')).toBe(true);
    expect(correspond(INGREDIENTS.tomate, 'Sauce tomate')).toBe(false);
    expect(correspond(INGREDIENTS.tomatesConcassees, 'Sauce tomate')).toBe(true);
    expect(correspond(INGREDIENTS.pomme, 'Tarte aux pommes')).toBe(false);
  });

  it('ne confond pas les mots proches', () => {
    expect(correspond(INGREDIENTS.lait, 'Laitue')).toBe(false);
    expect(correspond(INGREDIENTS.salade, 'Laitue')).toBe(true);
    expect(correspond(INGREDIENTS.lait, 'Lait demi-écrémé')).toBe(true);
    expect(correspond(INGREDIENTS.lait, 'Lait de coco')).toBe(false);
  });

  it('reconnaît un ingrédient précédé d’un découpage', () => {
    expect(correspond(INGREDIENTS.poulet, 'Blanc de poulet')).toBe(true);
    expect(correspond(INGREDIENTS.boeufHache, 'Steak haché')).toBe(true);
    expect(correspond(INGREDIENTS.boeuf, 'Steak haché')).toBe(false);
    expect(correspond(INGREDIENTS.saumon, 'Saumon fumé')).toBe(false);
  });

  it('reconnaît les nouveaux ingrédients sans les confondre', () => {
    expect(correspond(INGREDIENTS.poissonPane, 'Poissons panés')).toBe(true);
    expect(correspond(INGREDIENTS.poisson, 'Poissons panés')).toBe(false);
    expect(correspond(INGREDIENTS.chouBruxelles, 'Choux de Bruxelles')).toBe(true);
    expect(correspond(INGREDIENTS.chou, 'Choux de Bruxelles')).toBe(false);
    expect(correspond(INGREDIENTS.canard, 'Magret de canard')).toBe(true);
    expect(correspond(INGREDIENTS.canard, 'Foie gras de canard')).toBe(false);
    expect(correspond(INGREDIENTS.lait, 'Lait d’amande')).toBe(false);
    expect(correspond(INGREDIENTS.amande, 'Lait d’amande')).toBe(false);
  });
});

describe('suggestions', () => {
  it('propose les recettes faisables avec le stock', () => {
    const stock = [
      aliment({ id: 'o', nom: 'Œufs', quantite: 6 }),
      aliment({ id: 'c', nom: 'Champignons de Paris', quantite: 250, unite: 'g' }),
      aliment({ id: 'b', nom: 'Beurre doux', quantite: 1 }),
    ];
    const s = suggererRecettes(stock, AUJOURDHUI);
    const omelette = s.find((x) => x.recette.id === 'omelette-champignons');
    expect(omelette).toBeDefined();
    expect(omelette!.manquants).toEqual([]);
    expect(omelette!.lignes.find((l) => l.ingredient.cle === 'champignon')!.aliment!.id).toBe('c');
  });

  it('ne compte jamais un produit de placard comme manquant', () => {
    const s = suggererRecettes([aliment({ nom: 'Pommes', quantite: 6 })], AUJOURDHUI);
    const compote = s.find((x) => x.recette.id === 'compote')!;
    expect(compote.manquants).toEqual([]);
    expect(compote.requis).toBe(1);
  });

  it('ignore les aliments épuisés', () => {
    const s = suggererRecettes([aliment({ nom: 'Pommes', quantite: 0 })], AUJOURDHUI);
    expect(s.find((x) => x.recette.id === 'compote')).toBeUndefined();
  });

  it('met en avant ce qui périme bientôt', () => {
    const stock = [
      aliment({ id: 'p', nom: 'Pommes', quantite: 6, datePeremption: '2026-12-01' }),
      aliment({ id: 'f', nom: 'Fraises', quantite: 1, datePeremption: '2026-10-08' }),
      aliment({ id: 'c', nom: 'Crème liquide', quantite: 1 }),
    ];
    const s = suggererRecettes(stock, AUJOURDHUI);
    const fraises = s.findIndex((x) => x.recette.id === 'fraises-chantilly');
    const compote = s.findIndex((x) => x.recette.id === 'compote');
    expect(fraises).toBeGreaterThanOrEqual(0);
    expect(s[fraises].urgents.map((a) => a.id)).toEqual(['f']);
    expect(fraises).toBeLessThan(compote);
  });

  it('utilise d’abord l’aliment qui périme le plus tôt', () => {
    const stock = [
      aliment({ id: 'loin', nom: 'Lait', quantite: 1, datePeremption: '2026-11-01' }),
      aliment({ id: 'sans', nom: 'Lait entier', quantite: 1 }),
      aliment({ id: 'proche', nom: 'Lait', quantite: 1, datePeremption: '2026-10-09' }),
      aliment({ id: 'o', nom: 'Œufs', quantite: 6 }),
    ];
    const crepes = suggererRecettes(stock, AUJOURDHUI).find((x) => x.recette.id === 'crepes')!;
    expect(crepes.lignes.find((l) => l.ingredient.cle === 'lait')!.aliment!.id).toBe('proche');
  });

  it('écarte les recettes où il manque trop de choses', () => {
    const s = suggererRecettes([aliment({ nom: 'Poireaux', quantite: 3 })], AUJOURDHUI);
    expect(s.find((x) => x.recette.id === 'pot-au-feu')).toBeUndefined();
    expect(s.find((x) => x.recette.id === 'poireaux-vinaigrette')).toBeDefined();
  });
});

describe('manquantsAAjouter', () => {
  it('ne rajoute pas ce qui est déjà sur la liste de courses', () => {
    const stock = [
      aliment({ id: 'o', nom: 'Œufs', quantite: 6 }),
      aliment({ id: 'p', nom: 'Pain de campagne', quantite: 1 }),
      aliment({ id: 'l', nom: 'Lait', quantite: 0 }),
    ];
    const painPerdu = suggererRecettes(stock, AUJOURDHUI).find((x) => x.recette.id === 'pain-perdu')!;
    expect(painPerdu.manquants.map((i) => i.cle).sort()).toEqual(['beurre', 'lait']);
    // Le lait épuisé est déjà dans les courses ; le beurre y est en article libre.
    expect(manquantsAAjouter(painPerdu, stock, [libre({ nom: 'Beurre' })])).toEqual([]);
    expect(manquantsAAjouter(painPerdu, stock, []).map((i) => i.cle)).toEqual(['beurre']);
  });
});

describe('catalogue', () => {
  const stock = [aliment({ id: 'o', nom: 'Œufs', quantite: 6 }), aliment({ id: 'l', nom: 'Lait', quantite: 1 })];

  it('analyse toutes les recettes, les plus faisables d’abord', () => {
    const tout = analyserRecettes(stock, AUJOURDHUI);
    expect(tout).toHaveLength(RECETTES.length);
    for (let i = 1; i < tout.length; i++) expect(tout[i].manquants.length).toBeGreaterThanOrEqual(tout[i - 1].manquants.length);
  });

  it('cherche par début de mot, dans le nom puis dans les ingrédients', () => {
    const tout = analyserRecettes([], AUJOURDHUI);
    const crepes = rechercherRecettes(tout, 'crep');
    expect(crepes[0].recette.nom.toLowerCase()).toContain('crêpe');
    expect(rechercherRecettes(tout, 'poul curry').every((s) => /poulet/i.test(s.recette.nom + s.recette.ingredients.map((i) => i.nom).join(' ')))).toBe(true);
    expect(rechercherRecettes(tout, '   ')).toHaveLength(tout.length);
    expect(rechercherRecettes(tout, 'zzzzz')).toHaveLength(0);
  });

  it('choisit une recette du jour stable sur la journée, prête si possible', () => {
    const s = suggererRecettes(stock, AUJOURDHUI);
    const matin = recetteDuJour(s, new Date(2026, 9, 7, 8));
    const soir = recetteDuJour(s, new Date(2026, 9, 7, 21));
    expect(matin?.recette.id).toBe(soir?.recette.id);
    if (s.some(estPrete)) expect(matin && estPrete(matin)).toBe(true);
    expect(recetteDuJour([], AUJOURDHUI)).toBeNull();
  });
});

describe('nombre de personnes', () => {
  it('recalcule le nombre de tête et accorde l’unité', () => {
    expect(adapterQuantite('250 g', 4, 2)).toBe('125 g');
    expect(adapterQuantite('2', 4, 2)).toBe('1');
    expect(adapterQuantite('2', 4, 6)).toBe('3');
    expect(adapterQuantite('1 gousse', 2, 4)).toBe('2 gousses');
    expect(adapterQuantite('2 gousses', 4, 2)).toBe('1 gousse');
    expect(adapterQuantite('1/2 bouquet', 4, 8)).toBe('1 bouquet');
    expect(adapterQuantite('1 boîte de 400 g', 2, 4)).toBe('2 boîtes de 400 g');
    expect(adapterQuantite('30 cl', 4, 6)).toBe('45 cl');
    expect(adapterQuantite('1', 4, 2)).toBe('1/2');
  });

  it('laisse tel quel ce qui n’a pas de nombre ou ne change pas', () => {
    expect(adapterQuantite('quelques brins', 4, 2)).toBe('quelques brins');
    expect(adapterQuantite(null, 4, 2)).toBeNull();
    expect(adapterQuantite('250 g', 4, 4)).toBe('250 g');
  });
});
