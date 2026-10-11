/** Accès au classeur de la passerelle (onglets : Utilisateurs, Modules, DroitsRole, Exceptions, Journal). */
var Store = (function () {
  function db_() { return SpreadsheetApp.openById(prop_('DB_ID')); }
  function table(nom) {
    var cache = CacheService.getScriptCache(); var k = 'TBL_' + nom;
    var hit = cache.get(k); if (hit) return JSON.parse(hit);
    var v = db_().getSheetByName(nom).getDataRange().getValues();
    var h = v[0].map(String);
    var rows = v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; h.forEach(function (c, i) { o[c] = r[i]; }); return o; });
    cache.put(k, JSON.stringify(rows), 120); // 2 min : une modification manuelle du classeur est vue rapidement
    return rows;
  }
  function utilisateur(email) {
    email = String(email || '').toLowerCase();
    var l = table('Utilisateurs');
    for (var i = 0; i < l.length; i += 1) if (String(l[i].email).toLowerCase() === email) return l[i];
    return null;
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
  return { table: table, utilisateur: utilisateur, parUid: parUid, journal: journal };
})();
