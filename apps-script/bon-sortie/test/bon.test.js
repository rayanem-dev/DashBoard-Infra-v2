const test = require('node:test'), assert = require('node:assert');
const { lirePersonnes_, bonHtml_, adressesValides_, dateFr_ } = require('../Code.js');

test('BDDORGA : colonnes repérées par leur en-tête, doublons et lignes vides écartés, tri alphabétique', () => {
  const v = [['Nom et Prénom', 'Matricule', 'Fonction', 'Service', 'Dépendance'], ['ZIANI Karim', '12345', 'Ingénieur', 'Service Construction', 'SONATRACH'], ['', '', '', '', ''], ['AMANI Brahim', '777', 'Technicien', 'Entretien', 'ACOSCO'], ['ziani karim', '1', '', '', '']];
  const r = lirePersonnes_(v);
  assert.deepStrictEqual(r.map(p => p.nom), ['AMANI Brahim', 'ZIANI Karim']);
  assert.strictEqual(r[1].matricule, '12345'); assert.strictEqual(r[0].dependance, 'ACOSCO');
  assert.throws(() => lirePersonnes_([['autre']]), /introuvable/);
});
test('le bon reprend les champs, échappe le HTML et laisse les pointillés quand c\'est vide', () => {
  const h = bonHtml_({ soussigne: { nom: 'ZIANI <b>Karim', fonction: 'Ingénieur', matricule: '12345' }, autorise: { nom: 'AMANI Brahim' }, materiel: '02 (deux) pompes\n10 (dix) câbles', lieuEnlevement: 'Magasin', lieuDestination: 'Chantier',
    habilite: { date: '2026-10-17', structure: 'Construction' }, preneur: {}, sie: {}, instruction: '' }, 'AAAA');
  assert.ok(h.includes('Bon De Sortie Matériel') && h.includes('ZIANI &lt;b&gt;Karim') && h.includes('02 (deux) pompes<br>10 (dix) câbles'));
  assert.ok(h.includes('17/10/2026') && h.includes('Construction') && h.includes('data:image/jpeg;base64,AAAA'));
  assert.ok(h.includes('Date : ...........') && h.includes('Structure : .......')); // preneur et SIE sans date : pointillés du modèle
  assert.ok(h.includes('Instruction particulière') && h.includes('en deux exemplaires'));
  assert.ok(!bonHtml_({}, '').includes('<img')); // sans logo : pas d'image cassée
});
test('adresses e-mail : valides seulement, séparateurs libres', () => {
  assert.deepStrictEqual(adressesValides_('a@x.dz; b@y.dz, pas-un-mail  c@z.com'), ['a@x.dz', 'b@y.dz', 'c@z.com']);
  assert.strictEqual(dateFr_('2026-10-17'), '17/10/2026');
});
