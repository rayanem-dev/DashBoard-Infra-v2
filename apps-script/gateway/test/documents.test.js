// Documents administratifs : chaque modèle se génère, échappe le HTML, préremplit depuis le profil et imprime des pointillés pour les cases vides.
const test = require('node:test');
const assert = require('node:assert');
const D = require('../../../js/documents-modeles.js');
const user = { nom: 'HADJADJ <b>Lamine</b>', matricule: '90856S', fonction: 'CHEF DIVISION INFRA', service: 'INFRASTRUCTURE', date_integration: '2005-03-01' };

test('25 modèles, identifiants uniques, catégories connues', () => {
  assert.strictEqual(D.modeles.length, 28);
  assert.strictEqual(new Set(D.modeles.map(m => m.id)).size, 28);
  const cats = D.categories.map(c => c.id);
  D.modeles.forEach(m => assert.ok(cats.includes(m.categorie), m.id));
});
test('chaque modèle se génère, vide ou prérempli, sans « undefined »', () => {
  D.modeles.forEach(m => {
    [{}, D.valeursInitiales(m, user, '2026-10-19')].forEach(v => {
      const h = D.rendre(m, v);
      assert.ok(h.includes('class="doc"') && h.includes('logo-sonatrach'), m.id);
      assert.ok(!/undefined|\[object|NaN/.test(h), m.id + ' : ' + (h.match(/.{20}(undefined|\[object|NaN).{20}/) || [''])[0]);
    });
  });
});
test('le profil préremplit et le HTML saisi est échappé', () => {
  const m = D.trouver('odm'), v = D.valeursInitiales(m, user, '2026-10-19');
  assert.strictEqual(v.date, '2026-10-19'); assert.strictEqual(v.fonction, 'CHEF DIVISION INFRA'); assert.match(v.ref, /2026$/);
  const h = D.rendre(m, v);
  assert.ok(h.includes('HADJADJ &lt;b&gt;Lamine&lt;/b&gt;') && !h.includes('<b>Lamine'));
  assert.ok(h.includes('19/10/2026'));
});
test('une case vide devient des pointillés', () => { assert.match(D.rendre(D.trouver('requete'), {}), /pt|ligne-pt/); });
test('hôtel : nuitées calculées entre les deux dates ; avance : montant formaté', () => {
  assert.match(D.rendre(D.trouver('hotel'), { du: '2026-08-29', au: '2026-09-11' }), />13</);
  assert.match(D.rendre(D.trouver('avance'), { montant: '30000' }), /30[\s  ]000 DA/);
});
test('compte rendu : génération jour par jour', () => {
  const c = D.trouver('compte-rendu-mission').champs.find(x => x.k === 'jours');
  const j = c.generer({ dep_date: '2025-09-13', retour_date: '2025-09-19' });
  assert.strictEqual(j.length, 7); assert.strictEqual(j[0].detail, 'Départ du domicile'); assert.strictEqual(j[6].detail, 'Retour vers le domicile');
  assert.deepStrictEqual(c.generer({}), []);
  const h = D.rendre(D.trouver('compte-rendu-mission'), { jours: [{ date: '2025-09-13', detail: 'x', heb: 'Avec prise en charge' }] });
  assert.ok(h.includes('13/09/2025'));
});
