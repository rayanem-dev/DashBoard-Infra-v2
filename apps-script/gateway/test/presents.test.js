// Prestataires présents sur site : dates, fin de contrat, filtrage par date.
const test = require('node:test');
const assert = require('node:assert');
const { presentsCalculer_, presentsDate_, presentsFinContrat_ } = require('../Presents.gs');

test('dates lues : jj/mm/aaaa, aaaa-mm-jj, objet Date ; le reste est vide', () => {
  assert.strictEqual(presentsDate_('07/10/2026'), '2026-10-07'); assert.strictEqual(presentsDate_('2026-10-07'), '2026-10-07'); assert.strictEqual(presentsDate_('7.1.26'), '2026-01-07');
  assert.strictEqual(presentsDate_(new Date(2026, 9, 7)), '2026-10-07'); assert.strictEqual(presentsDate_('à compléter'), ''); assert.strictEqual(presentsDate_(''), '');
});
test('fin de contrat : échéance indiquée, sinon ODS + durée en mois (ou en jours au-delà de 60), moins un jour', () => {
  assert.strictEqual(presentsFinContrat_('31/12/2026', '', ''), '2026-12-31');
  assert.strictEqual(presentsFinContrat_('', '01/01/2026', '12'), '2026-12-31');
  assert.strictEqual(presentsFinContrat_('', '01/01/2026', '90'), '2026-03-31');
  assert.strictEqual(presentsFinContrat_('', '', '12'), '');
});
const G = [
  { entreprise: 'B SPA', contrat: '2.INFRA.26', debut: '2026-01-01', fin: '2026-12-31', personnes: [{ nom: 'ZED', prenom: 'Ali', date_enreg: '10/03/2026' }, { nom: 'ABD', prenom: 'Omar', date_enreg: '' }, { nom: 'LATE', prenom: 'X', date_enreg: '01/11/2026' }] },
  { entreprise: 'A SARL', contrat: '1.INFRA.25', debut: '2025-01-01', fin: '2025-12-31', personnes: [{ nom: 'OLD', prenom: 'Y', date_enreg: '01/02/2025' }] },
  { entreprise: 'C', contrat: '', personnes: [{ nom: 'SANS', prenom: 'Contrat', date_enreg: '01/01/2026' }] }
];
test('présents à une date : date d\'enregistrement, contrat en cours, tri par entreprise puis par nom', () => {
  const r = presentsCalculer_(G, '2026-10-07');
  assert.deepStrictEqual(r.entreprises.map(e => e.entreprise), ['B SPA', 'C']);
  assert.deepStrictEqual(r.entreprises[0].personnes.map(p => p.nom), ['ABD', 'ZED']);   // LATE enregistré après la date : absent
  assert.deepStrictEqual(r.exclus, { apres: 1, sans_date: 0, contrat: 1 }); assert.strictEqual(r.total, 3);
  const a = presentsCalculer_(G, '2025-06-01'); assert.deepStrictEqual(a.entreprises.map(e => e.entreprise), ['A SARL', 'C'].filter(x => x !== 'C'), 'contrat 2026 pas commencé, et C enregistré en 2026');
});
test('options : sans date exclus ; contrat non contrôlé', () => {
  const r = presentsCalculer_(G, '2026-10-07', { sansDate: false }); assert.deepStrictEqual(r.entreprises[0].personnes.map(p => p.nom), ['ZED']); assert.strictEqual(r.exclus.sans_date, 1);
  const s = presentsCalculer_(G, '2026-10-07', { contratValide: false }); assert.ok(s.entreprises.some(e => e.entreprise === 'A SARL'));
});
