// Vérifications du calcul de la fiche de minage V3.
// Le code testé est extrait de la maquette (bloc calc:start … calc:end), pour que maquette et tests ne divergent pas.
// Lancer : node docs/mining-v3/calcul.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./maquette-fiche.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('/* calc:start'), html.indexOf('/* calc:end */'));
const { allocateNet, planTransfers, settle, stockOf, checkSale } =
  new Function(`${code}; return { allocateNet, planTransfers, settle, stockOf, checkSale };`)();

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const sum = list => list.reduce((s, x) => s + x, 0);

/* Invariants vérifiés sur chaque règlement */
function invariants(res, people) {
  assert.equal(sum(res.rows.map(r => r.share)), res.net, 'somme des parts = bénéfice net');
  assert.equal(sum(res.rows.map(r => r.balance)), res.totalSales, 'somme des soldes = total des ventes');
  assert.equal(sum(res.rows.map(r => r.gap)), 0, 'somme des écarts = 0');
  const moved = {};
  for (const t of res.transfers) {
    assert.ok(t.amount > 0 && Number.isInteger(t.amount));
    moved[t.from] = (moved[t.from] || 0) - t.amount;
    moved[t.to] = (moved[t.to] || 0) + t.amount;
  }
  for (const r of res.rows) assert.equal(moved[r.id] || 0, r.gap, `versements soldent ${r.id}`);
  assert.ok(res.transfers.length <= Math.max(0, people.length - 1), 'au plus n − 1 versements');
  for (const r of res.rows) {
    const exact = res.net * r.centi / sum(people.map(p => p.centi));
    assert.ok(Math.abs(r.share - exact) < 1, `part de ${r.id} à moins d'1 aUEC de l'exacte`);
    if (r.centi === 0) assert.equal(r.share, 0, 'part à 0 : rien du bénéfice');
  }
}

const ABC = [{ id: 'alex', centi: 100 }, { id: 'bea', centi: 100 }, { id: 'cid', centi: 100 }];

test('exemple SPEC : bénéfice, deux vendeurs, une demi-part', () => {
  const people = [{ id: 'alex', centi: 100 }, { id: 'bea', centi: 100 }, { id: 'cid', centi: 50 }];
  const res = settle(people, [{ by: 'alex', amount: 50000 }, { by: 'cid', amount: 100000 }], [{ by: 'alex', amount: 600000 }, { by: 'bea', amount: 400000 }]);
  invariants(res, people);
  assert.deepEqual(res.rows.map(r => r.balance), [390000, 340000, 270000]);
  assert.deepEqual(res.transfers.map(t => [t.from, t.to, t.amount]), [['alex', 'cid', 210000], ['bea', 'cid', 60000]]);
});

test('exemple SPEC : session déficitaire', () => {
  const res = settle(ABC, [{ by: 'alex', amount: 150000 }], [{ by: 'bea', amount: 60000 }]);
  invariants(res, ABC);
  assert.deepEqual(res.rows.map(r => r.share), [-30000, -30000, -30000]);
  assert.deepEqual(res.transfers.map(t => [t.from, t.to, t.amount]), [['bea', 'alex', 90000], ['cid', 'alex', 30000]]);
});

test('arrondi SPEC : 100 000 sur 3 parts, le reste va au premier arrivé', () => {
  assert.deepEqual(allocateNet(100000, ABC), { alex: 33334, bea: 33333, cid: 33333 });
});

test('arrondi SPEC : −100 000 sur 3 parts, partie entière inférieure', () => {
  assert.deepEqual(allocateNet(-100000, ABC), { alex: -33333, bea: -33333, cid: -33334 });
});

test('plus grand reste : le plus grand reste passe avant l’ordre d’arrivée', () => {
  // 100 aUEC pour 1 + 0,5 + 0,5 part (200 centièmes) : 50, 25, 25, aucun reste.
  assert.deepEqual(allocateNet(100, [{ id: 'a', centi: 100 }, { id: 'b', centi: 50 }, { id: 'c', centi: 50 }]), { a: 50, b: 25, c: 25 });
  // 10 aUEC pour 0,5 + 1 part (150) : exacts 3,33 et 6,67. Le reste de b (0,67) l'emporte sur celui de a (0,33).
  assert.deepEqual(allocateNet(10, [{ id: 'a', centi: 50 }, { id: 'b', centi: 100 }]), { a: 3, b: 7 });
});

test('part à 0 : remboursée de ses frais, jamais du reste d’arrondi', () => {
  const people = [{ id: 'a', centi: 0 }, { id: 'b', centi: 100 }, { id: 'c', centi: 100 }, { id: 'd', centi: 100 }];
  const res = settle(people, [{ by: 'a', amount: 7 }], [{ by: 'b', amount: 108 }]);
  invariants(res, people);
  const a = res.rows.find(r => r.id === 'a');
  assert.equal(a.share, 0);
  assert.equal(a.balance, 7);
});

test('vendeur sans frais avancés, plusieurs vendeurs, parts fractionnaires', () => {
  const people = [{ id: 'k', centi: 100 }, { id: 'v', centi: 100 }, { id: 't', centi: 100 }, { id: 'm', centi: 50 }];
  const res = settle(people, [{ by: 'k', amount: 42000 }, { by: 'v', amount: 63500 }, { by: 't', amount: 20400 }], [{ by: 'k', amount: 1284000 }, { by: 'v', amount: 236000 }]);
  invariants(res, people);
});

test('aucune part : refusé', () => {
  assert.throws(() => allocateNet(1000, [{ id: 'a', centi: 0 }]));
});

test('aléatoire : invariants sur 5 000 sessions', () => {
  let seed = 42;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let k = 0; k < 5000; k++) {
    const n = 1 + rnd(9);
    const people = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, centi: [0, 25, 50, 100, 100, 100, 150, 200][rnd(8)] }));
    if (!people.some(p => p.centi > 0)) people[0].centi = 100;
    const costs = Array.from({ length: rnd(6) }, () => ({ by: 'p' + rnd(n), amount: 1 + rnd(300000) }));
    const sales = Array.from({ length: rnd(5) }, () => ({ by: 'p' + rnd(n), amount: 1 + rnd(3000000) }));
    invariants(settle(people, costs, sales), people);
  }
});

test('stock : ordres remis, minerais conservés exclus, ventes partielles', () => {
  const orders = [
    { to: 'v', handedOver: true, lines: [{ ore: 'Laranite', cscu: 1480, dest: 'SELL' }, { ore: 'Or', cscu: 230, dest: 'KEEP' }] },
    { to: 'v', handedOver: false, lines: [{ ore: 'Laranite', cscu: 500, dest: 'SELL' }] },
    { to: 'k', handedOver: true, lines: [{ ore: 'Laranite', cscu: 900, dest: 'SELL' }] }
  ];
  const sales = [{ by: 'v', lines: [{ ore: 'Laranite', cscu: 1000 }] }];
  assert.deepEqual(stockOf('v', orders, sales), { Laranite: 480 });
  assert.equal(stockOf('v', orders, []).Or, undefined, 'minerai conservé hors stock');
  assert.deepEqual(checkSale({ by: 'v', lines: [{ ore: 'Laranite', cscu: 480 }] }, orders, sales), { ok: true });
  assert.equal(checkSale({ by: 'v', lines: [{ ore: 'Laranite', cscu: 481 }] }, orders, sales).ok, false, 'pas plus que le stock');
  assert.equal(checkSale({ by: 'v', lines: [{ ore: 'Or', cscu: 1 }] }, orders, sales).ok, false, 'conservé : invendable');
  assert.equal(checkSale({ by: 'k', lines: [{ ore: 'Laranite', cscu: 901 }] }, orders, sales).ok, false, 'stock propre à chaque vendeur');
  assert.equal(checkSale({ by: 'v', lines: [{ ore: 'Laranite', cscu: 0 }] }, orders, sales).ok, false, 'quantité nulle refusée');
});

test('stock : lignes d’un même minerai cumulées dans une vente', () => {
  const orders = [{ to: 'v', handedOver: true, lines: [{ ore: 'Laranite', cscu: 100, dest: 'SELL' }] }];
  const twice = checkSale({ by: 'v', lines: [{ ore: 'Laranite', cscu: 70 }, { ore: 'Laranite', cscu: 70 }] }, orders, []);
  assert.equal(twice.ok, false, '70 + 70 > 100 refusé');
  assert.deepEqual(twice.lines, [{ ore: 'Laranite', wanted: 140, available: 100 }]);
  assert.equal(checkSale({ by: 'v', lines: [{ ore: 'Laranite', cscu: 50 }, { ore: 'Laranite', cscu: 50 }] }, orders, []).ok, true, '50 + 50 = 100 accepté');
});

test('stock : un ordre prêt mais non remis n’est pas vendable, même par son lanceur', () => {
  const orders = [{ to: 'k', handedOver: false, lines: [{ ore: 'Quantanium', cscu: 1840, dest: 'SELL' }] }];
  assert.equal(checkSale({ by: 'k', lines: [{ ore: 'Quantanium', cscu: 1 }] }, orders, []).ok, false);
});

console.log(`\n${passed} vérifications réussies`);
