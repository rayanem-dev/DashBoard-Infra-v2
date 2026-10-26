/**
 * Requête de transport de personnel (page requete-transport.html) : enregistre dans BDDORGA le téléphone d'une personne qui n'en a pas.
 * Jamais d'écrasement : si BDDORGA a déjà un numéro, rien n'est modifié.
 */
var Transport = (function () {
  /** « 0696956429 », « +213 696 95 64 29 », « 696956429 » → « 06 96 95 64 29 » ; null si ce n'est pas un numéro algérien plausible. */
  function nettoyerTel(s) {
    var d = String(s == null ? '' : s).replace(/[^\d+]/g, '');
    if (/^\+213\d{9}$/.test(d)) d = '0' + d.slice(4);
    else if (/^00213\d{9}$/.test(d)) d = '0' + d.slice(5);
    d = d.replace(/\D/g, '');
    if (/^[567]\d{8}$/.test(d)) d = '0' + d;
    if (!/^0\d{9}$/.test(d)) return null;
    return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  function cle(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  return { nettoyerTel: nettoyerTel, cle: cle };
})();
if (typeof module !== 'undefined') module.exports = Transport;

function transportTelephone_(req) {
  var u = Auth.userFromToken(req.token), tel = Transport.nettoyerTel(req.tel), nom = Transport.cle(req.nom);
  if (!nom) throw new Error('Nom manquant');
  if (!tel) throw new Error('Numéro de téléphone invalide');
  var cand = Store.table('Utilisateurs').filter(function (x) { return String(x.actif) !== '0' && Transport.cle(Annuaire.nomAffichable(x.nom, x.email)) === nom; });
  if (cand.length !== 1) throw new Error(cand.length ? 'Plusieurs personnes portent ce nom dans BDDORGA : le numéro n\'a pas été enregistré' : 'Personne introuvable dans BDDORGA : le numéro n\'a pas été enregistré');
  var c = cand[0];
  if (String(c.telephone || '').trim()) return { ecrit: false, raison: 'deja', tel: String(c.telephone) };
  Store.maj('Utilisateurs', { email: c.email }, { telephone: tel });
  try { CacheService.getScriptCache().remove('ANN_PERSONNES'); } catch (e) { /* rien */ }
  Store.journal('telephone_bddorga', u.email, c.email + ' → ' + tel);
  return { ecrit: true, tel: tel };
}
