// Vis-à-vis de travail et de chambre : plan d'écriture (réciprocité sans écrasement).
const test = require('node:test');
const assert = require('node:assert');
const { visavisPlan_ } = require('../VisAVis.gs');
const connus = { a: true, b: true, c: true, d: true };

test('lien posé chez l\'agent et, par réciprocité, chez son vis-à-vis libre', () => {
  const r = visavisPlan_({}, 'a', 'b', 'c', connus);
  assert.deepStrictEqual(r.plan, [{ uid: 'a', vis_travail: 'b' }, { uid: 'b', vis_travail: 'a' }, { uid: 'a', vis_chambre: 'c' }, { uid: 'c', vis_chambre: 'a' }]);
});
test('un lien existant chez le vis-à-vis n\'est jamais écrasé (A↔C chambre, C↔D travail)', () => {
  const carte = { c: { vis_travail: 'd', vis_chambre: '' }, d: { vis_travail: 'c', vis_chambre: '' } };
  const r = visavisPlan_(carte, 'a', 'c', '', connus);
  assert.deepStrictEqual(r.plan, [{ uid: 'a', vis_travail: 'c' }]);                                   // c a déjà un vis-à-vis de travail (d) : intact
});
test('retrait : le lien réciproque est retiré aussi, rien si inchangé', () => {
  const carte = { a: { vis_travail: 'b', vis_chambre: '' }, b: { vis_travail: 'a', vis_chambre: '' } };
  assert.deepStrictEqual(visavisPlan_(carte, 'a', '', '', connus).plan, [{ uid: 'a', vis_travail: '' }, { uid: 'b', vis_travail: '' }]);
  assert.deepStrictEqual(visavisPlan_(carte, 'a', 'b', '', connus).plan, []);
});
test('refus : soi-même, inconnu', () => {
  assert.ok(visavisPlan_({}, 'a', 'a', '', connus).erreur);
  assert.ok(visavisPlan_({}, 'a', 'zz', '', connus).erreur);
  assert.ok(visavisPlan_({}, 'zz', 'a', '', connus).erreur);
});
