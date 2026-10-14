// node --test apps-script/gateway/test/annuaire.test.js
// Données ENTIÈREMENT FICTIVES (noms, e-mails et numéros inventés) qui reproduisent la structure du fichier réel.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const Annuaire = require('../Annuaire.gs');

const NUM = '100000000000000001'; // faux numéro à 18 chiffres (le fichier réel en contient pour certaines personnes)

// ----- Disposition ACTUELLE de BDDORGA : e-mail | matricule | NOM (sans titre) | service | fonction | division | dépendance | NUMÉRO (sans titre) | SONA | FONCTION | wifi | pass | date | téléphone
const ENT = ['E-Mail', 'Matricule', '', 'Service', 'Fonction', 'Division', 'dependance', '', 'SONA', 'FONCTION', 'Wifi User', 'Pass', 'Date Integration', 'Numero telephone'];
const ligne = (email, mat, nom, service, dep, num, poste, tel = '', sona = 'sona10001', integ = '') =>
  [email, mat, nom, service, 'Chef', 'Division Infrastructures', dep, num, sona, poste, 'wifi.user', 'MOT-DE-PASSE-SECRET', integ, tel];
const SRC = [ENT,
  ligne('marie.durand@sonatrach.dz', 'M-100', 'DURAND MARIE', 'CPM', 'SONATRACH', NUM, 'Technicienne', 658578057, 'sona10001', '05/10/2025'),
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

test('fiche : identifiant SONA et date d\'intégration lus ; les colonnes secrètes jamais', () => {
  const p = Annuaire.lire(SRC).personnes[0];
  assert.strictEqual(p.sona, 'sona10001'); assert.strictEqual(p.date_integration, '2025-10-05');
  assert.strictEqual(Annuaire.lire(SRC).personnes[1].date_integration, ''); // vide : reste vide
});

test('dateIso : formats courants, dates impossibles refusées', () => {
  const d = Annuaire.dateIso;
  assert.strictEqual(d('05/10/2025'), '2025-10-05'); assert.strictEqual(d('5.3.2024'), '2024-03-05'); assert.strictEqual(d('2025-10-05'), '2025-10-05');
  assert.strictEqual(d(new Date(2025, 9, 5)), '2025-10-05'); assert.strictEqual(d('31/02/2025'), ''); assert.strictEqual(d('n\'importe quoi'), ''); assert.strictEqual(d(''), ''); assert.strictEqual(d(null), '');
});

test('SÉCURITÉ : aucun mot de passe n\'est recopié ; le NIN (18 chiffres) est lu mais jamais pris pour un nom', () => {
  const j = JSON.stringify(Annuaire.lire(SRC));
  for (const secret of ['MOT-DE-PASSE-SECRET']) assert.ok(!j.includes(secret), secret);
  assert.strictEqual(Annuaire.lire(SRC).personnes[0].nin, NUM);
  assert.strictEqual(Annuaire.lire(SRC).personnes[0].nom, 'DURAND MARIE');
  assert.deepStrictEqual(Object.keys(Annuaire.lire(SRC).personnes[0]).sort(), ['date_integration', 'dependance', 'email', 'fonction', 'matricule', 'nin', 'nom', 'nomDeduit', 'sap', 'service', 'sona', 'telephone', 'wifi_user']);
});

// ----- Ancienne disposition (nom puis numéro côte à côte après « dépendance ») : doit marcher aussi
const ENT_ANCIEN = ['Division', 'Service', 'Fonction', 'dependance', '', '', 'SONA', 'Matricule', 'E-Mail', 'FONCTION', 'Wifi User', 'Pass', 'Date Integration', 'Numero telephone'];
const ancien = (nom, num, email) => ['Division Infrastructures', 'CPM', 'Chef', 'GTP', nom, num, 'login1', 'M-1', email, 'Technicien', 'w', 'SECRET', '', ''];

test('ancienne disposition : nom puis numéro, ou numéro puis nom, ou nom seul', () => {
  const r = Annuaire.lire([ENT_ANCIEN, ancien('DURAND MARIE', NUM, 'marie.durand@x.dz'), ancien(NUM, 'MARTIN BENOIT', 'benoit.martin@x.dz'), ancien('BERNARD ALICE', '', 'alice.bernard@x.dz')]);
  assert.deepStrictEqual(r.personnes.map(p => p.nom), ['DURAND MARIE', 'MARTIN BENOIT', 'BERNARD ALICE']);
  assert.ok(r.personnes.every(p => !p.nom.includes(NUM)), 'un numéro n\'est jamais un nom');
});

test('aucun nom exploitable : nom déduit de l\'e-mail, avec avertissement', () => {
  const r = Annuaire.lire([ENT, ligne('jean.dupont@x.dz', '', '', 'CPM', 'SONATRACH', NUM, 'X'), ligne('paul_morel@x.dz', '', NUM, 'CPM', 'SONATRACH', NUM, 'X'), ligne('b@x.dz', '', 'BERNARD ALICE', 'CPM', 'SONATRACH', '', 'X')]);
  const deduits = r.personnes.filter(p => p.nomDeduit);
  assert.deepStrictEqual(deduits.map(p => p.nom), ['JEAN DUPONT', 'PAUL MOREL']);
  assert.strictEqual(r.avertissements.length, 2);
  assert.ok(r.personnes.every(p => !p.nom.includes(NUM)), 'un numéro n\'est jamais un nom');
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
    { uid: 'u1', email: 'marie.durand@sonatrach.dz', nom: 'DURAND MARIE', service: 'Ancien service', matricule: 'M-100', role: 'chef_service', actif: 1, telephone: '', sona: 'sona10001', wifi_user: 'wifi.user', nin: NUM, date_integration: '2025-10-05' },
    { uid: 'u2', email: 'benoit.martin463@gmail.com', nom: 'MARTIN BENOIT', service: 'CPM', matricule: 'M-7', fonction: 'Conducteur des travaux', dependance: 'GTP', sona: 'sona10001', wifi_user: 'wifi.user', role: 'agent', actif: 1 },
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
    { uid: 'u1', email: 'marie.durand@sonatrach.dz', nom: NUM, service: 'CPM', matricule: 'M-100', dependance: 'SONATRACH', fonction: 'Technicienne', telephone: '0658578057', sona: 'sona10001', wifi_user: 'wifi.user', nin: NUM, date_integration: '2025-10-05', role: 'agent', actif: 1 },
    { uid: 'u2', email: 'benoit.martin463@gmail.com', nom: 'BENOITMARTIN', service: 'CPM', matricule: 'M-7', dependance: 'GTP', fonction: 'Conducteur des travaux', sona: 'sona10001', wifi_user: 'wifi.user', role: 'agent', actif: 1 },
  ];
  const f = Annuaire.fusionner(existants, Annuaire.lire(SRC).personnes);
  const noms = Object.fromEntries(f.maj.map(m => [m.email, m.champs.nom]));
  assert.strictEqual(noms['marie.durand@sonatrach.dz'], 'DURAND MARIE');
  assert.strictEqual(noms['benoit.martin463@gmail.com'], 'MARTIN BENOIT');
});

test('un nom DÉDUIT de l\'e-mail n\'écrase jamais un vrai nom déjà enregistré', () => {
  const src = Annuaire.lire([ENT, ligne('b@x.dz', '', 'BERNARD ALICE', 'CPM', 'SONATRACH', '', 'X'), ligne('marie.durand@x.dz', '', '', 'CPM', 'SONATRACH', NUM, 'X')]).personnes.slice(1);
  assert.strictEqual(src[0].nomDeduit, true);
  const f = Annuaire.fusionner([{ uid: 'u1', email: 'marie.durand@x.dz', nom: 'DURAND MARIE', service: 'CPM', fonction: 'X', dependance: 'SONATRACH', matricule: '', sona: 'sona10001', wifi_user: 'wifi.user', nin: NUM, role: 'agent', actif: 1 }], src);
  assert.strictEqual(f.maj.length, 0);
  const g = Annuaire.fusionner([{ uid: 'u1', email: 'marie.durand@x.dz', nom: NUM, service: 'CPM', fonction: 'X', dependance: 'SONATRACH', sona: 'sona10001', wifi_user: 'wifi.user', nin: NUM, role: 'agent', actif: 1 }], src);
  assert.strictEqual(g.maj[0].champs.nom, 'MARIE DURAND'); // mieux qu'un numéro
});

test('erreurs claires : en-têtes absents, colonne des noms introuvable ; en-tête « Nom » respecté', () => {
  assert.match(Annuaire.lire([['a', 'b'], ['1', '2']]).erreur, /En-têtes introuvables/);
  assert.match(Annuaire.lire([['Service', 'E-Mail'], ['S', 'x@y.dz']]).erreur, /noms introuvable/);
  assert.strictEqual(Annuaire.lire([['Service', 'Nom', 'E-Mail'], ['S', 'DURAND MARIE', 'x@y.dz']]).personnes[0].nom, 'DURAND MARIE');
});

function ctxListe(utilisateurs) {
  const ctx = { Store: { table: () => utilisateurs }, CFG: {} };
  vm.createContext(ctx);
  for (const f of ['Annuaire.gs', 'Auth.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/if \(typeof module[^\n]*\n/g, ''), ctx);
  return q => { ctx.q = q; return JSON.parse(JSON.stringify(vm.runInContext('Auth.liste(q)', ctx))); };
}
const U = (i, nom, extra = {}) => Object.assign({ uid: 'u' + i, email: `p${i}@x.dz`, nom, service: 'S', actif: 1 }, extra);

test('LA LISTE N\'EST JAMAIS RENVOYÉE EN ENTIER : rien sans recherche, rien en dessous de 3 lettres', () => {
  const liste = ctxListe([U(1, 'DURAND MARIE'), U(2, 'MARTIN BENOIT')]);
  for (const q of [undefined, '', '  ', 'a', 'du', 'd u']) assert.deepStrictEqual(liste(q).utilisateurs, [], JSON.stringify(q));
  assert.strictEqual(liste('du').court, true);
});

test('recherche : accents et majuscules ignorés, tous les mots doivent correspondre, prénom ou nom', () => {
  const liste = ctxListe([U(1, 'DURAND MARIE'), U(2, 'MARTIN BENOIT'), U(3, 'DJELLOUL BOUCHIKHI'), U(4, 'BOUAZIZ HOCINE'), U(5, 'GARCÍA ÉLODIE')]);
  assert.deepStrictEqual(liste('bou').utilisateurs.map(u => u.nom), ['BOUAZIZ HOCINE', 'DJELLOUL BOUCHIKHI']);
  assert.deepStrictEqual(liste('hocine bouaziz').utilisateurs.map(u => u.nom), ['BOUAZIZ HOCINE']);
  assert.deepStrictEqual(liste('garcia elodie').utilisateurs.map(u => u.nom), ['GARCÍA ÉLODIE']);
  assert.deepStrictEqual(liste('zzz').utilisateurs, []);
});

test('au plus 8 résultats, avec l\'indication qu\'il y en a davantage ; comptes désactivés et sans uid exclus', () => {
  const beaucoup = Array.from({ length: 12 }, (_, i) => U(i, 'MARTIN ' + String.fromCharCode(65 + i) + 'ALICE'));
  beaucoup.push(U(99, 'MARTIN ZOMBIE', { actif: 0 }), U(98, 'MARTIN SANSUID', { uid: '' }));
  const r = ctxListe(beaucoup)('martin');
  assert.strictEqual(r.utilisateurs.length, 8); assert.strictEqual(r.plus, true);
  assert.ok(!JSON.stringify(r).includes('ZOMBIE') && !JSON.stringify(r).includes('SANSUID'));
});

test('la recherche ne renvoie jamais d\'e-mail, de matricule ni de numéro, même si Utilisateurs en contient', () => {
  const liste = ctxListe([U(1, NUM, { email: 'marie.durand@sonatrach.dz', matricule: 'M-100' }), U(2, 'MARTIN BENOIT', { matricule: 'M-7' })]);
  const r = liste('marie');
  assert.deepStrictEqual(r.utilisateurs.map(u => u.nom), ['MARIE DURAND']);
  const j = JSON.stringify(liste('mar'));
  for (const interdit of [NUM, 'M-100', 'M-7', '@', 'sonatrach']) assert.ok(!j.includes(interdit), interdit);
  assert.deepStrictEqual(Object.keys(r.utilisateurs[0]).sort(), ['nom', 'service', 'uid']);
});

test('écriture dans BDDORGA : sans écraser, colonne SAP créée, NIN seulement si autorisé', () => {
  const src = JSON.parse(JSON.stringify(SRC));
  const p = Annuaire.planEcriture(src, 'BENOIT.MARTIN463@gmail.com', { matricule: 'M-77', sap: '0012', nin: '123456789012345678' });
  assert.strictEqual(p.ligne, 3);
  assert.strictEqual(p.ecritures.find(e => e.valeur === 'M-77').col, 2);
  const s = p.ecritures.find(e => e.valeur === '0012');
  assert.strictEqual(s.entete, 'Matricule SAP'); assert.strictEqual(s.col, ENT.length + 1); assert.strictEqual(s.ligneEntete, 1);
  assert.ok(!JSON.stringify(p).includes('123456789012345678'), 'sans autorisation, le NIN n\'est pas écrit');
  const avec = Annuaire.planEcriture(src, 'benoit.martin463@gmail.com', { nin: '123456789012345678' }, { nin: true });
  assert.strictEqual(avec.ecritures.length, 1); assert.strictEqual(avec.ecritures[0].col, 8); // colonne sans titre des numéros de 18 chiffres
  assert.strictEqual(Annuaire.nin(123456789012345678), '', 'un nombre perd ses chiffres : refusé');
  assert.strictEqual(Annuaire.planEcriture(src, 'marie.durand@sonatrach.dz', { matricule: 'AUTRE' }).ecritures.length, 0, 'matricule déjà dans le fichier : intact');
  assert.match(Annuaire.planEcriture(src, 'inconnu@x.dz', { matricule: 'X' }).erreur, /absente/);
});

test('affectation : la cellule Service de la bonne ligne, rien d\'autre', () => {
  const p = Annuaire.planAffectation(SRC, 'BENOIT.MARTIN463@gmail.com', '  Service   Construction ');
  assert.strictEqual(p.ligne, 3); assert.strictEqual(p.col, 4); assert.strictEqual(p.ancien, 'CPM'); // colonne « Service » = 4e
  assert.match(Annuaire.planAffectation(SRC, 'inconnu@x.dz', 'CPM').erreur, /absente/);
  assert.match(Annuaire.planAffectation(SRC, 'benoit.martin463@gmail.com', '  ').erreur, /vide/);
});
