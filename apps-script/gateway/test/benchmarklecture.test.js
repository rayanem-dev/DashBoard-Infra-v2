// node --test apps-script/gateway/test/benchmarklecture.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../../../js/banchy.js').Lecture;
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

test('PDF texte : l\'offre financière (N°, unité, quantité, PU, montant, total) est lue en entier', () => {
  const r = L.depuisTexte(fx('benchmark-offre.txt'));
  assert.strictEqual(r.mode, 3); assert.strictEqual(r.total, 49495000); assert.strictEqual(r.articles.length, 6);
  assert.deepStrictEqual(r.articles.map(a => [a.n.replace(/^0/, ''), a.u, a.qte, a.pu, a.montant]), [['1', 'M2', 5000, 738, 3690000], ['2', 'M2', 5000, 1000, 5000000], ['3', 'M2', 2000, 400, 800000], ['4', 'M2', 6500, 5170, 33605000], ['5', 'U', 200, 2000, 400000], ['I.4.4', 'Ml', 5000, 1200, 6000000]]);
  assert.ok(r.articles.every(a => !a.verifier));
});
test('PDF texte : chaque désignation est celle de son article (lignes avant et après le N° réparties)', () => {
  const a = L.depuisTexte(fx('benchmark-offre.txt')).articles;
  assert.ok(/^Décapage et dépose/.test(a[0].des) && /mise en oeuvre$/.test(a[0].des) && !/forme de pente/.test(a[0].des));
  assert.ok(/^realisation d'une forme de pente/.test(a[1].des) && /pontage/.test(a[1].des) && /chappe au mortier de ciment et compris/.test(a[1].des));
  assert.ok(/^Fourniture et pose/.test(a[3].des) && /1er choix$/.test(a[3].des));
  assert.ok(/^F\/P Gargouille/.test(a[4].des) && /de pluie$/.test(a[4].des));
  assert.strictEqual(a[5].des, 'Protection lourde en gravier roulé EP 5 cm');   // ni titre ni montant en lettres
});
test('canevas d\'une région (prix unitaire seul, scan lu par OCR) : mode 1, milliers espacés', () => {
  const r = L.depuisTexte(fx('benchmark-region-hmd.txt'));
  assert.strictEqual(r.mode, 1); assert.deepStrictEqual(r.articles.map(a => a.n), ['01', '02', '03', '04', '05', '06']);
  assert.deepStrictEqual(r.articles.map(a => a.pu), [1200, 10000, 10500, 5600, 2000, 550]);
  assert.deepStrictEqual(r.articles.map(a => a.u), ['M²', 'M²', 'M²', 'M²', 'U', 'M²']);
  assert.ok(/^Décapage/.test(r.articles[0].des) && /sujétions de mise en œuvre\.$/.test(r.articles[0].des));
  assert.ok(/^Fourniture et pose/.test(r.articles[3].des) && /1er choix\.$/.test(r.articles[3].des) && !/Gargouille/.test(r.articles[3].des));
});
test('courrier d\'une région : contrat, année, courrier, région, date', () => {
  const m = L.metadonnees(fx('benchmark-region-hmd.txt'));
  assert.strictEqual(m.contrat, '39/LOG-HMD/2023'); assert.strictEqual(m.annee, 2023); assert.strictEqual(m.courrier, '225/SH/E&P/HMD/LOG/2026'); assert.strictEqual(m.region, 'Hassi-Messaoud');
  const c = L.metadonnees('Objet : Normativité des prix\nRéf : CF N° 38/SH-PROD/RNS/INFRA/2026.\nRhourde Nouss, le 08/10/2026');
  assert.strictEqual(c.reference, 'CF N° 38/SH-PROD/RNS/INFRA/2026'); assert.strictEqual(c.date, '2026-10-08');
});
test('nombres coupés par les espaces des milliers', () => {
  assert.ok(L.segmentations(['3', '690', '000,00']).some(r => r.length === 1 && r[0] === 3690000));
  assert.ok(L.segmentations(['1', '200,00']).some(r => r.length === 1 && r[0] === 1200));
  assert.ok(!L.segmentations(['000,00']).length);
  assert.strictEqual(L.nombre('5 170,00 DA'), 5170);
});
test('tableur : votre ancien benchmark.xlsx est relu (articles, prix de l\'offre, 3 colonnes de régions avec contrat et année)', () => {
  const r = L.depuisTableau(JSON.parse(fx('benchmark-tableur.json')));
  assert.strictEqual(r.articles.length, 6); assert.deepStrictEqual(r.articles.map(a => a.pu), [738, 1000, 400, 5170, 2000, 1200]); assert.deepStrictEqual(r.articles.map(a => a.qte), [5000, 5000, 2000, 6500, 200, 5000]);
  assert.strictEqual(r.articles[5].n, 'I.4.4');
  assert.strictEqual(r.offres.length, 3); assert.deepStrictEqual(r.offres.map(o => o.annee), [2023, 2026, 2022]);
  assert.deepStrictEqual(r.offres[0].prix, [1200, 10000, 10500, 5600, 2000, 550]); assert.deepStrictEqual(r.offres[1].prix, [null, 1600, 600, null, 1200, 800]);
  assert.strictEqual(r.offres[2].contrat, 'I/37/HAMRA/2022');
});
test('rapprochement avec l\'offre : par N° (01 = 1), puis par désignation (I.4.4 ↔ 06), puis par ordre', () => {
  const offre = L.depuisTexte(fx('benchmark-offre.txt')).articles, lus = L.depuisTexte(fx('benchmark-region-hmd.txt')).articles;
  const m = L.rapprocher(offre, lus);
  assert.deepStrictEqual(m.map(x => x.i), [0, 1, 2, 3, 4, 5]); assert.deepStrictEqual(m.map(x => x.methode), ['n°', 'n°', 'n°', 'n°', 'n°', 'désignation']);
  const ordre = L.rapprocher([{ n: 'a', des: 'xx' }, { n: 'b', des: 'yy' }], [{ n: '', des: 'qq' }, { n: '', des: 'rr' }]);
  assert.deepStrictEqual(ordre.map(x => x.methode), ['ordre', 'ordre']);
});
test('entrées vides ou illisibles : aucune erreur', () => {
  assert.deepStrictEqual(L.depuisTexte('').articles, []); assert.deepStrictEqual(L.depuisTexte(null).articles, []);
  assert.deepStrictEqual(L.depuisTableau([['rien', 'ici']]).articles, []); assert.deepStrictEqual(L.depuisTableau().articles, []);
  assert.deepStrictEqual(L.rapprocher([], []), []);
});
