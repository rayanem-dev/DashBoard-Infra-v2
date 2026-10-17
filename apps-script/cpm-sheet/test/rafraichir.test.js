// Le rafraîchissement EN BLOC doit donner exactement le même résultat que le traitement ligne par ligne (processRow).
const test = require('node:test'), assert = require('node:assert'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '..', 'SuiviCPM-complet.gs'), 'utf8');

function fabrique(lignes) {
  const entetes = ['Date debut Cahier des Charges', 'Type', 'Etape', 'Date Limite', '', '% Réalisé', 'Statut', 'Attribution', 'Date signature de contrat', 'Date ODS', 'Durée du contrat (mois)', 'Échéance', 'Date Attribution Finale', 'Durée Passation (jours)', 'Fin après prolongation 1', 'Fin après prolongation 2', 'Unité durée', 'Prolongation 1 (jours)', 'Prolongation 2 (jours)', 'Date arrêt 1', 'Date reprise 1', 'Date arrêt 2', 'Date reprise 2', 'Commentaire'];
  const nc = entetes.length, grille = [[], entetes.map(h => ({ v: h, bg: '#ffffff', fc: '#000000' }))];
  grille[0] = entetes.map(() => ({ v: '', bg: '#ffffff', fc: '#000000' }));
  lignes.forEach(l => grille.push(entetes.map((_, i) => ({ v: l[i] === undefined ? '' : l[i], bg: '#ffffff', fc: '#000000' }))));
  class Range {
    constructor(r, c, nr, nc2) { this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc2 || 1; }
    cells() { const o = []; for (let i = 0; i < this.nr; i++) { const l = []; for (let j = 0; j < this.nc; j++) l.push(grille[this.r - 1 + i][this.c - 1 + j]); o.push(l); } return o; }
    getValue() { return this.cells()[0][0].v; } getValues() { return this.cells().map(l => l.map(x => x.v)); }
    getBackgrounds() { return this.cells().map(l => l.map(x => x.bg)); } getFontColors() { return this.cells().map(l => l.map(x => x.fc)); }
    setValue(v) { this.cells().forEach(l => l.forEach(x => { x.v = v; })); return this; }
    setValues(a) { this.cells().forEach((l, i) => l.forEach((x, j) => { x.v = a[i][j]; })); return this; }
    setBackground(c) { this.cells().forEach(l => l.forEach(x => { x.bg = c === null ? '#ffffff' : c; })); return this; }
    setBackgrounds(a) { this.cells().forEach((l, i) => l.forEach((x, j) => { x.bg = a[i][j]; })); return this; }
    setFontColor(c) { this.cells().forEach(l => l.forEach(x => { x.fc = c === null ? '#000000' : c; })); return this; }
    setFontColors(a) { this.cells().forEach((l, i) => l.forEach((x, j) => { x.fc = a[i][j]; })); return this; }
    clearContent() { return this.setValue(''); }
  }
  const sheet = { getLastColumn: () => nc, getLastRow: () => grille.length, getRange: (r, c, nr, n) => new Range(r, c, nr, n) };
  return { sheet, grille };
}
// Date de l'hôte : les dates du test doivent être « instanceof Date » dans le script
const ctx = { console, Date, SpreadsheetApp: {} };
vm.createContext(ctx); vm.runInContext(code, ctx);
const jours = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const LIGNES = [
  [jours(-100), 'DAO', 'x', jours(5), '', 1, 'Attribué', 'ENT A', jours(-90), jours(-80), 12, '', '', ''],                 // 100 % : passe en exécution, échéance calculée
  [jours(-900), 'CF', 'x', '', '', '95%', 'Contrat en exécution', 'ENT B', jours(-800), jours(-700), 6, '', jours(-850), ''],   // échéance dépassée : échu
  [jours(-30), 'DAO', 'x', jours(20), '', 0.5, 'Dossier en cours', '', '', '', '', '', '', ''],                              // en cours, dead line verte
  [jours(-30), 'DAO', 'x', jours(-3), '', 0.5, 'Attribué', '', '', '', '', '', '', ''],                                      // dead line dépassée, champs manquants (rouge)
  ['', 'DAO', 'x', jours(5), '', 1, 'Attribué', '', '', '', '', '', '', ''],                                                 // pas de Date Début : intouchée
  [jours(-60), 'CF', 'x', jours(10), '', 0.3, 'Bloqué', '', '', '', '', '', jours(-10), ''],                                // bloqué + durée de passation
  [jours(-10), 'CF', 'x', '', '', 0, 'infructueux', '', '', '', '', '', '', ''],
  [jours(-10), 'CF', 'x', '', '', 0, '', '', '', '', '', '', '', ''],                                                        // statut vide
  [jours(-900), 'CF', 'x', '', '', '95%', 'Contrat en exécution', 'ENT P', jours(-800), jours(-700), 6, '', jours(-850), '', jours(40), ''],   // base échue mais prolongé : reste en exécution
  [jours(-900), 'CF', 'x', '', '', '95%', 'Contrat échu', 'ENT Q', jours(-800), jours(-700), 6, '', jours(-850), '', jours(60), ''],           // échu puis prolongé : de nouveau en exécution
  [jours(-900), 'CF', 'x', '', '', '95%', 'Contrat échu', 'ENT R', jours(-800), jours(-700), 6, '', jours(-850), '', jours(-20), ''],          // prolongation déjà passée : reste échu
  [jours(-900), 'CF', 'x', '', '', '95%', 'Contrat en exécution', 'ENT S', jours(-800), jours(-700), 6, '', jours(-850), '', jours(-100), jours(90)], // deux prolongations : la plus tardive compte
  [new Date(2025, 2, 30), 'CF', 'x', '', '', 0.5, 'Attribué', 'ACOSCO', new Date(2025, 3, 30), new Date(2025, 4, 1), 18, '', '', '', '', '', ''],       // 18 mois depuis le 01/05/2025 → 31/10/2026
  [new Date(2025, 0, 1), 'CF', 'x', '', '', 0.5, 'Attribué', 'X', new Date(2025, 0, 1), new Date(2025, 4, 1), 580, '', '', '', '', '', ''],            // 580 sans unité = jours → 01/12/2026
  [new Date(2025, 0, 1), 'CF', 'x', '', '', 0.5, 'Attribué', 'Y', new Date(2025, 0, 1), new Date(2025, 4, 1), 90, '', '', '', '', '', 'mois'],           // unité explicite : 90 mois
  [new Date(2025, 0, 1), 'CF', 'x', '', '', 0.5, 'Attribué', 'Z', new Date(2025, 0, 1), new Date(2025, 0, 31), 1, '', '', '', '', '', ''],             // 31/01 + 1 mois → fin février
  [jours(-100), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'T0', jours(-100), jours(-100), 6, '', '', '', '', '', '', '', ''],            // 16 : témoin sans prolongation
  [jours(-100), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'T1', jours(-100), jours(-100), 6, '', '', '', '', '', '', 30, ''],            // 17 : +30 jours
  [jours(-100), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'T2', jours(-100), jours(-100), 6, '', '', '', '', '', '', '2 mois', 15],      // 18 : 2 mois (60 j) + 15 j
  [jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'T3', jours(-330), jours(-330), 6, '', '', '', '', '', '', '2 mois', ''],      // 19 : fin dépassée même avec 60 j → échu
  [jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat échu', 'T4', jours(-330), jours(-330), 6, '', '', '', '', '', '', 200, ''],                     // 20 : échu puis +200 j → de nouveau en exécution
  [jours(-100), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'T5', jours(-100), jours(-100), 6, '', '', '', '', '', '', '', '', jours(-60), jours(-30), '', '', 'ancien commentaire'],   // 21 : arrêt puis reprise = 30 j de plus
  [jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'T6', jours(-330), jours(-330), 6, '', '', '', '', '', '', '', '', jours(-20), '', '', ''],                            // 22 : à l'arrêt, jamais échu
  [jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat échu', 'T7', jours(-330), jours(-330), 6, '', '', '', '', '', '', '', '', jours(-100), jours(-10), '', ''],                            // 23 : 90 j d'arrêt, fin encore dépassée → reste échu
  [jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat échu', 'T8', jours(-330), jours(-330), 6, '', '', '', '', '', '', '', '', jours(-200), jours(-10), '', '']                             // 24 : 190 j d'arrêt → de nouveau en exécution
];
test('rafraîchissement en bloc = traitement ligne par ligne', () => {
  const A = fabrique(LIGNES), B = fabrique(LIGNES);
  ctx.__A = A.sheet; ctx.__B = B.sheet;
  vm.runInContext('(function(){ var map = buildColumnMap(__A); for (var r = DATA_START_ROW; r <= __A.getLastRow(); r++) processRow(__A, r, map); })()', ctx);
  vm.runInContext('rafraichirEnBloc(__B, buildColumnMap(__B))', ctx);
  const aplat = g => g.slice(2).map(l => l.map(x => [x.v instanceof Date ? x.v.getTime() : x.v, x.bg, x.fc]));
  assert.deepStrictEqual(aplat(B.grille), aplat(A.grille));
  assert.strictEqual(B.grille[2][6].v, 'Contrat en exécution');   // ligne 1
  assert.strictEqual(B.grille[3][6].v, 'Contrat échu');           // ligne 2
  const st = i => B.grille[2 + i][6].v;
  assert.deepStrictEqual([st(8), st(9), st(10), st(11)], ['Contrat en exécution', 'Contrat en exécution', 'Contrat échu', 'Contrat en exécution']);
  assert.strictEqual(B.grille[2 + 8][11].v.getTime(), LIGNES[8][14].getTime());   // l'échéance affichée est la fin prolongée
  assert.strictEqual(B.grille[2 + 11][11].v.getTime(), LIGNES[11][15].getTime()); // la plus tardive des deux
  const fin = i => B.grille[2 + i][11].v, jour = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  assert.strictEqual(jour(fin(12)), '2026-10-31');   // 18 mois : fin incluse
  assert.strictEqual(jour(fin(13)), '2026-12-1');    // 580 jours (unité déduite) : 01/05/2025 + 579
  assert.strictEqual(jour(fin(14)), '2032-10-31');   // 90 mois, unité explicite
  assert.strictEqual(jour(fin(15)), '2025-2-28');    // fin de mois : 31/01 + 1 mois
  const ecart = i => Math.round((fin(i) - fin(16)) / 864e5);
  assert.deepStrictEqual([ecart(17), ecart(18)], [30, 75]);                         // 30 j ; « 2 mois » (60) + 15 j
  assert.deepStrictEqual([st(19), st(20)], ['Contrat échu', 'Contrat en exécution']);
  assert.deepStrictEqual([st(21), st(22), st(23), st(24)], ['Contrat en exécution', 'Contrat en exécution', 'Contrat échu', 'Contrat en exécution']);
  assert.strictEqual(ecart(21), 30);                                                // arrêt de 30 j : la fin recule de 30 j
  const com = i => B.grille[2 + i][23].v;
  assert.match(com(16), /^En cours d'exécution — ODS le \d\d\/\d\d\/\d{4}, durée 6 mois, fin prévue le /);
  assert.match(com(21), /30 j d'arrêt.*Nouvelle fin prévue le /);                  // remplace l'ancien commentaire
  assert.match(com(22), /ARRÊT DE CHANTIER depuis le .*reprise à venir.*à calculer à la reprise/);
  assert.match(com(17), /prolongation de 30 j/);
});

test('onEdit : le reclassement se déclenche dès que le statut change, même si la colonne modifiée n\'est pas celle du statut', () => {
  const lignes = [[jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat échu', 'U', jours(-330), jours(-330), 6, '', '', '', '', '', '', 200, '']];
  const essai = (colonneModifiee, lignesTest) => {
    const F = fabrique(lignesTest || lignes); let tri = 0;
    ctx.trierParStatut = () => { tri += 1; };
    ctx.__F = F.sheet; ctx.__col = colonneModifiee;
    const feuille = Object.assign({}, F.sheet, { getName: () => 'Suivi CPM' });
    ctx.__e = { source: { getActiveSheet: () => feuille, getSheetByName: () => null }, range: { getRow: () => 3, getNumRows: () => 1, getColumn: () => colonneModifiee, getNumColumns: () => 1 } };
    vm.runInContext('onEdit(__e)', ctx);
    return tri;
  };
  assert.strictEqual(essai(18), 1);   // colonne « Prolongation 1 (jours) » : échu → exécution → reclassement
  const stable = [[jours(-100), 'CF', 'x', '', '', 0.5, 'Contrat en exécution', 'V', jours(-100), jours(-100), 6, '', '', '', '', '', '', '', '']];
  assert.strictEqual(essai(8, stable), 0);   // colonne « Attribution » sans changement de statut : pas de tri
  const durée = [[jours(-330), 'CF', 'x', '', '', 0.5, 'Contrat échu', 'W', jours(-330), jours(-330), 6, '', '', '', '', '', '', 200, '']];
  assert.strictEqual(essai(11, durée), 1);   // colonne « Durée » : le statut change tout seul → reclassement
});
