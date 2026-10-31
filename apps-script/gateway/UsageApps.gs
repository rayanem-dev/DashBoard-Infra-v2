/**
 * « Mes applications » (accueil) : les 9 applications qu'une personne ouvre le plus. Le compteur est gardé PAR COMPTE sur le serveur (onglet « UsageApps »),
 * donc il suit la personne d'un appareil à l'autre ; avant elle, il restait dans le navigateur (d'où un classement qui ne « marchait » que sur l'appareil utilisé).
 * Pour qui n'a encore rien ouvert, l'ordre vient des applications les plus ouvertes par les personnes de même rôle.
 * Partie PURE (testée en Node : test/usageapps.test.js) puis les actions de la passerelle.
 */
var UsageApps = (function () {
  var PLAFOND = 300;   // au-delà de ce total par personne, tous les compteurs sont divisés par 2 : les habitudes récentes l'emportent peu à peu
  function titre(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, 120); }
  /** Compteurs d'une personne : { titre: n } d'après les lignes [{ uid, titre, n }]. */
  function deUid(lignes, uid) { var o = {}; (lignes || []).forEach(function (l) { if (String(l.uid) === String(uid) && l.titre) o[l.titre] = (Number(l.n) || 0) + (o[l.titre] || 0); }); return o; }
  /** Ajoute une ouverture ; retourne les nouveaux compteurs de la personne (divisés par 2 quand le total dépasse le plafond). */
  function incrementer(compteurs, t) {
    var o = {}; Object.keys(compteurs || {}).forEach(function (k) { o[k] = compteurs[k]; }); t = titre(t); if (!t) return o;
    o[t] = (o[t] || 0) + 1;
    if (Object.keys(o).reduce(function (n, k) { return n + o[k]; }, 0) > PLAFOND) Object.keys(o).forEach(function (k) { o[k] = Math.floor(o[k] / 2); if (!o[k]) delete o[k]; });
    return o;
  }
  /** Fusion d'un historique venu du navigateur : pour chaque application, le plus grand des deux compteurs (jamais d'addition : rien n'est compté deux fois). */
  function fusionner(compteurs, venu) {
    var o = {}; Object.keys(compteurs || {}).forEach(function (k) { o[k] = compteurs[k]; });
    Object.keys(venu || {}).forEach(function (k) { var t = titre(k), n = Math.max(0, Math.min(1000, Math.floor(Number(venu[k]) || 0))); if (t && n > (o[t] || 0)) o[t] = n; });
    return o;
  }
  /** Applications les plus ouvertes par un ensemble de personnes (uids) : { titre: somme }, les `limite` premières. */
  function populaires(lignes, uids, limite) {
    var ok = {}; (uids || []).forEach(function (u) { ok[String(u)] = 1; }); var s = {};
    (lignes || []).forEach(function (l) { if (ok[String(l.uid)] && l.titre) s[l.titre] = (s[l.titre] || 0) + (Number(l.n) || 0); });
    var t = Object.keys(s).sort(function (a, b) { return s[b] - s[a]; }).slice(0, limite || 40), o = {}; t.forEach(function (k) { o[k] = s[k]; }); return o;
  }
  return { PLAFOND: PLAFOND, titre: titre, deUid: deUid, incrementer: incrementer, fusionner: fusionner, populaires: populaires };
})();
if (typeof module !== 'undefined') module.exports = UsageApps;

// ---------- passerelle ----------
var USAGE_ENTETES_ = ['uid', 'titre', 'n', 'maj_le'];
function usageLignes_() {
  var cache = CacheService.getScriptCache(), c = null; try { c = cache.get('USAGE_APPS'); } catch (e) { c = null; }
  if (c) { try { return JSON.parse(c); } catch (e) { /* recalcul */ } }
  var v = cpmFeuille_('UsageApps', USAGE_ENTETES_).getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i += 1) if (v[i][0] && v[i][1]) out.push({ uid: String(v[i][0]), titre: String(v[i][1]), n: Number(v[i][2]) || 0 });
  try { var j = JSON.stringify(out); if (j.length < 95000) cache.put('USAGE_APPS', j, 120); } catch (e) { /* trop gros : pas de cache */ }
  return out;
}
/** Compteurs de la personne et applications populaires de son rôle, pour la réponse « menu » ; jamais bloquant. */
function usagePourMenu_(u) {
  try {
    var lignes = usageLignes_(), role = Droits.roleCanon(u.role), memes = Store.table('Utilisateurs').filter(function (x) { return x.uid && String(x.actif) !== '0' && Droits.roleCanon(x.role) === role; }).map(function (x) { return String(x.uid); });
    return { usages: UsageApps.deUid(lignes, u.uid), populaires: UsageApps.populaires(lignes, memes, 40) };
  } catch (e) { return { usages: {}, populaires: {} }; }
}
/** Enregistre une ouverture (titre) et/ou fusionne l'historique du navigateur (sync = { titre: n }) ; réponse : les compteurs de la personne. */
function usageEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); if (!u.uid) throw new Error('Compte sans identifiant');
  // seules les applications du menu de la personne sont comptées (aucune ligne inventée)
  var permis = {}; Droits.menu(acces_(u), Store.table('Modules'), Store.table('Applications'), u.role).forEach(function (m) { (m.apps || []).forEach(function (a) { permis[UsageApps.titre(a.titre)] = 1; }); });
  var venu = {}; Object.keys(req.sync || {}).forEach(function (k) { if (permis[UsageApps.titre(k)]) venu[UsageApps.titre(k)] = req.sync[k]; });
  if (req.titre && !permis[UsageApps.titre(req.titre)]) req.titre = '';
  req.sync = venu;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = cpmFeuille_('UsageApps', USAGE_ENTETES_), v = sh.getDataRange().getValues(), mes = {}, lignes = {};
    for (var i = 1; i < v.length; i += 1) if (String(v[i][0]) === String(u.uid)) { mes[String(v[i][1])] = Number(v[i][2]) || 0; lignes[String(v[i][1])] = i + 1; }
    var apres = req.sync ? UsageApps.fusionner(mes, req.sync) : mes;
    if (req.titre) apres = UsageApps.incrementer(apres, req.titre);
    var maintenant = new Date().toISOString(), aEcrire = [];
    Object.keys(apres).forEach(function (t) { if (apres[t] !== mes[t]) aEcrire.push(t); });
    aEcrire.forEach(function (t) { var n = apres[t]; if (lignes[t]) sh.getRange(lignes[t], 3, 1, 2).setValues([[n, maintenant]]); else { var r = sh.getRange(sh.getLastRow() + 1, 1, 1, 4); r.setNumberFormat('@'); r.setValues([[String(u.uid), t, n, maintenant]]); } });
    Object.keys(mes).forEach(function (t) { if (!(t in apres) && lignes[t]) sh.getRange(lignes[t], 3, 1, 2).setValues([[0, maintenant]]); });   // compteur ramené à 0 par la division : ligne gardée à 0 (ignorée à la lecture)
    try { CacheService.getScriptCache().remove('USAGE_APPS'); } catch (e) { /* sans effet */ }
    return { usages: apres };
  } finally { lock.releaseLock(); }
}
