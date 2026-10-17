const test = require('node:test'), assert = require('node:assert');
const { lienActuel_ } = require('../Setup.gs');
test('anciens liens (rapport pptx, Suivi CPM) remplacés par les actuels ; les autres inchangés', () => {
  assert.strictEqual(lienActuel_('https://docs.google.com/presentation/d/1FLFP453C8F1Sb8hZBnxboqoJtSq33rEu/edit?usp=sharing&ouid=1&rtpof=true&sd=true'), 'https://docs.google.com/presentation/d/1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20/edit?slide=id.p14#slide=id.p14');
  assert.ok(lienActuel_('https://docs.google.com/spreadsheets/d/1QFoEEsoosl3vGdwyAlzmQbHt3Vv76llfWfrO-prmAuY/edit?usp=sharing').includes('1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I'));
  assert.strictEqual(lienActuel_('Dossiers_CPM.html'), 'Dossiers_CPM.html');
});
