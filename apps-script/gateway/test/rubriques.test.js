// Rubriques du portail : chaque carte du catalogue a une rubrique, le regroupement ne perd ni ne double aucune carte et ne touche pas aux droits.
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs'), path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
const R = require(path.join(racine, 'js', 'rubriques.js'));
const seed = fs.readFileSync(path.join(__dirname, '..', 'Applications.gs'), 'utf8');
const lignes = [...seed.matchAll(/\[\s*"([a-z_]+)",\s*"([^"]+)"/g)].map(m => ({ module: m[1], titre: m[2] }));

test('chaque carte du catalogue a une rubrique', () => {
  assert.ok(lignes.length > 40);
  const sans = lignes.filter(l => !R.rubriqueDe({ titre: l.titre })).map(l => l.module + ' : ' + l.titre);
  assert.deepStrictEqual(sans, []);
});
test('placements voulus', () => {
  const r = t => R.rubriqueDe({ titre: t });
  assert.strictEqual(r('Prises en Charge + Autorisation d\'Accès'), 'acces'); assert.strictEqual(r('Enquêtes Administratives'), 'acces'); assert.strictEqual(r('Bon de sortie matériel'), 'acces');
  assert.strictEqual(r('Statistiques Sous-traitants – Avril 2026'), 'marches'); assert.strictEqual(r('Fiche d\'évaluation'), 'marches');
  assert.strictEqual(r('Simulation de planning'), 'personnel'); assert.strictEqual(r('Vidéos Formation SAP'), 'personnel');
  assert.strictEqual(r('Veste en Cuir – Personnel Actif RNS'), 'logistique'); assert.strictEqual(r('Repas à emporter'), 'logistique');
  assert.strictEqual(r('Contrôle de l\'annuaire'), 'it'); assert.strictEqual(r('Documents administratifs'), 'admin');
  assert.strictEqual(R.rubriqueDe({ titre: 'x', rubrique: 'it' }), 'it', 'la colonne du catalogue a la priorité');
});
test('regroupement : aucune carte perdue ni doublée, ordre des rubriques fixe, carte inconnue sous son module', () => {
  const menu = [{ id: 'logistique', titre: 'Logistique', icone: '🚛', apps: [{ titre: 'Dotation Vivres', url: 'a' }, { titre: 'Prises en Charge', url: 'b' }, { titre: 'Truc inconnu', url: 'c' }] },
    { id: 'cpm', titre: 'CPM', apps: [{ titre: 'Suivi CPM V5', url: 'd' }, { titre: 'Dotation Vivres', url: 'a' }] }];
  const g = R.regrouper(menu);
  assert.deepStrictEqual(g.map(x => x.id), ['marches', 'acces', 'logistique', 'autres-logistique']);
  assert.strictEqual(g.reduce((n, x) => n + x.apps.length, 0), 4);
  assert.ok(g.every(x => x.niveau === 0));
  assert.ok(R.regrouper([]).length === 0);
});
test('mots de recherche supplémentaires', () => { assert.match(R.motsCles({ titre: 'Repas à emporter' }), /casse croute/); });
