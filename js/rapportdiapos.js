/**
 * Diapositives « Dossiers CPM non achevés » pour le rapport hebdomadaire : une série de diapositives par tableau du rapport
 * (DAO et CF / contrats d'application / convention cadre / autres), avec N° de dossier, intitulé, avancement en jauge et commentaire.
 * Le commentaire est en GRAS quand le dossier a changé pendant la semaine choisie. Les diapositives sont à AJOUTER à la fin du PowerPoint existant.
 * La partie « préparer » est pure (testée en Node) ; « construire » dessine avec PptxGenJS (passé en paramètre).
 */
var RapportDiapos = (function () {
  var PAR_DIAPO = 6;
  var C = { nuit: '1A1A2E', orange: 'E85D04', gris: 'E5E7EB', texte: '1F2937', doux: '6B7280', bande: 'F8F5F1', vert: '16A34A', ambre: 'F59E0B', rouge: 'DC2626' };

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
  function couper(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
  function pctDe(v) { var x = parseFloat(String(v == null ? '' : v).replace('%', '').replace(',', '.').trim()); return isNaN(x) ? 0 : Math.max(0, Math.min(100, x)); }

  /**
   * rows : lignes du CSV « Suivi CPM » ; evenements : journal ; debut : samedi (aaaa-mm-jj) ; synthese : le module Synthese (groupeRapport, plusJours).
   * Retourne { debut, fin, groupes: [{ cle, titre, dossiers: [{ numero, intitule, pct, commentaire, change }] }] } : seulement les dossiers à moins de 100 %.
   */
  function preparer(rows, evenements, debut, synthese) {
    var h = rows.findIndex(function (r) { return r.some(function (c) { return norm(c) === 'statut'; }); }); if (h === -1) h = 1;
    var fin = plusJours(debut, 6), touches = {};
    (evenements || []).forEach(function (e) {
      if (e.date < debut || e.date > fin || (e.champ !== 'commentaire' && e.champ !== 'pourcent' && e.type === 'modifie')) return;
      if (e.type === 'retire') return;
      touches[norm(e.n_dossier) + '|' + norm(e.dossier)] = true;
    });
    var titres = { daocf: 'DAO et CF', application: 'Contrats d\'application', cadre: 'Contrats d\'application convention cadre', autres: 'Autres dossiers' };
    var groupes = ['daocf', 'application', 'cadre', 'autres'].map(function (k) { return { cle: k, titre: titres[k], dossiers: [] }; });
    rows.slice(h + 1).forEach(function (r) {
      var intitule = (r[3] || '').trim(), statut = (r[8] || '').trim(); if (!intitule && !statut) return;
      var pct = pctDe(r[7]); if (pct >= 100) return;
      var numero = (r[2] || '').trim();
      var g = groupes.filter(function (x) { return x.cle === synthese.groupeRapport(r[1]); })[0];
      g.dossiers.push({ numero: numero, intitule: intitule, pct: pct, commentaire: (r[9] || '').trim(), change: !!touches[norm(numero) + '|' + norm(intitule)] });
    });
    return { debut: debut, fin: fin, groupes: groupes.filter(function (g) { return g.dossiers.length; }) };
  }

  function plusJours(iso, n) { var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function frIso(iso) { var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function couleurJauge(p) { return p >= 70 ? C.vert : p >= 40 ? C.ambre : C.orange; }

  /** Dessine les diapositives dans `pptx` (PptxGenJS) ; retourne le nombre de diapositives ajoutées. */
  function construire(pptx, rapport) {
    pptx.layout = 'LAYOUT_16x9'; // 10 × 5,625 po
    var n = 0, total = 0;
    rapport.groupes.forEach(function (g) { total += Math.ceil(g.dossiers.length / PAR_DIAPO); });
    rapport.groupes.forEach(function (g) {
      var pages = Math.ceil(g.dossiers.length / PAR_DIAPO);
      for (var p = 0; p < pages; p += 1) {
        var s = pptx.addSlide(); n += 1; s.background = { color: 'FFFFFF' };
        s.addShape('rect', { x: 0, y: 0, w: 10, h: 0.85, fill: { color: C.nuit }, line: { color: C.nuit, width: 0 } });
        s.addShape('rect', { x: 0, y: 0.85, w: 10, h: 0.05, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
        s.addText('Dossiers CPM non achevés — ' + g.titre + (pages > 1 ? '  (' + (p + 1) + '/' + pages + ')' : ''), { x: 0.4, y: 0.12, w: 7.4, h: 0.4, fontFace: 'Calibri', fontSize: 18, bold: true, color: 'FFFFFF', margin: 0 });
        s.addText('Semaine du ' + frIso(rapport.debut) + ' au ' + frIso(rapport.fin), { x: 0.4, y: 0.5, w: 7.4, h: 0.28, fontFace: 'Calibri', fontSize: 11, color: 'F4B183', margin: 0 });
        s.addText(g.dossiers.length + ' dossier' + (g.dossiers.length > 1 ? 's' : ''), { x: 7.8, y: 0.2, w: 1.8, h: 0.45, align: 'right', fontFace: 'Calibri', fontSize: 14, bold: true, color: 'FFFFFF', margin: 0 });
        var X = { num: 0.4, int: 1.95, jau: 4.75, com: 6.45 }, W = { num: 1.45, int: 2.65, jau: 1.6, com: 3.2 };
        [['N° Dossier', 'num'], ['Intitulé', 'int'], ['Avancement', 'jau'], ['Commentaire', 'com']].forEach(function (c) {
          s.addText(c[0], { x: X[c[1]], y: 1.0, w: W[c[1]], h: 0.28, fontFace: 'Calibri', fontSize: 10, bold: true, color: C.orange, margin: 0 });
        });
        s.addShape('line', { x: 0.4, y: 1.3, w: 9.2, h: 0, line: { color: C.orange, width: 1 } });
        g.dossiers.slice(p * PAR_DIAPO, (p + 1) * PAR_DIAPO).forEach(function (d, i) {
          var y = 1.38 + i * 0.64;
          if (i % 2 === 0) s.addShape('rect', { x: 0.3, y: y - 0.03, w: 9.4, h: 0.62, fill: { color: C.bande }, line: { color: C.bande, width: 0 } });
          if (d.change) s.addShape('rect', { x: 0.3, y: y - 0.03, w: 0.05, h: 0.62, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
          s.addText(d.numero || '—', { x: X.num, y: y, w: W.num, h: 0.56, valign: 'middle', fontFace: 'Calibri', fontSize: 8.5, color: C.doux, margin: 0 });
          s.addText(couper(d.intitule, 78), { x: X.int, y: y, w: W.int, h: 0.56, valign: 'middle', fontFace: 'Calibri', fontSize: 10.5, bold: true, color: C.texte, margin: 0 });
          s.addShape('roundRect', { x: X.jau, y: y + 0.2, w: 1.1, h: 0.16, rectRadius: 0.08, fill: { color: C.gris }, line: { color: C.gris, width: 0 } });
          if (d.pct > 0) s.addShape('roundRect', { x: X.jau, y: y + 0.2, w: Math.max(0.16, 1.1 * d.pct / 100), h: 0.16, rectRadius: 0.08, fill: { color: couleurJauge(d.pct) }, line: { color: couleurJauge(d.pct), width: 0 } });
          s.addText(Math.round(d.pct) + ' %', { x: X.jau + 1.15, y: y, w: 0.5, h: 0.56, valign: 'middle', fontFace: 'Calibri', fontSize: 11, bold: true, color: C.texte, margin: 0 });
          s.addText(couper(d.commentaire, 150) || '—', { x: X.com, y: y, w: W.com, h: 0.56, valign: 'middle', fontFace: 'Calibri', fontSize: 8.5, bold: d.change, color: d.change ? C.texte : C.doux, margin: 0 });
        });
        s.addText('Commentaire en gras = dossier modifié cette semaine', { x: 0.4, y: 5.28, w: 6, h: 0.25, fontFace: 'Calibri', fontSize: 8, italic: true, color: C.doux, margin: 0 });
        s.addText('Division Infrastructures — RNS   ·   ' + n + '/' + total, { x: 6.2, y: 5.28, w: 3.4, h: 0.25, align: 'right', fontFace: 'Calibri', fontSize: 8, color: C.doux, margin: 0 });
      }
    });
    return n;
  }

  return { preparer: preparer, construire: construire, PAR_DIAPO: PAR_DIAPO };
})();
if (typeof module !== 'undefined') module.exports = RapportDiapos;
