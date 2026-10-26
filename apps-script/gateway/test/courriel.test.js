// node --test apps-script/gateway/test/courriel.test.js
const test = require('node:test');
const assert = require('node:assert');
const Courriel = require('../CourrielChange.gs');

test('adresse valide / invalide', () => {
  assert.ok(Courriel.valide('a.b@exemple.dz')); assert.ok(Courriel.valide(' x@y.com '));
  ['', 'abc', 'a@b', 'a b@c.dz', 'a@b.dz,c@d.dz', 'a@@b.dz'].forEach(s => assert.ok(!Courriel.valide(s), s));
});
test('remplacement dans les colonnes nommées seulement, sans toucher aux autres adresses', () => {
  const v = [['email', 'par', 'motif'], ['Faute@x.dz', 'chef@x.dz', 'faute@x.dz'], ['autre@x.dz', 'FAUTE@x.dz', '']];
  const r = Courriel.remplacer(v, ['email', 'par'], 'faute@x.dz', 'bon@x.dz');
  assert.deepStrictEqual(r.valeurs, [['email', 'par', 'motif'], ['bon@x.dz', 'chef@x.dz', 'faute@x.dz'], ['autre@x.dz', 'bon@x.dz', '']]);
  assert.strictEqual(r.n, 2); assert.strictEqual(v[1][0], 'Faute@x.dz');   // l'entrée n'est pas modifiée
  assert.strictEqual(Courriel.remplacer(v, ['absente'], 'faute@x.dz', 'z@x.dz').n, 0);
});
