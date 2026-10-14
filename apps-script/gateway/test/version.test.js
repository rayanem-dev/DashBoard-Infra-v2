// Garde-fou : js/version.js doit toujours contenir PORTAIL_VERSION (le déploiement du site en dépend) et correspondre à version.json.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
test('version du portail lisible et cohérente', () => {
  const m = fs.readFileSync(path.join(racine, 'js', 'version.js'), 'utf8').match(/PORTAIL_VERSION = '([^']+)'/);
  assert.ok(m, 'js/version.js ne définit plus PORTAIL_VERSION');
  assert.match(m[1], /^\d+\.\d+\.\d+$/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(racine, 'version.json'), 'utf8')).version, m[1]);
  const log = JSON.parse(fs.readFileSync(path.join(racine, 'changelog.json'), 'utf8'));
  assert.match(log[0].title, new RegExp('Version ' + m[1].replace(/\.0$/, '').replace(/\./g, '\\.')), 'la première entrée des nouveautés doit annoncer la version publiée');
});
