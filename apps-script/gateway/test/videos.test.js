// Vidéos de formation privées : assemblage des morceaux et générateur des fichiers de la passerelle.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { videoAssembler_ } = require('../Videos.gs');
const { generer, TAILLE } = require('../../../outils/generer-videos-gateway.js');

test('assemblage : morceaux recollés dans l\'ordre ; identifiant inconnu ou hérité refusé', () => {
  const parties = { a: { mp4: ['AB', 'CD', 'E'], poster: ['xy'] } };
  assert.deepStrictEqual(videoAssembler_(parties, 'a'), { mp4: 'ABCDE', poster: 'xy' });
  assert.strictEqual(videoAssembler_(parties, 'b'), null); assert.strictEqual(videoAssembler_(parties, 'constructor'), null); assert.strictEqual(videoAssembler_({}, 'a'), null);
});
test('générateur : fichiers .gs par morceaux, recollés ils redonnent exactement la vidéo', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'vsrc-')), out = fs.mkdtempSync(path.join(os.tmpdir(), 'vout-'));
  const mp4 = Buffer.alloc(TAILLE * 1.5 * 0.75 | 0, 7); mp4[5] = 200; fs.writeFileSync(path.join(src, 'essai-un.mp4'), mp4); fs.writeFileSync(path.join(src, 'essai-un.jpg'), Buffer.from([1, 2, 3]));
  const r = generer(src, out); assert.deepStrictEqual(r.ids, ['essai-un']);
  const ctx = {}; new Function('ctx', r.fichiers.map(f => fs.readFileSync(path.join(out, f), 'utf8')).join('\n') + '\nctx.p = videosFormationParties_();')(ctx);
  assert.ok(ctx.p['essai-un'].mp4.length >= 2, 'plusieurs morceaux');
  assert.ok(r.fichiers.every(f => fs.statSync(path.join(out, f)).size < TAILLE + 200));
  assert.strictEqual(Buffer.from(ctx.p['essai-un'].mp4.join(''), 'base64').equals(mp4), true);
  assert.strictEqual(Buffer.from(ctx.p['essai-un'].poster.join(''), 'base64').toString('hex'), '010203');
});
