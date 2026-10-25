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

test('trajet libre : normalisé en majuscules, départ ≠ destination, lieux obligatoires', () => {
  assert.strictEqual(R.resaTrajet_(' laghouat ', 'rns'), 'LAGHOUAT → RNS');
  assert.throws(() => R.resaTrajet_('RNS', 'rns'), /identiques/); assert.throws(() => R.resaTrajet_('', 'RNS'), /départ et la destination/);
  const m = R.resaMail_({ date: '2026-10-25', depart: 'ghardaia', destination: 'rns', personnes: [{ civ: 'M.', nom: 'A', fonction: '', societe: 'SONATRACH' }] });
  assert.strictEqual(m.sujet, 'Reservation GHARDAIA → RNS'); assert.ok(m.texte.includes('GHARDAIA → RNS le Dimanche 25/10/2026'));
});
test('trajets appris : le jour de la semaine compte, ceux du jour sortent en premier', () => {
  let t = {};
  t = R.resaApprendre_(t, 'LAGHOUAT → RNS', '2026-10-25'); t = R.resaApprendre_(t, 'LAGHOUAT → RNS', '2026-11-01'); t = R.resaApprendre_(t, 'RNS → LAGHOUAT', '2026-10-29');
  assert.strictEqual(t['LAGHOUAT → RNS'].n, 2); assert.strictEqual(t['LAGHOUAT → RNS'].jours[0], 2);
  assert.deepStrictEqual(R.resaTrajetsTries_(t, 0).map(x => x.trajet), ['LAGHOUAT → RNS', 'RNS → LAGHOUAT']);
  assert.deepStrictEqual(R.resaTrajetsTries_(t, 4).map(x => x.trajet), ['RNS → LAGHOUAT', 'LAGHOUAT → RNS']);
});
