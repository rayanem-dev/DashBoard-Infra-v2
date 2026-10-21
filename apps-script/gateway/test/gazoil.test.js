// Autorisation GAZ-OIL : la quantité en litres est divisée en fûts de 200 L.
const test = require('node:test');
const assert = require('node:assert');
const { repartir } = require('../../../js/gazoil.js');

test('400 L = 2 fûts de 200 L ; 200 L = 1 fût (singulier) ; 1000 L = 5 fûts', () => {
  assert.deepStrictEqual(repartir(400, 200), { futs: 2, reste: 0, texte: '400L Soit 2 fûts de 200L' });
  assert.strictEqual(repartir(200, 200).texte, '200L Soit 1 fût de 200L');
  assert.strictEqual(repartir(1000, 200).futs, 5);
});
test('quantité qui ne tombe pas juste : un dernier fût partiel ; contenance modifiable ; entrées invalides', () => {
  assert.strictEqual(repartir(500, 200).texte, '500L Soit 2 fûts de 200L et 1 fût de 100L'); assert.strictEqual(repartir(500, 200).futs, 3);
  assert.strictEqual(repartir(150, 200).texte, '150L Soit 1 fût de 150L');
  assert.strictEqual(repartir(300, 100).texte, '300L Soit 3 fûts de 100L');
  assert.strictEqual(repartir('', 200).texte, ''); assert.strictEqual(repartir(-5, 200).futs, 0);
});
