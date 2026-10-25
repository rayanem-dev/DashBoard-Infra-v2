// Demande de réservation de vol : texte du mail (exemple du secrétariat), mention de rattachement, validation.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../Reservation.gs');

test('mail : date en toutes lettres, société hors SONATRACH et mention de rattachement', () => {
  const m = R.resaMail_({ date: '2026-10-23', trajet: 'ALGER → RNS', personnes: [
    { civ: 'M.', nom: 'BENALI Karim', fonction: 'Chef de division', societe: 'SONATRACH', rattache: false },
    { civ: 'M.', nom: 'MEZIANE Sofia', fonction: 'Conducteur des travaux', societe: 'ACOSCO', rattache: true }] });
  assert.strictEqual(m.sujet, 'Reservation ALGER → RNS'); assert.strictEqual(m.nb, 2);
  assert.ok(m.texte.includes('réserver 2 places') && m.texte.includes('ALGER → RNS le Vendredi 23/10/2026, au profit de Messieurs :'));
  assert.ok(m.texte.includes(' - BENALI Karim  Chef de division\n'));
  assert.ok(m.texte.includes(' - MEZIANE Sofia  Conducteur des travaux  ACOSCO  Rattaché à la division Infra'));
  assert.ok(m.html.includes('<b>Vendredi 23/10/2026,</b>'));
});
test('mail : une personne, civilité féminine, trajet retour ; erreurs claires', () => {
  const m = R.resaMail_({ date: '2026-10-24', trajet: 'RNS → ALGER', personnes: [{ civ: 'Mme', nom: 'X <b>', fonction: '', societe: 'SONATRACH', rattache: false }] });
  assert.ok(m.texte.includes('réserver une place') && m.texte.includes('RNS → ALGER le Samedi 24/10/2026, au profit de Madame :'));
  assert.ok(m.html.includes('X &lt;b&gt;'));
  assert.throws(() => R.resaMail_({ date: '', personnes: [] }), /Date/);
  assert.throws(() => R.resaMail_({ date: '2026-10-24', personnes: [] }), /au moins une personne/);
  assert.throws(() => R.resaMail_({ date: '2026-10-24', personnes: [{ civ: 'M.', nom: 'A' }, { civ: 'M.', nom: ' ' }] }), /nom est vide/);
});
