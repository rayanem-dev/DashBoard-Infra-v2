// node --test apps-script/gateway/test/rapportmedias.test.js
const test = require('node:test');
const assert = require('node:assert');
const M = require('../RapportMedias.gs');

const ID = n => 'FILEID' + String(n).padStart(8, '0');
test('types acceptés : photos et vidéos usuelles seulement', () => {
  assert.deepStrictEqual(M.typeDe('image/jpeg'), { type: 'photo', ext: 'jpg' }); assert.strictEqual(M.typeDe('video/mp4').type, 'video'); assert.strictEqual(M.typeDe('video/quicktime').ext, 'mov');
  ['application/pdf', 'text/html', 'image/svg+xml', '', undefined].forEach(m => assert.strictEqual(M.typeDe(m), null));
});
test('liste enregistrée : forme vérifiée, doublons et excédent écartés, texte illisible = liste vide', () => {
  const l = M.nettoyerListe([{ id: ID(1), type: 'video', nom: 'a\nb', taille: 12.7 }, { id: ID(1) }, { id: 'x' }, null, { id: ID(2), type: 'bizarre' }]);
  assert.deepStrictEqual(l.map(m => [m.id, m.type, m.nom, m.taille]), [[ID(1), 'video', 'a b', 13], [ID(2), 'photo', '', 0]]);
  assert.strictEqual(M.nettoyerListe(Array.from({ length: 9 }, (_, i) => ({ id: ID(i) }))).length, M.MAX_PAR_RAPPORT);
  assert.deepStrictEqual(M.listeDe('pas du json'), []); assert.strictEqual(M.listeDe(JSON.stringify([{ id: ID(3), type: 'photo' }]))[0].id, ID(3));
});
test('morceau : photo en une fois, vidéo par morceaux, tailles et caractères contrôlés', () => {
  const ok = { mime: 'image/jpeg', partie: 0, total: 1, taille: 200000, data: 'QUJD' };
  assert.deepStrictEqual(M.controleMorceau(ok), { ok: true, type: 'photo', ext: 'jpg', premier: true, dernier: true });
  assert.ok(M.controleMorceau(Object.assign({}, ok, { total: 2 })).erreur);                              // une photo ne se découpe pas
  assert.ok(M.controleMorceau(Object.assign({}, ok, { taille: 3 * 1024 * 1024 })).erreur);               // photo trop lourde
  assert.ok(M.controleMorceau(Object.assign({}, ok, { mime: 'video/mp4', total: 2, taille: 21 * 1024 * 1024 })).erreur);   // vidéo trop lourde
  const v = M.controleMorceau({ mime: 'video/mp4', partie: 1, total: 3, taille: 5e6, data: 'QUJD' }); assert.deepStrictEqual([v.premier, v.dernier], [false, false]);
  assert.ok(M.controleMorceau(Object.assign({}, ok, { data: 'a b<script>' })).erreur); assert.ok(M.controleMorceau(Object.assign({}, ok, { data: '' })).erreur);
  assert.ok(M.controleMorceau(Object.assign({}, ok, { partie: 1 })).erreur); assert.ok(M.controleMorceau(Object.assign({}, ok, { mime: 'application/pdf' })).erreur);
});
test('nom de fichier lisible et sûr', () => {
  assert.strictEqual(M.nomFichier('2026-10-30', 'Forage_RNS/../x', 'video', 2, 'mp4'), '2026-10-30_Forage_RNSx_video-002.mp4');
});
test('enregistrement du rapport : anciens médias gardés ou retirés, nouveaux seulement s\'ils sont vérifiés', () => {
  const ex = [{ id: ID(1), type: 'photo', nom: 'a', taille: 1 }, { id: ID(2), type: 'video', nom: 'b', taille: 2 }];
  const verifie = id => id === ID(3) ? { id, type: 'photo', nom: 'c', taille: 3 } : null;      // ID(4) n'appartient pas à cette personne
  const f = M.fusion(ex, [ID(2), ID(3), ID(4), 'pas un id', ID(2)], verifie);
  assert.deepStrictEqual(f.gardes.map(m => m.id), [ID(2), ID(3)]); assert.deepStrictEqual(f.retires, [ID(1)]);
  assert.deepStrictEqual(M.fusion(JSON.stringify(ex), [], verifie).retires, [ID(1), ID(2)]);
});
