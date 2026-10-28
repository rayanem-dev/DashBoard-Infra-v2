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

test('rôle écrit autrement : « secretaire », « Secrétariat », « Chef de division » sont reconnus', () => {
  assert.strictEqual(Droits.roleCanon('secretaire'), 'secretariat');
  assert.strictEqual(Droits.roleCanon(' Secrétariat '), 'secretariat');
  assert.strictEqual(Droits.roleCanon('Chef de Division'), 'chef_division');
  assert.strictEqual(Droits.roleCanon('chef_service'), 'chef_service');
  assert.strictEqual(Droits.roleCanon('inconnu'), 'inconnu');
  const dr = [{ role: 'secretariat', module: 'securite', niveau: 3 }];
  assert.deepStrictEqual(Droits.resolve({ email: 'a@x.dz', role: 'secretaire' }, dr, []), { securite: 3 });
});

test('rôles issus de la base : variantes reconnues', () => {
  ['Cadre_Sup', 'Interim_chef_service', 'chef_atelier', 'dessinateur', 'ordonateur', 'Chef de Division'].forEach(r =>
    assert.ok(Droits.ROLES.includes(Droits.roleCanon(r)), r));
  assert.strictEqual(Droits.roleCanon('Cadre_Sup'), 'cadre_sup');
  assert.strictEqual(Droits.roleCanon('Interim_chef_service'), 'interim_chef_service');
  assert.strictEqual(Droits.roleCanon('ordonateur'), 'ordonnateur');
});

test('guest : lecture seule, jamais plus, même avec un droit ou une exception de niveau 3', () => {
  const dr = [{ role: 'guest', module: 'pilotage', niveau: 3 }, { role: 'guest', module: 'cpm', niveau: 2 }];
  const a = Droits.resolve({ email: 'g@x.dz', role: 'Guest' }, dr, [{ email: 'g@x.dz', module: 'logistique', niveau: 3 }]);
  assert.deepStrictEqual(a, { pilotage: 1, cpm: 1, logistique: 1 });
});

test('guest et prestataire : modules sensibles toujours fermés', () => {
  const dr = ['securite', 'rh', 'admin', 'planning', 'badges', 'cpm'].map(m => ({ role: 'guest', module: m, niveau: 1 }));
  assert.deepStrictEqual(Droits.resolve({ email: 'g@x.dz', role: 'guest' }, dr, [{ email: 'g@x.dz', module: 'securite', niveau: 3 }]), { cpm: 1 });
  const p = Droits.resolve({ email: 'p@x.dz', role: 'prestataire' }, [
    { role: 'prestataire', module: 'securite', niveau: 3 }, { role: 'prestataire', module: 'badges', niveau: 3 }, { role: 'prestataire', module: 'rapports', niveau: 2 }], []);
  assert.deepStrictEqual(p, { badges: 2, rapports: 2 });
});

test('verifier : rôle, niveau, plafond et module interdit', () => {
  assert.strictEqual(Droits.verifier('prestataire', 2, 'rapports'), '');
  assert.match(Droits.verifier('prestataire', 3, 'rapports'), /Niveau maximum/);
  assert.match(Droits.verifier('guest', 1, 'securite'), /ne peut pas accéder/);
  assert.strictEqual(Droits.verifier('guest', 0, 'securite'), '');
  assert.strictEqual(Droits.verifier('Interim_chef_service', 2, 'cpm'), '');
});

test('menu : application limitée à certains rôles', () => {
  const cat = [{ id: 'logistique', titre: 'L', icone: 'l', ordre: 1, actif: 1 }];
  const apps = [
    { module: 'logistique', titre: 'Pour tous', url: 'a', niveau_min: 1, roles: '' },
    { module: 'logistique', titre: 'Prestataires', url: 'b', niveau_min: 1, roles: 'prestataire, secretaire' },
    { module: 'logistique', titre: 'Chefs', url: 'c', niveau_min: 1, roles: 'chef_service;chef_division' },
  ];
  const titres = r => Droits.menu({ logistique: 1 }, cat, apps, r)[0].apps.map(x => x.titre);
  assert.deepStrictEqual(titres('prestataire'), [], 'un prestataire ne voit que les applications qui limitent ses données (badges.html)');
  assert.deepStrictEqual(Droits.menu({ logistique: 1 }, cat, [{ module: 'logistique', titre: 'Badges', url: 'badges.html', niveau_min: 1, roles: '' }, apps[0]], 'prestataire')[0].apps.map(x => x.titre), ['Badges']);
  assert.deepStrictEqual(titres('secretariat'), ['Pour tous', 'Prestataires']);
  assert.deepStrictEqual(titres('Chef_Service'), ['Pour tous', 'Chefs']);
  assert.deepStrictEqual(titres('guest'), ['Pour tous']);
});

test('rôles modifiables : un rôle créé par l\'administrateur fonctionne, avec plafond et modules interdits', () => {
  Droits.configurer([
    { id: 'secretariat', niveau_max: 0, interdits: [] },
    { id: 'Stagiaire', niveau_max: 1, interdits: ['securite', 'RH'] },
  ]);
  try {
    assert.deepStrictEqual(Droits.ROLES, ['secretariat', 'stagiaire']);
    assert.strictEqual(Droits.roleCanon('Chef Projet'), 'chef_projet');
    const dr = [{ role: 'stagiaire', module: 'pilotage', niveau: 3 }, { role: 'stagiaire', module: 'rh', niveau: 1 }, { role: 'secretariat', module: 'securite', niveau: 3 }];
    assert.deepStrictEqual(Droits.resolve({ email: 's@x.dz', role: 'stagiaire' }, dr, []), { pilotage: 1 });
    assert.deepStrictEqual(Droits.resolve({ email: 'a@x.dz', role: 'secretariat' }, dr, []), { securite: 3 });
    assert.strictEqual(Droits.verifier('stagiaire', 2, 'pilotage'), 'Niveau maximum pour ce rôle : 1');
    assert.strictEqual(Droits.verifier('guest', 1, 'cpm'), 'Rôle inconnu'); // supprimé de la liste
  } finally { Droits.configurer([]); }
  assert.strictEqual(Droits.ROLES.length, 15); // retour aux rôles d'origine
});

test('validerRole : création, doublon, niveau, module inconnu', () => {
  const ex = ['agent', 'cpm'], mods = ['cpm', 'rh', 'securite'];
  assert.strictEqual(Droits.validerRole({ libelle: 'Stagiaire', niveau_max: 1, interdits: ['rh'] }, ex, mods, true), '');
  assert.match(Droits.validerRole({ libelle: 'Agent' }, ex, mods, true), /existe déjà/);
  assert.strictEqual(Droits.validerRole({ id: 'agent', libelle: 'Agent', niveau_max: 0 }, ex, mods, false), '');
  assert.match(Droits.validerRole({ libelle: '' , id: 'xx' }, ex, mods, true), /nom au rôle/);
  assert.match(Droits.validerRole({ libelle: 'Z', id: 'a' }, ex, mods, true), /Identifiant invalide/);
  assert.match(Droits.validerRole({ libelle: 'Test', niveau_max: 5 }, ex, mods, true), /Niveau maximum/);
  assert.match(Droits.validerRole({ libelle: 'Test', interdits: ['nimporte'] }, ex, mods, true), /Module inconnu/);
});

test('rolesParDefaut reste celui d\'origine même après une configuration personnalisée', () => {
  Droits.configurer([{ id: 'secretariat' }, { id: 'stagiaire', niveau_max: 1 }]);
  try { assert.strictEqual(Droits.rolesParDefaut().length, 15); assert.strictEqual(Droits.rolesParDefaut().find(r => r.id === 'guest').niveau_max, 1); }
  finally { Droits.configurer([]); }
});

test('menu : une carte masquée (actif = 0) n\'apparaît pour personne', () => {
  const cat = [{ id: 'pilotage', titre: 'P', icone: 'p', ordre: 1, actif: 1 }];
  const apps = [{ module: 'pilotage', titre: 'A', url: 'a.html', niveau_min: 1 }, { module: 'pilotage', titre: 'B', url: 'b.html', niveau_min: 1, actif: 0 }, { module: 'pilotage', titre: 'C', url: 'c.html', niveau_min: 1, actif: 1 }];
  assert.deepStrictEqual(Droits.menu({ pilotage: 3 }, cat, apps, 'agent')[0].apps.map(a => a.titre), ['A', 'C']);
});

test('niveau de vision : une carte n\'est vue que par le rôle-seuil et les rôles au-dessus (rang ≤), en plus des droits du module', () => {
  const cat = [{ id: 'pilotage', titre: 'P', icone: 'p', ordre: 1, actif: 1 }];
  const apps = [{ module: 'pilotage', titre: 'Tous', url: 't.html', niveau_min: 1 }, { module: 'pilotage', titre: 'Chef service', url: 'cs.html', niveau_min: 1, vision: 'interim_chef_service' },
    { module: 'pilotage', titre: 'Conducteur', url: 'c.html', niveau_min: 1, vision: 'conducteur' }, { module: 'pilotage', titre: 'Agent', url: 'a.html', niveau_min: 1, vision: 'agent' }, { module: 'pilotage', titre: 'Ancien 7', url: 'o.html', niveau_min: 1, vision: '7' }];
  const vus = (role) => Droits.menu({ pilotage: 3 }, cat, apps, role)[0].apps.map(a => a.titre);
  assert.deepStrictEqual(vus('secretariat'), ['Tous', 'Chef service', 'Conducteur', 'Agent', 'Ancien 7']);
  assert.deepStrictEqual(vus('chef_service'), ['Tous', 'Chef service', 'Conducteur', 'Agent', 'Ancien 7']);
  assert.deepStrictEqual(vus('cpm'), ['Tous', 'Conducteur', 'Agent', 'Ancien 7']);   // rang 5 : au-dessus des conducteurs, sous les chefs de service
  assert.deepStrictEqual(vus('conducteur'), ['Tous', 'Conducteur', 'Agent', 'Ancien 7']);
  assert.deepStrictEqual(vus('agent'), ['Tous', 'Agent', 'Ancien 7']);
  assert.deepStrictEqual(vus('dsp'), ['Tous']);
  assert.deepStrictEqual(vus('stagiaire'), ['Tous']);
  assert.strictEqual(Droits.visionDe(''), null); assert.strictEqual(Droits.visionDe('12'), null); assert.strictEqual(Droits.visionDe(3), 'interim_chef_service'); assert.strictEqual(Droits.visionDe('chef_atelier'), 'chef_atelier');
  const ordre = Object.keys(Droits.RANGS).sort((a, b) => Droits.RANGS[a] - Droits.RANGS[b]);
  assert.deepStrictEqual(ordre.slice(0, 8), ['secretariat', 'chef_division', 'cadre_sup', 'chef_service', 'interim_chef_service', 'cpm', 'ordonnateur', 'chef_atelier']);
});
