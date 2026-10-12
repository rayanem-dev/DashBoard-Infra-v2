// node --test apps-script/gateway/test/droits.test.js
const test = require('node:test');
const assert = require('node:assert');
const Droits = require('../Droits.gs');

const droitsRole = [
  { role: 'conducteur', module: 'rapports', niveau: 2 },
  { role: 'conducteur', module: 'pilotage', niveau: 1 },
  { role: 'chef_division', module: 'cpm', niveau: 3 },
];

test('le rôle donne ses modules', () => {
  const a = Droits.resolve({ email: 'a@x.dz', role: 'conducteur' }, droitsRole, []);
  assert.deepStrictEqual(a, { rapports: 2, pilotage: 1 });
});

test('rôle inconnu : aucun accès', () => {
  assert.deepStrictEqual(Droits.resolve({ email: 'a@x.dz', role: 'inconnu' }, droitsRole, []), {});
});

test('exception : ajout et relèvement de niveau', () => {
  const a = Droits.resolve({ email: 'a@x.dz', role: 'conducteur' }, droitsRole, [
    { email: 'A@x.dz', module: 'cpm', niveau: 1 }, { email: 'a@x.dz', module: 'pilotage', niveau: 3 }]);
  assert.deepStrictEqual(a, { rapports: 2, pilotage: 3, cpm: 1 });
});

test('exception niveau 0 : retrait explicite, prioritaire', () => {
  const a = Droits.resolve({ email: 'a@x.dz', role: 'conducteur' }, droitsRole, [
    { email: 'a@x.dz', module: 'rapports', niveau: 0 }, { email: 'a@x.dz', module: 'rapports', niveau: 3 }]);
  assert.deepStrictEqual(a, { pilotage: 1 });
});

test('les exceptions des autres utilisateurs sont ignorées', () => {
  const a = Droits.resolve({ email: 'a@x.dz', role: 'conducteur' }, droitsRole, [{ email: 'b@x.dz', module: 'cpm', niveau: 3 }]);
  assert.ok(!('cpm' in a));
});

test('menu : modules accessibles, actifs, triés', () => {
  const cat = [
    { id: 'rapports', titre: 'R', icone: 'r', ordre: 7, actif: 1 },
    { id: 'pilotage', titre: 'P', icone: 'p', ordre: 1, actif: 1 },
    { id: 'cpm', titre: 'C', icone: 'c', ordre: 2, actif: 1 },
    { id: 'logistique', titre: 'L', icone: 'l', ordre: 3, actif: 0 },
  ];
  const m = Droits.menu({ rapports: 2, pilotage: 1, logistique: 1 }, cat);
  assert.deepStrictEqual(m.map(x => x.id), ['pilotage', 'rapports']);
});

test('menu : applications filtrées par module et niveau minimal', () => {
  const cat = [{ id: 'cpm', titre: 'C', icone: 'c', ordre: 1, actif: 1 }, { id: 'rh', titre: 'R', icone: 'r', ordre: 2, actif: 1 }];
  const apps = [
    { module: 'cpm', titre: 'Lecture', description: '', emoji: '', url: 'u1', niveau_min: 1 },
    { module: 'cpm', titre: 'Admin', description: '', emoji: '', url: 'u2', niveau_min: 3 },
    { module: 'rh', titre: 'RH', description: '', emoji: '', url: 'u3', niveau_min: 1 },
  ];
  const m = Droits.menu({ cpm: 2 }, cat, apps);
  assert.strictEqual(m.length, 1);
  assert.deepStrictEqual(m[0].apps.map(a => a.titre), ['Lecture']);
});

test('verifier : rôle et niveau', () => {
  assert.strictEqual(Droits.verifier('conducteur', 2), '');
  assert.strictEqual(Droits.verifier('roi'), 'Rôle inconnu');
  assert.strictEqual(Droits.verifier(undefined, 4), 'Niveau invalide (0 à 3)');
  assert.strictEqual(Droits.verifier(undefined, 1.5), 'Niveau invalide (0 à 3)');
  assert.strictEqual(Droits.verifier(undefined, NaN), 'Niveau invalide (0 à 3)');
});
