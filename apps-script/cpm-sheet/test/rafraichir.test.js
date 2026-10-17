// Le rafraîchissement EN BLOC doit donner exactement le même résultat que le traitement ligne par ligne (processRow).
const test = require('node:test'), assert = require('node:assert'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '..', 'SuiviCPM-complet.gs'), 'utf8');

function fabrique(lignes) {
  const entetes = ['Date debut Cahier des Charges', 'Type', 'Etape', 'Date Limite', '', '% Réalisé', 'Statut', 'Attribution', 'Date signature de contrat', 'Date ODS', 'Durée du contrat (mois)', 'Échéance', 'Date Attribution Finale', 'Durée Passation (jours)'];
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
  [jours(-10), 'CF', 'x', '', '', 0, '', '', '', '', '', '', '', '']                                                         // statut vide
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
});
