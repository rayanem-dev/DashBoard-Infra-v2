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
test('la page Vivier a ses deux onglets et le lien du formulaire', () => {
  const h = lire('vivier.html');
  assert.ok(/id="p-base"/.test(h) && /id="p-insc"/.test(h) && /forms\/d\/1l-6f3oqFmToPe7MFd78wq6gxfcrw2rZNrNntVR1k2FY\/viewform/.test(h));
});
