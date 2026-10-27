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
  assert.deepStrictEqual(c.designations, ['Zaatout abdenacer', 'I/54/RNS/INFRA/2025']); assert.deepStrictEqual(c.quand, ['06/07/2026 Au 12/07/2026']); assert.strictEqual(c.nb, '01'); assert.strictEqual(c.colonne, 'Période De Dotation');
});
test('prise en charge repas : champs obligatoires', () => {
  assert.throws(() => run(`repasChamps_({ sousType: 'PAUSE_CAFE', designations: '', dateDebut: '2026-06-19', nb: '3' })`), /désignations/);
  assert.throws(() => run(`repasChamps_({ sousType: 'PAUSE_CAFE', designations: 'x', dateDebut: '', nb: '3' })`), /date/);
  assert.throws(() => run(`repasChamps_({ sousType: 'PAUSE_CAFE', designations: 'x', dateDebut: '2026-06-19', nb: '' })`), /nombre/);
  assert.strictEqual(run(`dateLongueFr_('2026-10-20')`), '20 octobre 2026');
});

test('prise en charge repas : génération complète avec un faux DocumentApp qui refuse tout texte vide (comme Google Docs)', () => {
  const videDans = (x) => x === '' || (Array.isArray(x) && x.some(videDans));
  const objet = () => new Proxy(function () {}, {
    get: (t, k) => k === 'getNumChildren' ? () => 1 : k === 'getText' ? () => 'x' : k === 'getUrl' ? () => 'u' : k === 'getId' ? () => 'id'
      : k === 'getParents' ? () => ({ next: objet() }) : k === Symbol.toPrimitive ? () => '' : new Proxy(function () {}, { apply: (f, th, args) => { if (args.some(videDans)) throw new Error("Impossible d'insérer un élément de texte vide."); return objet(); }, get: (f, k2) => objet()[k2] }),
    apply: () => objet() });
  ctx.DocumentApp = { create: () => objet(), HorizontalAlignment: { CENTER: 'c', RIGHT: 'r', LEFT: 'l' }, VerticalAlignment: { CENTER: 'c', TOP: 't' } };
  ctx.Utilities = { newBlob: () => ({}), base64Decode: () => [], formatDate: () => '20-10-2026' };
  ctx.DriveApp = { getFileById: () => objet() };
  ['CASSE_CROUTE', 'COLLATION', 'PAUSE_CAFE', 'REPAS_EMPORTER'].forEach(t => {
    const r = run(`genererPriseEnChargeRepas_({ sousType: '${t}', designations: 'A B\\nC D', dateDebut: '2026-10-18', dateFin: '2026-10-24', nb: '2', imputation: '', observations: '', date: '2026-10-20' })`);
    assert.strictEqual(r.success, true, t + ' : ' + r.error);
  });
});

test('envoi par e-mail : boîte du service d\'après le nom du fichier, secrétariat par défaut, jamais sans choix', () => {
  const b = (n) => run(`(boiteServiceDeFichier_(${JSON.stringify(n)}) || {}).email || null`);
  assert.strictEqual(b('DOTATION_VIVRES_Service Construction (Génie Civil)_01-10-2026.pdf'), 'infra_constr.rns@sonatrach.dz');
  assert.strictEqual(b('DOTATION_EAU_Service Electromécanique_01-10-2026.pdf'), 'infra_electromec.rns@sonatrach.dz');
  assert.strictEqual(b('DOTATION_ENTRETIEN_Atelier_1ere-quinzaine.pdf'), 'service_travaux_entretien_infra.rns@sonatrach.dz');
  assert.strictEqual(b('DOTATION_DIVISION_01-10-2026_au_15-10-2026.pdf'), 'cdd_infra.rns@sonatrach.dz');
  assert.strictEqual(b('DOTATION_REPAS_4300045200_26-10-2026.pdf'), 'service_travaux_entretien_infra.rns@sonatrach.dz');
  assert.strictEqual(b('AUTRE.pdf'), null);
  assert.deepStrictEqual(run(`destinatairesDotation_({ secretariat: true }, 'DOTATION_EAU_Service Construction_x.pdf')`), ['sec-infra.rns@sonatrach.dz', 'sec.infra.rns@gmail.com', 'rayanem@gmail.com']);
  assert.strictEqual(run(`destinatairesDotation_({ secretariat: true, service: true }, 'DOTATION_EAU_Service Construction_x.pdf').length`), 4);
  assert.throws(() => run(`destinatairesDotation_({}, 'DOTATION_EAU_Service Construction_x.pdf')`), /Cochez/);
  assert.throws(() => run(`destinatairesDotation_({ service: true }, 'AUTRE.pdf')`), /Aucune boîte/);
});

test('dotation eau : le nombre de fardeaux figure dans la quantité (PDF et aperçu)', () => {
  assert.strictEqual(run('calcQuantiteEau(2, "1L", 7)'), '2 Fardeaux (12 Bouteilles 1L)');
  assert.strictEqual(run('calcQuantiteEau(1, "0.5L", 7)'), '1 Fardeau (12 Bouteilles 0.5L)');
  assert.strictEqual(run('calcQuantiteEau(3, "1L", 14)'), '6 Fardeaux (36 Bouteilles 1L)');
  assert.strictEqual(run('calcQuantiteEau(0, "1L", 7)'), '0 Fardeau (0 Bouteilles 1L)');
});

test('dotation division : la quinzaine se calcule seule (01-15 ou 16-fin du mois)', () => {
  const q = (d) => run(`getPeriodeQuinzaine_(${JSON.stringify(d)})`);
  assert.deepStrictEqual(q('2026-10-01'), { debut: '01/10/2026', fin: '15/10/2026' });
  assert.deepStrictEqual(q('2026-10-15'), { debut: '01/10/2026', fin: '15/10/2026' });
  assert.deepStrictEqual(q('2026-10-16'), { debut: '16/10/2026', fin: '31/10/2026' });
  assert.deepStrictEqual(q('2026-02-27'), { debut: '16/02/2026', fin: '28/02/2026' });
  assert.deepStrictEqual(q('2028-02-20'), { debut: '16/02/2028', fin: '29/02/2028' });
});
