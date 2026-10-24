// Nouveau rôle « Stagiaire » (lecture seule) et bouton « Ajouter un utilisateur » de Privilèges.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Droits = require('../Droits.gs');

test('stagiaire : rôle reconnu, plafonné au niveau 1, sans sécurité / RH / admin / badges', () => {
  assert.strictEqual(Droits.roleCanon('Stagiaire'), 'stagiaire');
  assert.ok(Droits.verifier('stagiaire', 2, 'planning'), 'niveau 2 refusé');
  assert.strictEqual(Droits.verifier('stagiaire', 1, 'planning'), '');
  assert.ok(Droits.verifier('stagiaire', 1, 'badges'));
});
test('l\'action admin_utilisateur_ajouter est réservée à l\'administrateur et refuse un doublon', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'Main.gs'), 'utf8');
  const bloc = main.slice(main.indexOf("case 'admin_utilisateur_ajouter'"), main.indexOf("case 'admin_actif'"));
  assert.ok(/admin_\(req\)/.test(bloc) && /existe déjà/.test(bloc) && /Droits\.verifier/.test(bloc));
});
