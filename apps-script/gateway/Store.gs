/** Accès au classeur de la passerelle (onglets : Utilisateurs, Modules, DroitsRole, Exceptions, Journal). */
var Store = (function () {
  function db_() { return SpreadsheetApp.openById(prop_('DB_ID')); }
  function table(nom) {
    var cache = CacheService.getScriptCache(); var k = 'TBL_' + nom;
    var hit = cache.get(k); if (hit) return JSON.parse(hit);
    var v = db_().getSheetByName(nom).getDataRange().getValues();
    var h = v[0].map(String);
    var rows = v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; h.forEach(function (c, i) { o[c] = r[i]; }); return o; });
    try { cache.put(k, JSON.stringify(rows), 120); } catch (e) { /* table > 100 Ko : lue directement à chaque appel */ } // 2 min : une modification manuelle du classeur est vue rapidement
    return rows;
  }
  function utilisateur(email) {
    email = String(email || '').toLowerCase();
    var l = table('Utilisateurs');
    for (var i = 0; i < l.length; i += 1) if (String(l[i].email).toLowerCase() === email) return l[i];
    return null;
  }
  function feuille_(nom) { return db_().getSheetByName(nom); }
  function invalider_(nom) { CacheService.getScriptCache().remove('TBL_' + nom); }
  function trouver_(sh, cles) {
    var v = sh.getDataRange().getValues(); var h = v[0].map(String);
    for (var i = 1; i < v.length; i += 1) {
      var ok = true;
      Object.keys(cles).forEach(function (k) { if (String(v[i][h.indexOf(k)]).toLowerCase() !== String(cles[k]).toLowerCase()) ok = false; });
      if (ok) return { ligne: i + 1, h: h };
    }
    return { ligne: 0, h: h };
  }
  /** Met à jour (ou crée) la ligne identifiée par `cles` avec `valeurs`. */
  function maj(nom, cles, valeurs) {
    var sh = feuille_(nom); var t = trouver_(sh, cles); var tout = {};
    Object.keys(cles).forEach(function (k) { tout[k] = cles[k]; }); Object.keys(valeurs).forEach(function (k) { tout[k] = valeurs[k]; });
    if (t.ligne) { Object.keys(valeurs).forEach(function (k) { sh.getRange(t.ligne, t.h.indexOf(k) + 1).setValue(valeurs[k]); }); }
    else sh.appendRow(t.h.map(function (c) { return tout[c] === undefined ? '' : tout[c]; }));
    invalider_(nom);
  }
  function supprimer(nom, cles) {
    var sh = feuille_(nom); var t = trouver_(sh, cles);
    if (t.ligne) sh.deleteRow(t.ligne);
    invalider_(nom);
  }
  function supprimerTout(nom, cles) {
    var sh = feuille_(nom);
    for (var i = 0; i < 500; i += 1) { var t = trouver_(sh, cles); if (!t.ligne) break; sh.deleteRow(t.ligne); }
    invalider_(nom);
  }
  function parUid(uid) {
    uid = String(uid || '');
    if (!uid) return null;
    var l = table('Utilisateurs');
    for (var i = 0; i < l.length; i += 1) if (String(l[i].uid) === uid) return l[i];
    return null;
  }
  function journal(action, email, detail) {
    try { db_().getSheetByName('Journal').appendRow([new Date(), action, email, detail || '']); } catch (e) { Logger.log('Journal : ' + e.message); }
  }
  return { table: table, utilisateur: utilisateur, parUid: parUid, maj: maj, supprimer: supprimer, supprimerTout: supprimerTout, journal: journal };
})();
