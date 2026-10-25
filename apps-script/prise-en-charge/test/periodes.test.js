// Fin de l'autorisation et du macaron : date choisie → les deux la suivent ; sinon autorisation mensuelle et macaron jusqu'à la fin du contrat.
const test = require('node:test'), assert = require('node:assert');
const { dateLue_, finContrat_, departManuel_, datesFin_, repartirParBase_ } = require('../Code.js');
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
test('date de départ choisie : elle ne change ni l\'autorisation (fin de mois) ni le macaron (échéance du contrat)', () => {
  const r = datesFin_({ aujourdhui: '2026-10-27', depart: '2026-10-30', departManuel: true, finContrat: '2027-02-28' });
  assert.strictEqual(jj(r.autorisation), '2026-10-31'); assert.strictEqual(jj(r.macaron), '2027-02-28');
});
test('date non touchée : autorisation fin de mois, macaron fin de contrat', () => {
  const r = datesFin_({ aujourdhui: '2026-10-27', depart: '2026-11-24', departManuel: false, finContrat: '2027-02-28' });
  assert.strictEqual(jj(r.autorisation), '2026-10-31'); assert.strictEqual(jj(r.macaron), '2027-02-28');
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27', deuxMois: true, finContrat: '2027-02-28' }).autorisation), '2026-11-30');
});
test('le macaron suit toujours la fin du contrat (même dépassée) ; fin introuvable : il suit l\'autorisation ; visite sur site : date de départ', () => {
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27', finContrat: '2026-09-30' }).macaron), '2026-09-30');
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27' }).macaron), '2026-10-31');
  assert.strictEqual(jj(datesFin_({ aujourdhui: '2026-10-27', depart: '2026-10-29', visite: true }).autorisation), '2026-10-29');
});

const { nomAvecTiret_, largeursColonnes_ } = require('../Code.js');
test('noms : tiret devant, jamais doublé, ligne vide reste vide', () => {
  assert.strictEqual(nomAvecTiret_('BENSLIMANE CHEMSEDDINE'), '- BENSLIMANE CHEMSEDDINE');
  assert.strictEqual(nomAvecTiret_(' - CHAIB TOUFIK '), '- CHAIB TOUFIK');
  assert.strictEqual(nomAvecTiret_(''), ' ');
});
test('largeurs : la colonne des noms s\'élargit sur le nombre de personnes d\'abord, total inchangé, minimums respectés', () => {
  const act = [110, 66, 66, 70, 80, 100, 90], tot = act.reduce((a, b) => a + b, 0);
  const r = largeursColonnes_(act, 24);
  assert.ok(r[0] > act[0] && r[3] < act[3] && r[3] >= 40);
  assert.ok(Math.abs(r.reduce((a, b) => a + b, 0) - tot) < 1e-9);
  assert.deepStrictEqual(largeursColonnes_(act, 5), act, 'nom court : rien ne bouge');
  const g = largeursColonnes_(act, 80); assert.ok(g.every((x, i) => i === 0 || x > 0));
});

const { typeFichier_ } = require('../Code.js');
test('type des fichiers générés d\'après leur nom', () => {
  assert.strictEqual(typeFichier_('PEC_ENCC_20-10-2026.pdf'), 'PEC'); assert.strictEqual(typeFichier_('Autorisation_X_1.pdf'), 'AUTORISATION');
  assert.strictEqual(typeFichier_('Macaron_X_1.pdf'), 'MACARON'); assert.strictEqual(typeFichier_('autre.pdf'), 'PDF');
});

test('largeurs : la case « Code » garde assez de place pour une entreprise au nom long', () => {
  const act = [150, 70, 70, 60, 80, 150, 130];   // total 710
  const r = largeursColonnes_(act, 60);          // nom très long : toute la place possible est prise ailleurs
  assert.ok(r[5] >= 124, 'case Code : ' + r[5]);
  assert.strictEqual(r.reduce((a, b) => a + b, 0), act.reduce((a, b) => a + b, 0));
});

test('répartition : une prise en charge par base de vie, 8 personnes au plus par document', () => {
  const p = (n, base) => ({ nom: 'N' + n, base });
  const r = repartirParBase_([p(1, 'BASE DE VIE CENTRALE'), p(2, 'ANNEXE II BJSP'), p(3, 'BASE DE VIE CENTRALE'), p(4, 'ANNEXE II BJSP')], '', 8);
  assert.deepStrictEqual(r.map(g => g.base + ':' + g.personnes.length), ['BASE DE VIE CENTRALE:2', 'ANNEXE II BJSP:2']);
  const dix = Array.from({ length: 10 }, (_, i) => p(i, ''));
  const g = repartirParBase_(dix, 'BASE DE VIE CENTRALE', 8);
  assert.deepStrictEqual(g.map(x => x.personnes.length + '/' + x.partie + '/' + x.parties), ['8/1/2', '2/2/2']);
  assert.strictEqual(repartirParBase_([], 'X', 8).length, 0);
});
