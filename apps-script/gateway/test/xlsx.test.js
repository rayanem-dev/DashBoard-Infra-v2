// Générateur de classeur Excel minimal (js/xlsx-mini.js) : zip valide, contenu relisible, caractères spéciaux échappés.
const test = require('node:test');
const assert = require('node:assert');
const X = require('../../../js/xlsx-mini.js');

test('crc32 connu et zip lisible (en-têtes locaux, répertoire central, fin de zip)', async () => {
  assert.strictEqual(X._crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const b = X.blob({ feuilles: [{ nom: 'A/B*C', lignes: [[{ v: 'Titre & <é>', s: 'titre' }, 12, '']] }] });
  const o = Buffer.from(await b.arrayBuffer());
  assert.strictEqual(o.readUInt32LE(0), 0x04034b50);
  assert.ok(o.includes(Buffer.from('xl/worksheets/sheet1.xml')) && o.includes(Buffer.from('xl/styles.xml')));
  assert.ok(o.includes(Buffer.from('Titre &amp; &lt;é&gt;')), 'texte échappé');
  assert.ok(!o.includes(Buffer.from('A/B*C')), 'caractères interdits retirés du nom de feuille');
  assert.strictEqual(o.readUInt32LE(o.length - 22), 0x06054b50);
});
