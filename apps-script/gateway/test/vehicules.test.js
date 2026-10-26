// node --test apps-script/gateway/test/vehicules.test.js
const test = require('node:test');
const assert = require('node:assert');
const VH = require('../VehiculesVH.gs');

const ENT = ['', 'Type de véhicule :', 'Immatriculation :', 'Affecation', 'Type de véhicule', 'Prestatire', 'Contrat N° :', 'N°Authorisation', 'Macaron Pret', 'Chauffeur', 'Radio'];
const L = (...c) => ['', ...c];
const table = [[''], ['', 'Tableau Affectation Vehicule Division Infra'], [], [], ENT,
  L('TOYOTA HILUX', '000031-320-33', 'Service Construction', 'Vehicule Mis a dispo', 'Acosco', 'I/24/RNS-INFRA/2025', 'INFR N°12', 'ok', 'attente piece', 'demande de trasvert'),
  L('PRADO', '00464-103-30', 'Service Electromécanique', 'Vehicule Sonatrach', '', '', 'INFR N°02', 'ok', '', ''),
  L('TOYOTA HILUX', '01307-316-30', 'Service_Travaux_Entretien', 'Vehicule Prestataire', 'Zaatout Abdenacer', 'I/58/RNS-INFRA/2025', 'INFR N°14', 'ok', '', ''),
  L('CHARGEUR', '2022', 'Service_Travaux_Entretien', 'Vehicule Prestataire', 'Zaatout Abdenacer', 'I/58/RNS-INFRA/2025', 'INFR N°35', '—', '', ''),
  L('', '', '', '')];

test('colonnes repérées par leurs titres (deux « Type de véhicule » : modèle puis catégorie)', () => {
  const c = VH.colonnes(table);
  assert.deepStrictEqual([c.ligne, c.modele, c.immat, c.affectation, c.categorie, c.prestataire, c.contrat, c.auth, c.macaron, c.chauffeur, c.radio, c.date], [4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1]);
});
test('lecture : lignes avec leur numéro dans la feuille, lignes vides ignorées', () => {
  const r = VH.lire(table);
  assert.strictEqual(r.lignes.length, 4); assert.strictEqual(r.lignes[0].ligne, 6); assert.strictEqual(r.lignes[0].auth, 'INFR N°12'); assert.strictEqual(r.lignes[2].prestataire, 'Zaatout Abdenacer');
});
test('immatriculations : ignorer les séparateurs, rejeter « — » et « 2022 »', () => {
  assert.strictEqual(VH.immatNorm('00164-216-30'), '0016421630'); assert.strictEqual(VH.immatNorm('00164 216 30'), '0016421630'); assert.strictEqual(VH.immatNorm('—'), ''); assert.strictEqual(VH.immatNorm('2022'), '');
});
test('planifier : véhicule connu mis à jour (n° et macaron conservés), nouveau véhicule ajouté avec le n° suivant, orthographe du service reprise', () => {
  const { lignes } = VH.lire(table);
  const ctx = { affectation: 'Service Travaux Entretien', categorie: 'Vehicule Prestataire', prestataire: 'Zaatout Abdenacer', contrat: '58.INFRA.25', date: '2026-10-26', valide: '2026-11-30' };
  const p = VH.planifier(lignes, [{ modele: 'TOYOTA HILUX', immat: '01307 316 30', chauffeur: 'BENALI Karim' }, { modele: 'SHACMAN', immat: '00437-216-30', chauffeur: 'X Y' }, { modele: 'SHACMAN', immat: '00437-216-30', chauffeur: 'Z W' }, { modele: 'sans immat', immat: '' }], ctx);
  assert.strictEqual(p.maj.length, 1); assert.strictEqual(p.maj[0].ligne, 8);
  assert.deepStrictEqual(p.maj[0].champs, { contrat: '58.INFRA.25', chauffeur: 'BENALI Karim', date: '2026-10-26', valide: '2026-11-30' });   // affectation, prestataire, catégorie identiques : non réécrits
  assert.strictEqual(p.ajouter.length, 1);
  assert.strictEqual(p.ajouter[0].champs.auth, 'INFR N°36'); assert.strictEqual(p.ajouter[0].champs.affectation, 'Service_Travaux_Entretien'); assert.strictEqual(p.ajouter[0].champs.chauffeur, 'X Y / Z W');
});
test('fin de mois', () => { assert.strictEqual(VH.finDeMois('2026-10-26', false), '2026-10-31'); assert.strictEqual(VH.finDeMois('2026-10-26', true), '2026-11-30'); assert.strictEqual(VH.finDeMois('2026-12-05', true), '2027-01-31'); });
test('Feuille 2 : personnes affectées aux véhicules', () => {
  const f2 = [[], ['', 'Affectation VH INFRA RNS'], [], ['', 'Type de véhicule', 'Immatriculation', 'Affectation', 'Nom & Prénom'], ['', 'CHARGEUR XCMG', '2022', 'Zaatout Abdenacer', 'Aona de Abdelhalife'], ['', 'SHACMAN', '000237-218-30', 'Zaatout Abdenacer', 'Belmehdi M']];
  assert.deepStrictEqual(VH.lireFeuille2(f2).map(x => [x.immat, x.personne]), [['2022', 'Aona de Abdelhalife'], ['000237-218-30', 'Belmehdi M']]);
});
