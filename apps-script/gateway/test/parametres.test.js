// node --test apps-script/gateway/test/parametres.test.js
const test = require('node:test');
const assert = require('node:assert');
const P = require('../Parametres.gs');
const Rapports = require('../Rapports.gs');

test('registre : identifiants uniques, valeur d\'origine valide pour chaque réglage', () => {
  const ids = P.REGISTRE.map(d => d.id); assert.strictEqual(new Set(ids).size, ids.length);
  P.REGISTRE.forEach(d => { if (d.defaut !== '') assert.strictEqual(P.valider(d, d.defaut).erreur, undefined, d.id); });
});
test('nombre : virgule acceptée, bornes respectées, texte refusé', () => {
  const d = P.def('stats_st.heures');
  assert.strictEqual(P.valider(d, ' 288,5 ').valeur, '288.5'); assert.ok(P.valider(d, '0').erreur); assert.ok(P.valider(d, '800').erreur); assert.ok(P.valider(d, 'abc').erreur); assert.ok(P.valider(d, '').erreur);
  assert.ok(P.valider(P.def('benchmark.dispersion'), '1').erreur);
});
test('adresses : « Nom <adresse> », séparateurs variés, doublons écartés, adresse invalide refusée', () => {
  const a = P.adresses('Sec <a@x.dz>; b@x.dz\nA@X.dz, c@y.com');
  assert.deepStrictEqual(a.liste.map(x => x.email), ['a@x.dz', 'b@x.dz', 'c@y.com']); assert.strictEqual(a.liste[0].nom, 'Sec');
  assert.ok(P.adresses('pas-une-adresse').erreur); assert.ok(P.adresses('a@b').erreur);
  assert.ok(P.adresses(Array.from({ length: 40 }, (_, i) => 'u' + i + '@x.dz').join('\n')).erreur);
});
test('liste d\'adresses : normalisée à l\'enregistrement ; vide refusé quand une valeur d\'origine existe, permis pour « supplémentaires »', () => {
  assert.strictEqual(P.valider(P.def('rapports.boites_chef_division'), 'Chef <c@x.dz>;d@x.dz').valeur, 'Chef <c@x.dz>\nd@x.dz');
  assert.ok(P.valider(P.def('rapports.boites_chef_division'), '  ').erreur);
  assert.strictEqual(P.valider(P.def('cpm.rapport_extra'), '').valeur, '');
});
test('e-mail et adresse web', () => {
  assert.ok(P.valider(P.def('reservation.destinataire'), 'x').erreur); assert.strictEqual(P.valider(P.def('reservation.destinataire'), ' a@b.dz ').valeur, 'a@b.dz');
  assert.ok(P.valider(P.def('portail.site_url'), 'http://x.dz').erreur); assert.strictEqual(P.valider(P.def('portail.site_url'), 'https://x.dz/app').valeur, 'https://x.dz/app/');
});
test('valeur utilisée : enregistrée > ancienne propriété > origine', () => {
  const legacy = k => ({ STATS_ST_HEURES: '300' })[k] || '';
  const e = id => P.etat([{ cle: 'reservation.destinataire', valeur: 'z@x.dz' }], legacy).find(x => x.id === id);
  assert.deepStrictEqual([e('reservation.destinataire').valeur, e('reservation.destinataire').source], ['z@x.dz', 'parametres']);
  assert.deepStrictEqual([e('stats_st.heures').valeur, e('stats_st.heures').source], ['300', 'ancien']);
  assert.deepStrictEqual([e('benchmark.taux').valeur, e('benchmark.taux').source], ['9', 'defaut']);
  assert.strictEqual(P.valeurDe([], null, 'stats_st.heures'), '360');
});
test('boîtes d\'envoi du consolidé : réglées dans Paramètres, sinon d\'origine', () => {
  const b = P.adresses(P.def('rapports.boites_secretariat').defaut).liste; assert.strictEqual(b.length, 3);
  assert.deepStrictEqual(Rapports.boitesDestinataires({ secretariat: true }, { secretariat: [{ nom: 'N', email: 'n@x.dz' }] }).map(x => x.email), ['n@x.dz']);
  assert.strictEqual(Rapports.boitesDestinataires({ secretariat: true, chef_service: true, chef_division: true }).length, 8);
  const origine = Rapports.boitesDestinataires({ chef_service: true }).map(x => x.email), param = P.adresses(P.def('rapports.boites_chef_service').defaut).liste.map(x => x.email);
  assert.deepStrictEqual(param, origine);   // les valeurs d'origine de la page reproduisent exactement les anciennes boîtes
});
