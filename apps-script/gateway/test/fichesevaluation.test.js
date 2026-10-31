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

// ----- ignorer une fiche pour un projet et un mois ; relance du service et du conducteur affecté -----
test('contrat ignoré pour le mois : ni attendu ni manquant ; une fiche existante reste comptée', () => {
  const e = F.etat('2026-10-26', contrats, [fiche('I/30/RNS/INFRA/2024', '2026-10-05')], [{ cle: '53-25', par: 'RAYANE', motif: 'Contrat suspendu' }, { cle: '30-24', par: 'X' }]);
  assert.deepStrictEqual([e.attendues, e.creees], [2, 1]);                                                // 53 écarté ; 30 écarté mais sa fiche existe : comptée ; 47 attendu
  assert.deepStrictEqual(e.manquantes.map(m => m.contrat), ['47.INFRA.26']); assert.deepStrictEqual(e.ignorees.map(i => [i.contrat, i.par, i.motif]), [['53.INFRA.25', 'RAYANE', 'Contrat suspendu']]);
  const tout = F.etat('2026-10-26', contrats, [], contrats.map(c => ({ cle: F.cle(c.contrat) })));
  assert.deepStrictEqual([tout.attendues, tout.manquantes.length, tout.ignorees.length], [0, 0, 3]);
});
const U = (nom, email, role, service, extra) => Object.assign({ nom, email, role, service, actif: 1 }, extra || {});
const roleDe = r => String(r || '').toLowerCase();
test('relance : boîte du service du chantier + conducteurs de ce service ou affectés à ce chantier ; sans doublon ni inactif', () => {
  const users = [U('KHELIFI Amine', 'a@x.dz', 'conducteur', 'Service Construction'), U('MEZIANE Sofia', 'b@x.dz', 'conducteur', 'Travaux Entretien', { chantiers_sup: 'terrassement_rns ; autre' }), U('DERRADJI', 'c@x.dz', 'conducteur', 'Travaux Entretien'),
    U('INACTIF', 'd@x.dz', 'conducteur', 'Service Construction', { actif: 0 }), U('Chef Constr', 'e@x.dz', 'chef_service', 'Service Construction'), U('Agent', 'f@x.dz', 'agent', 'Service Construction')];
  const boites = [{ nom: 'Service Travaux Entretien INFRA - RNS', email: 'entretien@x.dz' }, { nom: 'Service Construction INFRA - RNS', email: 'constr@x.dz' }, { nom: 'Service Électromécanique INFRA - RNS', email: 'electro@x.dz' }];
  const r = F.destinatairesRelance({ id: 'terrassement_rns', service: 'Construction' }, users, boites, [], roleDe, TB.cleService);
  assert.deepStrictEqual(r.service.map(x => x.email), ['constr@x.dz']);
  assert.deepStrictEqual(r.conducteurs.map(x => x.email), ['a@x.dz', 'b@x.dz']);                         // KHELIFI (même service) + MEZIANE (chantier ajouté à ses projets) ; ni l'inactif, ni l'agent, ni DERRADJI
  const e = F.destinatairesRelance({ id: 'x', service: 'Électromécanique' }, users, boites, [], roleDe, TB.cleService);
  assert.deepStrictEqual(e.service.map(x => x.email), ['electro@x.dz']); assert.deepStrictEqual(e.conducteurs, []);
});
test('relance : sans boîte de service, les chefs de ce service ; sans conducteur affecté, ceux qui ont rapporté sur le chantier', () => {
  const users = [U('Chef Constr', 'e@x.dz', 'chef_service', 'Service Construction'), U('Chef Elec', 'g@x.dz', 'chef_service', 'Service Électromécanique'), U('Rapporteur', 'r@x.dz', 'agent', 'Service Construction'), U('Autre', 'z@x.dz', 'agent', 'X')];
  const r = F.destinatairesRelance({ id: 'c1', service: 'Service Construction' }, users, [], ['R@x.dz', 'inconnu@x.dz', 'r@x.dz'], roleDe, TB.cleService);
  assert.deepStrictEqual(r.service.map(x => x.email), ['e@x.dz']); assert.deepStrictEqual(r.conducteurs.map(x => x.email), ['r@x.dz']);
  assert.deepStrictEqual(F.destinatairesRelance(null, users, [], [], roleDe, TB.cleService), { service: [], conducteurs: [] });
});
test('dernière relance de chaque fiche manquante', () => {
  const m = F.avecRelances([{ contrat: '53.INFRA.25' }, { contrat: '47.INFRA.26' }], [{ cle: '53-25', le: '2026-10-26T08:00:00Z', par: 'A' }, { cle: '53-25', le: '2026-10-27T09:00:00Z', par: 'B' }]);
  assert.deepStrictEqual(m.map(x => x.relance), [{ le: '2026-10-27T09:00:00Z', par: 'B' }, null]);
});

test('fiche faite à la main (hors générateur) : comptée comme éditée, jamais manquante ; la fiche du générateur l\'emporte', () => {
  const e = F.etat('2026-10-26', contrats, [fiche('I/30/RNS/INFRA/2024', '2026-10-05')], [], [{ cle: '53-25', par: 'RAYANE', le: '2026-10-25T10:00:00Z' }, { cle: '30-24', par: 'X' }]);
  assert.deepStrictEqual([e.attendues, e.creees, e.manquantes.length], [3, 2, 1]);
  const m = e.faites.find(x => x.contrat === '53.INFRA.25'), g = e.faites.find(x => x.contrat === '30.INFRA.24');
  assert.deepStrictEqual([m.manuelle, m.par, m.taux, m.projet], [true, 'RAYANE', null, 'Terrassement']); assert.strictEqual(g.manuelle, undefined, 'fiche du générateur : pas marquée manuelle');
});
