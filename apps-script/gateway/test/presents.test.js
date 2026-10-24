// Prestataires présents sur site d'après les prises en charge : séjours (entrée / sortie), 28 jours par défaut, option « toutes les entrées ».
const test = require('node:test');
const assert = require('node:assert');
const { presentsCalculer_, presentsSejours_, presentsDate_ } = require('../Presents.gs');
const entrepriseDe = p => String(p || '').split(' - ')[1] || '', contratDe = p => String(p || '').split(' - ')[0].trim();

test('dates lues : jj/mm/aaaa, aaaa-mm-jj, objet Date ; le reste est vide', () => {
  assert.strictEqual(presentsDate_('07/10/2026'), '2026-10-07'); assert.strictEqual(presentsDate_('2026-10-07 14:30'), '2026-10-07'); assert.strictEqual(presentsDate_(new Date(2026, 9, 7)), '2026-10-07');
  assert.strictEqual(presentsDate_('à compléter'), '');
});
const L = [
  { date: '2026-10-01 09:00', prestataire: '2.INFRA.26 - B SPA - Génie civil', base: 'BASE CENTRALE', documents: 'PEC+Autorisation', nom: 'ZED', prenom: 'Ali', arrivee: '2026-10-02', depart: '2026-10-10' },
  { date: '2026-10-01 09:00', prestataire: '2.INFRA.26 - B SPA - Génie civil', base: 'BASE CENTRALE', documents: 'PEC', nom: 'ABD', prenom: 'Omar', arrivee: '2026-10-02', depart: '' },
  { date: '2026-09-01 09:00', prestataire: '1.INFRA.26 - A SARL - Forage', base: 'BASE ZINA', documents: 'PEC', nom: 'LONG', prenom: 'Sam', arrivee: '', depart: '' },
  { date: '2026-10-01 09:00', prestataire: '1.INFRA.26 - A SARL - Forage', base: '', documents: 'Autorisation', nom: 'SANSPEC', prenom: 'X', arrivee: '2026-10-02', depart: '2026-10-05' }
];
test('séjours : seules les prises en charge hébergées ; départ absent = entrée + 28 jours ; ancienne ligne = date de la demande', () => {
  const s = presentsSejours_(L, entrepriseDe, contratDe);
  assert.deepStrictEqual(s.map(x => [x.nom, x.entree, x.sortie, x.sortie_defaut]), [['ZED', '2026-10-02', '2026-10-10', false], ['ABD', '2026-10-02', '2026-10-30', true], ['LONG', '2026-09-01', '2026-09-29', true]]);
  assert.strictEqual(s[0].entreprise, 'B SPA'); assert.strictEqual(s[0].contrat, '2.INFRA.26');
});
test('présents à D : entrée ≤ D ≤ sortie ; prise en charge expirée non affichée ; option « toutes les entrées »', () => {
  const s = presentsSejours_(L, entrepriseDe, contratDe);
  const a = presentsCalculer_(s, '2026-10-12');
  assert.deepStrictEqual(a.entreprises.map(e => [e.entreprise, e.personnes.map(p => p.nom)]), [['B SPA', ['ABD']]]);   // ZED parti le 10, LONG sorti le 29/09
  assert.deepStrictEqual(a.exclus, { sorti: 2, avant: 0, hors_plage: 0, autre_base: 0 });
  const t = presentsCalculer_(s, '2026-10-12', { toutes: true });
  assert.deepStrictEqual(t.entreprises.map(e => e.personnes.map(p => p.nom)), [['LONG'], ['ABD', 'ZED']]); assert.strictEqual(t.total, 3);
  const av = presentsCalculer_(s, '2026-09-15'); assert.deepStrictEqual(av.entreprises.map(e => e.entreprise), ['A SARL']); assert.strictEqual(av.exclus.avant, 2);
});
test('filtres : période d\'entrée, base ; une personne revenue n\'apparaît qu\'une fois (séjour le plus récent)', () => {
  const s = presentsSejours_(L.concat([{ date: '2026-10-11', prestataire: '2.INFRA.26 - B SPA - Génie civil', base: 'BASE ZINA', documents: 'PEC', nom: 'ZED', prenom: 'Ali', arrivee: '2026-10-11', depart: '2026-11-01' }]), entrepriseDe, contratDe);
  const r = presentsCalculer_(s, '2026-10-12', { toutes: true });
  const zed = r.entreprises.filter(e => e.entreprise === 'B SPA')[0].personnes.filter(p => p.nom === 'ZED'); assert.strictEqual(zed.length, 1); assert.strictEqual(zed[0].entree, '2026-10-11'); assert.strictEqual(zed[0].base, 'BASE ZINA');
  assert.strictEqual(presentsCalculer_(s, '2026-10-12', { base: 'BASE ZINA' }).total, 1);
  assert.strictEqual(presentsCalculer_(s, '2026-10-12', { toutes: true, regDu: '2026-10-11' }).total, 1);
});

test('habilitations : colonnes personnelles réservées au niveau 2', () => {
  const { habColonnesVisibles_ } = require('../Habilitations.gs');
  const n1 = habColonnesVisibles_(1).map(c => c.id), n2 = habColonnesVisibles_(2).map(c => c.id);
  assert.ok(n1.includes('nom') && n1.includes('date_pec') && n1.includes('base')); assert.ok(!n1.includes('nin') && !n1.includes('adresse') && !n1.includes('tel'));
  assert.ok(n2.includes('nin') && n2.includes('adresse') && n2.includes('naiss'));
});
