/**
 * Suivi des véhicules (classeur « SUIVI VH », onglet « SUIVI VH » : Tableau d'affectation des véhicules de la Division Infrastructure).
 * Colonnes : type de véhicule, immatriculation, affectation (service), catégorie, prestataire, contrat N°, chauffeur, radio, date d'autorisation, valable jusqu'au.
 *  - la page vehicules.html (recherche par chauffeur, véhicule, date d'autorisation, entreprise…) lit et corrige ce tableau ;
 *  - chaque Autorisation d'accès générée par « Prise en charge et autorisation d'accès » renseigne ou met à jour la ligne du véhicule (voir Pec.gs), sans aucune question.
 * Partie PURE (testée en Node : test/vehicules.test.js), puis les accès au classeur.
 */
var VH = (function () {
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[°º'’]/g, ' ').replace(/[_\s]+/g, ' ').replace(/[:.\s]+$/, '').trim(); }
  function immatNorm(s) { var t = String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, ''); return /^\d{4,}/.test(t) ? t : ''; }   // « 00164-216-30 » → « 0016421630 » ; « — » : pas une immatriculation
  var CHAMPS = ['modele', 'immat', 'affectation', 'categorie', 'prestataire', 'contrat', 'chauffeur', 'radio', 'date', 'valide'];
  var LIBELLES = { modele: 'Type de véhicule', immat: 'Immatriculation', affectation: 'Affectation', categorie: 'Catégorie', prestataire: 'Prestataire', contrat: 'Contrat N°', chauffeur: 'Chauffeur', radio: 'Radio', date: 'Date d\'autorisation', valide: 'Valable jusqu\'au' };
  var ENTETES_NEUFS = { date: 'Date d\'autorisation', valide: 'Valable jusqu\'au' };
  /** Repère l'en-tête (ligne contenant « Immatriculation ») et la colonne de chaque champ ; null si absent. date / valide peuvent exister en double : toutes les colonnes sont gardées (c.dates, c.valides). */
  function colonnes(valeurs) {
    for (var r = 0; r < Math.min(15, valeurs.length); r += 1) {
      var h = (valeurs[r] || []).map(norm), iI = h.indexOf('immatriculation'); if (iI < 0) continue;
      var types = [], dates = [], valides = []; h.forEach(function (x, i) { if (x === 'type de vehicule') types.push(i); if (x === 'date d autorisation') dates.push(i); if (x === 'valable jusqu au') valides.push(i); });
      var c = { ligne: r, modele: types[0], immat: iI, categorie: types[1], affectation: Math.max(h.indexOf('affecation'), h.indexOf('affectation')), prestataire: Math.max(h.indexOf('prestatire'), h.indexOf('prestataire')),
        contrat: h.indexOf('contrat n'), chauffeur: h.indexOf('chauffeur'), radio: h.indexOf('radio'), date: dates.length ? dates[0] : -1, valide: valides.length ? valides[0] : -1, dates: dates, valides: valides };
      var dernier = -1; (valeurs[r] || []).forEach(function (x, i) { if (String(x == null ? '' : x).trim()) dernier = i; });
      c.largeur = dernier + 1;
      CHAMPS.forEach(function (k) { if (c[k] === undefined || c[k] < 0) c[k] = -1; });
      if (c.modele < 0) c.modele = Math.max(0, iI - 1);
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
      [['date', c.dates], ['valide', c.valides]].forEach(function (g) { for (var j = 0; j < g[1].length && !o[g[0]]; j += 1) o[g[0]] = texte(r[g[1][j]]); });   // colonnes en double : première valeur renseignée
      if (!o.modele && !o.immat) continue;
      out.push(o);
    }
    return { colonnes: c, lignes: out };
  }
  function vide(p) { return !p || /^vehicule\s/i.test(p) || /^[—-]$/.test(p); }
  /** Ajoute un nom à une liste « A / B » sans doublon ; remplace « Vehicule Sonatrach » ou une case vide. */
  function fusionnerPersonne(actuel, nom) {
    nom = String(nom || '').trim(); actuel = String(actuel || '').trim();
    if (!nom) return actuel; if (vide(actuel)) return nom;
    var deja = actuel.split(' / ').some(function (x) { return norm(x) === norm(nom); });
    return deja ? actuel : actuel + ' / ' + nom;
  }
  /**
   * Plan d'écriture pour des véhicules autorisés : vehicules = [{ modele, immat, chauffeur }] ; ctx = { affectation (service), categorie, prestataire, contrat, date, valide, sansEcraser }.
   * Un véhicule déjà dans le tableau (même immatriculation) est mis à jour (le chauffeur est ajouté à ceux déjà notés ; la catégorie, la radio et le type déjà renseignés sont conservés) ; sinon une ligne est ajoutée.
   * Avec sansEcraser, les cases contrat / date / valide déjà remplies ne sont pas modifiées (reprise d'un jour passé). L'affectation reprend l'orthographe déjà utilisée dans le tableau.
   */
  function planifier(lignes, vehicules, ctx) {
    var par = {}, ortho = {}, plan = { maj: [], ajouter: [] }, deja = {};
    (lignes || []).forEach(function (l) { var k = immatNorm(l.immat); if (k && !par[k]) par[k] = l; if (l.affectation) ortho[norm(l.affectation)] = l.affectation; });
    var aff = ctx.affectation ? (ortho[norm(ctx.affectation)] || String(ctx.affectation)) : '';
    (vehicules || []).forEach(function (v) {
      var k = immatNorm(v.immat); if (!k) return;
      if (deja[k]) { deja[k].champs.chauffeur = fusionnerPersonne(deja[k].champs.chauffeur, v.chauffeur); return; }
      var ex = par[k], entree;
      if (ex) {
        var maj = {}, ch = fusionnerPersonne(ex.chauffeur, v.chauffeur);
        if (!ex.modele && v.modele) maj.modele = v.modele;
        if (aff && norm(aff) !== norm(ex.affectation)) maj.affectation = aff;
        if (ctx.categorie && !ex.categorie) maj.categorie = ctx.categorie;
        if (ctx.prestataire && (!ex.prestataire || (!ctx.sansEcraser && norm(ctx.prestataire) !== norm(ex.prestataire)))) maj.prestataire = ctx.prestataire;
        if (ch !== ex.chauffeur) maj.chauffeur = ch;
        ['contrat', 'date', 'valide'].forEach(function (f) { if (ctx[f] && ctx[f] !== ex[f] && !(ctx.sansEcraser && ex[f])) maj[f] = ctx[f]; });
        entree = { ligne: ex.ligne, champs: maj }; plan.maj.push(entree);
      } else {
        entree = { champs: { modele: v.modele || '', immat: v.immat, affectation: aff, categorie: ctx.categorie || '', prestataire: ctx.prestataire || '', contrat: ctx.contrat || '', chauffeur: fusionnerPersonne('', v.chauffeur), date: ctx.date || '', valide: ctx.valide || '' } }; plan.ajouter.push(entree);
      }
      deja[k] = entree;
    });
    plan.maj = plan.maj.filter(function (m) { return Object.keys(m.champs).length; });
    return plan;
  }
  /** Fin du mois (ou du mois suivant) de la date ISO. */
  function finDeMois(iso, moisSuivant) { var p = String(iso).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1 + (moisSuivant ? 2 : 1), 0)).toISOString().slice(0, 10); }
  /** « 58.INFRA.25 - EURL CFCE » → { contrat, nom } ; sans tiret : le nom seul. */
  function prestataireDe(s) { var p = String(s || '').split(' - ').map(function (x) { return x.trim(); }); return p.length > 1 ? { contrat: p[0], nom: p.slice(1).join(' - ') } : { contrat: '', nom: p[0] }; }
  /**
   * Rattrapage : les véhicules des Autorisations d'accès d'un jour, lus dans le Journal_PEC (en-tête : date, prestataire, base, documents, nom, prenom, fonction, vehicule, immatriculation…).
   * Renvoie [{ prestataire, contrat, vehicules: [{ modele, immat, chauffeur }] }] ; filtre = fragment du nom de l'entreprise (facultatif).
   */
  function depuisJournal(valeurs, jour, filtre) {
    var h = (valeurs[0] || []).map(norm), iD = h.indexOf('date'), iP = h.indexOf('prestataire'), iDoc = h.indexOf('documents'), iN = h.indexOf('nom'), iPr = h.indexOf('prenom'), iV = h.indexOf('vehicule'), iI = h.indexOf('immatriculation');
    if (iD < 0 || iP < 0 || iI < 0) return [];
    var groupes = {}, ordre = [];
    for (var i = 1; i < valeurs.length; i += 1) {
      var r = valeurs[i]; if (String(r[iD]).slice(0, 10) !== jour) continue;
      if (iDoc >= 0 && !/autorisation/i.test(String(r[iDoc]))) continue;
      if (!immatNorm(r[iI])) continue;
      var pr = prestataireDe(r[iP]); if (filtre && norm(r[iP]).indexOf(norm(filtre)) < 0) continue;
      var g = groupes[r[iP]]; if (!g) { g = groupes[r[iP]] = { prestataire: pr.nom, contrat: pr.contrat, vehicules: [] }; ordre.push(r[iP]); }
      g.vehicules.push({ modele: String(r[iV] || '').trim().toUpperCase(), immat: String(r[iI]).trim().toUpperCase(), chauffeur: [r[iN], r[iPr]].filter(function (x) { return x && String(x).trim(); }).join(' ').trim() });
    }
    return ordre.map(function (k) { return groupes[k]; });
  }
  return { norm: norm, immatNorm: immatNorm, CHAMPS: CHAMPS, LIBELLES: LIBELLES, ENTETES_NEUFS: ENTETES_NEUFS, colonnes: colonnes, lire: lire, fusionnerPersonne: fusionnerPersonne, planifier: planifier, finDeMois: finDeMois, prestataireDe: prestataireDe, depuisJournal: depuisJournal };
})();
if (typeof module !== 'undefined') module.exports = VH;

// ---------- classeur « SUIVI VH » ----------
var SUIVI_VH_ID_DEFAUT_ = '1fRd_Yen2ynGPvkIF7zUMBh7P6-ZywrqfQ-2ZyTQmHfU';
var SUIVI_VH_ONGLET_ = 'SUIVI VH';
function vhClasseur_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SUIVI_VH_ID') || SUIVI_VH_ID_DEFAUT_); }
function vhOnglet_() { var ss = vhClasseur_(); return ss.getSheetByName(SUIVI_VH_ONGLET_) || ss.getSheets()[0]; }
function vhLireOnglet_() {
  var sh = vhOnglet_(), vals = sh.getDataRange().getValues(), lu = VH.lire(vals);
  if (!lu.colonnes) throw new Error('Tableau des véhicules introuvable (ligne d\'en-tête avec « Immatriculation »)');
  return { sh: sh, vals: vals, c: lu.colonnes, lignes: lu.lignes };
}
/** Ajoute à droite les en-têtes « Date d'autorisation » et « Valable jusqu'au » s'ils manquent (mêmes couleurs que l'en-tête voisin). */
function vhAssurerColonnes_(t) {
  var c = t.c, sh = t.sh, suivante = c.largeur, modele = Math.max(c.radio, c.chauffeur, 0);
  ['date', 'valide'].forEach(function (k) {
    if (c[k] >= 0) return;
    if (sh.getMaxColumns() < suivante + 1) sh.insertColumnAfter(sh.getMaxColumns());
    var src = sh.getRange(c.ligne + 1, modele + 1), dst = sh.getRange(c.ligne + 1, suivante + 1);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); dst.setValue(VH.ENTETES_NEUFS[k]); sh.setColumnWidth(suivante + 1, 140);
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
/** Écrit un plan (VH.planifier) dans le tableau ; à appeler sous verrou. */
function vhAppliquer_(t, vehicules, ctx) {
  var plan = VH.planifier(t.lignes, vehicules, ctx);
  plan.maj.forEach(function (m) { vhEcrire_(t, m.ligne, m.champs); });
  plan.ajouter.forEach(function (a) { t.lignes.push({ ligne: vhAjouter_(t, a.champs) }); });
  return { maj: plan.maj.length, ajoutes: plan.ajouter.length };
}
/** Appelé après chaque Autorisation d'accès générée (Pec.gs) : renseigne ou met à jour la ligne de chaque véhicule dans le tableau. Ne bloque jamais la génération. */
function vhEnregistrerDepuisPec_(d) {
  var pr = VH.prestataireDe(d.prestataire), auj = Dates.today();
  var vehicules = (d.personnes || []).filter(function (p) { return p && VH.immatNorm(p.immatriculation); }).map(function (p) {
    return { modele: String(p.typeVehicule || '').trim().toUpperCase(), immat: String(p.immatriculation).trim().toUpperCase(), chauffeur: [p.nom, p.prenom].filter(function (x) { return x && String(x).trim(); }).join(' ').trim() };
  });
  if (!vehicules.length) return { maj: 0, ajoutes: 0 };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var t = vhLireOnglet_(); vhAssurerColonnes_(t);
    return vhAppliquer_(t, vehicules, { affectation: d.emputation || '', categorie: 'Vehicule Prestataire', prestataire: pr.nom, contrat: pr.contrat, date: auj, valide: VH.finDeMois(auj, !!d.valable2Mois) });
  } finally { lock.releaseLock(); }
}
/** Reprend dans le tableau les autorisations d'accès d'un jour (Journal_PEC) : jour = 'yyyy-MM-dd' (aujourd'hui par défaut), filtre = fragment du nom d'entreprise (facultatif). */
function vhRattraper_(jour, filtre) {
  jour = jour || Dates.today();
  var sh = SpreadsheetApp.openById(PEC_SS_ID).getSheetByName('Journal_PEC'); if (!sh || sh.getLastRow() < 2) return { jour: jour, maj: 0, ajoutes: 0, entreprises: [] };
  var groupes = VH.depuisJournal(sh.getDataRange().getDisplayValues(), jour, filtre), maj = 0, ajoutes = 0;
  if (!groupes.length) return { jour: jour, maj: 0, ajoutes: 0, entreprises: [] };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var t = vhLireOnglet_(); vhAssurerColonnes_(t);
    groupes.forEach(function (g) { var r = vhAppliquer_(t, g.vehicules, { categorie: 'Vehicule Prestataire', prestataire: g.prestataire, contrat: g.contrat, date: jour, valide: VH.finDeMois(jour, false), sansEcraser: true }); maj += r.maj; ajoutes += r.ajoutes; });
  } finally { lock.releaseLock(); }
  return { jour: jour, maj: maj, ajoutes: ajoutes, entreprises: groupes.map(function (g) { return g.prestataire; }) };
}
/** Une seule fois : reprend les autorisations d'accès CFCE du jour dans le tableau (demande du propriétaire). Rejouable à la main depuis la page (niveau 2). */
function rattraperVehiculesCfce_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('VH_CFCE_JOUR_V1') === '1') return;
  try { var r = vhRattraper_(Dates.today(), 'CFCE'); props.setProperty('VH_CFCE_JOUR_V1', '1'); Store.journal('vh_rattrapage', 'systeme', r.jour + ' CFCE : ' + r.ajoutes + ' ajouté(s), ' + r.maj + ' mis à jour'); }
  catch (e) { /* on réessaiera à la requête suivante */ }
}

// ---------- page « Véhicules » ----------
function vhDroit_(req, min) {
  var u = Auth.userFromToken(req.token), n = acces_(u).logistique || 0;
  if (n < min) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return { u: u, niveau: n };
}
function vhLire_(req) {
  var d = vhDroit_(req, 1), t = vhLireOnglet_();
  return { niveau: d.niveau, lignes: t.lignes, libelles: VH.LIBELLES };
}
function vhChamps_(c) {
  var out = {}, LONG = { modele: 60, immat: 30, affectation: 80, categorie: 40, prestataire: 80, contrat: 60, chauffeur: 200, radio: 120, date: 10, valide: 10 };
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
    var n = vhAjouter_(t, ch); Store.journal('vh_ajout', d.u.email, ch.immat || ch.modele); return { ok: true, ligne: n };
  } finally { lock.releaseLock(); }
}
function vhSupprimer_(req) {
  var d = vhDroit_(req, 2), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { var t = vhLireOnglet_(), l = vhGarde_(t, req); t.sh.deleteRow(l.ligne); Store.journal('vh_suppr', d.u.email, String(l.immat)); return { ok: true }; }
  finally { lock.releaseLock(); }
}
/** Bouton « Reprendre les autorisations du jour » (niveau 2) : req.jour facultatif (aujourd'hui par défaut), req.filtre facultatif (entreprise). */
function vhRattraperAction_(req) {
  var d = vhDroit_(req, 2), jour = /^\d{4}-\d{2}-\d{2}$/.test(String(req.jour || '')) ? req.jour : Dates.today(), r = vhRattraper_(jour, String(req.filtre || '').slice(0, 60));
  Store.journal('vh_rattrapage', d.u.email, r.jour + ' : ' + r.ajoutes + ' ajouté(s), ' + r.maj + ' mis à jour'); return r;
}
