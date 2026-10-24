// Règle « prestataire : seulement ses entreprises / contrats » (Badges et tout ce qui lui est ouvert).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
const Badges = require(path.join(racine, 'badges', 'badges.js'));
const Droits = require('../Droits.gs');

function charger(personnes) {
  const ctx = { Badges, Droits, console };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', 'Badges.gs'), 'utf8');
  vm.runInContext(src.slice(src.indexOf('/** Entreprises d\'un compte prestataire'), src.indexOf('function badgesDroit_')), ctx);
  return ctx;
}
test('portée : null pour tout autre rôle, liste normalisée pour un prestataire (plusieurs entreprises possibles)', () => {
  const c = charger();
  assert.strictEqual(c.badgesPortee_({ role: 'chef_service', portee: 'X' }), null);
  assert.deepStrictEqual(Array.from(c.badgesPortee_({ role: 'Prestataire', portee: 'ETB Zatout Abdenacer ; GLOBI CORP' })), ['etb zatout abdenacer', 'globi corp']);
  assert.deepStrictEqual(Array.from(c.badgesPortee_({ role: 'prestataire', portee: '' })), [], 'sans entreprise attribuée : rien du tout');
});
test('portée : une entreprise hors liste est refusée, la sienne passe (casse et accents ignorés)', () => {
  const c = charger(), p = c.badgesPortee_({ role: 'prestataire', portee: 'ETB Zatout Abdenacer' });
  assert.strictEqual(c.badgesDansPortee_(p, 'etb ZATOUT abdenacer'), true);
  assert.strictEqual(c.badgesDansPortee_(p, 'GLOBI CORP'), false);
  assert.strictEqual(c.badgesDansPortee_(null, 'GLOBI CORP'), true);
  assert.throws(() => c.badgesExigerPortee_(p, 'GLOBI CORP'), /ne fait pas partie de vos contrats/);
});
test('passerelle : un prestataire n\'atteint que les actions prévues pour lui', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'Main.gs'), 'utf8');
  const re = new RegExp(/var ACTIONS_PRESTATAIRE_ = (\/.*\/);/.exec(main)[1].slice(1, -1));
  ['menu', 'badges_donnees', 'badges_numeroter', 'changer_mdp'].forEach(a => assert.ok(re.test(a), a));
  ['badges_fiche', 'badges_enquetes_chercher', 'badges_enquetes_export', 'cpm_journal', 'vivier_liste', 'admin_etat', 'habilitations_donnees', 'planning', 'admin_portee'].forEach(a => assert.ok(!re.test(a), a));
});
