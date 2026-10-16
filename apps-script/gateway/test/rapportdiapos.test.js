const test = require('node:test'), assert = require('node:assert');
const { rdPlan_, rdNettoyer_ } = require('../RapportDiapos.gs');
const rap = { debut: '2026-10-10', fin: '2026-10-16', groupes: [{ titre: 'DAO et CF', dossiers: Array.from({ length: 8 }, (_, i) => ({ numero: 'N' + i, intitule: 'Dossier ' + i, pct: 10 * i + 5, commentaire: 'c' + i, change: i === 0 })) }, { titre: 'Autres', dossiers: [] }] };
test('nettoyage : groupes vides retirés, pourcentage borné, refus si aucun dossier', () => {
  const r = rdNettoyer_(Object.assign({}, rap, { groupes: rap.groupes.concat([{ titre: 'X', dossiers: [{ pct: 250 }] }]) }));
  assert.strictEqual(r.groupes.length, 2); assert.ok(r.groupes[1].dossiers[0].pct < 100);
  assert.throws(() => rdNettoyer_({ groupes: [{ titre: 'A', dossiers: [] }] }), /Aucun dossier/);
});
test('plan : 8 dossiers = 2 diapositives, tout reste dans la page 720 × 540, gras seulement pour le dossier modifié', () => {
  const plan = rdPlan_(rdNettoyer_(rap));
  assert.strictEqual(plan.length, 2);
  plan.forEach(d => d.elements.forEach(e => { assert.ok(e.x >= 0 && e.x + e.w <= 720 && e.y >= 0 && e.y + (e.h || 0) <= 540, JSON.stringify(e)); }));
  const com = plan[0].elements.filter(e => e.t === 'rect' && e.texte && /^c\d$/.test(e.texte));
  assert.deepStrictEqual(com.map(e => e.gras), [true, false, false, false, false, false]);
  assert.match(plan[0].note, /^diapos-cpm-auto semaine=2026-10-10/);
});
