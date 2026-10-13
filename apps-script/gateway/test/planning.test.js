// node --test apps-script/gateway/test/planning.test.js
const test = require('node:test');
const assert = require('node:assert');
global.Dates = require('../Dates.gs');
global.Cycle = require('../Cycle.gs');
const Planning = require('../Planning.gs');

const rot = { statut: 'T', depuis: '2026-10-01', jours_travail: 28, jours_repos: 28 };

test('en travail : jour 10 sur 28, 19 jours restants (aujourd\'hui compris), repos le 29 octobre', () => {
  const s = Planning.situation(rot, [], '2026-10-10');
  assert.strictEqual(s.statut, 'T'); assert.strictEqual(s.depuis, '2026-10-01');
  assert.strictEqual(s.jour, 10); assert.strictEqual(s.total, 28); assert.strictEqual(s.restants, 19);
  assert.deepStrictEqual(s.prochain, { date: '2026-10-29', statut: 'R' });
});

test('bascule automatique en repos après 28 jours, puis retour au travail', () => {
  const r = Planning.situation(rot, [], '2026-10-29');
  assert.strictEqual(r.statut, 'R'); assert.strictEqual(r.depuis, '2026-10-29'); assert.strictEqual(r.jour, 1);
  const t = Planning.situation(rot, [], '2026-11-26');
  assert.strictEqual(t.statut, 'T'); assert.strictEqual(t.depuis, '2026-11-26');
});

test('rotation 4/4 : le début de la période en cours est bien retrouvé', () => {
  const r4 = { statut: 'R', depuis: '2026-10-01', jours_travail: 4, jours_repos: 4 };
  const s = Planning.situation(r4, [], '2026-10-11'); // R 1-4, T 5-8, R 9-12 => 11 = jour 3 du repos
  assert.strictEqual(s.statut, 'R'); assert.strictEqual(s.depuis, '2026-10-09'); assert.strictEqual(s.jour, 3); assert.strictEqual(s.restants, 2);
});

test('avant la date de début : pas de statut', () => {
  const s = Planning.situation({ ...rot, depuis: '2026-10-20' }, [], '2026-10-10');
  assert.deepStrictEqual(s, { avant: true, debut: '2026-10-20' });
});

test('grille : lettres sur 35 jours, points avant le début', () => {
  const g = Planning.grille({ statut: 'T', depuis: '2026-10-03', jours_travail: 2, jours_repos: 2 }, [], '2026-10-01', 10);
  assert.strictEqual(g, '..TTRRTTRR');
});

test('une correction (absence) fait avancer sans casser le cycle', () => {
  const g = Planning.grille({ statut: 'T', depuis: '2026-10-01', jours_travail: 3, jours_repos: 3 }, [{ date: '2026-10-02', statut: 'ABS' }], '2026-10-01', 6);
  assert.strictEqual(g, 'TATRRR');
});

test('validation', () => {
  const ok = { ...rot };
  assert.strictEqual(Planning.valider(ok, '2026-10-10'), '');
  assert.match(Planning.valider({ ...ok, statut: 'X' }, '2026-10-10'), /travail ou en repos/);
  assert.match(Planning.valider({ ...ok, depuis: '2026-02-31' }, '2026-10-10'), /invalide/);
  assert.match(Planning.valider({ ...ok, depuis: '2026-10-11' }, '2026-10-10'), /futur/);
  assert.match(Planning.valider({ ...ok, depuis: '2025-01-01' }, '2026-10-10'), /ancienne/);
  assert.match(Planning.valider({ ...ok, jours_travail: 0 }, '2026-10-10'), /Rotation invalide/);
  assert.match(Planning.valider({ ...ok, jours_repos: 1.5 }, '2026-10-10'), /Rotation invalide/);
});
