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
   * Retourne { debut, fin, groupes: [{ cle, titre, dossiers: [{ numero, intitule, pct, commentaire, change }] }] } : seulement les dossiers à moins de 100 % (hors dossiers « Non démarré »).
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
      if (synthese.cleStatut(statut) === 'nondemarre') return;   // dossier non démarré : pas dans les diapositives du rapport hebdomadaire
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

  /** Dessine les diapositives dans `pptx` (PptxGenJS) ; retourne le nombre de diapositives ajoutées. Présentation « tableau » sobre, comme les autres diapositives du rapport. */
  function construire(pptx, rapport) {
    pptx.layout = 'LAYOUT_16x9'; // 10 × 5,625 po
    var n = 0, total = 0, F = 'Calibri';
    rapport.groupes.forEach(function (g) { total += Math.ceil(g.dossiers.length / PAR_DIAPO); });
    var X = [0.4, 1.95, 4.75, 6.55], W = [1.55, 2.8, 1.8, 3.05]; // N° | Intitulé | Avancement | Commentaire
    rapport.groupes.forEach(function (g) {
      var pages = Math.ceil(g.dossiers.length / PAR_DIAPO);
      for (var p = 0; p < pages; p += 1) {
        var s = pptx.addSlide(); n += 1; s.background = { color: 'FFFFFF' };
        s.addText('Division Infrastructures', { x: 0.4, y: 0.18, w: 5, h: 0.25, fontFace: F, fontSize: 10, bold: true, color: C.orange, margin: 0 });
        s.addText('RNS : ' + frIso(rapport.fin), { x: 6.6, y: 0.18, w: 3, h: 0.25, align: 'right', fontFace: F, fontSize: 10, color: C.doux, margin: 0 });
        s.addText('Situation des dossiers CPM non achevés', { x: 0.4, y: 0.45, w: 9.2, h: 0.45, fontFace: F, fontSize: 24, bold: true, color: C.nuit, margin: 0 });
        s.addText(g.titre + (pages > 1 ? '  —  ' + (p + 1) + ' / ' + pages : '') + '   ·   ' + g.dossiers.length + ' dossier' + (g.dossiers.length > 1 ? 's' : '') + '   ·   semaine du ' + frIso(rapport.debut) + ' au ' + frIso(rapport.fin), { x: 0.4, y: 0.92, w: 9.2, h: 0.28, fontFace: F, fontSize: 12, color: C.doux, margin: 0 });
        s.addShape('line', { x: 0.4, y: 1.27, w: 9.2, h: 0, line: { color: C.orange, width: 2 } });
        s.addShape('rect', { x: 0.4, y: 1.4, w: 9.2, h: 0.36, fill: { color: C.nuit }, line: { color: C.nuit, width: 0 } });
        ['N° Dossier', 'Intitulé', 'Avancement', 'Commentaire'].forEach(function (t, i) {
          s.addText(t, { x: X[i] + 0.08, y: 1.4, w: W[i] - 0.1, h: 0.36, valign: 'middle', align: i === 2 ? 'center' : 'left', fontFace: F, fontSize: 11, bold: true, color: 'FFFFFF', margin: 0 });
        });
        g.dossiers.slice(p * PAR_DIAPO, (p + 1) * PAR_DIAPO).forEach(function (d, i) {
          var y = 1.76 + i * 0.5;
          s.addShape('line', { x: 0.4, y: y + 0.5, w: 9.2, h: 0, line: { color: 'D1D5DB', width: 0.75 } });
          s.addText(d.numero || '—', { x: X[0] + 0.08, y: y, w: W[0] - 0.12, h: 0.5, valign: 'middle', fontFace: F, fontSize: 8, color: C.doux, margin: 0 });
          s.addText(couper(d.intitule, 70), { x: X[1] + 0.08, y: y, w: W[1] - 0.12, h: 0.5, valign: 'middle', fontFace: F, fontSize: 10, bold: true, color: C.texte, margin: 0 });
          s.addShape('roundRect', { x: X[2] + 0.1, y: y + 0.17, w: 1.05, h: 0.16, rectRadius: 0.08, fill: { color: C.gris }, line: { color: C.gris, width: 0 } });
          if (d.pct > 0) s.addShape('roundRect', { x: X[2] + 0.1, y: y + 0.17, w: Math.max(0.16, 1.05 * d.pct / 100), h: 0.16, rectRadius: 0.08, fill: { color: couleurJauge(d.pct) }, line: { color: couleurJauge(d.pct), width: 0 } });
          s.addText(Math.round(d.pct) + ' %', { x: X[2] + 1.2, y: y, w: 0.55, h: 0.5, valign: 'middle', fontFace: F, fontSize: 11, bold: true, color: C.texte, margin: 0 });
          s.addText(couper(d.commentaire, 140) || '—', { x: X[3] + 0.08, y: y, w: W[3] - 0.1, h: 0.5, valign: 'middle', fontFace: F, fontSize: 8.5, bold: d.change, color: d.change ? C.texte : C.doux, margin: 0 });
        });
        s.addText('Commentaire en gras : dossier modifié pendant la semaine', { x: 0.4, y: 5.25, w: 6, h: 0.22, fontFace: F, fontSize: 8, italic: true, color: C.doux, margin: 0 });
        s.addText(n + ' / ' + total, { x: 8.6, y: 5.25, w: 1, h: 0.22, align: 'right', fontFace: F, fontSize: 8, color: C.doux, margin: 0 });
      }
    });
    return n;
  }

  return { preparer: preparer, construire: construire, PAR_DIAPO: PAR_DIAPO };
})();
if (typeof module !== 'undefined') module.exports = RapportDiapos;
