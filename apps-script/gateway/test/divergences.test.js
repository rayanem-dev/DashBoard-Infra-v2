// Contrôle de l'annuaire : fiches contact ↔ BDDORGA (appariement, divergences, personnes d'un seul côté).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Divergences.gs'), 'utf8').replace(/^function contactsDivergences_[\s\S]*$/m, ''), ctx);
const D = vm.runInContext('Divergences', ctx);
const data = (rows) => ({ groupes: ['g'], rows: rows.map(r => [0, ...r]) });
const copie = o => JSON.parse(JSON.stringify(o));

test('analyse d\'une fiche : téléphones (9 derniers chiffres), e-mail, SONA, matricule', () => {
  const a = D.analyserCarte('📞 0660514275 | ✉️ Lamine.HADJADJ@Sonatrach.dz | ID Sonatrach : sona12551 | Matricule : 90856S');
  assert.deepStrictEqual(copie(a), { tels: ['660514275'], email: 'lamine.hadjadj@sonatrach.dz', sona: 'sona12551', matricule: '90856S' });
  assert.deepStrictEqual(copie(D.analyserCarte('📞 +213 660 51 42 75 / 029 71 40 08')).tels, ['660514275', '029714008'.slice(-9)]);
});
test('appariement par matricule, SONA, e-mail puis nom (ordre des mots indifférent) ; divergences et manques', () => {
  const bdd = [
    { nom: 'HADJADJ LAMINE', email: 'l.hadjadj@sonatrach.dz', matricule: '90856S', sona: 'sona12551', telephone: '0660514275', dependance: 'SONATRACH', service: 'Division' },
    { nom: 'AZEGGAGH LOUCIF', email: 'a@x.dz', matricule: '', sona: '', telephone: '0661383099', dependance: 'ACOSCO', service: 'CPM' },
    { nom: 'BOUAZIZ HOCINE', email: 'b@x.dz', matricule: '', sona: 'sona1', telephone: '', dependance: 'ACOSCO', service: 'CPM' },
    { nom: 'SANS FICHE', email: 's@x.dz', matricule: '1', sona: '', telephone: '', dependance: 'GTP', service: 'S' }];
  const cartes = data([
    ['HADJADJ Lamine', '📞 0660514275 | ✉️ Lamine.HADJADJ@Sonatrach.dz | ID Sonatrach : sona12551 | Matricule : 90856S', 'CHEF', 'SONATRACH'],
    ['Loucif AZEGGAGH', '📞 0661383013', 'CPM', 'ACOSCO'],
    ['BOUAZIZ Hocine', '📞 0659191322', 'CPM', 'GTP'],
    ['INCONNU Paul', '📞 0600000000', 'X', 'SONATRACH'],
    ['PRESTA Un', '📞 0555000000', 'X', 'PRESTATAIRE'],
    ['Bureau cadre', '📞 7912', 'X', '']]);
  const r = D.comparer(bdd, cartes);
  const par = (nom, champ) => r.divergences.find(x => x.nom === nom && x.champ === champ);
  assert.strictEqual(r.divergences.filter(x => x.nom === 'HADJADJ Lamine').length, 1); // seule divergence : l'e-mail (nom différent de la fiche)
  assert.strictEqual(par('HADJADJ Lamine', 'E-mail').genre, 'different');
  assert.strictEqual(par('Loucif AZEGGAGH', 'Téléphone').genre, 'different');
  assert.strictEqual(par('BOUAZIZ Hocine', 'Téléphone').genre, 'manque_bddorga');
  assert.strictEqual(par('BOUAZIZ Hocine', 'Employeur').genre, 'different');
  assert.strictEqual(par('BOUAZIZ Hocine', 'Identifiant SONA').genre, 'manque_fiche');
  assert.deepStrictEqual([...r.fiches_sans_bddorga.map(x => x.nom)], ['INCONNU Paul']);
  assert.deepStrictEqual([...r.bddorga_sans_fiche.map(x => x.nom)], ['SANS FICHE']);
  assert.strictEqual(r.prestataires_non_compares, 1); assert.strictEqual(r.appariees, 3); assert.strictEqual(r.fiches_personnes, 4);
});
test('sur les vraies fiches du site : analyse sans erreur, 107 personnes dont des prestataires', () => {
  const w = {}; new Function('window', fs.readFileSync(path.join(racine, 'js', 'annuaire-data.js'), 'utf8'))(w);
  const c = D.cartesPersonnes(w.ANNUAIRE_DATA); assert.strictEqual(c.length, 107);
  const r = D.comparer([], w.ANNUAIRE_DATA); assert.strictEqual(r.fiches_sans_bddorga.length, 107 - 58); assert.strictEqual(r.prestataires_non_compares, 58);
});
