/**
 * Demande de réservation de vol (ALGER ⇄ RNS) : le nombre de personnes crée les lignes, le nom se choisit dans l'organigramme (comptes issus de BDDORGA),
 * la fonction et la société se remplissent seules ; hors SONATRACH, la mention « Rattaché à la division Infra » est ajoutée.
 * Le trajet est libre (départ → destination) ; chaque trajet envoyé est appris (avec le jour de la semaine) et proposé ensuite, ceux du jour d'abord.
 * Le bouton « Envoyer » envoie le mail au secrétariat (destinataire : propriété de script RESERVATION_DEST, sinon l'adresse du secrétariat Infra) ; jamais d'envoi automatique.
 * Droits : module « logistique », niveau 1. Les comptes prestataires n'y ont pas accès.
 */
var RESERVATION_DEST_DEFAUT_ = 'Sec-INFRA.RNS@Sonatrach.dz';
var RESERVATION_MENTION_ = 'Rattaché à la division Infra';
var RESERVATION_SIGNATURE_ = ['SECRETARIAT DIVISON INFRASTRUCTURE', 'SONATRACH – DP – RHOURDE-NOUSS', 'Sec-INFRA.RNS@Sonatrach.dz', 'FO : 7743/5843'];
var RESERVATION_JOURS_ = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function resaNorm_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function resaEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function resaEstSonatrach_(s) { return resaNorm_(s).indexOf('sonatrach') !== -1; }
function resaPad_(n) { return (n < 10 ? '0' : '') + n; }
/** Pur : « 2026-10-23 » → « Vendredi 23/10/2026 ». */
function resaDateTexte_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) throw new Error('Date invalide.');
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return RESERVATION_JOURS_[d.getUTCDay()] + ' ' + m[3] + '/' + m[2] + '/' + m[1];
}
function resaProfit_(ps) {
  var n = ps.length, m = ps.every(function (p) { return p.civ === 'M.'; }), f = ps.every(function (p) { return p.civ === 'Mme'; });
  if (m) return n > 1 ? 'de Messieurs' : 'de Monsieur';
  if (f) return n > 1 ? 'de Mesdames' : 'de Madame';
  return 'des personnes suivantes';
}
/** Pur : { nom, reste } d'une ligne (fonction, société si elle n'est pas SONATRACH, mention de rattachement). */
function resaLigne_(p) {
  var parts = [], soc = String(p.societe || '').trim();
  if (p.fonction) parts.push(String(p.fonction).trim());
  if (soc && !resaEstSonatrach_(soc)) parts.push(soc);
  if (p.rattache) parts.push(RESERVATION_MENTION_);
  return { nom: String(p.nom).trim(), reste: parts.join('  ') };
}
/** Pur : demande { date, trajet, personnes: [{ civ, nom, fonction, societe, rattache }] } → { sujet, texte, html, nb } ; lève une erreur si la demande est incomplète. */
function resaMail_(d) {
  if (!d || !d.date) throw new Error('Date du vol manquante.');
  var tous = (d.personnes || []).filter(function (p) { return p; }), ps = tous.filter(function (p) { return String(p.nom || '').trim(); });
  if (!ps.length) throw new Error('Ajoutez au moins une personne.');
  if (ps.length !== tous.length) throw new Error('Un nom est vide : complétez ou réduisez le nombre de personnes.');
  if (ps.length > 30) throw new Error('30 personnes au plus par demande.');
  var trajet = (d.depart || d.destination) ? resaTrajet_(d.depart, d.destination) : (function (p) { return resaTrajet_(p[0], p[1] || ''); })(String(d.trajet || '').split('→')), dateTxt = resaDateTexte_(d.date);
  var intro = ps.length > 1 ? 'Nous vous demandons de bien vouloir réserver ' + ps.length + ' places sur le vol suivant :' : 'Nous vous demandons de bien vouloir réserver une place sur le vol suivant :';
  var profit = 'au profit ' + resaProfit_(ps), lignes = ps.map(resaLigne_);
  var html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#000"><p>Bonjour ,</p><p>' + resaEsc_(intro) + '</p>' +
    '<p><b>' + resaEsc_(trajet) + '</b> le <b>' + resaEsc_(dateTxt) + ',</b> ' + resaEsc_(profit) + ' :</p>' +
    '<ul>' + lignes.map(function (l) { return '<li><b>' + resaEsc_(l.nom) + '</b>' + (l.reste ? '&nbsp;&nbsp;' + resaEsc_(l.reste).replace(/  /g, '&nbsp;&nbsp;') : '') + '</li>'; }).join('') + '</ul>' +
    '<p>Salutations .</p><br><div style="font-size:12px"><b>' + RESERVATION_SIGNATURE_.map(resaEsc_).join('<br>') + '</b></div></div>';
  var texte = 'Bonjour ,\n\n' + intro + '\n\n' + trajet + ' le ' + dateTxt + ', ' + profit + ' :\n' + lignes.map(function (l) { return ' - ' + l.nom + (l.reste ? '  ' + l.reste : ''); }).join('\n') + '\n\nSalutations .\n\n' + RESERVATION_SIGNATURE_.join('\n');
  return { sujet: 'Reservation ' + trajet, trajet: trajet, texte: texte, html: html, nb: ps.length };
}

/** Pur : « laghouat » + « rns » → « LAGHOUAT → RNS » (majuscules, espaces nettoyés) ; lève une erreur si un lieu manque, est trop long ou si départ = destination. */
function resaTrajet_(depart, destination) {
  var net = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[→⇄>\-]+$/, '').trim().toUpperCase(); };
  var a = net(depart), b = net(destination);
  if (!a || !b) throw new Error('Indiquez le départ et la destination.');
  if (a.length > 40 || b.length > 40) throw new Error('Nom de lieu trop long (40 caractères au plus).');
  if (resaNorm_(a) === resaNorm_(b)) throw new Error('Le départ et la destination sont identiques.');
  return a + ' → ' + b;
}
/** Pur : { trajet: { n, jours: { 0..6: n }, dernier } } + un trajet effectué le jour ISO → nouvelle table (le jour 0 = dimanche). */
function resaApprendre_(table, trajet, iso) {
  var t = {}; Object.keys(table || {}).forEach(function (k) { t[k] = table[k]; });
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')), jour = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : -1;
  var e = t[trajet] || { n: 0, jours: {}, dernier: '' };
  var j = {}; Object.keys(e.jours || {}).forEach(function (k) { j[k] = e.jours[k]; });
  if (jour >= 0) j[jour] = (j[jour] || 0) + 1;
  t[trajet] = { n: (e.n || 0) + 1, jours: j, dernier: String(iso || '') };
  return t;
}
/** Pur : trajets connus, ceux du jour de la semaine demandé d'abord (les plus fréquents ce jour-là), puis les autres par fréquence. */
function resaTrajetsTries_(table, jour) {
  return Object.keys(table || {}).map(function (k) { var e = table[k]; return { trajet: k, n: e.n || 0, ceJour: (e.jours && e.jours[jour]) || 0 }; })
    .sort(function (a, b) { return (b.ceJour - a.ceJour) || (b.n - a.n) || (a.trajet < b.trajet ? -1 : 1); });
}
var RESERVATION_TRAJETS_DEFAUT_ = { 'ALGER → RNS': { n: 0, jours: {}, dernier: '' }, 'RNS → ALGER': { n: 0, jours: {}, dernier: '' } };
function resaTrajetsLire_() {
  try { var o = JSON.parse(PropertiesService.getScriptProperties().getProperty('RESERVATION_TRAJETS') || 'null'); if (o && typeof o === 'object' && Object.keys(o).length) return o; } catch (e) { /* illisible : on repart des trajets d'origine */ }
  return RESERVATION_TRAJETS_DEFAUT_;
}
function resaTrajetsEcrire_(t) { PropertiesService.getScriptProperties().setProperty('RESERVATION_TRAJETS', JSON.stringify(t)); }

function resaDroit_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).logistique || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
/** Personnes de l'organigramme (comptes actifs issus de BDDORGA) : nom, fonction, société (dépendance), service. */
function reservationOrga_(req) {
  resaDroit_(req);
  var l = Store.table('Utilisateurs').filter(function (x) { return String(x.actif) !== '0' && x.nom; }).map(function (x) {
    return { nom: Annuaire.nomAffichable(x.nom, x.email), fonction: String(x.fonction || ''), societe: String(x.dependance || 'SONATRACH') || 'SONATRACH', service: String(x.service || '') };
  });
  l.sort(function (a, b) { return a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0; });
  return { personnes: l, trajets_table: resaTrajetsLire_(), destinataire: PropertiesService.getScriptProperties().getProperty('RESERVATION_DEST') || RESERVATION_DEST_DEFAUT_, mention: RESERVATION_MENTION_ };
}
function reservationEnvoyer_(req) {
  var u = resaDroit_(req), m = resaMail_(req.demande), dest = PropertiesService.getScriptProperties().getProperty('RESERVATION_DEST') || RESERVATION_DEST_DEFAUT_;
  MailApp.sendEmail({ to: dest, subject: m.sujet, body: m.texte, htmlBody: m.html, replyTo: u.email, name: 'Division Infrastructure RNS' });
  try { var lock = LockService.getScriptLock(); lock.waitLock(10000); try { resaTrajetsEcrire_(resaApprendre_(resaTrajetsLire_(), m.trajet, String(req.demande.date))); } finally { lock.releaseLock(); } } catch (e) { /* le trajet sera appris la prochaine fois */ }
  Store.journal('reservation', u.email, m.sujet + ' · ' + m.nb + ' pers. · ' + String(req.demande.date));
  return { ok: true, count: m.nb, to: dest };
}
/** Retire un trajet appris par erreur (niveau 2 sur Logistique) ; les deux trajets d'origine reviennent s'il ne reste rien. */
function reservationTrajetSupprimer_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).logistique || 0) < 2) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var t = resaTrajetsLire_(), cle = String(req.trajet || ''), n = {}; Object.keys(t).forEach(function (k) { if (k !== cle) n[k] = t[k]; });
  resaTrajetsEcrire_(n); Store.journal('reservation_trajet_suppr', u.email, cle);
  return { trajets_table: resaTrajetsLire_() };
}
if (typeof module !== 'undefined') module.exports = { resaTrajet_: resaTrajet_, resaApprendre_: resaApprendre_, resaTrajetsTries_: resaTrajetsTries_, resaMail_: resaMail_, resaLigne_: resaLigne_, resaDateTexte_: resaDateTexte_ };
