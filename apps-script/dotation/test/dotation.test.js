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
