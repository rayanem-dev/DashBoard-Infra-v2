const test = require('node:test'), assert = require('node:assert');
const { lienActuel_ } = require('../Setup.gs');
test('anciens liens (rapport pptx, Suivi CPM) remplacés par les actuels ; les autres inchangés', () => {
  assert.strictEqual(lienActuel_('https://docs.google.com/presentation/d/1FLFP453C8F1Sb8hZBnxboqoJtSq33rEu/edit?usp=sharing&ouid=1&rtpof=true&sd=true'), 'https://docs.google.com/presentation/d/1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20/edit?slide=id.p1#slide=id.p1');
  assert.ok(lienActuel_('https://docs.google.com/spreadsheets/d/1QFoEEsoosl3vGdwyAlzmQbHt3Vv76llfWfrO-prmAuY/edit?usp=sharing').includes('1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I'));
  assert.strictEqual(lienActuel_('Dossiers_CPM.html'), 'Dossiers_CPM.html');
});

test('lien des Enquêtes administratives : l\'ancien fichier est remplacé par le Google Sheets actuel', () => {
  const ancien = 'https://docs.google.com/spreadsheets/d/1BBT3DzzLUXAyEQT3SEXTei4wRuN9h1UZ/edit?usp=sharing';
  assert.strictEqual(lienActuel_(ancien), 'https://docs.google.com/spreadsheets/d/1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo/');
  assert.strictEqual(lienActuel_('https://docs.google.com/spreadsheets/d/1BBT3DzzLUXAyEQT3SEXTei4wRuN9h1UZ/'), 'https://docs.google.com/spreadsheets/d/1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo/');
});
