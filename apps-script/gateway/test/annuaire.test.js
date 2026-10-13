// node --test apps-script/gateway/test/annuaire.test.js
const test = require('node:test');
const assert = require('node:assert');
const Annuaire = require('../Annuaire.gs');

// Reproduit la structure réelle de BDDORGA (colonnes E et F sans en-tête ; colonnes sensibles présentes mais à ne jamais lire).
const ENT = ['Division', 'Service', 'Fonction', 'dependance', '', '', 'SONA', 'Matricule', 'E-Mail', 'FONCTION', 'Wifi User', 'Pass', 'Date Integration', 'Numero telephone'];
const ligne = (nom, email, o = {}) => ['Division Infrastructures', o.service ?? 'Service Construction', 'Chef Service', o.dep ?? 'SONATRACH', nom, '109870765009750005', 'sona1', o.mat ?? '36466H', email, o.poste ?? 'Technicien', 'wifi.user', 'MOT-DE-PASSE-SECRET', '', o.tel ?? ''];
const SRC = [ENT, ligne('LAKKAICHI NOUREDDINE', 'Noureddine.LAKKAICHI@Sonatrach.dz', { tel: 658578057 }), ligne('AZEGGAGH LOCIF', 'locif.aze@gmail.com', { dep: 'ACOSCO', mat: '' }), ligne('SANS MAIL', ''), ligne('MAIL CASSE', 'pas-un-mail'), [], ligne('DOUBLON', 'LOCIF.aze@gmail.com')];

test('colonnes repérées par leurs en-têtes, nom dans la colonne sans titre', () => {
  const c = Annuaire.colonnes(SRC);
  assert.deepStrictEqual(c.idx, { nom: 4, email: 8, matricule: 7, service: 1, fonction: 9, dependance: 3, telephone: 13 });
});

test('lecture : personnes valides, lignes écartées avec la raison', () => {
  const r = Annuaire.lire(SRC);
  assert.deepStrictEqual(r.personnes.map(p => p.email), ['noureddine.lakkaichi@sonatrach.dz', 'locif.aze@gmail.com']);
  assert.deepStrictEqual(r.ignores.map(i => [i.ligne, i.raison.split(' (')[0]]), [[4, 'e-mail manquant ou invalide'], [5, 'e-mail manquant ou invalide'], [7, 'e-mail en double']]);
  assert.strictEqual(r.personnes[0].telephone, '0658578057'); // zéro initial rétabli
  assert.strictEqual(r.personnes[0].fonction, 'Technicien'); assert.strictEqual(r.personnes[1].dependance, 'ACOSCO');
});

test('SÉCURITÉ : aucune colonne sensible (mot de passe, wifi, identifiants) n\'est recopiée', () => {
  const r = Annuaire.lire(SRC);
  const json = JSON.stringify(r);
  assert.ok(!json.includes('MOT-DE-PASSE-SECRET')); assert.ok(!json.includes('wifi.user')); assert.ok(!json.includes('109870765009750005')); assert.ok(!json.includes('sona1'));
  assert.deepStrictEqual(Object.keys(r.personnes[0]).sort(), ['dependance', 'email', 'fonction', 'matricule', 'nom', 'service', 'telephone']);
});

test('fusion : ajouts, mises à jour, absents ; une valeur vide n\'efface rien ; role/actif/uid jamais touchés', () => {
  const existants = [
    { uid: 'u1', email: 'noureddine.lakkaichi@sonatrach.dz', nom: 'LAKKAICHI NOUREDDINE', service: 'Ancien service', matricule: '36466H', role: 'chef_service', actif: 1, telephone: '' },
    { uid: 'u2', email: 'locif.aze@gmail.com', nom: 'AZEGGAGH LOCIF', service: 'Service Construction', matricule: 'M-123', fonction: 'Technicien', dependance: 'ACOSCO', role: 'agent', actif: 1 },
    { uid: 'u3', email: 'parti@x.dz', nom: 'PARTI', role: 'agent', actif: 1 },
  ];
  const r = Annuaire.lire(SRC);
  const f = Annuaire.fusionner(existants, r.personnes);
  assert.strictEqual(f.ajouts.length, 0);
  assert.deepStrictEqual(f.maj.map(m => m.email), ['noureddine.lakkaichi@sonatrach.dz']);
  assert.deepStrictEqual(Object.keys(f.maj[0].champs).sort(), ['dependance', 'fonction', 'service', 'telephone']);
  assert.ok(!('role' in f.maj[0].champs) && !('actif' in f.maj[0].champs) && !('uid' in f.maj[0].champs));
  assert.strictEqual(f.inchanges, 1, 'la matricule vide de la source n\'efface pas M-123');
  assert.deepStrictEqual(f.absents, ['parti@x.dz']);
  const g = Annuaire.fusionner(existants.slice(0, 1), r.personnes);
  assert.deepStrictEqual(g.ajouts.map(p => p.email), ['locif.aze@gmail.com']);
});

test('erreurs claires : en-têtes absents, colonne des noms introuvable', () => {
  assert.match(Annuaire.lire([['a', 'b'], ['1', '2']]).erreur, /En-têtes introuvables/);
  assert.match(Annuaire.lire([['Service', 'E-Mail']]).erreur, /noms introuvable/);
  assert.strictEqual(Annuaire.lire([['Service', 'Nom', 'E-Mail'], ['S', 'X Y', 'x@y.dz']]).personnes.length, 1);
});
