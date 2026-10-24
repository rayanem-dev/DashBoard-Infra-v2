// Journal des changements du CPM : comparaison, rapport hebdomadaire, instantané et envoi (faux services Google, vm).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ENTETE = ['Début', 'Type', 'N° dossier', 'Intitulé', 'Étape', 'Date limite', 'Échéance', '%', 'Statut', 'Commentaire', 'Attrib', 'Durée', 'Attribué à', 'N° contrat', 'Montant', 'Signature', 'ODS', 'Durée contrat', 'Échéance contrat'];
const ligne = (o) => { const r = new Array(27).fill(''); Object.entries(o).forEach(([i, v]) => { r[i] = v; }); return r; };
const feuille = (dossiers) => [new Array(27).fill(''), ENTETE.concat(new Array(8).fill('')), ...dossiers];

class FauxSheet {
  constructor() { this.v = []; }
  getDataRange() { return { getValues: () => this.v.map(r => r.slice()) }; }
  appendRow(r) { this.v.push(r.slice()); }
  setFrozenRows() {}
  getRange(l, c, nl = 1, nc = 1) {
    const s = this;
    return {
      setNumberFormat() {}, setValues(vals) { vals.forEach((row, i) => { s.v[l - 1 + i] = s.v[l - 1 + i] || []; row.forEach((x, j) => { s.v[l - 1 + i][c - 1 + j] = x; }); }); },
    };
  }
  getLastRow() { return this.v.length; }
  getLastColumn() { return Math.max(0, ...this.v.map(r => r.length)); }
  clearContents() { this.v = []; }
  deleteRow(n) { this.v.splice(n - 1, 1); }
}

function monde(opts = {}) {
  const feuilles = {}, mails = [], props = {};
  let source = feuille(opts.depart || []);
  const ctx = {
    console, Logger: { log() {} }, Utilities: { formatDate: (d, tz, f) => d.toISOString().slice(0, 10) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => feuilles[n] || null, insertSheet: n => (feuilles[n] = new FauxSheet()) }) },
    prop_: () => 'DB', lignesSource_: () => source,
    MailApp: { sendEmail: m => mails.push(m) },
    Session: { getActiveUser: () => ({ getEmail: () => 'moi@x.dz' }) },
    Store: { table: () => [{ email: 'Chef@x.dz', role: 'chef_division', actif: 1 }, { email: 'sec@x.dz', role: 'secretariat', actif: 1 }, { email: 'ag@x.dz', role: 'agent', actif: 1 }, { email: 'off@x.dz', role: 'secretariat', actif: 0 }] },
    Auth: { userFromToken: t => ({ email: t }) },
    acces_: u => ({ cpm: { a: 1, b: 3, c: 0 }[u.email] || 0 }),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'CpmJournal.gs'), 'utf8'), ctx);
  return { ctx, mails, props, feuilles, set: l => { source = feuille(l); }, run: c => vm.runInContext(c, ctx) };
}
const A = ligne({ 1: 'Dossier Appel Offre DAO', 2: 'D1', 3: 'Réhabilitation réseau', 8: 'Dossier en cours', 7: '10 %' });
const B = ligne({ 1: 'Consultation Fournisseur CF', 2: 'D2', 3: 'Fourniture pièces', 8: 'Attribué', 12: 'Atlas', 14: '3 400 000' });

test('premier instantané : état de départ mémorisé, aucun changement inventé', () => {
  const m = monde({ depart: [A, B] });
  const r = m.run('cpmInstantane_()');
  assert.strictEqual(r.base, true); assert.strictEqual(r.evenements, 0); assert.strictEqual(r.dossiers, 2);
  assert.strictEqual(m.feuilles.CpmJournal.v.length, 1); // en-tête seul
});
test('deuxième nuit : statut modifié, nouveau dossier, dossier retiré, champ modifié ; espaces et casse ignorés', () => {
  const m = monde({ depart: [A, B] }); m.run('cpmInstantane_()');
  const A2 = ligne({ 2: 'D1', 3: 'Réhabilitation réseau', 8: 'Contrat en exécution', 7: '10%', 16: '01/03/2026', 17: '8' });
  const C = ligne({ 2: 'D3', 3: 'Nettoyage', 8: 'Non démarré' });
  m.set([A2, C]); // B retiré
  const r = m.run('cpmInstantane_()');
  const lignes = m.feuilles.CpmJournal.v.slice(1);
  const types = lignes.map(l => l[3] + ':' + l[4]).sort();
  assert.deepStrictEqual([...types], ['modifie:date_ods', 'modifie:duree_contrat', 'modifie:statut', 'nouveau:', 'retire:']);
  assert.strictEqual(r.evenements, 5);
  const st = lignes.find(l => l[4] === 'statut'); assert.deepStrictEqual([st[6], st[7]], ['Dossier en cours', 'Contrat en exécution']);
  // troisième nuit sans changement : rien de plus
  m.run('cpmInstantane_()'); assert.strictEqual(m.feuilles.CpmJournal.v.length, lignes.length + 1);
});
test('clé : sans N° de dossier on retombe sur l\'intitulé ; intitulés en double distingués', () => {
  const r = vm.runInContext('cpmEnregistrements_', monde().ctx)(feuille([ligne({ 3: 'Peinture', 8: 'x' }), ligne({ 3: 'Peinture', 8: 'y' })]));
  assert.strictEqual(r.ordre.length, 2); assert.ok(r.ordre[0].startsWith('T:peinture'));
});
test('feuille vide : instantané refusé (on ne vide pas l\'état de la veille)', () => {
  const m = monde({ depart: [A] }); m.run('cpmInstantane_()');
  m.set([]);
  assert.throws(() => m.run('cpmInstantane_()'), /vide ou illisible/);
  assert.strictEqual(m.feuilles.CpmEtat.v.length, 2);
});
test('rapport : sections, pluriels, échappement HTML, contrats à surveiller', () => {
  const m = monde();
  const ev = [{ date: '2026-10-12', type: 'modifie', champ: 'statut', libelle: 'Statut', dossier: 'Réseau <eau>', avant: 'Dossier en cours', apres: 'Attribué' },
    { date: '2026-10-12', type: 'nouveau', dossier: 'Nettoyage', apres: 'Non démarré' }, { date: '2026-10-13', type: 'modifie', champ: 'montant', libelle: 'Montant', dossier: 'Pièces', avant: '', apres: '3 400 000' }];
  m.ctx.__ev = ev; m.ctx.__ech = [{ dossier: 'Terrassement', restants: 30, pct: 83 }];
  const r = m.run("cpmRapport_(__ev, __ech, '2026-10-06', '2026-10-13')");
  assert.match(r.sujet, /Semaine du 06\/10\/2026 au 13\/10\/2026 : 3 changements/);
  assert.match(r.html, /1 changement de statut/); assert.match(r.html, /Réseau &lt;eau&gt;/); assert.match(r.html, /<i>vide<\/i> → 3 400 000/); assert.match(r.html, /il reste 30 jours/);
  const vide = m.run("cpmRapport_([], [], '2026-10-06', '2026-10-13')"); assert.match(vide.sujet, /aucun changement/); assert.match(vide.html, /Aucun changement/);
});
test('échéances : seuls les contrats en exécution à ≥ 60 % du délai', () => {
  const m = monde(); const auj = new Date(2026, 9, 14);
  m.ctx.__etat = { dossiers: {
    a: { intitule: 'Presque fini', statut: 'Contrat en exécution', date_ods: '01/03/2026', duree_contrat: '8', echeance: '' },
    b: { intitule: 'Début', statut: 'Contrat en exécution', date_ods: '01/10/2026', duree_contrat: '12', echeance: '' },
    c: { intitule: 'Attribué', statut: 'Attribué', date_ods: '01/03/2026', duree_contrat: '8', echeance: '' } } };
  m.ctx.__auj = auj;
  const r = m.run('cpmEcheances_(__etat, __auj)'); assert.strictEqual(r.length, 1); assert.strictEqual(r[0].dossier, 'Presque fini');
});
test('rapport hebdomadaire : envoyé à la direction active (sans doublon), essai = soi-même ; journal sans droit refusé', () => {
  const m = monde({ depart: [A, B] }); m.props.CPM_RAPPORT_DESTINATAIRES = 'sec@x.dz, direction@x.dz';
  m.run('cpmInstantane_()'); m.run('cpmRapportSemaine()');
  assert.strictEqual(m.mails.length, 1); assert.deepStrictEqual(m.mails[0].to.split(',').sort(), ['chef@x.dz', 'direction@x.dz', 'sec@x.dz']);
  m.run('cpmRapportEssai()'); assert.strictEqual(m.mails[1].to, 'moi@x.dz');
  assert.throws(() => m.run("cpmJournalListe_({ token: 'c' })"), /Droits insuffisants/);
  assert.throws(() => m.run("cpmInstantaneMaintenant_({ token: 'c' })"), /Droits insuffisants/);
  assert.strictEqual(m.run("cpmInstantaneMaintenant_({ token: 'a' })").recent, true);   // un instantané vient d'être pris : pas de relecture avant 1 minute
  assert.ok(m.run("cpmJournalListe_({ token: 'a' })").evenements);
});

test('chaque événement porte le type du dossier (colonne B) et son N° de dossier ; un ancien onglet reçoit les nouvelles colonnes', () => {
  const m = monde({ depart: [A, B] }); m.run('cpmInstantane_()');
  m.feuilles.CpmJournal.v = [['date', 'cle', 'dossier', 'type', 'champ', 'libelle', 'avant', 'apres']]; // ancien format
  const A2 = ligne({ 1: 'Dossier Appel Offre DAO', 2: 'D1', 3: 'Réhabilitation réseau', 8: 'Attribué', 7: '10 %' });
  m.set([A2, B]); m.run('cpmInstantane_()');
  assert.strictEqual(m.feuilles.CpmJournal.v[0].length, 10);
  const l = m.feuilles.CpmJournal.v[1]; assert.strictEqual(l[8], 'Dossier Appel Offre DAO'); assert.strictEqual(l[9], 'D1');
});

test('journal : suppression d\'une ligne sans importance (niveau 2 requis), le reste et l\'état de comparaison sont intacts', () => {
  const m = monde({ depart: [A, B] }); m.run('cpmInstantane_()');
  const A2 = ligne({ 2: 'D1', 3: 'Réhabilitation réseau', 8: 'Contrat en exécution', 7: '10%' });
  m.set([A2, B]); m.run('cpmInstantane_()');
  const J = m.feuilles.CpmJournal.v; assert.strictEqual(J.length, 2);
  const e = { date: J[1][0], cle: J[1][1], type: J[1][3], champ: J[1][4], avant: J[1][6], apres: J[1][7] };
  m.ctx.req = { token: 'a', evenement: e };
  assert.throws(() => m.run('cpmJournalSupprimer_(req)'), /Droits insuffisants/);
  m.ctx.req = { token: 'b', evenement: e };
  m.ctx.Store.journal = () => {};
  assert.strictEqual(m.run('cpmJournalSupprimer_(req)').supprimees, 1);
  assert.strictEqual(m.feuilles.CpmJournal.v.length, 1);
  assert.strictEqual(m.feuilles.CpmEtat.v.length, 3);
  assert.strictEqual(m.run('cpmJournalListe_({ token: "b" })').peut_supprimer, true);
});
