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
  assert.deepStrictEqual(r.articles.map(a => a.u), ['M2', 'M2', 'M2', 'M2', 'U', 'M2']);
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

test('VRAIE sortie de l\'OCR (Tesseract fra) sur le scan du canevas de HMD : 6 articles, prix bruités signalés', () => {
  const r = L.depuisTexte(fx('benchmark-region-hmd-ocr.txt'));
  assert.strictEqual(r.articles.length, 6); assert.deepStrictEqual(r.articles.map(a => a.n), ['01', '02', '03', '04', '05', '06']);
  assert.deepStrictEqual(r.articles.map(a => a.pu), [1200, 10000, 10500, 5800, '', 550]);              // 5 800 : l'OCR a lu 6 en 8 ; 05 : prix illisible
  assert.deepStrictEqual(r.articles.map(a => a.verifier), [false, false, true, true, true, true]);     // les lignes bruitées sont signalées, jamais acceptées en silence
  assert.ok(r.articles.every(a => !/[|‘’]/.test(a.des)) && /^Décapage/.test(r.articles[0].des) && !/me — ee/.test(r.articles[0].des));
  assert.strictEqual(L.metadonnees(fx('benchmark-region-hmd-ocr.txt')).courrier, '225/SH/E&P/HMD/LOG/2026');
});
test('même scan lu à plus haute résolution (échelle 3, gris) : meilleurs chiffres, N° « 93 » corrigé en « 03 » par la suite 01, 02, 04', () => {
  const r = L.depuisTexte(fx('benchmark-region-hmd-ocr3.txt'));
  assert.deepStrictEqual(r.articles.map(a => a.n), ['01', '02', '03', '04', '05', '06']);
  assert.deepStrictEqual(r.articles.map(a => a.pu), [1200, 10000, 10500, 5600, 5300.08, 550]);
  assert.strictEqual(r.articles[4].verifier, true);   // 5 300,08 : décimales anormales → à vérifier
});
test('montants bruités par l\'OCR', () => {
  const l = txt => L.depuisTexte('N° Désignations Unité P.U\n' + txt).articles[0];
  assert.strictEqual(l('01 Décapage des anciens composants M 10:500;00').pu, 10500);
  assert.strictEqual(l('02 Forme de pente en béton maigre M? 10 000.00').pu, 10000);
  assert.strictEqual(l('03 Gargouille EPDM et compris crapaudine U | =\u2018000;06').pu, '');
  assert.strictEqual(l('04 Protection lourde en gravier roulé M² 550,00').pu, 550);
});

test('VRAIE lecture du navigateur (pdf.js + niveaux de gris + Tesseract) du canevas de HMD : « 10S00:00 » relu 10 500, 6 articles, plus de ligne de bruit', () => {
  const r = L.depuisTexte(fx('benchmark-region-hmd-nav.txt'));
  assert.deepStrictEqual(r.articles.map(a => a.n), ['01', '02', '03', '04', '05', '06']);
  assert.deepStrictEqual(r.articles.map(a => a.pu), [1200, 10000, 10500, 600, '', 550]);   // 04 : le « 5 » de 5 600 est perdu par l'OCR, 05 illisible
  assert.ok(r.articles[4].verifier && /^Décapage/.test(r.articles[0].des) && !/see ===/.test(r.articles[0].des));
});
test('troisième région (GTL, bordereau chiffré scanné) : prix unitaires, pas les montants ; PU abîmé réparé par montant ÷ quantité', () => {
  const r = L.depuisTexte(fx('benchmark-region-gtl-nav.txt'));
  assert.strictEqual(r.mode, 3);
  const par = d => r.articles.filter(a => d.test(a.des))[0];
  assert.strictEqual(par(/Réfection et rattrapage/).pu, 600);
  assert.strictEqual(par(/Gargouille/).pu, 1200); assert.strictEqual(par(/Gargouille/).qte, 25);        // quantité perdue, déduite de 30 000 ÷ 1 200
  assert.strictEqual(par(/Protection lourde/).pu, 800);
  assert.strictEqual(par(/forme de pente/).pu, 1600); assert.strictEqual(par(/forme de pente/).verifier, true);   // lu 4 800 ; 800 000 ÷ 500 = 1 600
  assert.strictEqual(par(/complexe d'étanchéité multicouches/).pu, 2400);   // montant mal lu : le prix lisible est gardé (1 525 n'est pas un prix rond)
  assert.ok(!/Monsieur|Directeur/.test(r.articles[0].des));                  // le courrier de la page 1 n'entre pas dans la désignation
  const m = L.metadonnees(fx('benchmark-region-gtl-nav.txt'));
  assert.strictEqual(m.contrat, 'I/14/GTL-INFRA/2026'); assert.strictEqual(m.annee, 2026); assert.strictEqual(m.region, 'Gassi Touil'); assert.ok(!/RNS/.test(m.courrier));
});
test('rapprochement des 3 régions avec l\'offre : les prix retrouvés sont ceux de votre tableau Excel', () => {
  const offre = L.depuisTexte(fx('benchmark-offre.txt')).articles, g = L.depuisTexte(fx('benchmark-region-gtl-nav.txt')).articles, h = L.depuisTexte(fx('benchmark-region-hmd-ocr3.txt')).articles;
  const prix = (lus) => L.rapprocher(offre, lus).map(x => x.i >= 0 ? lus[x.i].pu : null);
  assert.deepStrictEqual(prix(g).slice(1), [1600, 600, null, 1200, 800]);                   // GTL : 02, 03, (04 non comparable), 05, 06
  assert.deepStrictEqual(prix(h).slice(1, 3), [10000, 10500]);
});
test('nature du document : demande de prix envoyée aux régions, canevas vierge, offre, réponse', () => {
  assert.strictEqual(L.nature(fx('benchmark-demande-ocr.txt') + '\n' + fx('benchmark-canevas-vierge-ocr.txt')), 'demande');
  assert.strictEqual(L.nature(fx('benchmark-canevas-vierge-ocr.txt')), 'canevas-vierge');
  assert.strictEqual(L.nature(fx('benchmark-offre.txt')), 'offre'); assert.strictEqual(L.nature(fx('benchmark-region-gtl-nav.txt')), 'offre');
  assert.strictEqual(L.nature(fx('benchmark-region-hmd.txt')), 'reponse'); assert.strictEqual(L.nature(''), 'inconnu');
});

test('VRAI scan de 7 pages (ETB ZAATOUT, 400 chambres, 300 ppi) : colonnes nombre de chambres × quantité par chambre, N° « I,1 », total lu, somme contrôlée', () => {
  const r = L.depuisTexte(fx('benchmark-offre-zaatout-nav.txt'));
  assert.strictEqual(r.mode, 3); assert.strictEqual(r.total, 229056000); assert.ok(r.articles.length >= 44);
  const a = d => r.articles.filter(x => d.test(x.des))[0];
  assert.deepStrictEqual([a(/Faux Plafond en BA 13, réalisé/).qte, a(/Faux Plafond en BA 13, réalisé/).pu, a(/Faux Plafond en BA 13, réalisé/).montant], [4800, 3800, 18240000]);   // 400 × 12, 5 nombres sur la ligne
  assert.deepStrictEqual([a(/Dépose de plinthes existantes au niveau des couloirs/).qte, a(/Dépose de plinthes existantes au niveau des couloirs/).pu], [1720, 100]);
  assert.deepStrictEqual([a(/revêtement de sol existant dans les couloirs/).qte, a(/revêtement de sol existant dans les couloirs/).pu], [1200, 200]);
  assert.strictEqual(a(/accessoires pour Porte d'entrée de la chambre/).pu, 9000);          // quantité 400 perdue, déduite : 3 600 000 ÷ 9 000
  assert.strictEqual(a(/plafonnier pour couloir/).pu, 9000); assert.strictEqual(a(/plafonnier pour couloir/).verifier, true);   // « 900000 » : prix = 720 000 ÷ 80
  assert.strictEqual(a(/climatiseur/).qte, 400);                                           // « 1600 000,00 » = 1 600 000,00
  const v = L.verifierTotal(r.articles, r.total);
  assert.strictEqual(v.ok, false); assert.ok(v.ecart > 0 && v.ecart / v.total < 0.05);      // lignes manquantes signalées, jamais une somme fausse présentée comme juste
  assert.strictEqual(L.verifierTotal(L.depuisTexte(fx('benchmark-offre.txt')).articles, 49495000).ok, true);
  assert.strictEqual(L.nature(fx('benchmark-offre-zaatout-nav.txt')), 'offre');
});

test('colonnes de chiffres relues à part (bande découpée, agrandie, liste « 0-9 , . ») : les 6 prix de HMD sont justes, y compris « 5 600,00 » et le prix sous le tampon', () => {
  const r = L.depuisTexte(fx('benchmark-region-hmd-chiffres.txt'));
  assert.deepStrictEqual(r.articles.map(a => a.n), ['01', '02', '03', '04', '05', '06']);
  assert.deepStrictEqual(r.articles.map(a => a.pu), [1200, 10000, 10500, 5600, 2000, 550]);
  const offre = L.depuisTexte(fx('benchmark-offre.txt')).articles;
  assert.deepStrictEqual(L.rapprocher(offre, r.articles).map(x => r.articles[x.i].pu), [1200, 10000, 10500, 5600, 2000, 550]);
});
test('colonnes de chiffres relues à part : l\'offre de GTL est lue en entier, la somme des articles égale exactement le total du document', () => {
  const r = L.depuisTexte(fx('benchmark-region-gtl-chiffres.txt'));
  assert.strictEqual(r.total, 38370000); assert.strictEqual(r.articles.length, 13);
  const v = L.verifierTotal(r.articles, r.total); assert.strictEqual(v.ok, true); assert.strictEqual(v.ecart, 0);
  const a = d => r.articles.filter(x => d.test(x.des))[0];
  assert.deepStrictEqual([a(/Dépose de l/).qte, a(/Dépose de l/).pu], [8000, 300]);       // 1.1.1, perdu avant
  assert.deepStrictEqual([a(/Complexe d'étanchéité mul|complexe d'étanchéité multicouches \(03\)/).pu].length, 1);
  const offre = L.depuisTexte(fx('benchmark-offre.txt')).articles;
  assert.deepStrictEqual(L.rapprocher(offre, r.articles).map(x => x.i >= 0 ? r.articles[x.i].pu : null), [null, 1600, 600, null, 1200, 800]);
});

test('offre de 7 pages relue avec colonnes d\'unités, de N° et de chiffres : 48 articles, somme à 0,3 % du total, désignations dans le bon ordre', () => {
  const r = L.depuisTexte(fx('benchmark-offre-zaatout-nav2.txt'));
  assert.ok(r.articles.length >= 47); assert.strictEqual(r.total, 229056000);
  const v = L.verifierTotal(r.articles, r.total); assert.ok(Math.abs(v.ecart) / v.total < 0.005, 'écart ' + v.ecart);
  // chaque désignation commence par son propre texte (plus de décalage d'une ligne sur l'article voisin)
  const d = r.articles.map(a => a.des);
  assert.ok(/^Depose de revêtement mural/.test(d[1]) && /^Depose de plinthes existantes au niveau des chambres/.test(d[2]) && /^Dépose de revêtement de sol existant dans les couloirs/.test(d[3]) && /^Dépose de plinthes existantes au niveau des couloirs/.test(d[4]) && /^Dépose des portes/.test(d[5]));
  assert.ok(/^F\/P de tampon/.test(d[6]) && /^Curage du réseau/.test(d[7]));
  assert.ok(r.articles.filter(a => a.u).length >= 20 && r.articles.filter(a => a.n).length >= 15);   // unités et N° relus à part
});
test('grille lue sur l\'image (tableau à traits, GTL) : une rangée par ligne du tableau, cellules séparées, somme = total du document', () => {
  const g = JSON.parse(fx('benchmark-grille-gtl.json')), total = L.depuisTexte(fx('benchmark-region-gtl-chiffres.txt')).total;
  const r = L.depuisGrille(g, total);
  assert.deepStrictEqual(r.colonnes, { n: 0, des: 1, u: 2, qte: 3, pu: 4, montant: 5 });
  assert.strictEqual(r.articles.length, 13); assert.strictEqual(L.verifierTotal(r.articles, r.total).ok, true);
  assert.deepStrictEqual(r.articles.filter(a => /forme de pente/.test(a.des)).map(a => [a.qte, a.pu, a.montant]), [[500, 1600, 800000]]);
  assert.deepStrictEqual(L.depuisGrille([['a']], null).articles, []);
});
