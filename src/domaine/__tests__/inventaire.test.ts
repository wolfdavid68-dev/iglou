import { creerGestionnaireAnnulation, restaurerSiAbsent, type Minuteur } from '../annulation';
import { etatPeremption, ilYA, libellePeremption, lireDateSaisie } from '../dates';
import { EMOJI_PAR_DEFAUT, emojiPourNom } from '../emoji';
import {
  aConsommerEnPriorite,
  deplacement,
  deplacerDansListe,
  destinationsPossibles,
  nomsTiroirsParDefaut,
  peutSupprimerTiroir,
  rechercher,
  suggestionsNoms,
  tiroirParDefaut,
  trouverDoublon,
} from '../inventaire';
import { codeValide, genererCode, normaliserCode } from '../invitation';
import { etatSynchro } from '../synchro';
import { formaterQuantite, memeNom } from '../texte';
import { aliment, appareil, tiroir } from './fabriques';

describe('déplacement entre tiroirs', () => {
  test("change uniquement l'emplacement, jamais la quantité ni le maximum", () => {
    const a = aliment({ quantite: 2, quantiteMax: 6 });
    const cible = tiroir({ id: 't9', appareilId: 'congel' });
    expect(deplacement(a, cible)).toEqual({ tiroirId: 't9', appareilId: 'congel' });
  });

  test('lâcher dans le même tiroir ne fait rien', () => {
    expect(deplacement(aliment(), tiroir())).toBeNull();
  });
});

describe('tiroirs', () => {
  test("le dernier tiroir d'un appareil n'est pas supprimable", () => {
    const t1 = tiroir({ id: 't1' });
    const t2 = tiroir({ id: 't2' });
    const autre = tiroir({ id: 't3', appareilId: 'congel' });
    expect(peutSupprimerTiroir([t1, t2, autre], t1)).toBe(true);
    expect(peutSupprimerTiroir([t1, autre], t1)).toBe(false);
  });

  test('noms par défaut et réordonnancement', () => {
    expect(nomsTiroirsParDefaut(3)).toEqual(['Tiroir 1', 'Tiroir 2', 'Tiroir 3']);
    expect(deplacerDansListe(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(deplacerDansListe(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

describe('noms', () => {
  test('doublon dans le même tiroir, insensible aux accents et à la casse', () => {
    const oeufs = aliment({ nom: 'Œufs' });
    expect(trouverDoublon([oeufs], 't1', '  oeufs ')).toBe(oeufs);
    expect(trouverDoublon([oeufs], 't2', 'oeufs')).toBeUndefined();
    expect(memeNom('Crème fraîche', 'creme fraiche')).toBe(true);
  });

  test("suggestions sans doublon, préfixes d'abord", () => {
    const aliments = [aliment({ nom: 'Lait' }), aliment({ nom: 'lait' }), aliment({ nom: 'Petit lait' }), aliment({ nom: 'Laitue' })];
    expect(suggestionsNoms(aliments, 'lai')).toEqual(['Lait', 'Laitue', 'Petit lait']);
    expect(suggestionsNoms(aliments, '')).toEqual([]);
  });

  test('quantités lisibles', () => {
    expect(formaterQuantite(1, 'pièce')).toBe('1 pièce');
    expect(formaterQuantite(6, 'pièce')).toBe('6 pièces');
    expect(formaterQuantite(500, 'g')).toBe('500 g');
  });
});

test('recherche globale avec emplacement « Appareil › Tiroir »', () => {
  const resultats = rechercher(
    [aliment({ id: 'x', nom: 'Petits pois', tiroirId: 't2', appareilId: 'congel' }), aliment({ id: 'y', nom: 'Poireaux' })],
    [appareil(), appareil({ id: 'congel', nom: 'Congélateur', type: 'congelateur' })],
    [tiroir(), tiroir({ id: 't2', appareilId: 'congel', nom: 'Tiroir 2' })],
    'POI',
  );
  expect(resultats.map((r) => [r.aliment.id, r.emplacement])).toEqual([
    ['y', 'Frigo cuisine › Bac à légumes'],
    ['x', 'Congélateur › Tiroir 2'],
  ]);
});

test('à consommer en priorité : périmés puis proches, triés par date', () => {
  const auj = new Date(2026, 9, 7);
  const resultats = aConsommerEnPriorite(
    [
      aliment({ id: 'ok', datePeremption: '2026-10-30' }),
      aliment({ id: 'sans', datePeremption: null }),
      aliment({ id: 'demain', datePeremption: '2026-10-08' }),
      aliment({ id: 'perime', datePeremption: '2026-10-01' }),
    ],
    [appareil()],
    [tiroir()],
    auj,
  );
  expect(resultats.map((r) => r.aliment.id)).toEqual(['perime', 'demain']);
  expect(resultats[0].emplacement).toBe('Frigo cuisine › Bac à légumes');
});

describe('emoji automatique', () => {
  test.each([
    ['Œufs bio', '🥚'],
    ['Beurre doux', '🧈'],
    ['Pommes de terre', '🍟'],
    ['Pommes', '🍎'],
    ['Steak haché', '🥩'],
    ['Glace vanille', '🍦'],
    ['Truc inconnu', EMOJI_PAR_DEFAUT],
  ])('%s → %s', (nom, emoji) => {
    expect(emojiPourNom(nom)).toBe(emoji);
  });
});

describe('dates de péremption', () => {
  const aujourdHui = new Date(2026, 9, 7);
  test('saisie au format français', () => {
    expect(lireDateSaisie('9/10/2026')).toBe('2026-10-09');
    expect(lireDateSaisie('09/10/26')).toBe('2026-10-09');
    expect(lireDateSaisie('31/02/2026')).toBeNull();
    expect(lireDateSaisie('')).toBeNull();
  });
  test('rouge si dépassée, orange à moins de 3 jours', () => {
    expect(etatPeremption('2026-10-06', aujourdHui)).toBe('depassee');
    expect(etatPeremption('2026-10-09', aujourdHui)).toBe('proche');
    expect(etatPeremption('2026-10-10', aujourdHui)).toBe('ok');
    expect(etatPeremption(null, aujourdHui)).toBeNull();
    expect(libellePeremption('2026-10-08', aujourdHui)).toBe('Périme demain');
  });
  test('« il y a… »', () => {
    const maintenant = Date.UTC(2026, 9, 7);
    expect(ilYA(maintenant - 30_000, maintenant)).toBe("à l'instant");
    expect(ilYA(maintenant - 5 * 60_000, maintenant)).toBe('il y a 5 min');
    expect(ilYA(maintenant - 2 * 86_400_000, maintenant)).toBe('il y a 2 jours');
  });
});

describe("codes d'invitation", () => {
  test('6 caractères sans caractères ambigus', () => {
    for (let i = 0; i < 50; i++) {
      const code = genererCode();
      expect(codeValide(code)).toBe(true);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });
  test('saisie tolérante', () => {
    expect(normaliserCode(' ab3-k7q ')).toBe('AB3K7Q');
    expect(codeValide('AB3K7')).toBe(false);
    expect(codeValide('AB0K7Q')).toBe(false);
  });
});

describe('corbeille + ANNULER', () => {
  function minuteurManuel() {
    let fn: (() => void) | null = null;
    const minuteur: Minuteur = {
      definir: (f) => {
        fn = f;
        return 1;
      },
      effacer: () => {
        fn = null;
      },
    };
    return { minuteur, ecouler: () => fn?.() };
  }

  test("annuler dans les 5 secondes restaure l'aliment", async () => {
    const { minuteur } = minuteurManuel();
    const g = creerGestionnaireAnnulation(5000, minuteur);
    const restaurer = jest.fn();
    const id = g.proposer('Œufs supprimé', restaurer);
    expect(await g.annuler(id)).toBe('annule');
    expect(restaurer).toHaveBeenCalledTimes(1);
    expect(g.courant()).toBeNull();
  });

  test('après expiration, annuler ne fait plus rien', async () => {
    const { minuteur, ecouler } = minuteurManuel();
    const g = creerGestionnaireAnnulation(5000, minuteur);
    const restaurer = jest.fn();
    const id = g.proposer('Œufs supprimé', restaurer);
    ecouler();
    expect(await g.annuler(id)).toBe('expire');
    expect(restaurer).not.toHaveBeenCalled();
  });

  test('une nouvelle suppression remplace le bandeau précédent', async () => {
    const { minuteur } = minuteurManuel();
    const g = creerGestionnaireAnnulation(5000, minuteur);
    const premier = g.proposer('A supprimé', jest.fn());
    g.proposer('B supprimé', jest.fn());
    expect(await g.annuler(premier)).toBe('expire');
    expect(g.courant()?.message).toBe('B supprimé');
  });

  test("restauration à l'identique, sauf si l'id existe déjà", async () => {
    const reinserer = jest.fn();
    expect(await restaurerSiAbsent(async () => false, reinserer)).toBe('restaure');
    expect(reinserer).toHaveBeenCalledTimes(1);
    expect(await restaurerSiAbsent(async () => true, reinserer)).toBe('existe-deja');
    expect(reinserer).toHaveBeenCalledTimes(1);
  });
});

test('état de synchronisation (bandeau hors ligne)', () => {
  expect(etatSynchro({ isWebSocketConnected: true, hasInflightRequests: false })).toBe('synchronise');
  expect(etatSynchro({ isWebSocketConnected: true, hasInflightRequests: true })).toBe('en-attente');
  expect(etatSynchro({ isWebSocketConnected: false, hasInflightRequests: true })).toBe('hors-ligne');
});

describe('« Déplacer vers… »', () => {
  const appareils = [appareil({ id: 'congel', nom: 'Congélateur', type: 'congelateur', ordre: 1 }), appareil({ id: 'frigo', ordre: 0 })];
  const tiroirs = [
    tiroir({ id: 't2', appareilId: 'frigo', nom: 'Portes', ordre: 1 }),
    tiroir({ id: 't1', appareilId: 'frigo', ordre: 0 }),
    tiroir({ id: 'c1', appareilId: 'congel', nom: 'Tiroir 1', ordre: 0 }),
  ];

  test('groupe par appareil dans l’ordre, sans le tiroir de départ', () => {
    const groupes = destinationsPossibles(appareils, tiroirs, 't1');
    expect(groupes.map((g) => [g.appareil.id, g.tiroirs.map((t) => t.id)])).toEqual([
      ['frigo', ['t2']],
      ['congel', ['c1']],
    ]);
  });

  test('un appareil sans autre tiroir disparaît de la liste', () => {
    expect(destinationsPossibles(appareils, tiroirs, 'c1').map((g) => g.appareil.id)).toEqual(['frigo']);
  });
});

describe('tiroir par défaut (bouton « + » global, rangement des articles libres)', () => {
  const frigo = appareil({ id: 'frigo', ordre: 0 });
  const congel = appareil({ id: 'congel', type: 'congelateur', ordre: 1 });
  const t2 = tiroir({ id: 't2', appareilId: 'frigo', ordre: 1 });
  const t1 = tiroir({ id: 't1', appareilId: 'frigo', ordre: 0 });
  const c1 = tiroir({ id: 'c1', appareilId: 'congel', ordre: 0 });

  test('premier tiroir du premier appareil', () => {
    expect(tiroirParDefaut([congel, frigo], [c1, t2, t1], [])?.id).toBe('t1');
  });

  test("le tiroir où se trouve déjà un aliment du même nom l'emporte", () => {
    const pain = aliment({ nom: 'Pain', tiroirId: 'c1', appareilId: 'congel' });
    expect(tiroirParDefaut([frigo, congel], [t1, t2, c1], [pain], ' pain ')?.id).toBe('c1');
  });

  test('aucun tiroir : undefined', () => {
    expect(tiroirParDefaut([frigo], [], [])).toBeUndefined();
  });
});
