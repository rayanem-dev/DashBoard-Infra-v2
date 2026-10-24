/**
 * Vivier des entreprises : base des prestataires, sous-traitants et partenaires, avec ajout / correction / suppression dans le portail
 * (remplace l'ancien couple « feuille Google + formulaire Google »). Données : onglet « Vivier » de Gateway_DB, créé au premier usage.
 * Droits : module « cpm » — niveau 1 lecture, niveau 2 ajout / correction / suppression / synchronisation.
 * « Synchroniser » ajoute à la base les nouvelles réponses du formulaire Google destiné aux entreprises extérieures (jamais de suppression, jamais d'écriture dans la feuille Google).
 */
var VIVIER_COLONNES_ = ['id', 'nom', 'activite', 'telephone', 'telephone2', 'email', 'email2', 'fax', 'adresse', 'commentaire', 'source', 'cree_par', 'cree_le', 'maj_par', 'maj_le'];
var VIVIER_CHAMPS_ = ['nom', 'activite', 'telephone', 'telephone2', 'email', 'email2', 'fax', 'adresse', 'commentaire'];
var VIVIER_FORMULAIRE_ = 'https://docs.google.com/forms/d/1l-6f3oqFmToPe7MFd78wq6gxfcrw2rZNrNntVR1k2FY/viewform';
var VIVIER_ANCIENNE_FEUILLE_ = '1olPzVux6UclQVytVphOIFFvIxCEbhfgUJieqwipls7g';
var VIVIER_ONGLET_REPONSES_ = 'Réponses au formulaire 3';

/** Pur : texte nettoyé (espaces, « — » et équivalents = vide). */
function vivierTexte_(v, max) {
  var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (/^[-–—_.\/?]+$/.test(s)) s = '';
  return s.slice(0, max || 300);
}
/** Pur : clé de comparaison d'un nom d'entreprise (sans accents, majuscules, ponctuation ni forme juridique). */
function vivierCle_(nom) {
  return String(nom == null ? '' : nom).replace(/\./g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(sarl|eurl|spa|snc|sas|ets|ste|societe|entreprise)\b/g, ' ').replace(/[^a-z0-9؀-ۿ]+/g, '');
}
/** Pur : champs saisis → fiche propre ; lève une erreur si le nom manque ou si un e-mail est invalide. */
function vivierValider_(c) {
  var f = {};
  f.nom = vivierTexte_(c.nom, 120); if (!f.nom) throw new Error('Le nom de l\'entreprise est obligatoire');
  f.activite = vivierTexte_(c.activite, 120);
  f.telephone = vivierTexte_(c.telephone, 40); f.telephone2 = vivierTexte_(c.telephone2, 40); f.fax = vivierTexte_(c.fax, 40);
  f.email = vivierTexte_(c.email, 120).toLowerCase(); f.email2 = vivierTexte_(c.email2, 120).toLowerCase();
  [f.email, f.email2].forEach(function (e) { if (e && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e)) throw new Error('Adresse e-mail invalide : ' + e); });
  f.adresse = vivierTexte_(c.adresse, 250); f.commentaire = vivierTexte_(c.commentaire, 500);
  return f;
}
/** Pur : lignes de la feuille des réponses du formulaire (en-tête en 1re ligne) → fiches nouvelles, sans doublon avec `existantes` (noms). */
function vivierDepuisReponses_(lignes, existantes) {
  var vus = {}; (existantes || []).forEach(function (n) { vus[vivierCle_(n)] = true; });
  var out = [];
  (lignes || []).slice(1).forEach(function (l) {
    var nom = vivierTexte_(l[1], 120), cle = vivierCle_(nom);
    if (!nom || !cle || vus[cle]) return;
    vus[cle] = true;
    var email = vivierTexte_(l[5], 120).toLowerCase(), email2 = vivierTexte_(l[6], 120).toLowerCase();
    var ok = function (e) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e) ? e : ''; };
    out.push({ nom: nom, activite: vivierTexte_(l[2], 120), telephone: vivierTexte_(l[3], 40), telephone2: vivierTexte_(l[4], 40), email: ok(email), email2: ok(email2), fax: vivierTexte_(l[7], 40), adresse: vivierTexte_(l[8], 250), commentaire: vivierTexte_(l[9], 500) });
  });
  return out;
}

function vivierDroit_(req, min) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).cpm || 0) < min) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function vivierFeuille_() {
  var db = SpreadsheetApp.openById(prop_('DB_ID')), sh = db.getSheetByName('Vivier');
  if (!sh) { sh = db.insertSheet('Vivier'); sh.appendRow(VIVIER_COLONNES_); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
  return sh;
}
function vivierLire_() {
  var v = vivierFeuille_().getDataRange().getValues(), h = v[0].map(String);
  return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; h.forEach(function (c, i) { o[c] = String(r[i] == null ? '' : r[i]); }); return o; });
}
function vivierAjouter_(sh, f, source, email) {
  var maintenant = new Date().toISOString(), id = 'V' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  var o = { id: id, source: source, cree_par: email, cree_le: maintenant, maj_par: email, maj_le: maintenant };
  VIVIER_CHAMPS_.forEach(function (k) { o[k] = f[k] || ''; });
  sh.appendRow(VIVIER_COLONNES_.map(function (c) { return o[c] === undefined ? '' : o[c]; }));
  return id;
}
function vivierListe_(req) {
  var u = vivierDroit_(req, 1), niveau = acces_(u).cpm || 0;
  var l = vivierLire_().map(function (r) { var o = { id: r.id }; VIVIER_CHAMPS_.forEach(function (k) { o[k] = r[k]; }); o.maj_le = r.maj_le; return o; });
  l.sort(function (a, b) { return vivierCle_(a.nom) < vivierCle_(b.nom) ? -1 : 1; });
  return { entreprises: l, niveau: niveau, peut_modifier: niveau >= 2, lien_formulaire: VIVIER_FORMULAIRE_ };
}
function vivierEnregistrer_(req) {
  var u = vivierDroit_(req, 2), f = vivierValider_(req.fiche || {}), sh = vivierFeuille_(), lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var l = vivierLire_(), cle = vivierCle_(f.nom), id = String(req.id || '');
    if (l.some(function (r) { return r.id !== id && vivierCle_(r.nom) === cle; })) throw new Error('Cette entreprise existe déjà dans le vivier');
    if (!id) { id = vivierAjouter_(sh, f, 'portail', u.email); Store.journal('vivier_ajout', u.email, f.nom); return { id: id }; }
    var v = sh.getDataRange().getValues(), h = v[0].map(String), i = -1;
    for (var k = 1; k < v.length; k += 1) if (String(v[k][h.indexOf('id')]) === id) { i = k; break; }
    if (i < 0) throw new Error('Fiche introuvable');
    VIVIER_CHAMPS_.forEach(function (c) { sh.getRange(i + 1, h.indexOf(c) + 1).setValue(f[c]); });
    sh.getRange(i + 1, h.indexOf('maj_par') + 1).setValue(u.email); sh.getRange(i + 1, h.indexOf('maj_le') + 1).setValue(new Date().toISOString());
    Store.journal('vivier_modif', u.email, f.nom); return { id: id };
  } finally { lock.releaseLock(); }
}
function vivierSupprimer_(req) {
  var u = vivierDroit_(req, 2), sh = vivierFeuille_(), v = sh.getDataRange().getValues(), h = v[0].map(String), id = String(req.id || '');
  for (var k = 1; k < v.length; k += 1) if (String(v[k][h.indexOf('id')]) === id) { sh.deleteRow(k + 1); Store.journal('vivier_suppr', u.email, String(v[k][h.indexOf('nom')])); return {}; }
  throw new Error('Fiche introuvable');
}
/** Ajoute les réponses du formulaire Google pas encore dans la base (lecture seule de la feuille Google). */
function vivierSynchroniser_(req) {
  var u = vivierDroit_(req, 2), sh = vivierFeuille_(), lignes;
  try { lignes = SpreadsheetApp.openById(VIVIER_ANCIENNE_FEUILLE_).getSheetByName(VIVIER_ONGLET_REPONSES_).getDataRange().getDisplayValues(); }
  catch (e) { throw new Error('Impossible de lire les réponses du formulaire (accès à la feuille Google non autorisé pour la passerelle)'); }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var nouvelles = vivierDepuisReponses_(lignes, vivierLire_().map(function (r) { return r.nom; }));
    nouvelles.forEach(function (f) { vivierAjouter_(sh, f, 'formulaire', u.email); });
    Store.journal('vivier_sync', u.email, nouvelles.length + ' ajoutée(s)'); return { ajoutees: nouvelles.length };
  } finally { lock.releaseLock(); }
}
if (typeof module !== 'undefined') module.exports = { vivierTexte_: vivierTexte_, vivierCle_: vivierCle_, vivierValider_: vivierValider_, vivierDepuisReponses_: vivierDepuisReponses_ };
