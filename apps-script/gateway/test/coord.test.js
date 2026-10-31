// Planning : portée niveau 2 (service + CPM), libre-service chambre / vis-à-vis, écriture BDDORGA, droits de tous les rôles.
const test = require('node:test');
const assert = require('node:assert');
global.Droits = require('../Droits.gs');
const V = require('../VisAVis.gs');
const Annuaire = require('../Annuaire.gs');

test('chef de service : son service + la cellule CPM, pas les autres services', () => {
  const chef = { role: 'chef_service', service: 'Service Études' };
  assert.ok(V.planningPortee_(chef, { role: 'agent', service: 'Service  études' }));
  assert.ok(V.planningPortee_(chef, { role: 'cpm', service: 'Autre' }));
  assert.ok(V.planningPortee_(chef, { role: 'agent', service: 'Cellule Passation de Marché' }));
  assert.ok(!V.planningPortee_(chef, { role: 'agent', service: 'Maintenance' }));
});
test('rôle CPM : les gens de la cellule (4 personnes) mais pas les autres services', () => {
  const cpm = { role: 'cpm', service: 'CPM' };
  assert.ok(V.planningPortee_(cpm, { role: 'cpm', service: '' }));
  assert.ok(V.planningPortee_(cpm, { role: 'agent', service: 'CPM' }));
  assert.ok(!V.planningPortee_(cpm, { role: 'agent', service: 'Maintenance' }));
});
test('service vide : jamais « tout le monde sans service »', () => {
  assert.ok(!V.planningPortee_({ role: 'chef_service', service: '' }, { role: 'agent', service: '' }));
});

test('chambre : validation', () => {
  assert.deepStrictEqual(V.chambreValider_('  B-12 '), { valeur: 'B-12' });
  assert.deepStrictEqual(V.chambreValider_(''), { valeur: '' });
  assert.ok(V.chambreValider_('<script>').erreur);
  assert.ok(V.chambreValider_('1'.repeat(21)).erreur);
});
test('candidats vis-à-vis : tout le monde sauf soi ; un prestataire seulement son entreprise', () => {
  const U = [{ uid: 'a', email: 'a@x', role: 'agent', dependance: 'SONATRACH' }, { uid: 'b', email: 'b@x', dependance: 'ENTR1' }, { uid: 'c', email: 'c@x', dependance: 'entr1 ' },
    { uid: 'd', email: 'd@x', dependance: 'ENTR2' }, { uid: 'e', email: 'e@x', actif: '0', dependance: 'ENTR1' }];
  assert.deepStrictEqual(V.candidatsVisAVis_(U[0], U).map(x => x.uid), ['b', 'c', 'd']);
  assert.deepStrictEqual(V.candidatsVisAVis_({ uid: 'b', role: 'prestataire', dependance: 'ENTR1' }, U).map(x => x.uid), ['c']);
  assert.deepStrictEqual(V.candidatsVisAVis_({ uid: 'z', role: 'prestataire', dependance: '' }, U), []);
});
test('empreinte : on n\'écrit dans BDDORGA que si quelque chose a changé', () => {
  const c = V.coordChamps_('B12', { vis_travail: 'u2' }, { u2: 'DUPONT Jean' });
  assert.deepStrictEqual(c, { chambre: 'B12', vis_travail: 'DUPONT Jean', vis_chambre: '' });
  assert.ok(V.coordAEcrire_(c, ''));
  assert.ok(!V.coordAEcrire_(c, V.coordEmpreinte_(c)));
  const vide = V.coordChamps_('', {}, {});
  assert.ok(!V.coordAEcrire_(vide, ''));          // jamais rien à écrire la première fois
  assert.ok(V.coordAEcrire_(vide, 'B12||'));      // tout effacé : on efface dans BDDORGA
  assert.ok(!V.coordAEcrire_(vide, '-'));         // déjà reporté
});

test('BDDORGA : colonnes Chambre / Vis-à-vis créées, valeur remplacée si elle change, rien si identique', () => {
  const v = [['Service', 'E-Mail', ''], ['S1', 'a@x.dz', 'ALPHA Ali']];
  const p = Annuaire.planEcriture(v, 'a@x.dz', { chambre: 'B12', vis_travail: 'DUPONT Jean', vis_chambre: '' }, { coord: true });
  assert.deepStrictEqual(p.ecritures.map(e => [e.entete, e.valeur]), [['Chambre', 'B12'], ['Vis-à-vis travail', 'DUPONT Jean']]);
  const v2 = [['Service', 'E-Mail', '', 'Chambre', 'Vis-à-vis travail'], ['S1', 'a@x.dz', 'ALPHA Ali', 'A1', 'DUPONT Jean']];
  const p2 = Annuaire.planEcriture(v2, 'a@x.dz', { chambre: 'B12', vis_travail: 'DUPONT Jean' }, { coord: true });
  assert.deepStrictEqual(p2.ecritures, [{ col: 4, valeur: 'B12' }]);
  assert.deepStrictEqual(Annuaire.planEcriture(v2, 'a@x.dz', { chambre: 'B12' }, {}).ecritures, []);   // sans l'option : jamais
});

test('droits : prestataire ouvert au planning, à la simulation et à l\'organigramme ; l\'invité reste sans planning', () => {
  assert.ok(Droits.menu({ planning: 1, simulation: 1 }, [{ id: 'planning', actif: 1 }, { id: 'simulation', actif: 1 }],
    [{ module: 'planning', url: 'planning.html', titre: 'P' }, { module: 'simulation', url: 'simulation.html', titre: 'S' }, { module: 'simulation', url: 'organigramme.html', titre: 'O' }], 'prestataire')
    .every(m => m.apps.length >= 1));
  assert.ok(Droits.verifier('guest', 1, 'planning'));
  assert.strictEqual(Droits.verifier('prestataire', 1, 'planning'), '');
  assert.strictEqual(Droits.verifier('prestataire', 1, 'simulation'), '');
});
