// Vis-à-vis de travail et de chambre : plan d'écriture (réciprocité sans écrasement).
const test = require('node:test');
const assert = require('node:assert');
const { visavisPlan_, visavisReponse_, visavisPropositions_ } = require('../VisAVis.gs');
const connus = { a: true, b: true, c: true, d: true };

test('lien posé chez l\'agent et, par réciprocité, chez son vis-à-vis libre', () => {
  const r = visavisPlan_({}, 'a', 'b', 'c', connus);
  assert.deepStrictEqual(r.plan, [{ uid: 'a', vis_travail: 'b' }, { uid: 'b', vis_travail: 'a' }, { uid: 'a', vis_chambre: 'c' }, { uid: 'c', vis_chambre: 'a' }]);
});
test('un lien existant chez le vis-à-vis n\'est jamais écrasé (A↔C chambre, C↔D travail)', () => {
  const carte = { c: { vis_travail: 'd', vis_chambre: '' }, d: { vis_travail: 'c', vis_chambre: '' } };
  const r = visavisPlan_(carte, 'a', 'c', '', connus);
  assert.deepStrictEqual(r.plan, [{ uid: 'a', vis_travail: 'c' }, { uid: 'c', prop_vis_travail: 'a' }]);   // c a déjà d : son lien reste intact, mais il doit confirmer
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

const carteP = { a: { vis_travail: 'c' }, c: { vis_travail: 'd', prop_vis_travail: 'a' }, d: { vis_travail: 'c' } };
test('proposition en attente visible seulement tant que le proposant pointe toujours vers l\'agent', () => {
  assert.deepStrictEqual(visavisPropositions_(carteP, 'c'), [{ champ: 'vis_travail', uid: 'a', actuel: 'd' }]);
  assert.deepStrictEqual(visavisPropositions_({ a: { vis_travail: '' }, c: { prop_vis_travail: 'a' } }, 'c'), []);
});
test('réponse : accepter remplace l\'actuel (qui perd son lien)', () => {
  assert.deepStrictEqual(visavisReponse_(carteP, 'c', 'vis_travail', 'accepter').plan, [{ uid: 'c', prop_vis_travail: '', vis_travail: 'a' }, { uid: 'd', vis_travail: '' }]);
});
test('réponse : garder l\'actuel retire le lien du proposant ; aucun vide tout', () => {
  assert.deepStrictEqual(visavisReponse_(carteP, 'c', 'vis_travail', 'garder').plan, [{ uid: 'c', prop_vis_travail: '' }, { uid: 'a', vis_travail: '' }]);
  assert.deepStrictEqual(visavisReponse_(carteP, 'c', 'vis_travail', 'aucun').plan, [{ uid: 'c', prop_vis_travail: '', vis_travail: '' }, { uid: 'd', vis_travail: '' }, { uid: 'a', vis_travail: '' }]);
});
test('réponse : sans proposition, proposition périmée, choix inconnu', () => {
  assert.ok(visavisReponse_(carteP, 'd', 'vis_travail', 'accepter').erreur);
  assert.ok(visavisReponse_({ a: {}, c: { prop_vis_travail: 'a' } }, 'c', 'vis_travail', 'accepter').erreur);
  assert.ok(visavisReponse_(carteP, 'c', 'vis_travail', 'x').erreur);
});
