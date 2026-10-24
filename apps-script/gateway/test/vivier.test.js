// Vivier : une seule carte au catalogue, page et aide présentes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
const lire = (...p) => fs.readFileSync(path.join(racine, ...p), 'utf8');

test('le catalogue n\'a plus qu\'une carte Vivier, vers vivier.html', () => {
  const src = lire('apps-script', 'gateway', 'Applications.gs');
  const seed = src.slice(src.indexOf('SEED_APPS'), src.indexOf('function ajouterApplicationsManquantes'));
  assert.strictEqual((seed.match(/"Vivier des Entreprises"/g) || []).length, 1);
  assert.ok(!/Inscription au Vivier/.test(seed));
  assert.ok(/"vivier\.html"/.test(seed));
});
test('la page Vivier est une vraie application (liste, ajout, modification, suppression) et non plus de simples liens', () => {
  const h = lire('vivier.html');
  ['vivier_liste', 'vivier_enregistrer', 'vivier_supprimer', 'vivier_synchroniser'].forEach(a => assert.ok(h.includes(a), a));
  assert.ok(!/docs\.google\.com\/spreadsheets/.test(h));
});
test('vivier : validation et déduplication', () => {
  const V = require('../Vivier.gs');
  assert.strictEqual(V.vivierTexte_(' — '), ''); assert.strictEqual(V.vivierTexte_('  A   B '), 'A B');
  assert.strictEqual(V.vivierCle_('S.A.R.L. Électro  Sud'), V.vivierCle_('electro sud'));
  assert.throws(() => V.vivierValider_({ nom: '' }), /obligatoire/);
  assert.throws(() => V.vivierValider_({ nom: 'X', email: 'pas-un-mail' }), /e-mail/);
  assert.strictEqual(V.vivierValider_({ nom: ' ETS  X ', email: 'A@B.DZ', fax: '—' }).email, 'a@b.dz');
  const rep = [['Horodateur', 'Nom', 'Type'], ['', 'ETS Neuf', 'BTP', '029', '', 'x@y.dz'], ['', 'Ets neuf', 'BTP'], ['', 'Déjà là'], ['', '—']];
  const n = V.vivierDepuisReponses_(rep, ['deja la']);
  assert.deepStrictEqual(n.map(x => x.nom), ['ETS Neuf']); assert.strictEqual(n[0].email, 'x@y.dz');
});

test('catégories : l\'action admin_rubrique n\'accepte que les familles du portail', () => {
  const main = lire('apps-script', 'gateway', 'Main.gs');
  const R = require(path.join(racine, 'js', 'rubriques.js'));
  const ids = /RUBRIQUES_IDS_ = \[([^\]]*)\]/.exec(main)[1].split(',').map(s => s.trim().replace(/'/g, ''));
  assert.deepStrictEqual(ids, R.definitions.map(d => d.id));
  assert.ok(/case 'admin_rubrique'/.test(main) && /'rubrique'\]?/.test(lire('apps-script', 'gateway', 'Setup.gs')));
});
