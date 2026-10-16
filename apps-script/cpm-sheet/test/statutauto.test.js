const test = require('node:test'), assert = require('node:assert');
const { cpmStatutApres100_: f } = require('../StatutAuto.gs');
test('100 % : Attribué / Dossier en cours passent en exécution, les autres statuts restent', () => {
  assert.strictEqual(f('100%', 'Attribué'), 'Contrat en exécution');
  assert.strictEqual(f(1, 'Dossier en cours'), 'Contrat en exécution');
  assert.strictEqual(f(100, ' attribué '), 'Contrat en exécution');
  ['Contrat échu', 'infructueux', 'Bloqué', 'Contrat en exécution'].forEach(s => assert.strictEqual(f('100%', s), ''));
});
test('moins de 100 % ou illisible : rien ne change', () => {
  assert.strictEqual(f('95%', 'Attribué'), ''); assert.strictEqual(f(0.95, 'Attribué'), ''); assert.strictEqual(f('', 'Attribué'), ''); assert.strictEqual(f('abc', 'Attribué'), '');
});
