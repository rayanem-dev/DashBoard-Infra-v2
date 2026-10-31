// node --test apps-script/gateway/test/tableaubord.test.js
const test = require('node:test');
const assert = require('node:assert');
const TB = require('../TableauBord.gs');

test('jours consécutifs', () => { assert.deepStrictEqual(TB.jours('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']); });
test('effectif par jour et par service (le service vient du rapport ou du chantier)', () => {
  const r = [{ date: '2026-10-26', effectif: 10, service: 'Service Construction' }, { date: '2026-10-26', effectif: 5, service: 'Travaux Entretien' }, { date: '2026-10-27', effectif: 7, service: 'Électromécanique' }, { date: '2026-10-20', effectif: 99, service: 'x' }, { date: '2026-10-27', effectif: 3, service: '' }];
  const s = TB.serieEffectif(r, ['2026-10-26', '2026-10-27']);
  assert.deepStrictEqual(s.jours.map(j => [j.date, j.total, j.par.construction, j.par.entretien, j.par.electromecanique, j.par.autre]), [['2026-10-26', 15, 10, 5, 0, 0], ['2026-10-27', 10, 0, 0, 7, 3]]);
});
test('rapports du jour : reçus, manquants, hors-contrat ignorés', () => {
  const x = TB.rapportsDuJour({ chantiers: [{ nom: 'A', service: 'S', rapports: [{}] }, { nom: 'B', service: 'S', rapports: [] }, { nom: 'C', phase: 'preparation', rapports: [] }] });
  assert.deepStrictEqual([x.total, x.recus, x.manquants.map(m => m.nom)], [2, 1, ['B']]);
});
test('avancement contre délai : le plus en retard d\'abord, comptage des retards > 15 points', () => {
  const t = [{ nom: 'A', avancement: 80, delai_pct: 60 }, { nom: 'B', avancement: 20, delai_pct: 70 }, { nom: 'C', avancement: 50, delai_pct: 60 }, { nom: 'D', avancement: null, delai_pct: 10 }];
  const r = TB.avancementDelai(t, 5);
  assert.deepStrictEqual([r.chantiers.map(c => c.nom), r.en_retard, r.suivis], [['B', 'C', 'A'], 1, 3]);
});
test('échéances proches et répartition des contrats par statut', () => {
  assert.deepStrictEqual(TB.echeances([{ nom: 'A', jours_restants: 40 }, { nom: 'B', jours_restants: 5 }, { nom: 'C', jours_restants: 200 }, { nom: 'D', jours_restants: -3 }], 60).map(e => e.nom), ['B', 'A']);
  const enr = { ordre: ['a', 'b', 'c', 'd'], dossiers: { a: { statut: 'Contrat en exécution' }, b: { statut: 'Contrat échu' }, c: { statut: 'infructueux' }, d: { statut: 'Contrat en exécution' } } };
  assert.deepStrictEqual(TB.contratsParStatut(enr).map(s => [s.id, s.n]), [['execution', 2], ['echu', 1], ['infructueux', 1]]);
});

// ----- statistiques des rapports journaliers (semaine = samedi → vendredi) -----
const R = (date, chantier, effectif, auteur, extra) => Object.assign({ date, chantier, effectif, auteur_email: auteur + '@x.dz', auteur_nom: auteur.toUpperCase() }, extra || {});
test('début de semaine : le samedi qui ouvre la semaine', () => {
  assert.strictEqual(TB.debutSemaine('2026-10-31'), '2026-10-31');   // samedi
  assert.strictEqual(TB.debutSemaine('2026-11-01'), '2026-10-31');   // dimanche
  assert.strictEqual(TB.debutSemaine('2026-11-06'), '2026-10-31');   // vendredi
  assert.strictEqual(TB.debutSemaine('2026-11-07'), '2026-11-07');
});
test('rapports par jour et par semaine : 4 semaines, la dernière en cours, effectif moyen, difficultés, jours futurs omis', () => {
  const auj = '2026-11-03';                                          // mardi : semaine en cours = 31/10 → 06/11
  const r = [R('2026-10-10', 'a', 5, 'x'), R('2026-10-17', 'a', 8, 'x', { difficultes: 'Retard béton' }), R('2026-10-17', 'b', 4, 'y'), R('2026-10-31', 'a', 10, 'x'), R('2026-11-01', 'a', 10, 'x'), R('2026-11-01', 'b', 6, 'y'), R('2026-11-02', 'a', 9, 'x'), R('2026-11-04', 'a', 99, 'x'), R('2026-09-01', 'a', 99, 'x')];
  const s = TB.rapportsParSemaine(r, auj, 4), w = s.semaines;
  assert.deepStrictEqual(w.map(x => x.debut), ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']); assert.deepStrictEqual(w.map(x => x.enCours), [false, false, false, true]);
  assert.deepStrictEqual(w.map(x => x.rapports), [1, 2, 0, 4]);                                       // le 04/11 (futur) et le 01/09 (hors fenêtre) sont ignorés
  assert.strictEqual(w[1].difficultes, 1); assert.strictEqual(w[1].joursActifs, 1); assert.strictEqual(w[1].effectifMoyen, 12);   // 8 + 4 le même jour
  assert.deepStrictEqual([w[3].joursActifs, w[3].parJourActif, w[3].effectifMoyen], [3, 1.3, 11.7]);  // (10 + 16 + 9) / 3
  assert.strictEqual(s.jours.length, 7 * 3 + 4); assert.strictEqual(s.jours[s.jours.length - 1].date, auj); assert.strictEqual(s.jours.find(j => j.date === '2026-11-01').n, 2);
});
test('classement des rapporteurs : le plus de rapports, puis de jours ; fenêtre respectée ; limité', () => {
  const r = [R('2026-10-20', 'a', 1, 'zoe'), R('2026-10-21', 'a', 1, 'zoe'), R('2026-10-21', 'b', 1, 'zoe'), R('2026-10-20', 'a', 1, 'adam'), R('2026-10-21', 'a', 1, 'adam'), R('2026-10-22', 'a', 1, 'adam'), R('2026-09-01', 'a', 1, 'vieux'), R('2026-10-22', 'a', 1, 'lea')];
  const c = TB.classementRapporteurs(r, '2026-10-01', '2026-10-31', 2);
  assert.deepStrictEqual(c.rapporteurs.map(x => [x.nom, x.rapports, x.jours, x.chantiers]), [['ADAM', 3, 3, 1], ['ZOE', 3, 2, 2]]);   // à 3 rapports chacun : ADAM a plus de jours
  assert.strictEqual(c.total, 3, '« vieux » est hors fenêtre');
});
test('ouvriers par chantier et par semaine : effectif moyen par jour rapporté, les plus fournis d\'abord', () => {
  const ch = [{ id: 'a', nom: 'Forage', service: 'S1' }, { id: 'b', nom: 'Routes', service: 'S2' }, { id: 'c', nom: 'Vide' }];
  const r = [R('2026-10-31', 'a', 10, 'x'), R('2026-11-01', 'a', 20, 'x'), R('2026-11-01', 'a', 4, 'y'), R('2026-10-24', 'a', 6, 'x'), R('2026-10-31', 'b', 40, 'x'), R('2026-10-10', 'b', 30, 'x')];
  const e = TB.effectifParChantier(r, ch, '2026-11-03', 4, 5);
  assert.deepStrictEqual(e.chantiers.map(c => c.nom), ['Routes', 'Forage']);                          // « Vide » n'a aucun rapport : absent
  assert.deepStrictEqual(e.chantiers[1].valeurs, [0, 0, 6, 17]);                                      // semaine en cours : (10 + 24) / 2 jours
  assert.deepStrictEqual(e.chantiers[0].valeurs, [30, 0, 0, 40]); assert.strictEqual(e.max, 40); assert.strictEqual(e.semaines.length, 4);
});
test('suivi de la saisie : chantiers silencieux (depuis ≥ 3 jours ou jamais) et difficultés récentes', () => {
  const ch = [{ id: 'a', nom: 'Actif' }, { id: 'b', nom: 'Silencieux' }, { id: 'c', nom: 'Jamais' }, { id: 'd', nom: 'Préparation', phase: 'preparation' }];
  const r = [R('2026-11-03', 'a', 1, 'x', { difficultes: 'Panne engin' }), R('2026-11-02', 'a', 1, 'x', { difficultes: 'Retard livraison' }), R('2026-10-28', 'b', 1, 'x'), R('2026-10-01', 'a', 1, 'x', { difficultes: 'Ancienne' })];
  const s = TB.suiviSaisie(r, ch, '2026-11-03', 3, 14);
  assert.deepStrictEqual(s.silencieux.map(x => [x.nom, x.jours]), [['Jamais', null], ['Silencieux', 6]]); assert.strictEqual(s.nbSilencieux, 2); assert.strictEqual(s.suivis, 3, 'la préparation n\'est pas suivie');
  assert.deepStrictEqual(s.difficultes.map(d => [d.nom, d.n, d.texte]), [['Actif', 2, 'Panne engin']]); assert.strictEqual(s.nbDifficultes, 2);
});
