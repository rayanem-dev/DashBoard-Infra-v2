// Aide : chaque entrée est complète, ses captures existent, et chaque page du portail équipée du pied commun a son aide.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
const sandbox = {}; new Function('window', fs.readFileSync(path.join(racine, 'js', 'aide-data.js'), 'utf8'))(sandbox);
const AIDE = sandbox.AIDE;
test('chaque entrée a titre, résumé, pas à pas et capture existante', () => {
  Object.entries(AIDE).forEach(([k, d]) => {
    assert.ok(d.titre && d.resume, k); assert.ok(Array.isArray(d.etapes) && d.etapes.length, k + ' : pas à pas');
    if (d.img) assert.ok(fs.existsSync(path.join(racine, 'img', 'aide', d.img + '.jpg')), k + ' : capture manquante');
  });
});
test('chaque page du portail avec pied commun a une aide', () => {
  const sansAide = fs.readdirSync(racine).filter(f => /\.html$/.test(f) && fs.readFileSync(path.join(racine, f), 'utf8').includes('js/pied.js') && !AIDE[f.toLowerCase()]);
  assert.deepStrictEqual(sansAide, []);
});
test('chaque application Apps Script a une aide (clé = data-nom)', () => {
  const dossiers = ['dotation', 'commande-pieces', 'requete-transport', 'bon-sortie', 'prise-en-charge', 'fiche-evaluation'];
  dossiers.forEach(d => fs.readdirSync(path.join(racine, 'apps-script', d)).filter(f => f.endsWith('.html')).forEach(f => {
    const m = fs.readFileSync(path.join(racine, 'apps-script', d, f), 'utf8').match(/pied\.js" data-nom="([^"]+)"/);
    if (m) assert.ok(AIDE[m[1]], d + ' : aide « ' + m[1] + ' » manquante');
  }));
});
