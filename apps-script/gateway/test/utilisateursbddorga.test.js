// node --test apps-script/gateway/test/utilisateursbddorga.test.js — données fictives
const test = require('node:test'), assert = require('node:assert');
global.Annuaire = require('../Annuaire.gs');
const UBD = require('../UtilisateursBDDORGA.gs');
const ENT = ['E-Mail', 'Matricule', 'NOM ET PRENOM', 'Service', 'FONCTION', 'dependance', 'Numero telephone'];
const L = (e, m, n, s) => [e, m, n, s, 'Chef', 'SONATRACH', ''];
const uid = e => 'u-' + e;
const anciens = [
  { uid: 'old1', email: 'a@x.dz', nom: 'ANCIEN A', role: 'admin', actif: 1, email_contact: 'a@perso.com', service: 'X' },
  { uid: '', email: '', nom: 'FANTOME', role: 'x' },
  { uid: 'old9', email: 'seul@x.dz', nom: 'SEUL', role: 'admin', actif: 1 },
];

test('sans colonnes Rôle/Actif dans BDDORGA : rôle et actif viennent de l\'ancienne table, identité de BDDORGA', () => {
  const v = [ENT, L('a@x.dz', 'M1', 'DURAND ALICE', 'CPM'), L('b@x.dz', 'M2', 'MARTIN BOB', 'DSI')];
  const r = UBD.construire(Annuaire.lire(v), Annuaire.colonnes(v), anciens, uid);
  const a = r.find(u => u.email === 'a@x.dz'), b = r.find(u => u.email === 'b@x.dz');
  assert.strictEqual(a.uid, 'old1'); assert.strictEqual(a.nom, 'DURAND ALICE'); assert.strictEqual(a.service, 'CPM'); assert.strictEqual(a.role, 'admin'); assert.strictEqual(a.email_contact, 'a@perso.com');
  assert.strictEqual(b.uid, 'u-b@x.dz'); assert.strictEqual(b.role, ''); assert.strictEqual(b.actif, 1);
  assert.ok(!r.some(u => u.nom === 'FANTOME'), 'la ligne fantôme disparaît');
  const s = r.find(u => u.email === 'seul@x.dz'); assert.strictEqual(s.horsBDDORGA, 1); assert.strictEqual(s.role, 'admin');
});

test('avec colonnes Rôle/Actif : BDDORGA fait foi (vide = pas de rôle ; actif vide = actif)', () => {
  const v = [ENT.concat(['Rôle', 'Actif']), L('a@x.dz', 'M1', 'DURAND ALICE', 'CPM').concat(['', 0]), L('b@x.dz', 'M2', 'MARTIN BOB', 'DSI').concat(['chef', ''])];
  const r = UBD.construire(Annuaire.lire(v), Annuaire.colonnes(v), anciens, uid);
  assert.strictEqual(r.find(u => u.email === 'a@x.dz').role, ''); assert.strictEqual(r.find(u => u.email === 'a@x.dz').actif, 0);
  assert.strictEqual(r.find(u => u.email === 'b@x.dz').role, 'chef'); assert.strictEqual(r.find(u => u.email === 'b@x.dz').actif, 1);
});

test('écriture : colonnes créées à droite, colonne existante réutilisée, NIN refusé par défaut', () => {
  const v = [ENT, L('a@x.dz', 'M1', 'DURAND ALICE', 'CPM')];
  let p = UBD.planEcriture(v, 'A@x.dz', { role: 'admin', actif: 0, nin: '1', service: 'DSI', uid: 'z' }, {});
  assert.strictEqual(p.ligne, 2);
  assert.deepStrictEqual(p.ecritures.map(e => [e.col, e.valeur, e.entete || '']), [[8, 'admin', 'Rôle'], [9, 0, 'Actif'], [4, 'DSI', '']]);
  assert.deepStrictEqual(p.reste, { nin: '1', uid: 'z' });
  const v2 = [ENT.concat(['Rôle']), L('a@x.dz', 'M1', 'X Y Z', 'CPM').concat([''])];
  p = UBD.planEcriture(v2, 'a@x.dz', { role: 'chef' }, {});
  assert.deepStrictEqual(p.ecritures.map(e => [e.col, e.entete || '']), [[8, '']]);
  assert.ok(UBD.planEcriture(v, 'inconnu@x.dz', { role: 'a' }, {}).erreur);
});
