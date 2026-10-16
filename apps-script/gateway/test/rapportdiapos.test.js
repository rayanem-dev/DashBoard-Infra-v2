const test = require('node:test'), assert = require('node:assert');
const R = require('../../../js/rapportdiapos.js'), S = require('../../../js/synthese.js');
const E = ['', 'Type', 'N°', 'Intitule', '', '', '', '%', 'Statut', 'Commentaire'];
const L = (t, n, i, p, c) => ['', t, n, i, '', '', '', p, 'En cours', c];
const rows = [['x'], E, L('Dossier Appel Offre DAO', 'N1', 'Lot 1', '98%', 'a'), L('Dossier Appel Offre DAO', 'N1', 'Lot 2', '95%', 'b'), L('Dossier Appel Offre DAO', 'N2', 'Fini', '100%', 'c'), L('Gré à Gré Convention Cadre', 'N3', 'Cadre', '10%', '')];
test('dossiers à moins de 100 %, classés par tableau ; changement de la semaine seulement pour le bon dossier', () => {
  const r = R.preparer(rows, [{ date: '2026-10-12', type: 'modifie', champ: 'pourcent', n_dossier: 'N1', dossier: 'Lot 1' }, { date: '2026-10-01', type: 'modifie', champ: 'commentaire', n_dossier: 'N1', dossier: 'Lot 2' }], '2026-10-10', S);
  assert.deepStrictEqual(r.groupes.map(g => [g.cle, g.dossiers.length]), [['daocf', 2], ['cadre', 1]]);
  assert.deepStrictEqual(r.groupes[0].dossiers.map(d => d.change), [true, false]);
  assert.strictEqual(r.fin, '2026-10-16');
});
