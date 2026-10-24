/**
 * Prestataires présents sur site à une date donnée, d'après les PRISES EN CHARGE (onglet « Journal_PEC » du classeur des prises en charge) :
 * chaque ligne est un séjour (entrée = date d'arrivée saisie, sortie = date de départ saisie).
 *  - par défaut la fin de prise en charge est de 28 jours après l'entrée, sauf si la date de départ saisie est plus proche ;
 *  - une personne est présente à la date D si entrée ≤ D ≤ sortie ; une prise en charge expirée avant D n'est plus affichée ;
 *  - option « toutes les entrées » : on ne tient plus compte des sorties (tout séjour commencé à D ou avant).
 * Anciennes lignes sans dates saisies : entrée = date de la demande, sortie = entrée + 28 jours. Lecture seule.
 */
var PEC_CLASSEUR_ID_DEFAUT_ = '1htHz2rgdyjtH3Ne5E8QNprX2LZKauui4hF25Xse5S18';
var PRESENTS_DUREE_DEFAUT_ = 28;

// ---------- logique pure (testée en Node) ----------
function presentsDate_(s) {
  if (s == null || s === '') return '';
  if (Object.prototype.toString.call(s) === '[object Date]') return isNaN(s.getTime()) ? '' : s.getFullYear() + '-' + ('0' + (s.getMonth() + 1)).slice(-2) + '-' + ('0' + s.getDate()).slice(-2);
  var t = String(s).trim(), m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(t))) { var a = m[3].length === 2 ? '20' + m[3] : m[3]; return a + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  return '';
}
function presentsPlus_(iso, jours) { var d = new Date(iso + 'T00:00:00Z'); if (isNaN(d.getTime())) return ''; d.setUTCDate(d.getUTCDate() + jours); return d.toISOString().slice(0, 10); }
/**
 * Lignes du journal (objets { date, prestataire, base, documents, nom, prenom, fonction, arrivee, depart }) → séjours
 * [{ entreprise, contrat, nom, prenom, fonction, base, entree, sortie, sortie_defaut }] ; seules les prises en charge hébergées (document « PEC ») comptent.
 * `entrepriseDe(prestataire)` et `contratDe(prestataire)` : fonctions de lecture du libellé « N° contrat - Entreprise - Intitulé ».
 */
function presentsSejours_(lignes, entrepriseDe, contratDe) {
  var out = [];
  lignes.forEach(function (r) {
    if (String(r.documents || '').indexOf('PEC') === -1) return;
    var nom = String(r.nom || '').trim(); if (!nom) return;
    var entree = presentsDate_(r.arrivee) || presentsDate_(r.date); if (!entree) return;
    var depart = presentsDate_(r.depart), defaut = !depart || depart < entree;
    var sortie = defaut ? presentsPlus_(entree, PRESENTS_DUREE_DEFAUT_) : depart;
    var plafond = presentsPlus_(entree, PRESENTS_DUREE_DEFAUT_);
    if (!defaut && plafond && depart > plafond) { /* départ saisi au-delà de 28 jours : on garde la date saisie (prise en charge prolongée) */ }
    var ent = entrepriseDe(r.prestataire) || String(r.prestataire || '').trim() || 'Sans entreprise';
    out.push({ entreprise: ent, contrat: contratDe(r.prestataire) || '', nom: nom, prenom: String(r.prenom || '').trim(), fonction: String(r.fonction || '').trim(), base: String(r.base || '').trim(), entree: entree, sortie: sortie, sortie_defaut: defaut });
  });
  return out;
}
/**
 * options : { toutes (ignorer les sorties), base, regDu, regAu (période d'entrée) }. Renvoie { entreprises: [{ entreprise, contrat, personnes: [...] }], total, exclus: { sorti, avant, hors_plage, autre_base } }.
 * Une même personne présente une seule fois par entreprise (séjour le plus récent).
 */
function presentsCalculer_(sejours, date, options) {
  var o = options || {}, du = presentsDate_(o.regDu), au = presentsDate_(o.regAu), exclus = { sorti: 0, avant: 0, hors_plage: 0, autre_base: 0 }, par = {};
  sejours.forEach(function (s) {
    if (s.entree > date) { exclus.avant += 1; return; }
    if (!o.toutes && s.sortie < date) { exclus.sorti += 1; return; }
    if ((du && s.entree < du) || (au && s.entree > au)) { exclus.hors_plage += 1; return; }
    if (o.base && s.base !== o.base) { exclus.autre_base += 1; return; }
    var cle = s.entreprise.toLowerCase() + '|' + s.contrat.toLowerCase(), g = par[cle] = par[cle] || { entreprise: s.entreprise, contrat: s.contrat, idx: {}, personnes: [] };
    var k = (s.nom + ' ' + s.prenom).toLowerCase().replace(/\s+/g, ' '), i = g.idx[k];
    if (i === undefined) { g.idx[k] = g.personnes.length; g.personnes.push(s); } else if (s.entree > g.personnes[i].entree) g.personnes[i] = s;
  });
  var liste = Object.keys(par).map(function (k) { var g = par[k]; g.personnes.sort(function (a, b) { return (a.nom + ' ' + a.prenom) < (b.nom + ' ' + b.prenom) ? -1 : 1; }); return { entreprise: g.entreprise, contrat: g.contrat, personnes: g.personnes }; });
  liste.sort(function (a, b) { return a.entreprise.toLowerCase() < b.entreprise.toLowerCase() ? -1 : 1; });
  return { entreprises: liste, total: liste.reduce(function (n, g) { return n + g.personnes.length; }, 0), exclus: exclus };
}

// ---------- lecture du journal des prises en charge ----------
function presentsLireJournal_() {
  var id = PropertiesService.getScriptProperties().getProperty('PEC_SS_ID') || PEC_CLASSEUR_ID_DEFAUT_;
  var sh = SpreadsheetApp.openById(id).getSheetByName('Journal_PEC');
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 12)).getValues(), h = v[0].map(function (x) { return String(x).trim().toLowerCase(); });
  var ix = function (n, defaut) { var i = h.indexOf(n); return i >= 0 ? i : defaut; };
  var c = { date: ix('date', 0), prestataire: ix('prestataire', 1), base: ix('base', 2), documents: ix('documents', 3), nom: ix('nom', 4), prenom: ix('prenom', 5), fonction: ix('fonction', 6), arrivee: ix('arrivee', 10), depart: ix('depart', 11) };
  return v.slice(1).map(function (r) { var o = {}; Object.keys(c).forEach(function (k) { o[k] = r[c[k]]; }); return o; });
}
/** Excel et accès au fichier des Enquêtes : chef de division, chefs de service (et intérim), secrétariat. Les autres consultent la page seulement. */
function exportAutorise_(u) { return ['chef_division', 'chef_service', 'interim_chef_service', 'secretariat'].indexOf(Droits.roleCanon(u.role)) !== -1; }
/** Action « presents_donnees » : { date, toutes, base, reg_du, reg_au } → présents à la date (droit Badges, lecture). */
function presentsDonnees_(req) {
  var u = badgesDroit_(req, 1);
  var date = presentsDate_(req.date) || Dates.today();
  var cache = CacheService.getScriptCache(), cle = 'PRESENTS_SEJOURS', vu = cache.get(cle), sejours = null;
  if (vu && !req.force) { try { sejours = JSON.parse(vu); } catch (e) { sejours = null; } }
  if (!sejours) {
    sejours = presentsSejours_(presentsLireJournal_(), enqEntrepriseDe_, enqContratDe_);
    try { var t = JSON.stringify(sejours); if (t.length < 95000) cache.put(cle, t, 300); } catch (e) { /* trop gros : pas de cache */ }
  }
  var r = presentsCalculer_(sejours, date, { toutes: req.toutes === true, base: req.base, regDu: req.reg_du, regAu: req.reg_au });
  var bases = {}; sejours.forEach(function (s) { if (s.base) bases[s.base] = true; });
  r.peut_exporter = exportAutorise_(u); r.date = date; r.bases = Object.keys(bases).sort(); r.nb_sejours = sejours.length; r.duree_defaut = PRESENTS_DUREE_DEFAUT_;
  return r;
}
if (typeof module !== 'undefined') module.exports = { presentsCalculer_: presentsCalculer_, presentsSejours_: presentsSejours_, presentsDate_: presentsDate_ };
