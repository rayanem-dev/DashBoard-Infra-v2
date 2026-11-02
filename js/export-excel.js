/**
 * Export Excel mis en forme (ExcelJS, chargé à la demande) : titre sur bandeau sombre, en-têtes orange, lignes alternées, ligne de total, volets figés.
 *   ExportExcel.telecharger({ fichier: 'stats.xlsx', titre: '…', sousTitre: '…', feuilles: [{ nom, colonnes: [{ titre, largeur, centre, nombre }], lignes: [[…]], total: [...] | null }] }) → Promise
 * Partagé par les pages qui proposent un export (statistiques sous-traitants, visites périodiques…).
 */
var ExportExcel = (function () {
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  function script(src) { return new Promise(function (ok, ko) { if (window.ExcelJS) return ok(); var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('Chargement impossible : ' + src)); }; document.head.appendChild(s); }); }
  function plein(c) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } }; }
  function feuille(wb, f, titre, sousTitre) {
    var n = f.colonnes.length, ws = wb.addWorksheet(String(f.nom).slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    var fine = { style: 'thin', color: { argb: 'FFD1D5DB' } }, bord = { top: fine, left: fine, bottom: fine, right: fine };
    ws.mergeCells(1, 1, 1, n); var t = ws.getCell(1, 1); t.value = titre; t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; t.fill = plein('1A1A2E'); t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 30;
    ws.mergeCells(2, 1, 2, n); var u = ws.getCell(2, 1); u.value = sousTitre || ''; u.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF6B7280' } }; u.alignment = { indent: 1 };
    var h = ws.getRow(4); f.colonnes.forEach(function (c, i) { var x = h.getCell(i + 1); x.value = c.titre; x.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } }; x.fill = plein(f.couleur || 'E85D04'); x.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; x.border = bord; ws.getColumn(i + 1).width = c.largeur || 16; }); h.height = 26;
    f.lignes.forEach(function (l, k) {
      var r = ws.getRow(5 + k); f.colonnes.forEach(function (c, i) {
        var x = r.getCell(i + 1), v = l[i]; x.value = (v === '' || v == null) ? null : v; x.border = bord; x.font = { name: 'Calibri', size: 10.5 };
        x.alignment = { vertical: 'middle', horizontal: c.nombre ? 'right' : c.centre ? 'center' : 'left', wrapText: !!c.retour }; if (c.nombre && typeof v === 'number') x.numFmt = '#,##0';
        if (k % 2) x.fill = plein('F8F5F1');
      });
    });
    if (f.total) { var r = ws.getRow(5 + f.lignes.length); f.colonnes.forEach(function (c, i) { var x = r.getCell(i + 1), v = f.total[i]; x.value = (v === '' || v == null) ? null : v; x.font = { name: 'Calibri', bold: true }; x.fill = plein('FDE7D3'); x.border = Object.assign({}, bord, { top: { style: 'medium', color: { argb: 'FF1A1A2E' } } }); x.alignment = { horizontal: c.nombre ? 'right' : 'left' }; if (c.nombre && typeof v === 'number') x.numFmt = '#,##0'; }); }
    return ws;
  }
  function telecharger(o) {
    return script(CDN).then(function () {
      var wb = new window.ExcelJS.Workbook(); wb.creator = 'Division Infrastructure RNS';
      o.feuilles.forEach(function (f) { feuille(wb, f, o.titre, o.sousTitre); });
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = o.fichier; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    });
  }
  return { telecharger: telecharger };
})();
