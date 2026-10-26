// node --test apps-script/gateway/test/transport.test.js
const test = require('node:test');
const assert = require('node:assert');
const T = require('../Transport.gs');
const D = require('../../../js/documents-modeles.js');

test('numéros de téléphone : formats algériens normalisés, le reste refusé', () => {
  assert.strictEqual(T.nettoyerTel('0696956429'), '06 96 95 64 29');
  assert.strictEqual(T.nettoyerTel('06 96 95 64 29'), '06 96 95 64 29');
  assert.strictEqual(T.nettoyerTel('+213 696 95 64 29'), '06 96 95 64 29');
  assert.strictEqual(T.nettoyerTel('696956429'), '06 96 95 64 29');
  ['', 'abc', '12345', '0696956', '16969564290'].forEach(s => assert.strictEqual(T.nettoyerTel(s), null, s));
});
test('imputation de la personne : détectée d\'après son service, sinon inconnue', () => {
  const f = D.imputationDe;
  assert.strictEqual(f('Service Électromécanique').code, '43000451000');
  assert.strictEqual(f('Travaux Entretien').code, '43000452000');
  assert.strictEqual(f('Service Construction (Génie Civil)').code, '43000453000');
  assert.strictEqual(f('Division Infrastructures').code, '43000450000');
  assert.strictEqual(f('Cellule Passation de marché').code, '43000450000');
  assert.strictEqual(f(''), null); assert.strictEqual(f('Service inconnu'), null);
  assert.strictEqual(D.IMPUTATIONS.length, 4);
});
