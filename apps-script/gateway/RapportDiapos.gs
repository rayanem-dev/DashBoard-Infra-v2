/**
 * Injection des diapositives « dossiers CPM non achevés » à la FIN du rapport hebdomadaire (Google Slides « Rapport Hebdomadire Infra »).
 * Le navigateur prépare les données (js/rapportdiapos.js : dossiers à moins de 100 %, commentaires modifiés dans la semaine) et les envoie ici ;
 * la passerelle dessine les diapositives dans le style du rapport (titre, filet gris, cadre bleu, tableau bleu) avec le décor de pied de page des diapositives existantes.
 * Les diapositives ajoutées la semaine précédente (repérées par leurs notes « diapos-cpm-auto ») sont remplacées : on peut relancer sans doublon.
 * Une seule fois : ouvrir l'éditeur de la passerelle et exécuter autoriserDiapos() pour accepter l'accès à Google Slides.
 */
var RAPPORT_SLIDES_ID_DEFAUT_ = '1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20';
var RD_MARQUE_ = 'diapos-cpm-auto';
var RD_PAR_DIAPO_ = 6;
var RD_BLEU_ = '#5B9BD5', RD_CLAIR_ = '#DCE6F2', RD_LIGNE_ = '#CFDDEE', RD_CADRE_ = '#DCE6F2', RD_BORD_ = '#5B7FB3';

function rdCouper_(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
function rdFr_(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
function rdJauge_(p) { return p >= 70 ? '#16A34A' : p >= 40 ? '#F59E0B' : '#E85D04'; }

/** Contrôle et nettoie les données reçues du navigateur. */
function rdNettoyer_(r) {
  if (!r || !Array.isArray(r.groupes)) throw new Error('Données du rapport invalides');
  var total = 0;
  var groupes = r.groupes.slice(0, 6).map(function (g) {
    var d = (Array.isArray(g.dossiers) ? g.dossiers : []).slice(0, 80).map(function (x) {
      var pct = Math.max(0, Math.min(99.99, Number(x.pct) || 0)); total += 1;
      return { numero: rdCouper_(x.numero, 60), intitule: rdCouper_(x.intitule, 90), pct: pct, commentaire: rdCouper_(x.commentaire, 150), change: x.change === true };
    });
    return { titre: rdCouper_(g.titre, 80), dossiers: d };
  }).filter(function (g) { return g.dossiers.length; });
  if (!total || total > 200) throw new Error(total ? 'Trop de dossiers' : 'Aucun dossier à moins de 100 %');
  return { debut: String(r.debut || '').slice(0, 10), fin: String(r.fin || '').slice(0, 10), groupes: groupes };
}

/**
 * Plan de dessin (pur, testé en Node) : liste de diapositives, chacune une liste d'éléments sur une page de 720 × 540 points.
 * Éléments : { t: 'texte'|'rect'|'ligne', x, y, w, h, fond, bord, bordEp, texte, taille, gras, souligne, italique, couleur, align }.
 */
function rdPlan_(rapport) {
  var diapos = [], pages = 0;
  rapport.groupes.forEach(function (g) { pages += Math.ceil(g.dossiers.length / RD_PAR_DIAPO_); });
  var X = [50, 180, 360, 490], W = [130, 180, 130, 180], n = 0;
  rapport.groupes.forEach(function (g) {
    var nb = Math.ceil(g.dossiers.length / RD_PAR_DIAPO_);
    for (var p = 0; p < nb; p += 1) {
      n += 1; var e = [];
      e.push({ t: 'texte', x: 50, y: 22, w: 620, h: 36, texte: 'Situation des Dossiers CPM non achevés', taille: 24, gras: true, couleur: '#000000' });
      e.push({ t: 'ligne', x: 40, y: 66, w: 640, h: 0, bord: '#BFBFBF', bordEp: 1 });
      e.push({ t: 'rect', x: 50, y: 80, w: 620, h: 58, fond: RD_CADRE_, bord: RD_BORD_, bordEp: 1.5, texte: g.titre.toUpperCase() + (nb > 1 ? '  (' + (p + 1) + '/' + nb + ')' : '') + '\nSituation du ' + rdFr_(rapport.debut) + ' au ' + rdFr_(rapport.fin) + ' — ' + g.dossiers.length + ' dossier' + (g.dossiers.length > 1 ? 's' : ''), taille: 12, gras: true, couleur: '#000000', align: 'centre', premiereSouligne: true });
      ['N° Dossier', 'Intitulé', 'Avancement', 'Commentaire'].forEach(function (t, i) {
        e.push({ t: 'rect', x: X[i], y: 152, w: W[i], h: 32, fond: RD_BLEU_, bord: '#FFFFFF', bordEp: 1.5, texte: t, taille: 12, gras: true, couleur: '#000000', align: 'centre' });
      });
      g.dossiers.slice(p * RD_PAR_DIAPO_, (p + 1) * RD_PAR_DIAPO_).forEach(function (d, i) {
        var y = 184 + i * 50, fond = i % 2 === 0 ? RD_LIGNE_ : RD_CLAIR_;
        e.push({ t: 'rect', x: X[0], y: y, w: W[0], h: 50, fond: fond, bord: '#FFFFFF', bordEp: 1.5, texte: d.numero || '—', taille: 8, gras: true, couleur: '#000000', align: 'centre' });
        e.push({ t: 'rect', x: X[1], y: y, w: W[1], h: 50, fond: fond, bord: '#FFFFFF', bordEp: 1.5, texte: d.intitule, taille: 10, gras: true, couleur: '#000000', align: 'centre' });
        e.push({ t: 'rect', x: X[2], y: y, w: W[2], h: 50, fond: fond, bord: '#FFFFFF', bordEp: 1.5 });
        e.push({ t: 'rect', x: X[2] + 10, y: y + 20, w: 76, h: 10, fond: '#FFFFFF', bord: '#FFFFFF', bordEp: 0 });
        if (d.pct > 0) e.push({ t: 'rect', x: X[2] + 10, y: y + 20, w: Math.max(8, 76 * d.pct / 100), h: 10, fond: rdJauge_(d.pct), bord: rdJauge_(d.pct), bordEp: 0 });
        e.push({ t: 'texte', x: X[2] + 90, y: y + 12, w: 38, h: 26, texte: Math.round(d.pct) + ' %', taille: 11, gras: true, couleur: '#000000', align: 'centre' });
        e.push({ t: 'rect', x: X[3], y: y, w: W[3], h: 50, fond: fond, bord: '#FFFFFF', bordEp: 1.5, texte: d.commentaire || '—', taille: 8, gras: d.change, couleur: '#000000', align: 'centre' });
      });
      e.push({ t: 'texte', x: 50, y: 488, w: 500, h: 14, texte: 'Commentaire en gras : dossier modifié pendant la semaine', taille: 8, italique: true, couleur: '#595959' });
      diapos.push({ elements: e, note: RD_MARQUE_ + ' semaine=' + rapport.debut + ' page=' + n + '/' + pages });
    }
  });
  return diapos;
}


/** Dessine le plan dans une diapositive Google Slides (coordonnées 720 × 540 mises à l'échelle de la page). */
function rdDessiner_(slide, elements, sx, sy) {
  elements.forEach(function (el) {
    if (el.t === 'ligne') {
      var l = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, el.x * sx, el.y * sy, (el.x + el.w) * sx, el.y * sy);
      l.getLineFill().setSolidFill(el.bord); l.setWeight(el.bordEp); return;
    }
    var f = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, el.x * sx, el.y * sy, el.w * sx, el.h * sy);
    if (el.fond) f.getFill().setSolidFill(el.fond); else f.getFill().setTransparent();
    if (el.t === 'rect' && el.bord) { f.getBorder().getLineFill().setSolidFill(el.bord); f.getBorder().setWeight(el.bordEp || 0.5); } else f.getBorder().setTransparent();
    if (el.texte == null) return;
    var tr = f.getText(); tr.setText(String(el.texte));
    var st = tr.getTextStyle(); st.setFontFamily('Arial'); st.setFontSize(el.taille || 10); st.setBold(el.gras === true); st.setItalic(el.italique === true); st.setForegroundColor(el.couleur || '#000000');
    var ps = tr.getParagraphStyle(); ps.setParagraphAlignment(el.align === 'centre' ? SlidesApp.ParagraphAlignment.CENTER : SlidesApp.ParagraphAlignment.START);
    f.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
    if (el.premiereSouligne) { var p0 = tr.getParagraphs()[0]; if (p0) p0.getRange().getTextStyle().setUnderline(true); }
  });
}

function rapportDiaposInjecter_(req) {
  var u = Auth.userFromToken(req.token), acces = acces_(u);
  if ((acces.cpm || 0) < 1 || (acces.rapports || 0) < 2) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var rapport = rdNettoyer_(req.rapport), plan = rdPlan_(rapport);
  var id = PropertiesService.getScriptProperties().getProperty('RAPPORT_SLIDES_ID') || RAPPORT_SLIDES_ID_DEFAUT_;
  var pres = SlidesApp.openById(id);
  var anciennes = pres.getSlides().filter(function (s) { try { return s.getNotesPage().getSpeakerNotesShape().getText().asString().indexOf(RD_MARQUE_) === 0; } catch (e) { return false; } });
  var modele = pres.getSlides().filter(function (s) { return anciennes.indexOf(s) === -1; });
  var layout = (modele[1] || modele[0]).getLayout(); // décor (pied de page orange, logo) des diapositives existantes
  anciennes.forEach(function (s) { s.remove(); });
  var sx = pres.getPageWidth() / 720, sy = pres.getPageHeight() / 540;
  plan.forEach(function (d) {
    var s = pres.appendSlide(layout);
    s.getPlaceholders().forEach(function (ph) { ph.remove(); });
    rdDessiner_(s, d.elements, sx, sy);
    s.getNotesPage().getSpeakerNotesShape().getText().setText(d.note);
  });
  Store.journal('rapport_diapos', u.email, plan.length + ' diapositive(s) ajoutée(s), semaine ' + rapport.debut);
  return { diapositives: plan.length, remplacees: anciennes.length, url: 'https://docs.google.com/presentation/d/' + id + '/edit' };
}

/** À exécuter une fois dans l'éditeur : demande l'autorisation d'accès à Google Slides et vérifie que le rapport est lisible. */
function autoriserDiapos() {
  var id = PropertiesService.getScriptProperties().getProperty('RAPPORT_SLIDES_ID') || RAPPORT_SLIDES_ID_DEFAUT_;
  var pres = SlidesApp.openById(id);
  Logger.log('Rapport lisible : « ' + pres.getName() + ' », ' + pres.getSlides().length + ' diapositives.');
}
if (typeof module !== 'undefined') module.exports = { rdPlan_: rdPlan_, rdNettoyer_: rdNettoyer_ };
