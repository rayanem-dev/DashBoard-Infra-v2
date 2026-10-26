/**
 * Suivi des véhicules (classeur « SUIVI VH », onglet « OLd » : Tableau d'affectation des véhicules de la Division Infrastructure).
 *  - la page vehicules.html (recherche par personne, véhicule, date d'autorisation, entreprise…) lit et corrige ce tableau ;
 *  - chaque Autorisation d'accès générée par « Prise en charge et autorisation d'accès » renseigne ou met à jour la ligne du véhicule (voir Pec.gs).
 * Partie PURE (testée en Node : test/vehicules.test.js), puis les accès au classeur.
 */
var VH = (function () {
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[°º]/g, ' ').replace(/[_\s]+/g, ' ').replace(/[:.\s]+$/, '').trim(); }
  function immatNorm(s) { var t = String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, ''); return /^\d{5,}/.test(t) ? t : ''; }   // « 00164-216-30 » → « 0016421630 » ; « — », « 2022 » : pas une immatriculation
  var CHAMPS = ['modele', 'immat', 'affectation', 'categorie', 'prestataire', 'contrat', 'auth', 'macaron', 'chauffeur', 'radio', 'date', 'valide'];
  var LIBELLES = { modele: 'Type de véhicule', immat: 'Immatriculation', affectation: 'Affectation', categorie: 'Catégorie', prestataire: 'Prestataire', contrat: 'Contrat N°', auth: 'N° autorisation', macaron: 'Macaron prêt', chauffeur: 'Chauffeur', radio: 'Radio', date: 'Date d\'autorisation', valide: 'Valable jusqu\'au' };
  var ENTETES_NEUFS = { date: 'Date d\'autorisation', valide: 'Valable jusqu\'au' };
  /** Repère l'en-tête (ligne contenant « Immatriculation ») et la colonne de chaque champ ; null si absent. */
  function colonnes(valeurs) {
    for (var r = 0; r < Math.min(15, valeurs.length); r += 1) {
      var h = (valeurs[r] || []).map(norm), iI = h.indexOf('immatriculation'); if (iI < 0) continue;
      var types = []; h.forEach(function (x, i) { if (x === 'type de vehicule') types.push(i); });
      var c = { ligne: r, modele: types[0], immat: iI, categorie: types[1], affectation: Math.max(h.indexOf('affecation'), h.indexOf('affectation')), prestataire: Math.max(h.indexOf('prestatire'), h.indexOf('prestataire')),
        contrat: h.indexOf('contrat n'), auth: Math.max(h.indexOf('n authorisation'), h.indexOf('n autorisation')), macaron: Math.max(h.indexOf('macaron pret'), h.indexOf('macaron prêt')), chauffeur: h.indexOf('chauffeur'), radio: h.indexOf('radio'),
        date: h.indexOf('date d autorisation'), valide: h.indexOf('valable jusqu au'), largeur: h.length };
      CHAMPS.forEach(function (k) { if (c[k] === undefined || c[k] < 0) c[k] = -1; });
      if (c.modele < 0) return null;
      return c;
    }
    return null;
  }
  function texte(v) { if (v instanceof Date) return v.toISOString().slice(0, 10); return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  /** Lignes du tableau → [{ ligne, modele, immat, … }] (ligne = numéro dans la feuille, à partir de 1) ; les lignes sans véhicule ni immatriculation sont ignorées. */
  function lire(valeurs) {
    var c = colonnes(valeurs); if (!c) return { colonnes: null, lignes: [] };
    var out = [];
    for (var i = c.ligne + 1; i < valeurs.length; i += 1) {
      var r = valeurs[i] || [], o = { ligne: i + 1 };
      CHAMPS.forEach(function (k) { o[k] = c[k] >= 0 ? texte(r[c[k]]) : ''; });
      if (!o.modele && !o.immat) continue;
      out.push(o);
    }
    return { colonnes: c, lignes: out };
  }
  /** Feuille « Feuille 2 » (Affectation VH : type, immatriculation, affectation = entreprise, nom & prénom) → [{ modele, immat, entreprise, personne }]. */
  function lireFeuille2(valeurs) {
    var h = -1; for (var r = 0; r < Math.min(15, valeurs.length); r += 1) if ((valeurs[r] || []).map(norm).indexOf('immatriculation') >= 0) { h = r; break; }
    if (h < 0) return [];
    var e = valeurs[h].map(norm), iT = e.indexOf('type de vehicule'), iI = e.indexOf('immatriculation'), iA = Math.max(e.indexOf('affectation'), e.indexOf('affecation')), iN = e.indexOf('nom & prenom'), out = [];
    for (var i = h + 1; i < valeurs.length; i += 1) { var l = valeurs[i] || []; if (!texte(l[iT]) && !texte(l[iI])) continue; out.push({ modele: texte(l[iT]), immat: texte(l[iI]), entreprise: iA >= 0 ? texte(l[iA]) : '', personne: iN >= 0 ? texte(l[iN]) : '' }); }
    return out;
  }
  function numeroAuth(s) { var m = /(\d+)\s*$/.exec(String(s || '')); return m ? parseInt(m[1], 10) : 0; }
  function formaterAuth(n) { return 'INFR N°' + (n < 10 ? '0' + n : String(n)); }
  /**
   * Plan d'écriture pour des véhicules autorisés : vehicules = [{ modele, immat, chauffeur }] ; ctx = { affectation, categorie, prestataire, contrat, date, valide }.
   * Un véhicule déjà dans le tableau (même immatriculation) est mis à jour (le n° d'autorisation, le macaron et la radio sont conservés) ; sinon une ligne est ajoutée avec le n° suivant.
   * L'affectation reprend l'orthographe déjà utilisée dans le tableau (« Service_Travaux_Entretien »…).
   */
  function planifier(lignes, vehicules, ctx) {
    var par = {}, maxAuth = 0, ortho = {}, plan = { maj: [], ajouter: [] }, deja = {};
    (lignes || []).forEach(function (l) { var k = immatNorm(l.immat); if (k && !par[k]) par[k] = l; maxAuth = Math.max(maxAuth, numeroAuth(l.auth)); if (l.affectation) ortho[norm(l.affectation)] = l.affectation; });
    var aff = ortho[norm(ctx.affectation)] || String(ctx.affectation || '');
    (vehicules || []).forEach(function (v) {
      var k = immatNorm(v.immat); if (!k || deja[k]) { if (k) { var prec = deja[k]; if (v.chauffeur && prec.champs.chauffeur.split(' / ').indexOf(v.chauffeur) < 0) prec.champs.chauffeur += ' / ' + v.chauffeur; } return; }
      var champs = { modele: v.modele || '', immat: v.immat, affectation: aff, categorie: ctx.categorie || '', prestataire: ctx.prestataire || '', contrat: ctx.contrat || '', chauffeur: v.chauffeur || '', date: ctx.date || '', valide: ctx.valide || '' };
      var ex = par[k], entree;
      if (ex) { var maj = {}; Object.keys(champs).forEach(function (f) { if (f === 'modele' ? !ex.modele && champs[f] : (f === 'immat' ? false : champs[f] !== '' && champs[f] !== ex[f])) maj[f] = champs[f]; }); entree = { ligne: ex.ligne, champs: maj }; plan.maj.push(entree); }
      else { maxAuth += 1; champs.auth = formaterAuth(maxAuth); entree = { champs: champs }; plan.ajouter.push(entree); }
      deja[k] = entree; if (!entree.champs.chauffeur && entree.champs.chauffeur !== undefined) entree.champs.chauffeur = '';
      if (ex && entree.champs.chauffeur === undefined) entree.champs.chauffeur = undefined;
      if (entree.champs.chauffeur === undefined) entree.champs.chauffeur = '';
    });
    // une mise à jour sans chauffeur ne doit pas effacer celui du tableau
    plan.maj.forEach(function (m) { if (m.champs.chauffeur === '') delete m.champs.chauffeur; });
    return plan;
  }
  /** Fin du mois (ou du mois suivant) de la date ISO. */
  function finDeMois(iso, moisSuivant) { var p = String(iso).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1 + (moisSuivant ? 2 : 1), 0)).toISOString().slice(0, 10); }
  return { norm: norm, immatNorm: immatNorm, CHAMPS: CHAMPS, LIBELLES: LIBELLES, ENTETES_NEUFS: ENTETES_NEUFS, colonnes: colonnes, lire: lire, lireFeuille2: lireFeuille2, planifier: planifier, formaterAuth: formaterAuth, numeroAuth: numeroAuth, finDeMois: finDeMois };
})();
if (typeof module !== 'undefined') module.exports = VH;

// ---------- classeur « SUIVI VH » ----------
var SUIVI_VH_ID_DEFAUT_ = '1fRd_Yen2ynGPvkIF7zUMBh7P6-ZywrqfQ-2ZyTQmHfU';
function vhClasseur_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SUIVI_VH_ID') || SUIVI_VH_ID_DEFAUT_); }
function vhOnglet_() { var ss = vhClasseur_(); return ss.getSheetByName('OLd') || ss.getSheets()[0]; }
function vhLireOnglet_() {
  var sh = vhOnglet_(), vals = sh.getDataRange().getValues(), lu = VH.lire(vals);
  if (!lu.colonnes) throw new Error('Tableau des véhicules introuvable (ligne d\'en-tête avec « Immatriculation »)');
  return { sh: sh, vals: vals, c: lu.colonnes, lignes: lu.lignes };
}
/** Ajoute à droite les en-têtes « Date d'autorisation » et « Valable jusqu'au » s'ils manquent (mêmes couleurs que l'en-tête voisin). */
function vhAssurerColonnes_(t) {
  var c = t.c, sh = t.sh, suivante = c.largeur;
  ['date', 'valide'].forEach(function (k) {
    if (c[k] >= 0) return;
    var src = sh.getRange(c.ligne + 1, Math.max(c.radio, c.chauffeur, 1) + 1), dst = sh.getRange(c.ligne + 1, suivante + 1);
    if (sh.getMaxColumns() < suivante + 1) sh.insertColumnAfter(sh.getMaxColumns());
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); dst.setValue(VH.ENTETES_NEUFS[k]); sh.setColumnWidth(suivante + 1, 130);
    c[k] = suivante; suivante += 1;
  });
  c.largeur = suivante;
}
function vhEcrire_(t, ligne, champs) {
  Object.keys(champs).forEach(function (k) {
    if (VH.CHAMPS.indexOf(k) < 0 || t.c[k] < 0) return;
    var cell = t.sh.getRange(ligne, t.c[k] + 1); cell.setNumberFormat('@'); cell.setValue(String(champs[k] == null ? '' : champs[k]));
  });
}
function vhAjouter_(t, champs) {
  var derniere = t.lignes.length ? Math.max.apply(null, t.lignes.map(function (l) { return l.ligne; })) : t.c.ligne + 1, neuve = derniere + 1;
  if (t.sh.getMaxRows() < neuve) t.sh.insertRowsAfter(t.sh.getMaxRows(), neuve - t.sh.getMaxRows());
  if (derniere > t.c.ligne + 1) t.sh.getRange(derniere, 1, 1, t.c.largeur).copyTo(t.sh.getRange(neuve, 1, 1, t.c.largeur), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);   // mise en forme de la ligne précédente
  vhEcrire_(t, neuve, champs); return neuve;
}
/** Appelé après chaque Autorisation d'accès générée (Pec.gs) : renseigne ou met à jour la ligne de chaque véhicule dans le tableau. Ne bloque jamais la génération. */
function vhEnregistrerDepuisPec_(d) {
  var parts = String(d.prestataire || '').split(' - ').map(function (x) { return x.trim(); }), auj = Dates.today();
  var vehicules = (d.personnes || []).filter(function (p) { return p && VH.immatNorm(p.immatriculation); }).map(function (p) {
    return { modele: String(p.typeVehicule || '').trim(), immat: String(p.immatriculation).trim(), chauffeur: [p.nom, p.prenom].filter(function (x) { return x && String(x).trim(); }).join(' ').trim() };
  });
  if (!vehicules.length) return { maj: 0, ajoutes: 0 };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var t = vhLireOnglet_(); vhAssurerColonnes_(t);
    var plan = VH.planifier(t.lignes, vehicules, { affectation: d.emputation || '', categorie: 'Vehicule Prestataire', prestataire: parts.length > 1 ? parts[1] : parts[0], contrat: parts.length > 1 ? parts[0] : '', date: auj, valide: VH.finDeMois(auj, !!d.valable2Mois) });
    plan.maj.forEach(function (m) { vhEcrire_(t, m.ligne, m.champs); });
    plan.ajouter.forEach(function (a) { t.lignes.push({ ligne: vhAjouter_(t, a.champs) }); });
    return { maj: plan.maj.length, ajoutes: plan.ajouter.length };
  } finally { lock.releaseLock(); }
}

// ---------- page « Véhicules » ----------
function vhDroit_(req, min) {
  var u = Auth.userFromToken(req.token), n = acces_(u).logistique || 0;
  if (n < min) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return { u: u, niveau: n };
}
function vhLire_(req) {
  var d = vhDroit_(req, 1), t = vhLireOnglet_(), f2 = [];
  try { var onglet2 = vhClasseur_().getSheetByName('Feuille 2'); if (onglet2) f2 = VH.lireFeuille2(onglet2.getDataRange().getValues()); } catch (e) { /* onglet facultatif */ }
  var parImmat = {}; f2.forEach(function (x) { var k = VH.immatNorm(x.immat); if (k && x.personne && !/^vehicule /i.test(x.personne)) (parImmat[k] = parImmat[k] || []).push(x.personne); });
  var vus = {};
  var lignes = t.lignes.map(function (l) { var k = VH.immatNorm(l.immat); if (k) vus[k] = true; var o = {}; Object.keys(l).forEach(function (c) { o[c] = l[c]; }); o.personnes = (parImmat[k] || []).join(' / '); return o; });
  f2.forEach(function (x) {   // véhicules de « Feuille 2 » absents du tableau principal : visibles en lecture seule
    var k = VH.immatNorm(x.immat); if (k && vus[k]) return; if (k) vus[k] = true;
    lignes.push({ ligne: 0, modele: x.modele, immat: x.immat, affectation: '', categorie: '', prestataire: x.entreprise, contrat: '', auth: '', macaron: '', chauffeur: '', radio: '', date: '', valide: '', personnes: x.personne && !/^vehicule /i.test(x.personne) ? x.personne : '', lecture_seule: true });
  });
  return { niveau: d.niveau, lignes: lignes, libelles: VH.LIBELLES };
}
function vhChamps_(c) {
  var out = {}, LONG = { modele: 60, immat: 30, affectation: 60, categorie: 40, prestataire: 80, contrat: 60, auth: 20, macaron: 30, chauffeur: 120, radio: 120, date: 10, valide: 10 };
  Object.keys(LONG).forEach(function (k) { if (c && c[k] !== undefined) { out[k] = String(c[k]).replace(/\s+/g, ' ').trim().slice(0, LONG[k]); if (/^[=+@<>]/.test(out[k])) throw new Error('Valeur invalide pour « ' + VH.LIBELLES[k] + ' »'); } });
  ['date', 'valide'].forEach(function (k) { if (out[k] && !/^\d{4}-\d{2}-\d{2}$/.test(out[k])) throw new Error(VH.LIBELLES[k] + ' : AAAA-MM-JJ'); });
  return out;
}
function vhGarde_(t, req) {   // la ligne visée doit toujours être celle que la page a affichée (le tableau a pu bouger)
  var l = t.lignes.filter(function (x) { return x.ligne === Number(req.ligne); })[0];
  if (!l || VH.immatNorm(l.immat) !== VH.immatNorm(req.immat_avant) || String(l.modele) !== String(req.modele_avant || '')) throw new Error('Le tableau a changé depuis votre ouverture : rechargez la page');
  return l;
}
function vhMaj_(req) {
  var d = vhDroit_(req, 2), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { var t = vhLireOnglet_(); vhAssurerColonnes_(t); var l = vhGarde_(t, req), ch = vhChamps_(req.champs); vhEcrire_(t, l.ligne, ch); Store.journal('vh_maj', d.u.email, String(l.immat) + ' : ' + Object.keys(ch).join(', ')); return { ok: true }; }
  finally { lock.releaseLock(); }
}
function vhAjouterAction_(req) {
  var d = vhDroit_(req, 2), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var t = vhLireOnglet_(), ch = vhChamps_(req.champs); vhAssurerColonnes_(t);
    if (!ch.modele && !ch.immat) throw new Error('Indiquez le type de véhicule ou l\'immatriculation');
    if (ch.immat && VH.immatNorm(ch.immat) && t.lignes.some(function (l) { return VH.immatNorm(l.immat) === VH.immatNorm(ch.immat); })) throw new Error('Ce véhicule existe déjà dans le tableau');
    if (!ch.auth) ch.auth = VH.formaterAuth(Math.max.apply(null, [0].concat(t.lignes.map(function (l) { return VH.numeroAuth(l.auth); }))) + 1);
    var n = vhAjouter_(t, ch); Store.journal('vh_ajout', d.u.email, ch.immat + ' ' + ch.auth); return { ok: true, ligne: n };
  } finally { lock.releaseLock(); }
}
function vhSupprimer_(req) {
  var d = vhDroit_(req, 2), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { var t = vhLireOnglet_(), l = vhGarde_(t, req); t.sh.deleteRow(l.ligne); Store.journal('vh_suppr', d.u.email, String(l.immat) + ' ' + String(l.auth)); return { ok: true }; }
  finally { lock.releaseLock(); }
}
