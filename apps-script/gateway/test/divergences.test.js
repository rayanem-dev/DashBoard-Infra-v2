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

test('ressemblance de noms : fautes, accents, ordre, initiales, prénoms composés ; noms différents refusés', () => {
  const s = (a, b) => D.simNom(a, b);
  assert.ok(s('KHATIRI Mohammed Sadek Elslam', 'KHATIRI MOHAMED SADEK ELISLAM') > 0.8);
  assert.ok(s('Loucif AZEGGAGH', 'AZEGGAGH Loucif') > 0.99);
  assert.ok(s('BOUAZIZ Hocine', 'BOUAZIZ Houcine') > 0.85);
  assert.ok(s('Benali Mohamed Amine', 'BENALI Mohamed') > 0.8);
  assert.ok(s('BENALI M.', 'BENALI Mohamed') > 0.6);
  assert.ok(s('BENALI Karim', 'BENALI Samir') < 0.62);
  assert.ok(s('HADJ Ali', 'MEZIANE Sofia') < 0.3);
});
test('correspondances probables : proposées (jamais appliquées seules), ambiguïté signalée, indices (téléphone)', () => {
  const bdd = [
    { nom: 'KHATIRI MOHAMED SADEK ELISLAM', email: 'k@x.dz', telephone: '0562303481', dependance: 'SONATRACH', service: 'S1' },
    { nom: 'BENALI KARIMA', email: 'bk@x.dz', telephone: '', dependance: 'ACOSCO', service: 'S2' },
    { nom: 'BENALI KARIMA', email: 'bk2@x.dz', telephone: '', dependance: 'ACOSCO', service: 'S5' },
    { nom: 'ZZ AUTRE', email: 'z@x.dz', telephone: '', dependance: 'GTP', service: 'S3' }];
  const cartes = data([
    ['KHATIRI Mohammed Sadek Elslam', '📞 0562303481', 'FROID', 'SONATRACH'],
    ['BENALI Karimaa', '📞 0600000001', 'FROID', 'ACOSCO'],
    ['TOTALEMENT DIFFERENT', '📞 0600000002', 'FROID', 'GTP']]);
  const r = D.comparer(bdd, cartes);
  assert.strictEqual(r.appariees, 0);
  const k = r.correspondances_probables.find(x => x.nom.startsWith('KHATIRI'));
  assert.strictEqual(k.candidats[0].email, 'k@x.dz'); assert.ok(k.candidats[0].indices.includes('même téléphone'));
  const b = r.correspondances_probables.find(x => x.nom === 'BENALI Karimaa');
  assert.ok(b.candidats.length >= 2); assert.strictEqual(b.candidats[0].ambigu, true);
  assert.deepStrictEqual([...r.fiches_sans_bddorga.map(x => x.nom)], ['TOTALEMENT DIFFERENT']);
  assert.deepStrictEqual([...r.bddorga_sans_fiche.map(x => x.nom)], ['ZZ AUTRE']);
});
test('rapprochement confirmé à la main : la fiche est comparée à la personne choisie (champs différents signalés)', () => {
  const bdd = [{ nom: 'KHATIRI MOHAMED SADEK ELISLAM', email: 'k@x.dz', telephone: '0562000000', dependance: 'SONATRACH', matricule: '', sona: '' }];
  const cartes = data([['KHATIRI Mohammed Sadek Elslam', '📞 0562303481', 'FROID', 'SONATRACH']]);
  const r = D.comparer(bdd, cartes, { [D.jetons('KHATIRI Mohammed Sadek Elslam')]: 'k@x.dz' });
  assert.strictEqual(r.appariees, 1); assert.strictEqual(r.correspondances_probables.length, 0);
  assert.deepStrictEqual([...r.rapproches.map(x => x.email)], ['k@x.dz']);
  assert.strictEqual(r.divergences.find(x => x.champ === 'Téléphone').genre, 'different');
});

test('annuaire fusionné : BDDORGA complète la fiche et la fiche complète BDDORGA ; 0 initial ; e-mail de la fiche gardé en « e-mail 2 »', () => {
  const bdd = [
    { nom: 'HADJADJ LAMINE', email: 'h@x.dz', matricule: '', sona: '', telephone: '', dependance: 'SONATRACH', service: 'Division', fonction: 'Chef' },
    { nom: 'BOUAZIZ HOCINE', email: 'hocin@gmail.com', matricule: '', sona: 'soni0299', telephone: '0659191322', dependance: 'ACOSCO', service: 'CPM', fonction: '' },
    { nom: 'LAKKAICHI NOUREDDINE', email: 'lak@gmail.com', matricule: '', sona: '', telephone: '661775887', dependance: 'SONATRACH', service: 'S', fonction: '' },
    { nom: 'NOUVEAU PERSONNE', email: 'n@x.dz', matricule: '9', sona: '', telephone: '', dependance: 'GTP', service: 'S2', fonction: '' }];
  const cartes = data([
    ['HADJADJ Lamine', '📞 660514275 | ID Sonatrach : sona12551 | Matricule : 90856S', 'CHEF DIVISION', 'SONATRACH'],
    ['BOUAZIZ Hocine', '📞 0659191322', 'CPM', 'ACOSCO'],
    ['LAKKAICHI Noureddine', '📞 0661775887 | ✉️ noureddine.lakkaichi@sonatrach.dz', 'FROID', 'SONATRACH'],
    ['AUCUNE Fiche', '📞 0600000000', 'FROID', 'SONATRACH'], ['PRESTA Un', '📞 0555000000', 'FROID', 'PRESTATAIRE']]);
  const r = D.fusionner(bdd, cartes, {});
  const par = n => r.personnes.find(p => p.nom === n);
  assert.strictEqual(par('HADJADJ Lamine').tel, '0660514275');   // téléphone pris sur la fiche, avec le 0 initial
  assert.strictEqual(par('HADJADJ Lamine').sona, 'sona12551'); assert.strictEqual(par('HADJADJ Lamine').matricule, '90856S');
  assert.strictEqual(par('HADJADJ Lamine').section, 'CHEF DIVISION');
  assert.strictEqual(par('BOUAZIZ Hocine').email, 'hocin@gmail.com'); assert.strictEqual(par('BOUAZIZ Hocine').sona, 'soni0299'); // pris sur BDDORGA (la fiche n'avait rien)
  assert.strictEqual(par('LAKKAICHI Noureddine').tel, '0661775887'); assert.strictEqual(par('LAKKAICHI Noureddine').email2, 'noureddine.lakkaichi@sonatrach.dz');
  assert.strictEqual(par('NOUVEAU PERSONNE').employeur, 'GTP');
  assert.deepStrictEqual([...r.remplace].sort(), ['BOUAZIZ Hocine', 'HADJADJ Lamine', 'LAKKAICHI Noureddine']);
});
