// node --test apps-script/gateway/test/simulation.test.js
const test = require('node:test');
const assert = require('node:assert');
global.Dates = require('../Dates.gs');
global.Cycle = require('../Cycle.gs');
const Planning = require('../Planning.gs');
const Simulation = require('../../../js/simulation.js');

// Rotation 28/28 ; modification d'un exemple réel de « Demande de modification de planning » (dates seulement, aucune donnée personnelle).
const rot = { statut: 'T', depuis: '2026-08-12', jours_travail: 28, jours_repos: 28 };
const modif = { debut: '2026-09-09', periodes: [{ type: 'R', jours: 16 }, { type: 'T', jours: 12 }, { type: 'R', jours: 14 }, { type: 'T', jours: 21 }, { type: 'R', jours: 21 }], reprise: 'T' };
const DF = '2026-08-12', N = 300;

test('modèle d\'exemple : la reprise tombe le 02/12/2026, le formulaire est valide', () => {
  assert.strictEqual(Simulation.dateReprise(modif), '2026-12-02');
  assert.strictEqual(Simulation.valider(modif, rot, '2026-09-28'), '');
});

test('tableaux « actuel » et « modifié » identiques à ceux de la demande papier', () => {
  const off = Planning.grille(rot, [], DF, N), mod = Simulation.appliquer(off, DF, modif, rot);
  const f = t => t.map(p => [p.type, p.du, p.au, p.jours].join(' '));
  assert.deepStrictEqual(f(Simulation.tableau(off, DF, '2026-08-12', '2026-11-04')), [
    'T 2026-08-12 2026-09-08 28', 'R 2026-09-09 2026-10-06 28', 'T 2026-10-07 2026-11-03 28', 'R 2026-11-04 2026-11-04 1']);
  assert.deepStrictEqual(f(Simulation.tableau(mod, DF, '2026-08-12', '2027-03-23')), [
    'T 2026-08-12 2026-09-08 28', 'R 2026-09-09 2026-09-24 16', 'T 2026-09-25 2026-10-06 12', 'R 2026-10-07 2026-10-20 14', 'T 2026-10-21 2026-11-10 21',
    'R 2026-11-11 2026-12-01 21', 'T 2026-12-02 2026-12-29 28', 'R 2026-12-30 2027-01-26 28', 'T 2027-01-27 2027-02-23 28', 'R 2027-02-24 2027-03-23 28']);
});

test('PARITÉ avec le moteur de Sijil : appliquer ≡ Planning.grille avec les corrections', () => {
  const cas = [modif,
    { debut: '2026-09-20', periodes: [{ type: 'T', jours: 5 }], reprise: 'R' },
    { debut: '2026-10-07', periodes: [{ type: 'R', jours: 40 }, { type: 'T', jours: 3 }], reprise: 'R' },
    { debut: '2026-08-12', periodes: [{ type: 'R', jours: 2 }, { type: 'T', jours: 60 }], reprise: 'R' }];
  const r4 = { statut: 'R', depuis: '2026-08-01', jours_travail: 14, jours_repos: 21 };
  for (const rt of [rot, r4]) for (const m of cas) {
    if (Simulation.valider(m, rt, null)) continue;
    const off = Planning.grille(rt, [], rt.depuis, 400);
    assert.strictEqual(Simulation.appliquer(off, rt.depuis, m, rt), Planning.grille(rt, Simulation.corrections(m), rt.depuis, 400), JSON.stringify([rt.jours_travail, m.debut]));
  }
});

test('validation : dates, périodes, reprise différente de la dernière période', () => {
  const v = m => Simulation.valider(Object.assign({}, modif, m), rot, '2026-09-28');
  assert.match(v({ debut: '2026-02-30' }), /début invalide/);
  assert.match(v({ debut: '2026-08-01' }), /avant le début de la rotation/);
  assert.match(v({ debut: '2026-01-01' }), /avant le début|passé/);
  assert.match(v({ periodes: [] }), /au moins une période/);
  assert.match(v({ periodes: [{ type: 'X', jours: 3 }] }), /travail ou repos/);
  assert.match(v({ periodes: [{ type: 'T', jours: 0 }], reprise: 'R' }), /1 à 120/);
  assert.match(v({ reprise: 'R' }), /autre statut/);
  assert.match(v({ reprise: '' }), /reprend/);
});

test('vis-à-vis : relève sans trou ; chevauchement toléré ; trou jamais toléré par défaut', () => {
  const A = 'TTTTRRRRTTTT', B = 'RRRRTTTTRRRR';
  assert.strictEqual(Simulation.conflits(A, B, DF).jours, 0);
  const B2 = 'RRRTTTTTRRRR'; // B reprend 1 jour plus tôt : 1 jour de chevauchement (toléré)
  const c = Simulation.conflits(A, B2, DF, { tolChev: 2 });
  assert.strictEqual(c.jours, 0); assert.strictEqual(c.plages[0].tolere, true);
  assert.strictEqual(Simulation.conflits(A, B2, DF, { tolChev: 0 }).jours, 1);
  const B3 = 'RRRRRTTTRRRR'; // 1 jour où les deux sont en repos : un trou
  const t = Simulation.conflits(A, B3, DF);
  assert.strictEqual(t.jours, 1); assert.strictEqual(t.plages.find(p => p.type === 'trou').jours, 1);
  assert.strictEqual(Simulation.conflits(A, B3, DF, { tolTrou: 1 }).jours, 0);
});

test('proposition : met l\'agent en vis-à-vis d\'un collègue décalé', () => {
  const rA = { statut: 'T', depuis: '2026-09-01', jours_travail: 28, jours_repos: 28 };
  const rB = { statut: 'R', depuis: '2026-09-15', jours_travail: 28, jours_repos: 28 }; // décalé : en repos depuis le 15/09
  const dF = '2026-09-01', n = 240, debut = '2026-10-01';
  const offA = Planning.grille(rA, [], dF, n), gB = Planning.grille(rB, [], dF, n);
  const avant = Simulation.conflits(offA, gB, dF, { tolChev: 2, tolTrou: 0 }, Simulation.diff(dF, debut));
  assert.ok(avant.jours > 0, 'sans modification : conflits');
  const p = Simulation.proposer({ offA, gB, debutF: dF, rot: rA, debut, tolChev: 2, tolTrou: 0 });
  assert.ok(p.length > 0 && p[0].conflits.jours === 0, 'une proposition sans conflit existe');
  assert.strictEqual(Simulation.valider(p[0].modif, rA, '2026-10-01'), '');
  // la proposition appliquée via les corrections donne la même grille que la simulation
  assert.strictEqual(Planning.grille(rA, Simulation.corrections(p[0].modif), dF, n), p[0].grille);
});
