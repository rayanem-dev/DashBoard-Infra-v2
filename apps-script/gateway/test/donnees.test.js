// Lecture des feuilles de suivi par la passerelle : droits, format CSV, erreurs claires (faux services Google, vm).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function monde(options = {}) {
  const lignes = options.lignes || [['Titre', ''], ['Intitulé', 'Statut', 'Note'], ['Forage "A"', 'Attribué', 'a, b'], ['Ligne\nbis', '', '']];
  const cache = {};
  const ctx = {
    console,
    Auth: { userFromToken: t => { if (t === 'fin') throw new Error('Session expirée'); return { email: t }; } },
    acces_: u => options.niveaux && options.niveaux[u.email] || {},
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    SpreadsheetApp: { openById: id => {
      if (options.illisible) throw new Error('Impossible d\'ouvrir');
      ctx.__ouvertures = (ctx.__ouvertures || 0) + 1;
      return { getSheets: () => [{ getSheetId: () => 111, getDataRange: () => ({ getDisplayValues: () => [['autre']] }) }, { getSheetId: () => options.gid || 1963142469, getDataRange: () => ({ getDisplayValues: () => lignes }) }], getSheetByName: () => null };
    } },
  };
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(__dirname, '..', 'Donnees.gs'), 'utf8');
  vm.runInContext(code, ctx, { filename: 'Donnees.gs' });
  return { ctx, run: (req) => { ctx.__req = req; return vm.runInContext('donneesCsv_(__req)', ctx); }, ouvertures: () => ctx.__ouvertures || 0 };
}

test('CSV : guillemets, virgules et retours à la ligne protégés ; format relisible', () => {
  const m = monde({ niveaux: { 'a@x': { cpm: 1 } } });
  const r = m.run({ token: 'a@x', source: 'cpm' });
  assert.strictEqual(r.csv, 'Titre,\nIntitulé,Statut,Note\n"Forage ""A""",Attribué,"a, b"\n"Ligne\nbis",,');
});
test('droits : sans module requis → refus ; module pilotage accepté pour le CPM ; niveau 0 refusé', () => {
  const m = monde({ niveaux: { 'a@x': { rh: 3 }, 'b@x': { pilotage: 1 }, 'c@x': { cpm: 0 } } });
  assert.throws(() => m.run({ token: 'a@x', source: 'cpm' }), /Droits insuffisants/);
  assert.throws(() => m.run({ token: 'c@x', source: 'cpm' }), /Droits insuffisants/);
  assert.ok(m.run({ token: 'b@x', source: 'cpm' }).csv);
});
test('un chantier exige le module pilotage (le CPM seul ne suffit pas)', () => {
  const m = monde({ niveaux: { 'a@x': { cpm: 3 } }, gid: 1809509458 });
  assert.throws(() => m.run({ token: 'a@x', source: 'forage' }), /Droits insuffisants/);
});
test('source inconnue, session expirée, feuille illisible : messages clairs', () => {
  assert.throws(() => monde().run({ token: 'a@x', source: 'zzz' }), /Source de données inconnue/);
  assert.throws(() => monde().run({ token: 'fin', source: 'cpm' }), /Session expirée/);
  const m = monde({ niveaux: { 'a@x': { cpm: 1 } }, illisible: true });
  assert.throws(() => m.run({ token: 'a@x', source: 'cpm' }), /n'est pas lisible par la passerelle/);
});
test('onglet introuvable ; deuxième lecture servie par le cache', () => {
  const m = monde({ niveaux: { 'a@x': { cpm: 1 } }, gid: 5 });
  assert.throws(() => m.run({ token: 'a@x', source: 'cpm' }), /Onglet introuvable/);
  const n = monde({ niveaux: { 'a@x': { cpm: 1 } } });
  n.run({ token: 'a@x', source: 'cpm' }); const r2 = n.run({ token: 'a@x', source: 'cpm' });
  assert.strictEqual(n.ouvertures(), 1); assert.strictEqual(r2.cache, true);
});
