// node --test apps-script/gateway/test/tableaubord.test.js
const test = require('node:test');
const assert = require('node:assert');
const TB = require('../TableauBord.gs');

test('jours consécutifs', () => { assert.deepStrictEqual(TB.jours('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']); });
test('effectif par jour et par service (le service vient du rapport ou du chantier)', () => {
  const r = [{ date: '2026-10-26', effectif: 10, service: 'Service Construction' }, { date: '2026-10-26', effectif: 5, service: 'Travaux Entretien' }, { date: '2026-10-27', effectif: 7, service: 'Électromécanique' }, { date: '2026-10-20', effectif: 99, service: 'x' }, { date: '2026-10-27', effectif: 3, service: '' }];
  const s = TB.serieEffectif(r, ['2026-10-26', '2026-10-27']);
  assert.deepStrictEqual(s.jours.map(j => [j.date, j.total, j.par.construction, j.par.entretien, j.par.electromecanique, j.par.autre]), [['2026-10-26', 15, 10, 5, 0, 0], ['2026-10-27', 10, 0, 0, 7, 3]]);
});
test('rapports du jour : reçus, manquants, hors-contrat ignorés', () => {
  const x = TB.rapportsDuJour({ chantiers: [{ nom: 'A', service: 'S', rapports: [{}] }, { nom: 'B', service: 'S', rapports: [] }, { nom: 'C', phase: 'preparation', rapports: [] }] });
  assert.deepStrictEqual([x.total, x.recus, x.manquants.map(m => m.nom)], [2, 1, ['B']]);
});
test('avancement contre délai : le plus en retard d\'abord, comptage des retards > 15 points', () => {
  const t = [{ nom: 'A', avancement: 80, delai_pct: 60 }, { nom: 'B', avancement: 20, delai_pct: 70 }, { nom: 'C', avancement: 50, delai_pct: 60 }, { nom: 'D', avancement: null, delai_pct: 10 }];
  const r = TB.avancementDelai(t, 5);
  assert.deepStrictEqual([r.chantiers.map(c => c.nom), r.en_retard, r.suivis], [['B', 'C', 'A'], 1, 3]);
});
test('échéances proches et répartition des contrats par statut', () => {
  assert.deepStrictEqual(TB.echeances([{ nom: 'A', jours_restants: 40 }, { nom: 'B', jours_restants: 5 }, { nom: 'C', jours_restants: 200 }, { nom: 'D', jours_restants: -3 }], 60).map(e => e.nom), ['B', 'A']);
  const enr = { ordre: ['a', 'b', 'c', 'd'], dossiers: { a: { statut: 'Contrat en exécution' }, b: { statut: 'Contrat échu' }, c: { statut: 'infructueux' }, d: { statut: 'Contrat en exécution' } } };
  assert.deepStrictEqual(TB.contratsParStatut(enr).map(s => [s.id, s.n]), [['execution', 2], ['echu', 1], ['infructueux', 1]]);
});
