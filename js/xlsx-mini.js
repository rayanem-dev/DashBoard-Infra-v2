/**
 * Mini générateur de classeur Excel (.xlsx) sans dépendance : feuilles, styles (titre, tuiles, en-têtes orange, bordures), fusions, largeurs, volet figé, filtre.
 * Un .xlsx est un zip de fichiers XML : ici zip « sans compression » (fiable et léger pour quelques centaines de lignes).
 * XlsxMini.blob({ feuilles: [{ nom, grille: false, largeurs: [..], fusions: ['A1:F1'], figer: 1, filtre: 'A1:H80', lignes: [[cellule, ...], ...] }] }) → Blob
 * Cellule : texte, nombre, ou { v: valeur, s: nomDeStyle } avec s ∈ XlsxMini.STYLES (titre, sous, tuileN, tuileL, entete, texte, gras, centre, bande).
 */
(function (racine) {
  var STYLES = { defaut: 0, titre: 1, sous: 2, tuileN: 3, tuileL: 4, entete: 5, texte: 6, gras: 7, centre: 8, bande: 9 };
  function esc(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(n) { var s = ''; n += 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  var STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="6"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF1F2937"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="26"/><color rgb="FFE85D04"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1E6"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE85D04"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function feuilleXml(f) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    x += '<sheetViews><sheetView workbookViewId="0"' + (f.grille === false ? ' showGridLines="0"' : '') + '>' + (f.figer ? '<pane ySplit="' + f.figer + '" topLeftCell="A' + (f.figer + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews>';
    x += '<sheetFormatPr defaultRowHeight="18"/>';
    if (f.largeurs) x += '<cols>' + f.largeurs.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    x += '<sheetData>';
    f.lignes.forEach(function (l, r) {
      var h = l.hauteur ? ' ht="' + l.hauteur + '" customHeight="1"' : '';
      x += '<row r="' + (r + 1) + '"' + h + '>';
      (l.cellules || l).forEach(function (c, i) {
        if (c == null) return;
        var v = typeof c === 'object' ? c.v : c, s = typeof c === 'object' && c.s ? (STYLES[c.s] || 0) : 0, ref = col(i) + (r + 1);
        if (v === '' || v == null) x += '<c r="' + ref + '" s="' + s + '"/>';
        else if (typeof v === 'number' && isFinite(v)) x += '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>';
        else x += '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (f.filtre) x += '<autoFilter ref="' + f.filtre + '"/>';
    if (f.fusions && f.fusions.length) x += '<mergeCells count="' + f.fusions.length + '">' + f.fusions.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>';
    return x;
  }
  // ----- zip « stocké » -----
  var TABLE = null;
  function crc32(oct) { if (!TABLE) { TABLE = []; for (var n = 0; n < 256; n += 1) { var c = n; for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } } var crc = 0xFFFFFFFF; for (var i = 0; i < oct.length; i += 1) crc = TABLE[(crc ^ oct[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
  function u8(s) { return new TextEncoder().encode(s); }
  function zip(fichiers) {
    var parts = [], centrale = [], decalage = 0;
    function u16(n) { return [n & 255, (n >>> 8) & 255]; } function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    fichiers.forEach(function (f) {
      var nom = u8(f.nom), data = u8(f.texte), crc = crc32(data);
      var loc = [].concat([0x50, 0x4B, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nom.length), u16(0));
      parts.push(new Uint8Array(loc), nom, data);
      centrale.push([].concat([0x50, 0x4B, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nom.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(decalage)), Array.prototype.slice.call(nom));
      decalage += loc.length + nom.length + data.length;
    });
    var taille = 0; centrale.forEach(function (c) { parts.push(new Uint8Array(c)); taille += c.length; });
    parts.push(new Uint8Array([].concat([0x50, 0x4B, 5, 6], u16(0), u16(0), u16(fichiers.length), u16(fichiers.length), u32(taille), u32(decalage), u16(0))));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function blob(classeur) {
    var fe = classeur.feuilles, F = [];
    F.push({ nom: '[Content_Types].xml', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + fe.map(function (_, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    F.push({ nom: '_rels/.rels', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    F.push({ nom: 'xl/workbook.xml', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + fe.map(function (f, i) { return '<sheet name="' + esc(String(f.nom).replace(/[\[\]*?:\/\\]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
    F.push({ nom: 'xl/_rels/workbook.xml.rels', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + fe.map(function (_, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (fe.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    F.push({ nom: 'xl/styles.xml', texte: STYLES_XML });
    fe.forEach(function (f, i) { F.push({ nom: 'xl/worksheets/sheet' + (i + 1) + '.xml', texte: feuilleXml(f) }); });
    return zip(F);
  }
  var API = { blob: blob, STYLES: STYLES, col: col, _zip: zip, _crc32: crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.XlsxMini = API;
})(typeof window !== 'undefined' ? window : this);
