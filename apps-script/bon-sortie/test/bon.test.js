const test = require('node:test'), assert = require('node:assert');
const { lirePersonnes_, bonHtml_, adressesValides_, dateFr_, lireSignataires_, filtrerSignataires_, fusionnerPersonnes_ } = require('../Code.js');

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
  assert.ok(h.includes('Bon De Sortie Matériel') && h.includes('ZIANI &lt;b&gt;Karim') && h.includes('- 02 (deux) pompes<br>- 10 (dix) câbles'));
  assert.ok(h.includes('17/10/2026') && h.includes('Construction') && h.includes('data:image/jpeg;base64,AAAA'));
  assert.ok(h.includes('Date : ...........') && h.includes('Structure : .......')); // preneur et SIE sans date : pointillés du modèle
  assert.ok(h.includes('Instruction particulière') && h.includes('en deux exemplaires'));
  assert.ok(!bonHtml_({}, '').includes('<img')); // sans logo : pas d'image cassée
});
test('adresses e-mail : valides seulement, séparateurs libres', () => {
  assert.deepStrictEqual(adressesValides_('a@x.dz; b@y.dz, pas-un-mail  c@z.com'), ['a@x.dz', 'b@y.dz', 'c@z.com']);
  assert.strictEqual(dateFr_('2026-10-17'), '17/10/2026');
});

test('signataires : désignés par leur nom, quel que soit l\'ordre ou la casse ; seuls ceux-là sont retenus', () => {
  const noms = lireSignataires_([['Nom et prénom', 'remarque'], ['karim ziani', ''], ['', ''], ['AMANI Brahim', 'x']]);
  assert.deepStrictEqual(noms, ['karim ziani', 'AMANI Brahim']);
  const tous = [{ nom: 'ZIANI Karim' }, { nom: 'AMANI Brahim' }, { nom: 'BAHI Ramzi' }];
  assert.deepStrictEqual(filtrerSignataires_(tous, noms).map(p => p.nom), ['ZIANI Karim', 'AMANI Brahim']);
  assert.deepStrictEqual(filtrerSignataires_(tous, []).map(p => p.nom), []);
});
test('preneurs : BDDORGA puis Enquêtes, sans doublon, triés', () => {
  const r = fusionnerPersonnes_([{ nom: 'ZIANI Karim', service: 'Construction' }], [{ nom: 'Karim ZIANI', service: 'ENAGEO', source: 'enquetes' }, { nom: 'BAHI Ramzi', service: 'ETS RADJAA', source: 'enquetes' }]);
  assert.deepStrictEqual(r.map(p => [p.nom, p.source]), [['BAHI Ramzi', 'enquetes'], ['ZIANI Karim', 'bddorga']]);
});
test('matériel : un tiret par ligne, sans doubler le tiret saisi, lignes vides ignorées', () => {
  const h = bonHtml_({ materiel: '- 13 pièces Tube 3"\n\n  – Pompe immergée\nCâble' });
  assert.ok(h.includes('- 13 pièces Tube 3&quot;<br>- Pompe immergée<br>- Câble'));
});
