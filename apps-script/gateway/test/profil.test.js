// Profil personnel : validation des champs modifiables et fiche fusionnée avec les corrections de l'agent.
const test = require('node:test');
const assert = require('node:assert');
global.Dates = { today: () => '2026-10-24' };
const { profilValider_, profilFusion_ } = require('../Profil.gs');

test('champs valables : seules les valeurs fournies sont gardées, espaces nettoyés', () => {
  const r = profilValider_({ nom_affiche: '  Rayane   M. ', telephone: '0670 77 97 92', date_integration: '2025-05-01', wifi_user: 'r.rayane', civilite: 'M.' });
  assert.deepStrictEqual(r.champs, { nom_affiche: 'Rayane M.', telephone: '0670 77 97 92', date_integration: '2025-05-01', wifi_user: 'r.rayane', civilite: 'M.' });
  assert.deepStrictEqual(profilValider_({ telephone: '' }).champs, { telephone: '' }, 'vider un champ est permis (retour à la valeur de BDDORGA)');
  assert.deepStrictEqual(profilValider_({}).champs, {});
});
test('valeurs refusées : téléphone, date future ou mal écrite, Wi-Fi avec espace, noms trop longs', () => {
  assert.match(profilValider_({ telephone: 'abc' }).erreur, /Téléphone/);
  assert.match(profilValider_({ date_integration: '2027-01-01' }).erreur, /Date/);
  assert.match(profilValider_({ date_integration: '01/05/2025' }).erreur, /Date/);
  assert.match(profilValider_({ wifi_user: 'r rayane' }).erreur, /Wi-Fi/);
  assert.match(profilValider_({ nom_affiche: 'x'.repeat(61) }).erreur, /Nom/);
});
test('fiche fusionnée : corrections non vides prioritaires, nom officiel conservé, photo signalée', () => {
  const pub = { nom: 'MADANI RAYANE', telephone: '0550', civilite: '', wifi_user: 'wf.x', date_integration: '2025-05-01' };
  const f = profilFusion_(pub, { nom_affiche: 'Rayane', telephone: '0670', civilite: 'M.', wifi_user: '', photo_mini: 'data:image/jpeg;base64,AAA' });
  assert.strictEqual(f.nom, 'MADANI RAYANE'); assert.strictEqual(f.nom_affiche, 'Rayane'); assert.strictEqual(f.telephone, '0670'); assert.strictEqual(f.civilite, 'M.');
  assert.strictEqual(f.wifi_user, 'wf.x'); assert.strictEqual(f.photo, true);
  const g = profilFusion_(pub, null); assert.strictEqual(g.nom_affiche, 'MADANI RAYANE'); assert.strictEqual(g.photo, false); assert.strictEqual(pub.telephone, '0550', 'l\'original n\'est pas modifié');
});
