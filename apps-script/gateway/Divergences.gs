/**
 * Contrôle de l'annuaire : compare les fiches contact (annuaire du portail, ANNUAIRE_DATA) avec BDDORGA et liste les divergences
 * (téléphone, e-mail, matricule, identifiant SONA, employeur) ainsi que les personnes présentes d'un seul côté.
 * Les prestataires (absents de BDDORGA) ne sont pas comparés. Réservé à l'administration de la sécurité (secrétariat). Ne modifie rien.
 */
var Divergences = (function () {
  function norme(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function jetons(s) { return norme(s).split(' ').filter(Boolean).sort().join(' '); }
  function chiffres(s) { return String(s == null ? '' : s).replace(/\D+/g, ''); }
  function neuf(s) { var d = chiffres(s); if (d.indexOf('213') === 0 && d.length > 9) d = d.slice(3); return d.length >= 9 ? d.slice(-9) : ''; }

  /** Détails d'une fiche personne → { tels:[9 chiffres], email, sona, matricule } */
  function analyserCarte(d) {
    var txt = String(d || ''), tels = [], m, re = /(?:\+?213|0)?[\d ]{9,14}/g;
    (txt.match(/📞[^|✉]*/g) || []).forEach(function (bloc) { (bloc.match(/[\d +]{9,}/g) || []).forEach(function (x) { var n = neuf(x); if (n && tels.indexOf(n) === -1) tels.push(n); }); });
    m = txt.match(/[\w.+-]+@[\w.-]+\.\w+/);
    var s = txt.match(/ID Sonatrach\s*:\s*(\S+)/i), mat = txt.match(/Matricule\s*:\s*([^|]+?)\s*(?:\||$)/i);
    return { tels: tels, email: m ? m[0].toLowerCase() : '', sona: s ? s[1].toLowerCase() : '', matricule: mat ? mat[1].trim().toUpperCase() : '' };
  }
  function cartesPersonnes(data) {
    var out = [];
    (data.rows || []).forEach(function (r) {
      var emp = String(r[4] || '').trim().toUpperCase();
      if (!emp) return; // fiche de poste ou de service, pas une personne
      var a = analyserCarte(r[2]);
      out.push({ nom: r[1], employeur: emp, section: String(r[3] || ''), tels: a.tels, email: a.email, sona: a.sona, matricule: a.matricule });
    });
    return out;
  }
  function empNorm(v) { var n = norme(v); if (!n || n === 'sh' || n === 'sonatrach') return 'SONATRACH'; return n.toUpperCase(); }

  /** personnes : résultat d'Annuaire.lire(...).personnes ; data : ANNUAIRE_DATA. */
  function comparer(personnes, data) {
    var cartes = cartesPersonnes(data), prest = cartes.filter(function (c) { return c.employeur === 'PRESTATAIRE'; }).length;
    var staff = cartes.filter(function (c) { return c.employeur !== 'PRESTATAIRE'; });
    var parMat = {}, parSona = {}, parMail = {}, parNom = {};
    personnes.forEach(function (p) { var k;
      if ((k = String(p.matricule || '').toUpperCase())) parMat[k] = p; if ((k = String(p.sona || '').toLowerCase())) parSona[k] = p; if ((k = String(p.email || '').toLowerCase())) parMail[k] = p; if ((k = jetons(p.nom))) parNom[k] = p; });
    var div = [], sansBdd = [], utilises = {}, appariees = 0;
    staff.forEach(function (c) {
      var p = (c.matricule && parMat[c.matricule]) || (c.sona && parSona[c.sona]) || (c.email && parMail[c.email]) || parNom[jetons(c.nom)] || null;
      if (!p) { sansBdd.push({ nom: c.nom, employeur: c.employeur, section: c.section }); return; }
      appariees += 1; utilises[String(p.email).toLowerCase()] = true;
      function noter(champ, fiche, bdd, types) { div.push({ nom: c.nom, champ: champ, fiche: fiche, bddorga: bdd, genre: types }); }
      var tb = neuf(p.telephone);
      if (c.tels.length && tb) { if (c.tels.indexOf(tb) === -1) noter('Téléphone', c.tels.join(' / '), p.telephone, 'different'); }
      else if (tb && !c.tels.length) noter('Téléphone', '', p.telephone, 'manque_fiche');
      else if (!tb && c.tels.length) noter('Téléphone', c.tels.join(' / '), '', 'manque_bddorga');
      [['E-mail', c.email, String(p.email || '').toLowerCase()], ['Identifiant SONA', c.sona, String(p.sona || '').toLowerCase()], ['Matricule', c.matricule, String(p.matricule || '').toUpperCase()]].forEach(function (x) {
        if (x[1] && x[2]) { if (x[1] !== x[2]) noter(x[0], x[1], x[2], 'different'); }
        else if (x[2]) noter(x[0], '', x[2], 'manque_fiche'); else if (x[1]) noter(x[0], x[1], '', 'manque_bddorga');
      });
      var eb = empNorm(p.dependance), ef = empNorm(c.employeur);
      if (eb !== ef) noter('Employeur', c.employeur, p.dependance || '(vide)', 'different');
    });
    var sansFiche = personnes.filter(function (p) { return !utilises[String(p.email).toLowerCase()]; }).map(function (p) { return { nom: p.nom, service: p.service, employeur: p.dependance || '' }; });
    return { divergences: div, fiches_sans_bddorga: sansBdd, bddorga_sans_fiche: sansFiche, prestataires_non_compares: prest, appariees: appariees, fiches_personnes: staff.length, bddorga: personnes.length };
  }
  return { comparer: comparer, analyserCarte: analyserCarte, cartesPersonnes: cartesPersonnes, neuf: neuf };
})();

/** Action « contacts_divergences » (administration de la sécurité). */
function contactsDivergences_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  if (typeof ANNUAIRE_DATA === 'undefined') throw new Error('Données des fiches contact absentes de la passerelle (déploiement incomplet)');
  var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var src = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  if (!src) throw new Error('Onglet BDDORGA introuvable dans le fichier Organigramme');
  var lu = Annuaire.lire(src.getDataRange().getValues());
  if (lu.erreur) throw new Error(lu.erreur);
  return Divergences.comparer(lu.personnes, ANNUAIRE_DATA);
}
