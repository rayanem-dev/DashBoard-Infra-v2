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

test('proposition pour les DEUX agents : par semaine, depuis la relève, sans conflit, transition minimale', () => {
  const rA = { statut: 'T', depuis: '2026-09-01', jours_travail: 28, jours_repos: 28 };
  const rB = { statut: 'T', depuis: '2026-09-11', jours_travail: 28, jours_repos: 28 }; // décalé de 10 jours : relèves à des jours de semaine différents
  const dF = '2026-09-01', n = 300, debut = '2026-10-05';
  const offA = Planning.grille(rA, [], dF, n), offB = Planning.grille(rB, [], dF, n);
  const base = { offA, offB, debutF: dF, rotA: rA, rotB: rB, debut, tolChev: 2, tolTrou: 0 };
  const sem = Simulation.proposerPaire(Object.assign({ pas: 7, alignerReleve: true }, base));
  assert.ok(sem.length > 0);
  for (const p of sem) {
    for (const [m, g, off, rot] of [[p.A, p.grilleA, offA, rA], [p.B, p.grilleB, offB, rB]]) {
      if (!m) continue;
      assert.strictEqual(Simulation.valider(m, rot, null), '');
      assert.strictEqual(g, Simulation.appliquer(off, dF, m, rot), 'la grille proposée = la modification appliquée');
      assert.ok(m.periodes.every(x => x.jours % 7 === 0), 'ajustement par semaine');
      assert.strictEqual(m.debut, Simulation.addDays(dF, Simulation.prochaineReleve(off, Simulation.diff(dF, debut))), 'depuis la relève');
    }
    assert.strictEqual(p.conflits, Simulation.conflits(p.grilleA, p.grilleB, dF, { tolChev: 2, tolTrou: 0 }, Simulation.diff(dF, p.depuis)).jours);
    assert.strictEqual(p.depuis, debut, 'le vis-à-vis est évalué depuis la date choisie');
  }
  // le meilleur résultat commun n'est jamais plus long que le meilleur résultat obtenu en ne modifiant qu'UN agent
  const seulA = Simulation.proposerPaire(Object.assign({ pas: 7, alignerReleve: true }, base, { offB: offB })).filter(p => p.agents === 1 && p.A);
    // au jour près : permet des durées non multiples de 7
  const jour = Simulation.proposerPaire(Object.assign({ pas: 1, alignerReleve: false }, base));
  assert.ok(jour[0].conflits <= sem[0].conflits);
});

test('reliquat concédé = jours de travail en plus (+) ou de repos en plus (−), au pic ; classement du moins au plus concédé', () => {
  const rA = { statut: 'T', depuis: '2026-10-11', jours_travail: 28, jours_repos: 28 };
  const off = Planning.grille(rA, [], '2026-09-14', 200);          // T jusqu'au 07/11, R 08/11→05/12, T 06/12→02/01…
  const r = m => Simulation.reliquat(off, Simulation.appliquer(off, '2026-09-14', m, rA), '2026-09-14', m);
  assert.strictEqual(r({ debut: '2026-11-08', periodes: [{ type: 'T', jours: 7 }], reprise: 'R' }), 7, 'travaille 7 j de plus puis son congé habituel de 28 j');
  assert.strictEqual(r({ debut: '2026-11-08', periodes: [{ type: 'R', jours: 7 }], reprise: 'T' }), 21, 'congé écourté : 7 j pris sur 28, donc 21 j de congé cédés');
  assert.strictEqual(r({ debut: '2026-11-08', periodes: [{ type: 'R', jours: 35 }], reprise: 'T' }), -7, 'congé rallongé de 7 j');
  assert.strictEqual(Simulation.reliquat(off, off, '2026-09-14', null), 0);
  assert.strictEqual(r({ debut: '2026-11-26', periodes: [{ type: 'R', jours: 7 }], reprise: 'T' }), 3, 'départ en milieu de congé : il en restait 10 j, écourté à 7 j : +3');
  assert.strictEqual(r({ debut: '2026-11-08', periodes: [{ type: 'T', jours: 7 }, { type: 'R', jours: 7 }], reprise: 'T' }), 21, 'deux périodes : 7 j de travail puis congé écourté à 7 j');
  // 4×4 : congé terminé, le suivant est du travail ; on prolonge le congé de 7 j à la maison : −7
  assert.strictEqual(r({ debut: '2026-11-08', periodes: [{ type: 'T', jours: 28 }, { type: 'R', jours: 28 }], reprise: 'T' }), 28, 'travail en plus puis repos en plus : le pic (+28) reste concédé, pas 0');
  assert.strictEqual(r({ debut: '2026-12-06', periodes: [{ type: 'R', jours: 28 }, { type: 'T', jours: 28 }], reprise: 'R' }), -28, 'repos en plus puis travail en plus : −28');
  const r4 = { statut: 'T', depuis: '2026-10-01', jours_travail: 4, jours_repos: 4 }, off4 = Planning.grille(r4, [], '2026-09-14', 200);
  const m4 = { debut: '2026-10-09', periodes: [{ type: 'R', jours: 7 }], reprise: 'T' };
  assert.strictEqual(Simulation.reliquat(off4, Simulation.appliquer(off4, '2026-09-14', m4, r4), '2026-09-14', m4), -7, 'congé prolongé de 7 j : −7');
  const rB = { statut: 'T', depuis: '2026-10-25', jours_travail: 28, jours_repos: 28 };
  const offB = Planning.grille(rB, [], '2026-09-14', 200);
  const res = Simulation.proposerPaire({ offA: off, offB, debutF: '2026-09-14', rotA: rA, rotB: rB, debut: '2026-11-01', tolChev: 2, tolTrou: 0, pas: 7, alignerReleve: true });
  const sansConflit = res.filter(x => x.conflits === 0);
  for (let i = 1; i < sansConflit.length; i++) assert.ok(sansConflit[i - 1].concession <= sansConflit[i].concession, 'classés par reliquat croissant');
  for (const x of res) assert.strictEqual(x.concession, Math.abs(x.reliquatA) + Math.abs(x.reliquatB));
});

test('priorités des propositions : 1) vis-à-vis établi au plus tôt, 2) moins de reliquat ; préférence de signe ; transition limitée', () => {
  const r = { statut: 'T', depuis: '2026-10-11', jours_travail: 28, jours_repos: 28 }, dF = '2026-09-14';
  const off = Planning.grille(r, [], dF, 400);
  const base = { offA: off, offB: off, debutF: dF, rotA: r, rotB: r, debut: '2026-11-08', tolChev: 2, tolTrou: 0, pas: 7, alignerReleve: true, maxTotal: 28 };
  const res = Simulation.proposerPaire(base);
  assert.ok(res.length > 0 && res.every(p => p.A || p.B), 'jamais « aucune modification »');
  assert.ok(res.every(p => p.stable && p.etabliLe === '2026-11-08'), 'vis-à-vis établi dès la date choisie');
  for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].etabliLe < res[i].etabliLe || res[i - 1].pire <= res[i].pire, 'le plus fort reliquat atteint est classé en dernier');
  assert.strictEqual(Math.min(...res.map(p => p.concession)), 28, 'phases identiques : décaler d\'un demi-cycle coûte 28 j au total, au mieux');
  // deux semaines de transition au maximum : on ne propose rien de plus long
  assert.ok(Simulation.proposerPaire(Object.assign({}, base, { maxTotal: 14 })).every(p => (p.A ? Simulation.totalJours(p.A) : 0) <= 14 && (p.B ? Simulation.totalJours(p.B) : 0) <= 14));
  // phases identiques : décaler d'un demi-cycle sans faire travailler personne en plus est impossible dans cette limite
  assert.strictEqual(Simulation.proposerPaire(Object.assign({}, base, { preference: 'negatif' })).length, 0);
  // « congés prolongés seulement » avec des rotations décalées : des propositions existent, aucun reliquat positif
  const rB = { statut: 'T', depuis: '2026-11-01', jours_travail: 28, jours_repos: 28 }, offB = Planning.grille(rB, [], dF, 400);
  const neg = Simulation.proposerPaire(Object.assign({}, base, { offB, rotB: rB, preference: 'negatif', maxTotal: 56 }));
  assert.ok(neg.length > 0 && neg.every(p => p.reliquatA <= 0 && p.reliquatB <= 0), 'aucun reliquat positif');
  const pos = Simulation.proposerPaire(Object.assign({}, base, { preference: 'positif' }));
  assert.ok(pos.length > 0 && pos.every(p => p.reliquatA >= 0 && p.reliquatB >= 0));
});

test('à vis-à-vis égal, le plus fort reliquat atteint est classé en dernier (14/14 avant 28/0)', () => {
  const r = { statut: 'T', depuis: '2026-10-11', jours_travail: 28, jours_repos: 28 }, dF = '2026-09-14', off = Planning.grille(r, [], dF, 400);
  const res = Simulation.proposerPaire({ offA: off, offB: off, debutF: dF, rotA: r, rotB: r, debut: '2026-11-08', tolChev: 2, tolTrou: 0, pas: 7, alignerReleve: true, maxTotal: 28, max: 50 });
  const i1414 = res.findIndex(p => p.pire === 14 && p.concession === 28), i280 = res.findIndex(p => p.pire === 28 && p.concession === 28);
  assert.ok(i1414 >= 0 && i280 >= 0 && i1414 < i280, '14/14 avant 28/0');
});
