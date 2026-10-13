// node --test apps-script/gateway/test/annuaire.test.js
// Données ENTIÈREMENT FICTIVES (noms, e-mails et numéros inventés) qui reproduisent la structure du fichier réel.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const Annuaire = require('../Annuaire.gs');

const NUM = '100000000000000001'; // faux numéro à 18 chiffres (le fichier réel en contient pour certaines personnes)

// ----- Disposition ACTUELLE de BDDORGA : e-mail | matricule | NOM (sans titre) | service | fonction | division | dépendance | NUMÉRO (sans titre) | SONA | FONCTION | wifi | pass | date | téléphone
const ENT = ['E-Mail', 'Matricule', '', 'Service', 'Fonction', 'Division', 'dependance', '', 'SONA', 'FONCTION', 'Wifi User', 'Pass', 'Date Integration', 'Numero telephone'];
const ligne = (email, mat, nom, service, dep, num, poste, tel = '') =>
  [email, mat, nom, service, 'Chef', 'Division Infrastructures', dep, num, 'login1', poste, 'wifi.user', 'MOT-DE-PASSE-SECRET', '', tel];
const SRC = [ENT,
  ligne('marie.durand@sonatrach.dz', 'M-100', 'DURAND MARIE', 'CPM', 'SONATRACH', NUM, 'Technicienne', 658578057),
  ligne('benoit.martin463@gmail.com', '', 'MARTIN BENOIT', 'CPM', 'GTP', '', 'Conducteur des travaux'),     // pas de numéro : le cas qui produisait « BENOITMARTIN »
  ligne('alice.bernard@gmail.com', '', 'BERNARD ALICE', 'Service Construction', 'ACOSCO', '', 'ING GENIE CIVIL'),
  ligne('', 'M-101', 'SANS MAIL', 'CPM', 'SONATRACH', NUM, 'X'),
  ligne('pas-un-mail', '', 'MAIL CASSE', 'CPM', 'SONATRACH', '', 'X'),
  [],
  ligne('ALICE.bernard@gmail.com', '', 'DOUBLON ALICE', 'CPM', 'ACOSCO', '', 'X')];

test('RÉGRESSION : la colonne des noms est celle qui contient des noms, jamais celle des numéros', () => {
  const c = Annuaire.colonnes(SRC);
  assert.strictEqual(c.idx.nom, 2, 'les noms sont en colonne C');
  assert.deepStrictEqual(c.idx.noms, [2], 'la colonne des numéros (H) n\'est pas candidate');
  assert.deepStrictEqual([c.idx.email, c.idx.matricule, c.idx.service, c.idx.dependance, c.idx.fonction, c.idx.telephone], [0, 1, 3, 6, 9, 13]);
});

test('RÉGRESSION : noms, employeurs et postes corrects ; BENOIT MARTIN (sans numéro) garde son vrai nom', () => {
  const r = Annuaire.lire(SRC);
  assert.deepStrictEqual(r.personnes.map(p => [p.nom, p.dependance, p.fonction]),
    [['DURAND MARIE', 'SONATRACH', 'Technicienne'], ['MARTIN BENOIT', 'GTP', 'Conducteur des travaux'], ['BERNARD ALICE', 'ACOSCO', 'ING GENIE CIVIL']]);
  assert.strictEqual(r.avertissements.length, 0, 'aucun nom déduit : tous les noms sont lus');
  assert.deepStrictEqual(r.ignores.map(i => [i.ligne, i.raison.split(' (')[0]]), [[5, 'e-mail manquant ou invalide'], [6, 'e-mail manquant ou invalide'], [8, 'e-mail en double']]);
  assert.strictEqual(r.personnes[0].telephone, '0658578057');
});

test('SÉCURITÉ : ni numéro d\'identité, ni mot de passe, ni identifiant n\'est recopié', () => {
  const j = JSON.stringify(Annuaire.lire(SRC));
  for (const secret of [NUM, 'MOT-DE-PASSE-SECRET', 'wifi.user', 'login1']) assert.ok(!j.includes(secret), secret);
  assert.deepStrictEqual(Object.keys(Annuaire.lire(SRC).personnes[0]).sort(), ['dependance', 'email', 'fonction', 'matricule', 'nom', 'nomDeduit', 'service', 'telephone']);
});

// ----- Ancienne disposition (nom puis numéro côte à côte après « dépendance ») : doit marcher aussi
const ENT_ANCIEN = ['Division', 'Service', 'Fonction', 'dependance', '', '', 'SONA', 'Matricule', 'E-Mail', 'FONCTION', 'Wifi User', 'Pass', 'Date Integration', 'Numero telephone'];
const ancien = (nom, num, email) => ['Division Infrastructures', 'CPM', 'Chef', 'GTP', nom, num, 'login1', 'M-1', email, 'Technicien', 'w', 'SECRET', '', ''];

test('ancienne disposition : nom puis numéro, ou numéro puis nom, ou nom seul', () => {
  const r = Annuaire.lire([ENT_ANCIEN, ancien('DURAND MARIE', NUM, 'marie.durand@x.dz'), ancien(NUM, 'MARTIN BENOIT', 'benoit.martin@x.dz'), ancien('BERNARD ALICE', '', 'alice.bernard@x.dz')]);
  assert.deepStrictEqual(r.personnes.map(p => p.nom), ['DURAND MARIE', 'MARTIN BENOIT', 'BERNARD ALICE']);
  assert.ok(!JSON.stringify(r).includes(NUM));
});

test('aucun nom exploitable : nom déduit de l\'e-mail, avec avertissement', () => {
  const r = Annuaire.lire([ENT, ligne('jean.dupont@x.dz', '', '', 'CPM', 'SONATRACH', NUM, 'X'), ligne('paul_morel@x.dz', '', NUM, 'CPM', 'SONATRACH', NUM, 'X'), ligne('b@x.dz', '', 'BERNARD ALICE', 'CPM', 'SONATRACH', '', 'X')]);
  const deduits = r.personnes.filter(p => p.nomDeduit);
  assert.deepStrictEqual(deduits.map(p => p.nom), ['JEAN DUPONT', 'PAUL MOREL']);
  assert.strictEqual(r.avertissements.length, 2);
  assert.ok(!JSON.stringify(r).includes(NUM));
});

test('nomAffichable : jamais de numéro, quelle que soit la forme', () => {
  const f = Annuaire.nomAffichable;
  assert.strictEqual(f('DURAND MARIE', 'a@x.dz'), 'DURAND MARIE');
  assert.strictEqual(f(NUM, 'marie.durand@x.dz'), 'MARIE DURAND');
  assert.strictEqual(f('1000 0000 0000 0000 01', 'marie_durand@x.dz'), 'MARIE DURAND');
  assert.strictEqual(f(100000000000000001, 'k.test@x.dz'), 'K TEST');
  assert.strictEqual(f('', 'sofia@x.dz'), 'SOFIA');
  assert.strictEqual(f(NUM, ''), '(nom à compléter)');
});

test('fusion : une valeur vide n\'efface rien ; role/actif/uid jamais touchés ; absents listés', () => {
  const existants = [
    { uid: 'u1', email: 'marie.durand@sonatrach.dz', nom: 'DURAND MARIE', service: 'Ancien service', matricule: 'M-100', role: 'chef_service', actif: 1, telephone: '' },
    { uid: 'u2', email: 'benoit.martin463@gmail.com', nom: 'MARTIN BENOIT', service: 'CPM', matricule: 'M-7', fonction: 'Conducteur des travaux', dependance: 'GTP', role: 'agent', actif: 1 },
    { uid: 'u3', email: 'parti@x.dz', nom: 'PARTI', role: 'agent', actif: 1 },
  ];
  const f = Annuaire.fusionner(existants, Annuaire.lire(SRC).personnes);
  assert.deepStrictEqual(f.maj.map(m => m.email), ['marie.durand@sonatrach.dz']);
  assert.deepStrictEqual(Object.keys(f.maj[0].champs).sort(), ['dependance', 'fonction', 'service', 'telephone']);
  for (const k of ['role', 'actif', 'uid']) assert.ok(!(k in f.maj[0].champs));
  assert.strictEqual(f.inchanges, 1, 'la matricule vide de la source n\'efface pas M-7');
  assert.deepStrictEqual(f.absents, ['parti@x.dz']);
  assert.deepStrictEqual(f.ajouts.map(p => p.email), ['alice.bernard@gmail.com']);
});

test('RÉPARATION : la synchro rétablit un vrai nom à la place d\'un numéro ou d\'un nom déduit de l\'e-mail', () => {
  const existants = [
    { uid: 'u1', email: 'marie.durand@sonatrach.dz', nom: NUM, service: 'CPM', matricule: 'M-100', dependance: 'SONATRACH', fonction: 'Technicienne', telephone: '0658578057', role: 'agent', actif: 1 },
    { uid: 'u2', email: 'benoit.martin463@gmail.com', nom: 'BENOITMARTIN', service: 'CPM', matricule: 'M-7', dependance: 'GTP', fonction: 'Conducteur des travaux', role: 'agent', actif: 1 },
  ];
  const f = Annuaire.fusionner(existants, Annuaire.lire(SRC).personnes);
  const noms = Object.fromEntries(f.maj.map(m => [m.email, m.champs.nom]));
  assert.strictEqual(noms['marie.durand@sonatrach.dz'], 'DURAND MARIE');
  assert.strictEqual(noms['benoit.martin463@gmail.com'], 'MARTIN BENOIT');
});

test('un nom DÉDUIT de l\'e-mail n\'écrase jamais un vrai nom déjà enregistré', () => {
  const src = Annuaire.lire([ENT, ligne('b@x.dz', '', 'BERNARD ALICE', 'CPM', 'SONATRACH', '', 'X'), ligne('marie.durand@x.dz', '', '', 'CPM', 'SONATRACH', NUM, 'X')]).personnes.slice(1);
  assert.strictEqual(src[0].nomDeduit, true);
  const f = Annuaire.fusionner([{ uid: 'u1', email: 'marie.durand@x.dz', nom: 'DURAND MARIE', service: 'CPM', fonction: 'X', dependance: 'SONATRACH', matricule: '', role: 'agent', actif: 1 }], src);
  assert.strictEqual(f.maj.length, 0);
  const g = Annuaire.fusionner([{ uid: 'u1', email: 'marie.durand@x.dz', nom: NUM, service: 'CPM', fonction: 'X', dependance: 'SONATRACH', role: 'agent', actif: 1 }], src);
  assert.strictEqual(g.maj[0].champs.nom, 'MARIE DURAND'); // mieux qu'un numéro
});

test('erreurs claires : en-têtes absents, colonne des noms introuvable ; en-tête « Nom » respecté', () => {
  assert.match(Annuaire.lire([['a', 'b'], ['1', '2']]).erreur, /En-têtes introuvables/);
  assert.match(Annuaire.lire([['Service', 'E-Mail'], ['S', 'x@y.dz']]).erreur, /noms introuvable/);
  assert.strictEqual(Annuaire.lire([['Service', 'Nom', 'E-Mail'], ['S', 'DURAND MARIE', 'x@y.dz']]).personnes[0].nom, 'DURAND MARIE');
});

test('la liste de connexion (publique) ne contient jamais de numéro, même si Utilisateurs en contient', () => {
  const ctx = { Store: { table: () => [{ uid: 'u1', email: 'marie.durand@sonatrach.dz', nom: NUM, service: 'S', actif: 1 }, { uid: 'u2', email: 'b@x.dz', nom: 'MARTIN BENOIT', service: 'S', actif: 1 }] }, CFG: {} };
  vm.createContext(ctx);
  for (const f of ['Annuaire.gs', 'Auth.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/if \(typeof module[^\n]*\n/g, ''), ctx);
  const liste = vm.runInContext('Auth.liste()', ctx);
  assert.deepStrictEqual(liste.map(u => u.nom), ['MARIE DURAND', 'MARTIN BENOIT']);
  assert.ok(!JSON.stringify(liste).includes(NUM));
});
