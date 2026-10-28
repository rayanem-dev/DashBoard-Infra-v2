// node --test apps-script/gateway/test/benchmarkserveur.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../Benchmark.gs');

const base = { titre: ' Toitures  RNS ', items: [{ id: 'a1', n: '01', des: 'Décapage', u: 'M2', qte: '5 000', pu: '738,5' }], sources: [{ nom: 'HMD', annee: 2023, coef: '1,3', prix: { a1: '1 200', inconnu: 5, a2: 3 } }] };

test('le document est nettoyé : titre, nombres, prix des seuls articles existants', () => {
  const d = D.nettoyer(base);
  assert.strictEqual(d.titre, 'Toitures RNS'); assert.strictEqual(d.items[0].qte, 5000); assert.strictEqual(d.items[0].pu, 738.5);
  assert.deepStrictEqual(d.sources[0].prix, { a1: 1200 }); assert.strictEqual(d.sources[0].coef, 1.3); assert.strictEqual(d.sources[0].id, 's1');
  assert.strictEqual(d.params.statistique, 'mediane');
});
test('titre obligatoire, valeurs aberrantes ou négatives ignorées, champs inconnus jamais stockés', () => {
  assert.throws(() => D.nettoyer({ titre: '  ' }), /titre/);
  const d = D.nettoyer({ titre: 'x', evil: '<script>', items: [{ id: 'a b!', des: 'z', qte: -5, pu: 'abc' }], params: { statistique: 'rien', exclureSuspects: 'oui' } });
  assert.strictEqual(d.evil, undefined); assert.strictEqual(d.items[0].qte, ''); assert.strictEqual(d.items[0].pu, ''); assert.strictEqual(d.items[0].id, 'ab');
  assert.strictEqual(d.params.statistique, 'mediane'); assert.strictEqual(d.params.exclureSuspects, false);
});
test('limites : articles, sources et taille de la cellule', () => {
  const items = Array.from({ length: 200 }, (_, i) => ({ id: 'a' + i, des: 'd' })), sources = Array.from({ length: 20 }, () => ({ nom: 'r' }));
  const d = D.nettoyer({ titre: 'x', items, sources }); assert.strictEqual(d.items.length, D.MAX_ARTICLES); assert.strictEqual(d.sources.length, D.MAX_SOURCES);
  const gros = Array.from({ length: 80 }, (_, i) => ({ id: 'a' + i, des: 'x'.repeat(400), prix: {} }));
  assert.throws(() => D.nettoyer({ titre: 'x', items: gros, sources: Array.from({ length: 8 }, (_, j) => ({ nom: 'n', prix: Object.fromEntries(gros.map(g => [g.id, 123456.789])) })) }), /volumineux/);
});
test('les actions sont branchées dans la passerelle', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'Main.gs'), 'utf8');
  ['liste', 'lire', 'enregistrer', 'supprimer'].forEach(a => assert.ok(main.includes("case 'benchmark_" + a + "'"), a));
});
