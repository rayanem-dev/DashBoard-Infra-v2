/**
 * Vivier des entreprises : base des prestataires, sous-traitants et partenaires, avec ajout / correction / suppression dans le portail
 * (remplace l'ancien couple « feuille Google + formulaire Google »). Données : onglet « Vivier » de Gateway_DB, créé au premier usage.
 * Droits : module « cpm » — niveau 1 lecture, niveau 2 ajout / correction / suppression / synchronisation.
 * À la première ouverture, la base reprend les entreprises de l'ancienne feuille Google (lecture seule).
 */
var VIVIER_COLONNES_ = ['id', 'nom', 'activite', 'telephone', 'telephone2', 'email', 'email2', 'fax', 'adresse', 'commentaire', 'source', 'cree_par', 'cree_le', 'maj_par', 'maj_le'];
var VIVIER_CHAMPS_ = ['nom', 'activite', 'telephone', 'telephone2', 'email', 'email2', 'fax', 'adresse', 'commentaire'];
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
/** Pur : « 0661 38 77 05 / / » ou « 0555 52 66 26 / 0531 15 62 9 » → { t1, t2 } (séparés par « / », restes de barres retirés ; un numéro incomplet est gardé tel quel). */
function vivierTels_(brut, autre) {
  var l = String(brut == null ? '' : brut).split('/').map(function (x) { return vivierTexte_(x, 40); }).filter(Boolean);
  var t1 = l[0] || '', t2 = vivierTexte_(autre, 40) || l[1] || '';
  return { t1: t1, t2: t2 };
}
var VIVIER_EMAIL_ = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
/**
 * Pur : lignes de la feuille des réponses du formulaire → fiches nouvelles, sans doublon avec `existantes` (noms).
 * La ligne d'en-tête est cherchée (la vraie feuille a un titre « Ajout Entreprise » au-dessus) ; seules les lignes en dessous sont lues.
 * Nettoyage : « — » et « / » seuls = vide, « (?) » retiré des activités, plusieurs numéros dans une cellule séparés, adresse e-mail rangée dans « Adresse » déplacée vers E-mail.
 */
function vivierDepuisReponses_(lignes, existantes) {
  var vus = {}; (existantes || []).forEach(function (n) { vus[vivierCle_(n)] = true; });
  var h = -1;
  for (var i = 0; i < (lignes || []).length && h < 0; i += 1) { var b = String((lignes[i] || [])[1] == null ? '' : lignes[i][1]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ''); if (b.indexOf('nomdelentreprise') !== -1 || b === 'nom') h = i; }
  if (h < 0) h = 0;
  var out = [];
  (lignes || []).slice(h + 1).forEach(function (l) {
    var nom = vivierTexte_(l[1], 120), cle = vivierCle_(nom);
    if (!nom || !cle || vus[cle]) return;
    vus[cle] = true;
    var tel = vivierTels_(l[3], l[4]);
    var email = vivierTexte_(l[5], 120).toLowerCase(), email2 = vivierTexte_(l[6], 120).toLowerCase(), adresse = vivierTexte_(l[8], 250);
    if (VIVIER_EMAIL_.test(adresse.toLowerCase())) { if (!email2 && adresse.toLowerCase() !== email) email2 = adresse.toLowerCase(); adresse = ''; }
    var ok = function (e) { return VIVIER_EMAIL_.test(e) ? e : ''; };
    var commentaire = vivierTexte_(String(l[9] == null ? '' : l[9]).replace(/^\s*\/\s*/, ''), 500);
    out.push({ nom: nom, activite: vivierTexte_(String(l[2] == null ? '' : l[2]).replace(/\s*\(\?\)/g, ''), 120), telephone: tel.t1, telephone2: tel.t2, email: ok(email), email2: ok(email2), fax: vivierTexte_(l[7], 40), adresse: adresse, commentaire: commentaire });
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
/** Première ouverture : si la base du portail est vide, on y reprend les entreprises de l'ancienne feuille Google (une seule fois, lecture seule de cette feuille). */
function vivierReprendreAncienne_(u) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('VIVIER_REPRIS') === '1') return '';
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (props.getProperty('VIVIER_REPRIS') === '1') return '';
    var sh = vivierFeuille_();
    if (vivierLire_().length) { props.setProperty('VIVIER_REPRIS', '1'); return ''; }
    var lignes;
    try { lignes = SpreadsheetApp.openById(VIVIER_ANCIENNE_FEUILLE_).getSheetByName(VIVIER_ONGLET_REPONSES_).getDataRange().getDisplayValues(); }
    catch (e) { return 'L\'ancienne base Google n\'a pas pu être lue (accès refusé pour la passerelle). Ajoutez les entreprises avec « + Ajouter une entreprise ».'; }
    var fiches = vivierDepuisReponses_(lignes, []);
    fiches.forEach(function (f) { vivierAjouter_(sh, f, 'ancienne base', u.email); });
    Store.journal('vivier_reprise', u.email, fiches.length + ' entreprise(s)');
    props.setProperty('VIVIER_REPRIS', '1'); return '';
  } finally { lock.releaseLock(); }
}
function vivierListe_(req) {
  var u = vivierDroit_(req, 1), niveau = acces_(u).cpm || 0, avertissement = vivierReprendreAncienne_(u);
  var l = vivierLire_().map(function (r) { var o = { id: r.id }; VIVIER_CHAMPS_.forEach(function (k) { o[k] = r[k]; }); o.maj_le = r.maj_le; return o; });
  l.sort(function (a, b) { return vivierCle_(a.nom) < vivierCle_(b.nom) ? -1 : 1; });
  return { entreprises: l, niveau: niveau, peut_modifier: niveau >= 2, avertissement: avertissement };
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
if (typeof module !== 'undefined') module.exports = { vivierTexte_: vivierTexte_, vivierCle_: vivierCle_, vivierValider_: vivierValider_, vivierDepuisReponses_: vivierDepuisReponses_, vivierTels_: vivierTels_ };
