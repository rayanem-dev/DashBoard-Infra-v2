// Dotation : lecture de BDDORGA par en-têtes (ancien et nouveau format), services normalisés, Sonatrach seulement.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = { console, Utilities: {}, Session: {}, SpreadsheetApp: {}, DriveApp: {}, DocumentApp: {}, HtmlService: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.js'), 'utf8'), ctx);
const run = (c) => JSON.parse(JSON.stringify(vm.runInContext(c, ctx)));
const feuille = (v) => { ctx.__v = v; ctx.SpreadsheetApp = { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => ctx.__v.map(l => l.slice()) }) }) }) }; };

const NOUVEAU = [
  ['E-Mail', 'Matricule', 'NOM ET PRENOM', 'Service', 'Fonction', 'Division', 'dependance', 'NIN'],
  ['k@sonatrach.dz', '81616Q', 'HAMDAOUI KADA', 'Division Infrastructures', 'Cadre Sup', 'Division Infrastructures', 'SONATRACH', ''],
  ['l@gmail.com', '', 'AZEGGAGH LOCIF', 'Service Construction', 'x', 'Division Infrastructures', 'ACOSCO', ''],
  ['n@sonatrach.dz', '36466H', 'LAKKAICHI NOUREDDINE', 'Service Construction', 'x', 'Division Infrastructures', 'SONATRACH', ''],
  ['e@sonatrach.dz', '60771C', 'BEN MESSAOUD ELFAROUK', 'Service Construction', 'Chef', 'Division Infrastructures', ' sonatrach ', ''],
  ['t@sonatrach.dz', '1', 'DUPONT Paul', 'Service Travaux Entretien', 'x', 'D', 'SONATRACH', ''],
  ['m@sonatrach.dz', '2', 'MARTIN Luc', 'Service Electromécanique', 'x', 'D', 'SONATRACH', '']];
const ANCIEN = [['Matricule', 'Service', 'x', 'dependance', 'Nom'], ['1', 'Service Génie Civil', '', 'SONATRACH', 'DURAND Jean']];

test('nouveau format de BDDORGA : personnel Sonatrach par service, sous-traitants exclus', () => {
  feuille(NOUVEAU);
  assert.deepStrictEqual(run("getPersonnel('Service Construction (Génie Civil)')"), ['LAKKAICHI NOUREDDINE', 'BEN MESSAOUD ELFAROUK']);
  assert.deepStrictEqual(run("getPersonnel('Service Travaux Entretien')"), ['DUPONT Paul']);
  assert.deepStrictEqual(run("getPersonnel('Service Electromécanique')"), ['MARTIN Luc']);
  assert.deepStrictEqual(run("getPersonnel('Division Infrastructure')"), ['HAMDAOUI KADA']);
});
test('ancien format toujours lu', () => {
  feuille(ANCIEN);
  assert.deepStrictEqual(run("getPersonnel('Service Construction (Génie Civil)')"), ['DURAND Jean']);
});
test('colonne absente : message clair avec les en-têtes lus', () => {
  feuille([['a', 'b'], ['1', '2']]);
  assert.throws(() => run("getPersonnel('Service Travaux Entretien')"), /introuvable.*a \| b/);
});

test('prise en charge repas : cellules du tableau (tirets pour la collation, période, heure, lieu, nombre sur 2 chiffres)', () => {
  const r = run(`repasChamps_({ sousType: 'COLLATION', designations: 'Grande tarte / 60 P\\n- Café\\n\\nJus', dateDebut: '2026-06-19', heure: '16:30', lieu: 'Division Infra', nb: '60', imputation: ' 4300045000 ', observations: 'Départ en retraite\\nMOKRANI Miloud' })`);
  assert.deepStrictEqual(r.designations, ['- Grande tarte / 60 P', '- Café', '- Jus']);
  assert.deepStrictEqual(r.quand, ['19/06/2026', 'A 16:30', 'Division Infra']);
  assert.strictEqual(r.nb, '60'); assert.strictEqual(r.imputation, '4300045000'); assert.deepStrictEqual(r.observations, ['Départ en retraite', 'MOKRANI Miloud']);
  assert.strictEqual(r.titre, 'PRISE EN CHARGE : COLLATION');
  const c = run(`repasChamps_({ sousType: 'CASSE_CROUTE', designations: 'Zaatout abdenacer\\nI/54/RNS/INFRA/2025', dateDebut: '2026-07-06', dateFin: '2026-07-12', nb: '1' })`);
  assert.deepStrictEqual(c.designations, ['Zaatout abdenacer', 'I/54/RNS/INFRA/2025']); assert.deepStrictEqual(c.quand, ['06/07/2026 au', '12/07/2026']); assert.strictEqual(c.nb, '01'); assert.strictEqual(c.colonne, 'Période De Dotation');
});
test('prise en charge repas : champs obligatoires', () => {
  assert.throws(() => run(`repasChamps_({ sousType: 'PAUSE_CAFE', designations: '', dateDebut: '2026-06-19', nb: '3' })`), /désignations/);
  assert.throws(() => run(`repasChamps_({ sousType: 'PAUSE_CAFE', designations: 'x', dateDebut: '', nb: '3' })`), /date/);
  assert.throws(() => run(`repasChamps_({ sousType: 'PAUSE_CAFE', designations: 'x', dateDebut: '2026-06-19', nb: '' })`), /nombre/);
  assert.strictEqual(run(`dateLongueFr_('2026-10-20')`), '20 octobre 2026');
});

test('prise en charge repas : le programme de génération va au bout avec un faux DocumentApp (aucune erreur de code)', () => {
  const objet = () => new Proxy(function () {}, { get: (t, k) => k === 'getNumChildren' ? () => 1 : k === 'getText' ? () => 'x' : k === 'getUrl' ? () => 'u' : k === 'getId' ? () => 'id' : k === 'getParents' ? () => ({ next: objet() }) : (k === Symbol.toPrimitive ? () => '' : objet()), apply: () => objet() });
  ctx.DocumentApp = { create: () => objet(), HorizontalAlignment: { CENTER: 'c', RIGHT: 'r', LEFT: 'l' }, VerticalAlignment: { CENTER: 'c' } };
  ctx.Utilities = { newBlob: () => ({}), base64Decode: () => [], formatDate: () => '20-10-2026' };
  ctx.DriveApp = { getFileById: () => objet() };
  const r = run(`genererPriseEnChargeRepas_({ sousType: 'CASSE_CROUTE', designations: 'A B\\nC D', dateDebut: '2026-10-18', dateFin: '2026-10-24', nb: '2', imputation: '4300045100', observations: 'Equipe Permanence step', date: '2026-10-20' })`);
  assert.strictEqual(r.success, true, r.error);
});
