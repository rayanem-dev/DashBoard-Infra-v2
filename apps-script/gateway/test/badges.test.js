// Moteur des badges prestataires : numérotation, noms, lecture des Enquêtes administratives, import, mise en page recto-verso.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const B = require(path.join(__dirname, '..', '..', '..', 'badges', 'badges.js'));
const cfg = B.config({});

test('numéro : format de la charte, continu, remis à 1 chaque année', () => {
  assert.strictEqual(B.formaterRef(cfg, 1, 2026), 'SH RNS BASE DE VIE CENTRALE-BADGE N° 01/2026');
  assert.strictEqual(B.formaterRef(B.config({ base: 'BASE ALPHA', chiffres: 3 }), 7, 2027), 'BASE ALPHA-BADGE N° 007/2027');
  const hist = [{ n: 1, annee: 2026 }, { n: 5, annee: 2026 }, { n: 40, annee: 2025 }];
  assert.strictEqual(B.prochain(hist, 2026, cfg), 6);
  assert.strictEqual(B.prochain(hist, 2027, cfg), 1);
});
test('réimpression : même personne + même entreprise = même numéro ; lot : numéros consécutifs', () => {
  const p = (nom, prenom, e) => ({ nom, prenom, entreprise: e });
  const hist = [Object.assign(p('KACI', 'Farid', 'ENAGEO'), { n: 3, annee: 2026 })];
  const r = B.attribuer(hist, [p('Kaci', 'FARID', 'enageo'), p('DEBILI', 'Fathi', 'ENAGEO'), p('DEBILI', 'Fathi', 'ENAGEO'), p('OUADAT', 'Khalifa', 'ENAGEO')], 2026, cfg);
  assert.deepStrictEqual(r.items.map(x => x.n), [3, 4, 4, 5]);
  assert.deepStrictEqual(r.items.map(x => x.reutilise), [true, false, true, false]);
  assert.strictEqual(r.items[0].ref, 'SH RNS BASE DE VIE CENTRALE-BADGE N° 03/2026');
  assert.strictEqual(r.nouveaux.length, 2); // le doublon du lot ne crée pas une 2e ligne d'historique
});
test('nom / prénom depuis « NOM Prénom » (arabe pour départager)', () => {
  const d = (a, b) => { const x = B.decouperNom(a, b); return [x.nom, x.prenom, x.verifier]; };
  assert.deepStrictEqual(d('KACI Farid'), ['KACI', 'Farid', false]);
  assert.deepStrictEqual(d('GHEMAM AMARA Ali'), ['GHEMAM AMARA', 'Ali', false]);
  assert.deepStrictEqual(d('AICHAOUI Mohamed Lamine'), ['AICHAOUI', 'Mohamed Lamine', false]);
  assert.deepStrictEqual(d('MEKHLOUFI AMOR', 'مخلوفي'), ['MEKHLOUFI', 'AMOR', false]);
  assert.deepStrictEqual(d('Ben Alia Meftah', 'بن علية'), ['Ben Alia', 'Meftah', false]);
  assert.deepStrictEqual(d('belarbi reda'), ['belarbi', 'reda', true]);
  assert.deepStrictEqual(d('—'), ['', '', false]);
});
test('Enquêtes administratives : onglet standard et onglet décalé d\'une colonne', () => {
  const ent = [['القائمة الإسمية لأعوان شركة ENAGEO', '', '', '', '', '', '', '', '', '', '', '', '', ''], ['ولاية إليزي'],
    ['رقم الهاتف', 'رقم شهادة الميلاد', 'رقم التعريف الوطني', 'الوظيفة المقترحة', 'تاريخ التوظيف', 'العنوان', 'الاسم و اللقب بالفرنسية', 'الأم', 'الأب', 'مكان الإزدياد', 'تاريخ الأزدياد', 'الإسم', 'اللقب', 'رقم'],
    ['—', '0014746', '109790526012970007', 'Chauffeur', '—', 'x', 'KACI Farid', '—', '—', 'واضية', '1979', 'فريد', 'قاسي', '1'],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '2'],
    ['', '206', '—', 'سائق وزن ثقيل', '2004', 'x', 'BENATALLAH Kamel', '', '', '', '', 'كمال', 'بن عطاء الله', '3']];
  const a = B.analyserEnquetes(ent, 'ENAGEO');
  assert.strictEqual(a.entreprise, 'ENAGEO');
  assert.strictEqual(a.personnes.length, 2);
  assert.deepStrictEqual([a.personnes[0].nom, a.personnes[0].prenom, a.personnes[0].fonction], ['KACI', 'Farid', 'Chauffeur']);
  assert.strictEqual(a.personnes[1].fonction, 'سائق وزن ثقيل');
  const dec = [['', 'القائمة الإسمية لأعوان شركة SARL ATIA MEHDI ET FRERES'], ['', 'ولاية'], ['', 'رقم الهاتف', 'رقم', 'رقم', 'الوظيفة المقترحة', 'x', 'x', 'الاسم و اللقب بالفرنسية', '', '', '', '', 'الإسم', 'اللقب', 'رقم'],
    ['', '', '', '109', '', '', 'x', 'RAMDANI TAHAR', '', '', '', '', 'الطاهر', 'رمضاني', '1']];
  const b = B.analyserEnquetes(dec, 'ATTIA');
  assert.strictEqual(b.entreprise, 'SARL ATIA MEHDI ET FRERES');
  assert.deepStrictEqual([b.personnes[0].nom, b.personnes[0].prenom], ['RAMDANI', 'TAHAR']);
  assert.strictEqual(B.analyserEnquetes([['a']], 'Z').personnes.length, 0);
});
test('import CSV / collage Excel : séparateur détecté, en-têtes reconnus, guillemets', () => {
  const t = 'Nom;Prénom;Fonction;Entreprise;Contrat\nKACI;Farid;"Chauffeur; PL";ENAGEO;I/43/RNS/INFRA/2025\n;;;;\nBOUSSAID;Abdallah;Chauffeur;ENAGEO;';
  const r = B.personnesDepuisTableau(B.lireCsv(t), { contrat: 'C-DEF' });
  assert.strictEqual(r.personnes.length, 2);
  assert.strictEqual(r.personnes[0].fonction, 'Chauffeur; PL');
  assert.strictEqual(r.personnes[1].contrat, 'C-DEF');
  const x = B.personnesDepuisTableau(B.lireCsv('KACI\tFarid\tChauffeur\tENAGEO\tC1'), {});
  assert.strictEqual(x.personnes[0].entreprise, 'ENAGEO');
});
test('mise en page : 9 par feuille, verso en miroir, case de départ, rien hors page', () => {
  const items = Array.from({ length: 11 }, (_, i) => ({ nom: 'N' + i, prenom: 'P', entreprise: 'E', contrat: 'C', ref: 'R' + i }));
  assert.deepStrictEqual(B.planifier(items, cfg, 1).map(x => x.length), [9, 2]);
  assert.deepStrictEqual(B.planifier(items, cfg, 8).map(x => x.length), [2, 9]);
  const g = cfg.grille, w = ((g.colonnes - 1) * g.pasX + cfg.carte.largeur) * cfg.echelle, h = ((g.lignes - 1) * g.pasY + cfg.carte.hauteur) * cfg.echelle;
  assert.ok(w < cfg.page.largeur && h < cfg.page.hauteur);
  const html = B.feuillesHtml(items, cfg, {});
  assert.strictEqual((html.match(/class="bdg-feuille"/g) || []).length, 2);
  assert.strictEqual((html.match(/class="bdg-feuille bdg-verso"/g) || []).length, 2);
  const x = (s) => [...s.matchAll(/class="bdg-carte" style="left:([\d.]+)mm/g)].map(m => +m[1]);
  const parts = html.split('<section');
  const xr = x(parts[1]), xv = x(parts[2]);
  assert.strictEqual(xr[0], xv[2]); assert.strictEqual(xr[2], xv[0]);
});
test('badge : champs de la charte, contrat au verso, échappement, QR et arabe optionnels', () => {
  const it = { nom: 'kaci', prenom: 'Farid', fonction: 'Chauffeur', entreprise: 'ENCC SPA UNITE HAMIZ', structure: '', contrat: 'I/43/RNS/INFRA/2025', ref: B.formaterRef(cfg, 1, 2026), nomAr: 'قاسي', prenomAr: 'فريد' };
  const h = B.feuillesHtml([it], B.config({ arabe: { actif: true } }), {});
  ['BADGE PRESTATAIRE', 'NOM', 'PRENOM', 'FONCTION', 'ENTREPRISE', 'STRUCTURE', 'INFRA/RNS', 'KACI', 'CONTRAT N°I/43/RNS/INFRA/2025', 'Visa prestataire', 'Visa structure', 'BADGE N° 01/2026', 'فريد قاسي'].forEach(s => assert.ok(h.includes(s), s));
  assert.ok(B.feuillesHtml([Object.assign({}, it, { prenom: '<b>x</b>' })], cfg, {}).includes('&lt;b&gt;'));
  assert.ok(!h.includes('data-qr'));
  assert.ok(B.feuillesHtml([it], cfg, { qr: (t) => '<svg data-qr="' + t.length + '"></svg>' }).includes('data-qr'));
});
test('historique : export CSV avec en-têtes', () => {
  const c = B.csvHistorique([{ date: '2026-10-15', ref: 'X', n: 1, annee: 2026, nom: 'A;B', prenom: 'C' }]);
  assert.ok(c.startsWith('﻿date;ref;n;annee;nom;prenom'));
  assert.ok(c.includes('"A;B"'));
});

// ---------- passerelle (Badges.gs) ----------
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'badges', 'badges.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Badges.gs'), 'utf8').replace(/^\/\/ ---------- actions ----------[\s\S]*$/m, ''), ctx);
const run = (code) => JSON.parse(JSON.stringify(vm.runInContext(code, ctx)));
const G = (nom, ...args) => { ctx.__a = args; return run(nom + '(...__a)'); };

test('passerelle : appariement des noms d\'entreprise (Enquêtes ↔ CPM)', () => {
  const noms = ['ENCC SPA', 'ENAGEO', 'ETB ZATOUT ABDENCER', 'SARL ATIA MEHDI ET FRERES', 'GLOBI CORP'];
  assert.strictEqual(G('badgesAppariement_', 'ENCC SPA UNITE HAMIZ', noms), 'ENCC SPA');
  assert.strictEqual(G('badgesAppariement_', 'ATIA MEHDI', noms), 'SARL ATIA MEHDI ET FRERES');
  assert.strictEqual(G('badgesAppariement_', 'ETB ZATOUT ABDENCER', noms), 'ETB ZATOUT ABDENCER');
  assert.strictEqual(G('badgesAppariement_', 'ACOSCO', noms), '');
  assert.strictEqual(G('badgesAppariement_', 'ETS ZATOUT TAYEB', noms), '');
});
test('passerelle : entreprises et contrats depuis le CPM', () => {
  const enr = { ordre: ['a', 'b', 'c', 'd'], dossiers: {
    a: { attribue_a: 'ENCC SPA', n_contrat: 'I/43/RNS/INFRA/2025', intitule: 'Génie civil' },
    b: { attribue_a: 'ENCC SPA', n_contrat: 'I/50/RNS/INFRA/2025', intitule: 'Bâtiment' },
    c: { attribue_a: 'encc spa ', n_contrat: 'I/43/RNS/INFRA/2025', intitule: 'doublon' },
    d: { attribue_a: '', n_contrat: 'X', intitule: 'sans attribution' } } };
  const r = G('badgesEntreprisesCpm_', enr);
  assert.strictEqual(r.length, 1);
  assert.deepStrictEqual(r[0].contrats.map(c => c.numero), ['I/43/RNS/INFRA/2025', 'I/50/RNS/INFRA/2025']);
});
test('passerelle : fusion Enquêtes + CPM + corrections manuelles', () => {
  const onglets = [
    { onglet: 'ENCC', entreprise: 'ENCC SPA UNITE HAMIZ', personnes: [{ nom: 'BENDJEDDA', prenom: 'ATHMANE', fonction: 'MONTEUR', nomAr: '', prenomAr: '', verifier: false }, { nom: 'HAMOU', prenom: 'WASSIM', fonction: 'agent', nomAr: '', prenomAr: '' }] },
    { onglet: 'ACOSCO', entreprise: 'ACOSCO', personnes: [{ nom: 'LACHI', prenom: 'Choayb', fonction: 'Preparateur' }] },
    { onglet: 'VIDE', entreprise: 'VIDE', personnes: [] }];
  const cpm = [{ nom: 'ENCC SPA', contrats: [{ numero: 'I/43', intitule: '' }] }, { nom: 'ETS DOUBLE', contrats: [{ numero: 'A', intitule: '' }, { numero: 'B', intitule: '' }] }];
  const base = G('badgesFusion_', onglets, cpm, [], []);
  assert.strictEqual(base.personnes.length, 3);
  const b = base.personnes.find(p => p.nom === 'BENDJEDDA');
  assert.strictEqual(b.entreprise, 'ENCC SPA'); assert.strictEqual(b.contrat, 'I/43'); assert.ok(/^e/.test(b.id));
  assert.ok(base.entreprises.some(e => e.nom === 'ACOSCO' && e.source === 'enquetes'));
  const id = b.id;
  const f = G('badgesFusion_', onglets, cpm,
    [{ id, nom: 'BENDJEDDA', prenom: 'Athmane', fonction: 'CHEF', entreprise: 'ENCC SPA', contrat: 'I/43', structure: 'DSP', nomAr: '', prenomAr: '', supprime: '' },
     { id: base.personnes.find(p => p.nom === 'HAMOU').id, supprime: '1' },
     { id: 'p1', nom: 'NEUF', prenom: 'Un', fonction: 'F', entreprise: 'ETS DOUBLE', contrat: 'B', supprime: '' }],
    [{ nom: 'ETS DOUBLE', contrats: '[{"numero":"B","intitule":"x"}]', supprime: '' }, { nom: 'ACOSCO', contrats: '[]', supprime: '1' }]);
  assert.strictEqual(f.personnes.length, 3);
  assert.strictEqual(f.personnes.find(p => p.id === id).structure, 'DSP');
  assert.ok(!f.personnes.some(p => p.nom === 'HAMOU'));
  assert.strictEqual(f.personnes.find(p => p.id === 'p1').source, 'manuel');
  assert.deepStrictEqual(f.entreprises.find(e => e.nom === 'ETS DOUBLE').contrats.map(c => c.numero), ['B']);
  assert.ok(!f.entreprises.some(e => e.nom === 'ACOSCO'));
});
test('passerelle : numéros attribués et chaque impression tracée (réimpression = même numéro)', () => {
  const cfg = ctx.Badges.config({});
  const p = (nom, n) => ({ nom, prenom: 'X', entreprise: 'E', contrat: 'C', n });
  const un = G('badgesAttribuerEtNoter_', [], [p('A'), p('B')], 2026, cfg, 'Rayane', '2026-10-15');
  assert.deepStrictEqual(un.items.map(i => i.n), [1, 2]);
  assert.strictEqual(un.lignes.length, 2);
  assert.strictEqual(un.lignes[0].ref, 'SH RNS BASE DE VIE CENTRALE-BADGE N° 01/2026');
  const hist = un.lignes.map(l => Object.assign({}, l));
  const deux = G('badgesAttribuerEtNoter_', hist, [p('B'), p('C')], 2026, cfg, 'Rayane', '2026-10-16');
  assert.deepStrictEqual(deux.items.map(i => i.n), [2, 3]);
  assert.strictEqual(deux.lignes.length, 2);                 // réimpression de B tracée aussi
  assert.strictEqual(deux.lignes[0].date, '2026-10-16');
});

test('passerelle : mots proches (MHENNI / MEHENNI) et rattachement manuel d\'une entreprise', () => {
  assert.strictEqual(G('badgesAppariement_', 'ETS MHENNI', ['ETS MEHENNI ABDELKADER', 'ETS MESSAI']), 'ETS MEHENNI ABDELKADER');
  assert.strictEqual(G('badgesAppariement_', 'ETS MESSAI', ['ETS MEHENNI ABDELKADER', 'ETS MESSAI']), 'ETS MESSAI');
  assert.strictEqual(G('badgesProche_', 'mhenni', 'mehenni'), true);
  assert.strictEqual(G('badgesProche_', 'zatout', 'tayeb'), false);
  const onglets = [{ onglet: 'ATTIA', entreprise: 'SARL ATIA MEHDI', personnes: [{ nom: 'RAMDANI', prenom: 'TAHAR', fonction: 'x' }] }];
  const cpm = [{ nom: 'SARL ATIA ET FRERES', contrats: [{ numero: '34.INFRA.25', intitule: 'Réseau routier' }] }];
  const sans = G('badgesFusion_', onglets, cpm, [], []);
  assert.ok(sans.entreprises.some(e => e.nom === 'SARL ATIA MEHDI'));            // pas rapprochées toutes seules
  const avec = G('badgesFusion_', onglets, cpm, [], [{ nom: 'SARL ATIA MEHDI', contrats: '[]', supprime: '', alias: 'SARL ATIA ET FRERES' }]);
  assert.strictEqual(avec.personnes[0].entreprise, 'SARL ATIA ET FRERES');       // rattachées à la main
  assert.strictEqual(avec.personnes[0].contrat, '34.INFRA.25');
  assert.ok(!avec.entreprises.some(e => e.nom === 'SARL ATIA MEHDI'));
});

test('contrat lu dans le nom d\'un onglet normalisé : deux onglets de la même entreprise gardent chacun leur contrat', () => {
  const pers = (n) => [{ nom: n, prenom: 'X', fonction: '', nomAr: '', prenomAr: '', verifier: false }];
  const onglets = [{ onglet: 'ZAATOUT · 54.INFRA.25', entreprise: 'ETB ZAATOUT ABDENCER', personnes: pers('A') }, { onglet: 'ZAATOUT · 53.INFRA.25', entreprise: 'ETB ZAATOUT ABDENCER', personnes: pers('B') }, { onglet: 'ANCIEN', entreprise: 'SARL TEST', personnes: pers('C') }];
  const cpm = [{ nom: 'ZAATOUT ABDENCER', contrats: [{ numero: '53.INFRA.25', intitule: 'T' }, { numero: '54.INFRA.25', intitule: 'D' }] }, { nom: 'SARL TEST', contrats: [{ numero: '1.INFRA.25', intitule: 'a' }, { numero: '2.INFRA.25', intitule: 'b' }] }];
  const f = G('badgesFusion_', onglets, cpm, [], []);
  assert.deepStrictEqual(f.personnes.map(p => [p.nom, p.contrat]), [['A', '54.INFRA.25'], ['B', '53.INFRA.25'], ['C', '']]);
});
