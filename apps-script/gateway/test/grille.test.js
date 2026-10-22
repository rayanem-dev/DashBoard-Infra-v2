// Grille « qui a accès à quoi » : plan des opérations (js/grille-acces.js).
const test = require('node:test');
const assert = require('node:assert');
const G = require('../../../js/grille-acces.js');

const etat = () => ({
  roles: [{ id: 'chef', libelle: 'Chef', niveau_max: 0, interdits: [] }, { id: 'agent', libelle: 'Agent', niveau_max: 0, interdits: [] },
    { id: 'guest', libelle: 'Invité', niveau_max: 1, interdits: ['rh'] }],
  droitsRole: [{ role: 'chef', module: 'logi', niveau: 3 }, { role: 'agent', module: 'logi', niveau: 1 }, { role: 'chef', module: 'rh', niveau: 3 }],
  applications: [
    { module: 'logi', titre: 'Stocks', niveau_min: 1, roles: [] },
    { module: 'logi', titre: 'Commande', niveau_min: 2, roles: [] },
    { module: 'logi', titre: 'Secret', niveau_min: 1, roles: ['chef'] },
    { module: 'rh', titre: 'Organigramme', niveau_min: 1, roles: [] }]
});

test('accès = niveau du module ≥ niveau minimal et rôle autorisé', () => {
  const e = etat();
  assert.ok(G.acces(e, 'agent', e.applications[0]));          // Stocks
  assert.ok(!G.acces(e, 'agent', e.applications[1]));         // Commande demande 2
  assert.ok(!G.acces(e, 'agent', e.applications[2]));         // Secret : réservée au chef
  assert.ok(G.acces(e, 'chef', e.applications[2]));
});
test('décocher une application ouverte à tous : elle est réservée aux autres rôles qui y avaient accès', () => {
  const p = G.plan(etat(), 'agent', 'Stocks', false);
  assert.deepStrictEqual(p.ops, [{ type: 'app', titre: 'Stocks', niveau_min: 1, roles: ['chef'] }]);
});
test('décocher avec liste de rôles : le rôle est retiré ; jamais de liste vide', () => {
  const e = etat(); e.applications[2].roles = ['chef', 'agent'];
  assert.deepStrictEqual(G.plan(e, 'agent', 'Secret', false).ops, [{ type: 'app', titre: 'Secret', niveau_min: 1, roles: ['chef'] }]);
  assert.ok(G.plan(etat(), 'chef', 'Secret', false).erreur);
});
test('cocher une application qui demande un niveau plus haut : le niveau du module monte, les autres applications du module gardent leur public', () => {
  const p = G.plan(etat(), 'agent', 'Commande', true);
  assert.deepStrictEqual(p.ops, [{ type: 'droit', role: 'agent', module: 'logi', niveau: 2 }]);   // Stocks était déjà accessible à l'agent, Secret limitée au chef : rien à protéger
  const e = etat(); e.applications.push({ module: 'logi', titre: 'Autre', niveau_min: 2, roles: [] });
  const q = G.plan(e, 'agent', 'Commande', true);
  assert.deepStrictEqual(q.ops[0], { type: 'app', titre: 'Autre', niveau_min: 2, roles: ['chef'] });  // « Autre » (niveau 2, ouverte à tous) n'aurait pas été visible à l'agent
  assert.deepStrictEqual(q.ops[1], { type: 'droit', role: 'agent', module: 'logi', niveau: 2 });
});
test('cocher une application limitée à certains rôles : le rôle est ajouté à la liste', () => {
  const p = G.plan(etat(), 'agent', 'Secret', true);
  assert.deepStrictEqual(p.ops, [{ type: 'app', titre: 'Secret', niveau_min: 1, roles: ['chef', 'agent'] }]);
});
test('refus : module interdit au rôle, niveau au-dessus du plafond', () => {
  assert.ok(G.plan(etat(), 'guest', 'Organigramme', true).erreur);
  const e = etat(); e.applications.push({ module: 'logi', titre: 'Admin', niveau_min: 3, roles: [] });
  assert.ok(G.plan(e, 'guest', 'Admin', true).erreur);
});
test('rien à faire si la case est déjà dans l\'état voulu', () => {
  assert.deepStrictEqual(G.plan(etat(), 'agent', 'Stocks', true).ops, []);
});
