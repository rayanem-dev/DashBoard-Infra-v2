// Fin de l'autorisation et du macaron : date choisie → les deux la suivent ; sinon autorisation mensuelle et macaron jusqu'à la fin du contrat.
const test = require('node:test'), assert = require('node:assert');
const { dateLue_, finContrat_, departManuel_, datesFin_ } = require('../Code.js');
const jj = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

test('fin de contrat : ODS + durée en mois ou en jours, moins un jour', () => {
  assert.strictEqual(jj(finContrat_('01/03/2026', 12)), '2027-02-28');
  assert.strictEqual(jj(finContrat_('2026-03-01', 6)), '2026-08-31');
  assert.strictEqual(jj(finContrat_('01/03/2026', 540)), '2027-08-22');
  assert.strictEqual(finContrat_('', 12), null); assert.strictEqual(finContrat_('01/03/2026', ''), null);
});
test('départ manuel : seulement si différent de l\'arrivée + 28 jours', () => {
  assert.strictEqual(departManuel_('2026-10-27', '2026-11-24'), false);
  assert.strictEqual(departManuel_('2026-10-27', '2026-10-30'), true);
  assert.strictEqual(departManuel_('2026-10-27', ''), false);
});
test('date choisie (3 jours) : autorisation et macaron suivent cette date', () => {
  const r = datesFin_({ aujourdhui: '2026-10-27', depart: '2026-10-30', departManuel: true, finContrat: '2027-02-28' });
  assert.strictEqual(jj(r.autorisation), '2026-10-30'); assert.strictEqual(jj(r.macaron), '2026-10-30');
});
test('date non touchée : autorisation fin de mois, macaron fin de contrat', () => {
  const r = datesFin_({ aujourdhui: '2026-10-27', depart: '2026-11-24', departManuel: false, finContrat: '2027-02-28' });
  assert.strictEqual(jj(r.autorisation), '2026-10-31'); assert.strictEqual(jj(r.macaron), '2027-02-28');
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27', deuxMois: true, finContrat: '2027-02-28' }).autorisation), '2026-11-30');
});
test('contrat terminé ou inconnu : le macaron suit l\'autorisation ; visite sur site : date de départ', () => {
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27', finContrat: '2026-09-30' }).macaron), '2026-10-31');
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27' }).macaron), '2026-10-31');
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27', depart: '2026-10-29', visite: true }).autorisation), '2026-10-29');
});
