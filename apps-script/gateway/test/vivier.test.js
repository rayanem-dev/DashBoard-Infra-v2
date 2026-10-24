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
  ['vivier_liste', 'vivier_enregistrer', 'vivier_supprimer'].forEach(a => assert.ok(h.includes(a), a));
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

test('vivier : lecture de la vraie feuille « Réponses au formulaire 3 » (titre + en-tête + lignes sales)', () => {
  const V = require('../Vivier.gs');
  const feuille = [
    ['', '', 'Ajout Entreprise'],
    ['Horodateur', 'Nom de l’entreprise', 'Type d’activité (Génie Civil, Hydrolique, Froid, etc.)', 'Téléphone', 'Autre Téléphone', 'E-mail', 'Autre E-mail', 'FAX', 'Adresse', 'Commentaire', 'Colonne 10'],
    ['08/10/2025 17:58:56', 'AB TRAVAUX BATIMENT', 'Bâtiment', '0561 54 99 62', '', 'ahmedboukhemila10@gmail.com', '', '—', '', '', ''],
    ['', 'ALL PSCINE', 'Rénovation piscines', '0661 38 77 05 / /', ' 0666 71 89 94', 'sarlallpiscines@yahoo.fr', '', '', '', '0661 44 08 72', ''],
    ['', 'Baya Smart Think', 'Rénovation piscines', '0555 52 66 26 / 0531 15 62 9', '', 'Ayoub.bayapiscine@gmail.com', '', '', '', '', ''],
    ['', 'BK PISCINE', 'Rénovation piscines', '0561 84 47 20', '', 'akrimo389@gmail.com', '', '', 'bkpiscine@gmail.com', '', ''],
    ['', 'EURL Atlas Sahariens Services Pétroliers', 'Services pétroliers', '0661 76 38 73', '0656 78 75 06', 'assp.algeria@gmail.com', '', '—', '', '/ 0661 39 76 13', ''],
    ['', 'EURL BIALCO', 'Travaux publics et hydraulique', '—', '', 'sarlbialco@gmail.com', '', '032 14 04 73', '', '', ''],
    ['', 'SARL ZIMO', 'Travaux divers (?)', '0660 45 50 66', '', 'sarlzimo.hmd@gmail.com', '', '', '', '', '']
  ];
  const r = V.vivierDepuisReponses_(feuille, []);
  assert.strictEqual(r.length, 7, 'ni le titre ni l\'en-tête ne deviennent des entreprises');
  assert.ok(!r.some(x => /entreprise/i.test(x.nom) && /Ajout|Nom de/.test(x.nom)));
  const par = n => r.find(x => x.nom === n);
  assert.deepStrictEqual([par('ALL PSCINE').telephone, par('ALL PSCINE').telephone2, par('ALL PSCINE').commentaire], ['0661 38 77 05', '0666 71 89 94', '0661 44 08 72']);
  assert.deepStrictEqual([par('Baya Smart Think').telephone, par('Baya Smart Think').telephone2], ['0555 52 66 26', '0531 15 62 9']);
  assert.deepStrictEqual([par('BK PISCINE').adresse, par('BK PISCINE').email2], ['', 'bkpiscine@gmail.com']);
  assert.strictEqual(par('EURL Atlas Sahariens Services Pétroliers').commentaire, '0661 39 76 13');
  assert.strictEqual(par('EURL BIALCO').telephone, ''); assert.strictEqual(par('EURL BIALCO').fax, '032 14 04 73');
  assert.strictEqual(par('SARL ZIMO').activite, 'Travaux divers'); assert.strictEqual(par('AB TRAVAUX BATIMENT').fax, '');
});
