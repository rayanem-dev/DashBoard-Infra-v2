// node --test apps-script/gateway/test/vehicules.test.js
const test = require('node:test');
const assert = require('node:assert');
const VH = require('../VehiculesVH.gs');

const ENT = ['', 'Type de véhicule :', 'Immatriculation :', 'Affecation', 'Type de véhicule', 'Prestatire', 'Contrat N° :', 'Chauffeur', 'Radio', 'Date d\'autorisation', 'Valable jusqu\'au', 'Date d\'autorisation', 'Valable jusqu\'au'];
const L = (...c) => ['', ...c];
const table = [[], ['Retour au Tableau de bord'], ['', '', 'Tableau Affectation Vehicule Division Infra'], [], ENT,
  L('SKODA RAPID', '00073-119-33', 'Chef division', 'Vehicule Sonatrach', '', '', 'CDD', ''),
  L('SHACMAN', '000237-218-30', 'Service_Travaux_Entretien', 'Vehicule Prestataire', 'Zaatout Abdenacer', 'I/53/RNS/INFRA/2025', '', ''),
  L('FIAT DOBLO', '005377-3124-19', '', 'Vehicule Prestataire', 'EURL CFCE', '57.INFRA.25', 'ABDALLAH Djaber', '', '', '', '2026-10-26', '2026-11-30'),
  L('', '', '', '')];

test('colonnes repérées par leurs titres (deux « Type de véhicule », dates en double)', () => {
  const c = VH.colonnes(table);
  assert.deepStrictEqual([c.ligne, c.modele, c.immat, c.affectation, c.categorie, c.prestataire, c.contrat, c.chauffeur, c.radio, c.date, c.valide, c.dates, c.valides], [4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, [9, 11], [10, 12]]);
});
test('lecture : lignes numérotées, lignes vides ignorées, date lue dans la première colonne renseignée', () => {
  const r = VH.lire(table);
  assert.strictEqual(r.lignes.length, 3); assert.strictEqual(r.lignes[0].ligne, 6);
  assert.deepStrictEqual([r.lignes[2].date, r.lignes[2].valide, r.lignes[2].chauffeur], ['2026-10-26', '2026-11-30', 'ABDALLAH Djaber']);
});
test('immatriculations : ignorer les séparateurs, rejeter « — »', () => {
  assert.strictEqual(VH.immatNorm('00164-216-30'), '0016421630'); assert.strictEqual(VH.immatNorm('00164 216 30'), '0016421630'); assert.strictEqual(VH.immatNorm('—'), ''); assert.strictEqual(VH.immatNorm(''), '');
});
test('chauffeurs : « Vehicule Sonatrach » remplacé, doublon évité, nom ajouté', () => {
  assert.strictEqual(VH.fusionnerPersonne('Vehicule Sonatrach', 'X Y'), 'X Y');
  assert.strictEqual(VH.fusionnerPersonne('X Y', 'x y'), 'X Y');
  assert.strictEqual(VH.fusionnerPersonne('X Y', 'Z W'), 'X Y / Z W');
  assert.strictEqual(VH.fusionnerPersonne('X Y', ''), 'X Y');
});
test('planifier : véhicule connu mis à jour, nouveau ajouté, orthographe du service reprise, chauffeurs d\'un même véhicule réunis', () => {
  const { lignes } = VH.lire(table);
  const ctx = { affectation: 'service travaux entretien', categorie: 'Vehicule Prestataire', prestataire: 'Zaatout Abdenacer', contrat: '58.INFRA.25', date: '2026-10-26', valide: '2026-10-31' };
  const p = VH.planifier(lignes, [{ modele: 'SHACMAN', immat: '000237 218 30', chauffeur: 'BENALI Karim' }, { modele: 'HILUX', immat: '00437-216-30', chauffeur: 'X Y' }, { modele: 'HILUX', immat: '00437-216-30', chauffeur: 'Z W' }, { modele: 'sans immat', immat: '' }], ctx);
  assert.strictEqual(p.maj.length, 1); assert.strictEqual(p.maj[0].ligne, 7);
  assert.deepStrictEqual(p.maj[0].champs, { chauffeur: 'BENALI Karim', contrat: '58.INFRA.25', date: '2026-10-26', valide: '2026-10-31' });
  assert.strictEqual(p.ajouter.length, 1);
  assert.deepStrictEqual(p.ajouter[0].champs, { modele: 'HILUX', immat: '00437-216-30', affectation: 'Service_Travaux_Entretien', categorie: 'Vehicule Prestataire', prestataire: 'Zaatout Abdenacer', contrat: '58.INFRA.25', chauffeur: 'X Y / Z W', date: '2026-10-26', valide: '2026-10-31' });
});
test('reprise sans écraser : dates et contrat déjà renseignés conservés, rien à écrire pour un véhicule déjà à jour', () => {
  const { lignes } = VH.lire(table);
  const p = VH.planifier(lignes, [{ modele: 'FIAT DOBLO', immat: '005377-3124-19', chauffeur: 'ABDALLAH Djaber' }], { categorie: 'Vehicule Prestataire', prestataire: 'EURL CFCE', contrat: '57.INFRA.25', date: '2026-10-26', valide: '2026-10-31', sansEcraser: true });
  assert.deepStrictEqual([p.maj.length, p.ajouter.length], [0, 0]);
});
test('fin de mois', () => { assert.strictEqual(VH.finDeMois('2026-10-26', false), '2026-10-31'); assert.strictEqual(VH.finDeMois('2026-10-26', true), '2026-11-30'); assert.strictEqual(VH.finDeMois('2026-12-05', true), '2027-01-31'); });
test('rattrapage : autorisations du jour d\'une entreprise lues dans le Journal_PEC', () => {
  const J = [['date', 'prestataire', 'base', 'documents', 'nom', 'prenom', 'fonction', 'vehicule', 'immatriculation', 'enquetes', 'arrivee', 'depart'],
    ['2026-10-26 09:10', '58.INFRA.25 - EURL CFCE', 'RNS', 'PEC+Autorisation', 'Benali', 'Karim', 'Chauffeur', 'Toyota Hilux', '01307-316-30', '', '', ''],
    ['2026-10-26 09:10', '58.INFRA.25 - EURL CFCE', 'RNS', 'PEC+Autorisation', 'Haddad', 'Omar', 'Maçon', '', '', '', '', ''],
    ['2026-10-26 11:00', '58.INFRA.25 - EURL CFCE', 'RNS', 'PEC', 'Saidi', 'Ali', 'Chauffeur', 'Doblo', '00624-323-39', '', '', ''],
    ['2026-10-25 09:00', '58.INFRA.25 - EURL CFCE', 'RNS', 'Autorisation', 'Veille', 'Jour', '', 'Doblo', '00624-323-40', '', '', ''],
    ['2026-10-26 12:00', '12.INFRA.25 - Ets Autre', 'RNS', 'Autorisation', 'Bou', 'Ali', '', 'Berlingo', '00111-222-30', '', '', '']];
  const g = VH.depuisJournal(J, '2026-10-26', 'CFCE');
  assert.deepStrictEqual(g, [{ prestataire: 'EURL CFCE', contrat: '58.INFRA.25', vehicules: [{ modele: 'TOYOTA HILUX', immat: '01307-316-30', chauffeur: 'Benali Karim' }] }]);
  assert.strictEqual(VH.depuisJournal(J, '2026-10-26').length, 2);
});
