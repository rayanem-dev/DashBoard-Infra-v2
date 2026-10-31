// Garde-fou : tout le JavaScript du site doit COMPILER (un commentaire « // » collé au milieu d'une ligne ou une accolade oubliée casse tout le fichier, donc toute la page).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const racine = path.join(__dirname, '..', '..', '..');
const echecs = [];
function compiler(nom, code) { try { new vm.Script(code, { filename: nom }); } catch (e) { echecs.push(nom + ' : ' + e.message); } }

test('chaque fichier js/*.js du site compile', () => {
  fs.readdirSync(path.join(racine, 'js')).filter(f => f.endsWith('.js')).forEach(f => compiler('js/' + f, fs.readFileSync(path.join(racine, 'js', f), 'utf8')));
  assert.deepStrictEqual(echecs, []);
});
test('chaque script intégré aux pages HTML du site compile', () => {
  fs.readdirSync(racine).filter(f => f.endsWith('.html')).forEach(f => {
    const h = fs.readFileSync(path.join(racine, f), 'utf8'); let i = 0;
    for (const m of h.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/json|application\/ld\+json|text\/template)")[^>]*>([\s\S]*?)<\/script>/gi)) { i += 1; if (m[1].trim()) compiler(f + ' (script ' + i + ')', m[1]); }
  });
  assert.deepStrictEqual(echecs, []);
});
