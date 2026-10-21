// Couverture d'une équipe : jours sans personne, pics de présence, verdict.
const test = require('node:test');
const assert = require('node:assert');
const { analyser } = require('../../../js/couverture.js');

const rot = (debutT, tr, rp, n) => { let s = ''; for (let i = 0; i < n; i += 1) s += ((i - debutT + 1000 * (tr + rp)) % (tr + rp)) < tr ? 'T' : 'R'; return s; };

test('deux agents en vis-à-vis parfait : équilibré, aucun jour vide', () => {
  const r = analyser([rot(0, 28, 28, 168), rot(28, 28, 28, 168)], { debut: '2026-10-01' });
  assert.strictEqual(r.verdict, 'ok'); assert.strictEqual(r.joursVides, 0); assert.strictEqual(r.titre, 'Planning des équipes équilibré');
});
test('deux agents en repos ensemble : jours sans personne repérés, à ajuster ou insuffisant', () => {
  const r = analyser([rot(0, 28, 28, 112), rot(0, 28, 28, 112).replace(/T/g, 'X').replace(/R/g, 'T').replace(/X/g, 'R')], { debut: '2026-10-01' });
  assert.strictEqual(r.joursVides, 0);
  const g1 = 'T'.repeat(20) + 'R'.repeat(10) + 'T'.repeat(30), g2 = 'T'.repeat(20) + 'R'.repeat(10) + 'T'.repeat(30);
  const t = analyser([g1.slice(0, 20) + 'R'.repeat(10) + g1.slice(30), g2.slice(0, 20) + 'R'.repeat(10) + g2.slice(30)], { debut: '2026-10-01' });
  assert.strictEqual(t.joursVides, 10); assert.deepStrictEqual(t.vides[0], { du: '2026-10-21', au: '2026-10-30', jours: 10, max: 0 });
  assert.strictEqual(t.verdict, 'insuffisant'); assert.match(t.details.join(' '), /10 jours sans personne/);
});
test('un seul jour vide sur six mois : toléré (correct) mais mentionné', () => {
  const g = 'T'.repeat(180), h = 'T'.repeat(50) + 'R' + 'T'.repeat(129);
  const r = analyser([h.replace(/T/g, 'R').slice(0, 0) + 'R' + 'T'.repeat(179), 'R' + 'T'.repeat(179)], { debut: '2026-10-01' });
  assert.strictEqual(r.joursVides, 1); assert.strictEqual(r.verdict, 'ok'); assert.match(r.details.join(' '), /1 jour sans personne/);
});
test('minimum de présents modifiable et pics de présence', () => {
  const a = 'T'.repeat(10), b = ('T'.repeat(5) + 'R'.repeat(5));
  assert.strictEqual(analyser([a, b], { debut: '2026-10-01', minimum: 2 }).joursVides, 5);
  const grand = [], pic = ('R'.repeat(10) + 'T'.repeat(5) + 'R'.repeat(10)); for (let i = 0; i < 5; i += 1) grand.push(pic);
  const r = analyser(grand.concat(['T'.repeat(25)]), { debut: '2026-10-01' }); assert.ok(r.pics.length >= 1);
  assert.strictEqual(analyser([], {}).titre, 'Aucun agent configuré');
});
test('période choisie (de, a)', () => {
  const r = analyser(['T'.repeat(10) + 'R'.repeat(10)], { debut: '2026-10-01', de: 10, a: 20 });
  assert.strictEqual(r.jours, 10); assert.strictEqual(r.joursVides, 10); assert.strictEqual(r.verdict, 'insuffisant');
});
