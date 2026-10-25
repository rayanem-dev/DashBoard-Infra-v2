/**
 * Demande de réservation de vol (ALGER ⇄ RNS) : le nombre de personnes crée les lignes, le nom se choisit dans l'organigramme (comptes issus de BDDORGA),
 * la fonction et la société se remplissent seules ; hors SONATRACH, la mention « Rattaché à la division Infra » est ajoutée.
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
  var trajet = d.trajet === 'RNS → ALGER' ? 'RNS → ALGER' : 'ALGER → RNS', dateTxt = resaDateTexte_(d.date);
  var intro = ps.length > 1 ? 'Nous vous demandons de bien vouloir réserver ' + ps.length + ' places sur le vol suivant :' : 'Nous vous demandons de bien vouloir réserver une place sur le vol suivant :';
  var profit = 'au profit ' + resaProfit_(ps), lignes = ps.map(resaLigne_);
  var html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#000"><p>Bonjour ,</p><p>' + resaEsc_(intro) + '</p>' +
    '<p><b>' + resaEsc_(trajet) + '</b> le <b>' + resaEsc_(dateTxt) + ',</b> ' + resaEsc_(profit) + ' :</p>' +
    '<ul>' + lignes.map(function (l) { return '<li><b>' + resaEsc_(l.nom) + '</b>' + (l.reste ? '&nbsp;&nbsp;' + resaEsc_(l.reste).replace(/  /g, '&nbsp;&nbsp;') : '') + '</li>'; }).join('') + '</ul>' +
    '<p>Salutations .</p><br><div style="font-size:12px"><b>' + RESERVATION_SIGNATURE_.map(resaEsc_).join('<br>') + '</b></div></div>';
  var texte = 'Bonjour ,\n\n' + intro + '\n\n' + trajet + ' le ' + dateTxt + ', ' + profit + ' :\n' + lignes.map(function (l) { return ' - ' + l.nom + (l.reste ? '  ' + l.reste : ''); }).join('\n') + '\n\nSalutations .\n\n' + RESERVATION_SIGNATURE_.join('\n');
  return { sujet: 'Reservation ' + trajet, texte: texte, html: html, nb: ps.length };
}

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
  return { personnes: l, destinataire: PropertiesService.getScriptProperties().getProperty('RESERVATION_DEST') || RESERVATION_DEST_DEFAUT_, mention: RESERVATION_MENTION_ };
}
function reservationEnvoyer_(req) {
  var u = resaDroit_(req), m = resaMail_(req.demande), dest = PropertiesService.getScriptProperties().getProperty('RESERVATION_DEST') || RESERVATION_DEST_DEFAUT_;
  MailApp.sendEmail({ to: dest, subject: m.sujet, body: m.texte, htmlBody: m.html, replyTo: u.email, name: 'Division Infrastructure RNS' });
  Store.journal('reservation', u.email, m.sujet + ' · ' + m.nb + ' pers. · ' + String(req.demande.date));
  return { ok: true, count: m.nb, to: dest };
}
if (typeof module !== 'undefined') module.exports = { resaMail_: resaMail_, resaLigne_: resaLigne_, resaDateTexte_: resaDateTexte_ };
