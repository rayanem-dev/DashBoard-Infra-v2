// node --test apps-script/gateway/test/benchmark.test.js
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../../js/banchy.js');

// Données du tableau d'origine (benchmark.xlsx) : toitures-terrasses de Rhourde Nouss, offre ALKO CONSTRUCTION, 3 contrats d'autres régions (coefficients du tableau).
const items = [
  { id: 'a1', n: '01', des: 'Décapage', u: 'M2', qte: 5000, pu: 738 }, { id: 'a2', n: '02', des: 'Forme de pente', u: 'M2', qte: 5000, pu: 1000 },
  { id: 'a3', n: '03', des: 'Réfection', u: 'M2', qte: 2000, pu: 400 }, { id: 'a4', n: '04', des: 'Étanchéité multicouche', u: 'M2', qte: 6500, pu: 5170 },
  { id: 'a5', n: '05', des: 'Gargouille', u: 'U', qte: 200, pu: 2000 }, { id: 'a6', n: '06', des: 'Gravier roulé', u: 'M2', qte: 5000, pu: 1200 }
];
const sources = [
  { id: 's1', nom: 'HMD', annee: 2023, coef: 1.3, prix: { a1: 1200, a2: 10000, a3: 10500, a4: 5600, a5: 2000, a6: 550 } },
  { id: 's2', nom: 'GTL', annee: 2026, coef: 1, prix: { a2: 1600, a3: 600, a5: 1200, a6: 800 } },
  { id: 's3', nom: 'HAMRA', annee: 2022, coef: 1.4, prix: { a2: 900 } }
];
const doc = { params: {}, items, sources };
const r = B.calculer(doc), L = id => r.lignes.find(x => x.id === id);

test('montant de l\'offre = 49 495 000 DA, poids des articles', () => {
  assert.strictEqual(r.totaux.montantOffre, 49495000);
  assert.ok(Math.abs(L('a4').poids - 0.67896) < 1e-4);
});
test('actualisation : coefficient saisi prioritaire, sinon (1+taux)^années, jamais vers le passé', () => {
  const p = B.parametres({});
  assert.strictEqual(B.coefficient({ coef: 1.3, annee: 2000 }, p), 1.3);
  assert.ok(Math.abs(B.coefficient({ annee: 2023 }, p) - 1.295029) < 1e-6);
  assert.strictEqual(B.coefficient({ annee: 2026 }, p), 1);
  assert.strictEqual(B.coefficient({ annee: 2030 }, p), 1);
  assert.strictEqual(B.coefficient({}, p), 1);
});
test('référence = médiane des prix actualisés ; écart = (offre − réf) / réf', () => {
  assert.deepStrictEqual(L('a2').valeurs.map(v => v.actualise), [13000, 1600, 1260]);
  assert.strictEqual(L('a2').ref, 1600);
  assert.ok(Math.abs(L('a2').ecart - (1000 - 1600) / 1600) < 1e-12);
  assert.strictEqual(L('a2').verdict, 'bas');          // 3 sources, HMD suspect (×8) mais la majorité est cohérente
  assert.strictEqual(L('a2').valeurs[0].suspect, true);
});
test('une seule source : écart calculé mais article « sources insuffisantes »', () => {
  assert.strictEqual(L('a1').verdict, 'insuffisant'); assert.strictEqual(L('a4').verdict, 'insuffisant');
  assert.ok(Math.abs(L('a4').ref - 7280) < 1e-9);
});
test('deux prix incohérents (600 vs 13 650) : à vérifier, pas de verdict de prix', () => {
  assert.strictEqual(L('a3').verdict, 'verifier'); assert.ok(L('a3').dispersion > 20);
});
test('deux prix cohérents : moyenne = médiane, verdict selon le seuil', () => {
  assert.strictEqual(L('a5').ref, 1900); assert.strictEqual(L('a5').verdict, 'conforme');
  assert.ok(Math.abs(L('a6').ref - 757.5) < 1e-9); assert.strictEqual(L('a6').verdict, 'eleve');
});
test('écart global pondéré par les montants, seulement sur les articles fiables', () => {
  const t = r.totaux;
  const offre = 5000 * 1000 + 200 * 2000 + 5000 * 1200, ref = 5000 * 1600 + 200 * 1900 + 5000 * 757.5;
  assert.strictEqual(t.montantOffreFiable, offre); assert.strictEqual(t.montantRefFiable, ref);
  assert.ok(Math.abs(t.ecartFiable - (offre - ref) / ref) < 1e-12);
  assert.strictEqual(t.nFiables, 3); assert.strictEqual(t.nVerifier, 1); assert.strictEqual(t.nInsuffisant, 2);
  assert.ok(t.couverture > 0.2 && t.couverture < 0.3);
});
test('verdict global : refusé si les articles fiables couvrent trop peu du marché', () => {
  assert.strictEqual(r.totaux.verdictGlobal, 'insuffisant');                                   // 23 % seulement : l'article 4 (68 % du marché) n'a qu'une source
  assert.strictEqual(B.calculer({ params: { couvertureMin: 0.1 }, items, sources }).totaux.verdictGlobal, 'conforme');
  assert.ok(r.totaux.ecartGlobal !== null);                                                    // l'écart indicatif sur tous les articles chiffrés reste donné
});
test('méthode du tableau d\'origine reproduite pour comparaison : moyenne simple = 370,04 %', () => {
  assert.ok(Math.abs(r.totaux.moyenneSimpleFeuille - 3.7003935993300936) < 1e-9);
  assert.ok(Math.abs(L('a3').ecartFeuille - 16.8125) < 1e-9);
});
test('exclusion des prix suspects (option) : la moyenne n\'est plus tirée par une saisie aberrante', () => {
  const m = B.calculer({ params: { statistique: 'moyenne' }, items, sources }), x = B.calculer({ params: { statistique: 'moyenne', exclureSuspects: true }, items, sources });
  assert.ok(Math.abs(m.lignes[1].ref - (13000 + 1600 + 1260) / 3) < 1e-9);
  assert.ok(Math.abs(x.lignes[1].ref - 1430) < 1e-9);
});
test('seuil, nombre mini de sources et statistique sont des paramètres', () => {
  const serre = B.calculer({ params: { seuil: 0.01 }, items, sources }); assert.strictEqual(serre.lignes[4].verdict, 'eleve');   // a5 : 2000 vs 1900 = +5,3 %
  const un = B.calculer({ params: { nMin: 1 }, items, sources }); assert.strictEqual(un.lignes[3].verdict, 'bas');             // a4 : 5170 vs 7280 = −29 %
  const mini = B.calculer({ params: { statistique: 'min' }, items, sources }); assert.strictEqual(mini.lignes[5].ref, 550 * 1.3);
  assert.strictEqual(B.parametres({ statistique: 'x', nMin: 0, seuil: -1 }).statistique, 'mediane');
});
test('sans aucune source : aucune référence, aucun plantage', () => {
  const z = B.calculer({ items, sources: [] }); assert.ok(z.lignes.every(l => l.verdict === 'sans_ref')); assert.strictEqual(z.totaux.ecartFiable, null); assert.strictEqual(z.totaux.verdictGlobal, 'insuffisant');
  assert.strictEqual(B.calculer({}).lignes.length, 0);
});
test('lecture des nombres : espaces, virgule, DA, valeurs nulles refusées', () => {
  assert.strictEqual(B.nombre('1 200,50'), 1200.5); assert.strictEqual(B.nombre('5 170,00 DA'), 5170); assert.strictEqual(B.nombre('0'), null); assert.strictEqual(B.nombre('abc'), null); assert.strictEqual(B.nombre(-3), null);
});
test('collage depuis Excel : articles et colonne de prix', () => {
  const a = B.lireArticles('N°\tDésignations\tU\tQté\tPU\n01\tDécapage\tM2\t5 000\t738,00\n\n02\tForme\tM2\t5000\t1 000,00\nfin');
  assert.strictEqual(a.length, 2); assert.strictEqual(a[0].qte, 5000); assert.strictEqual(a[1].pu, 1000);
  assert.deepStrictEqual(B.lireColonne('1 200,00\n\n10 500\t x\nabc'), [1200, null, 10500, null]);
});
test('export CSV : en-tête, lignes, totaux, guillemets', () => {
  const csv = B.versCsv(doc, r), l = csv.replace('﻿', '').split('\r\n');
  assert.ok(csv.startsWith('﻿N°;Désignation;U;Qté;PU offre (DA);Montant (DA);% du marché;PU HMD (DA)'));
  assert.ok(l[1].startsWith('01;Décapage;M2;5000;738,00;3690000,00;7,5 %;1200,00;;;1560,00'));
  assert.ok(csv.includes('Écart global pondéré'));
});
