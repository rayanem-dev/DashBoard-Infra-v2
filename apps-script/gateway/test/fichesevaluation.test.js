// node --test apps-script/gateway/test/fichesevaluation.test.js
const test = require('node:test');
const assert = require('node:assert');
const F = require('../FichesEvaluation.gs');
const TB = require('../TableauBord.gs');

const contrats = [{ contrat: '53.INFRA.25', entreprise: 'ETB ZATOUT', projet: 'Terrassement' }, { contrat: '47.INFRA.26', entreprise: 'GCB', projet: 'Routes' }, { contrat: '30.INFRA.24', entreprise: 'GLOBI', projet: 'Maintenance' }];
const fiche = (contrat, date, extra) => Object.assign({ contrat, entrepreneur: 'X', date, taux: 71.53, cree: '2026-10-20' }, extra || {});

test('clé de contrat : « 53.INFRA.25 » et « I/53/RNS/INFRA/2025 » désignent le même contrat', () => {
  assert.strictEqual(F.cle('53.INFRA.25'), '53-25'); assert.strictEqual(F.cle('I/53/RNS/INFRA/2025'), '53-25'); assert.strictEqual(F.cle('Visite sur site'), ''); assert.strictEqual(F.cle(''), '');
});
test('la carte n\'apparaît qu\'à partir du 22 ; 22-24 = préparation, dès le 25 = échéance', () => {
  assert.strictEqual(F.etat('2026-10-21', contrats, []), null);
  const p = F.etat('2026-10-22', contrats, []); assert.strictEqual(p.phase, 'preparation'); assert.strictEqual(p.joursAvantLimite, 3); assert.strictEqual(p.dateLimite, '2026-10-25');
  assert.strictEqual(F.etat('2026-10-24', contrats, []).phase, 'preparation'); assert.strictEqual(F.etat('2026-10-24', contrats, []).joursAvantLimite, 1);
  const e = F.etat('2026-10-25', contrats, []); assert.strictEqual(e.phase, 'echeance'); assert.strictEqual(e.joursAvantLimite, 0);
  const f = F.etat('2026-10-31', contrats, []); assert.strictEqual(f.phase, 'echeance'); assert.strictEqual(f.dateEnvoi, '2026-11-01'); assert.strictEqual(f.joursAvantEnvoi, 1);
  assert.strictEqual(F.etat('2026-02-22', contrats, []).dateEnvoi, '2026-03-01', 'février');
});
test('fiches créées / manquantes : par contrat, mois courant seulement, une seule fiche comptée par contrat', () => {
  const fiches = [fiche('I/53/RNS/INFRA/2025', '2026-10-12'), fiche('I/53/RNS/INFRA/2025', '2026-10-20'), fiche('I/47/RNS/INFRA/2026', '2026-09-28'), fiche('I/30/RNS/INFRA/2024', '', { cree: '2026-10-03' })];
  const e = F.etat('2026-10-26', contrats, fiches);
  assert.deepStrictEqual([e.attendues, e.creees, e.horsListe], [3, 2, 0]);
  assert.deepStrictEqual(e.manquantes.map(m => m.contrat), ['47.INFRA.26']);                       // la fiche de septembre ne compte pas
  assert.deepStrictEqual(e.faites.map(m => m.contrat), ['53.INFRA.25', '30.INFRA.24']); assert.strictEqual(e.faites[1].taux, 71.53);
});
test('fiches sans contrat en exécution (préparation, levée des réserves…) : comptées à part, jamais « manquantes »', () => {
  const e = F.etat('2026-10-26', contrats, [fiche('I/99/RNS/INFRA/2025', '2026-10-10'), fiche('', '2026-10-11'), fiche('I/53/RNS/INFRA/2025', '2026-10-12')]);
  assert.deepStrictEqual([e.creees, e.horsListe, e.total, e.manquantes.length], [1, 2, 3, 2]);
});
test('contrats en exécution du Suivi CPM : statut « En exécution », n° de contrat requis, sans doublon', () => {
  const enr = { ordre: ['a', 'b', 'c', 'd', 'e'], dossiers: {
    a: { statut: 'En exécution', n_contrat: '53.INFRA.25', attribue_a: 'ETB ZATOUT', intitule: 'Terrassement' }, b: { statut: 'En exécution', n_contrat: '53.INFRA.25', attribue_a: 'Doublon' }, c: { statut: 'Attribué', n_contrat: '10.INFRA.26' },
    d: { statut: 'En exécution', n_contrat: '', attribue_a: 'Sans n°' }, e: { statut: 'Exécution', n_contrat: '47.INFRA.26', attribue_a: 'GCB', intitule: 'Routes' } } };
  assert.deepStrictEqual(F.contratsEnExecution(enr, TB.cleStatut).map(c => [c.contrat, c.entreprise]), [['53.INFRA.25', 'ETB ZATOUT'], ['47.INFRA.26', 'GCB']]);
  assert.deepStrictEqual(F.contratsEnExecution(null, TB.cleStatut), []);
});
