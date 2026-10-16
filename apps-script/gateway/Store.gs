/** Accès au classeur de la passerelle (onglets : Utilisateurs, Modules, DroitsRole, Exceptions, Journal). */
var Store = (function () {
  function db_() { return SpreadsheetApp.openById(prop_('DB_ID')); }
  function brut_(nom) {
    var v = db_().getSheetByName(nom).getDataRange().getValues();
    var h = v[0].map(String);
    return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; h.forEach(function (c, i) { o[c] = r[i]; }); return o; });
  }
  function table(nom) {
    var cache = CacheService.getScriptCache(); var k = 'TBL_' + nom;
    var hit = cache.get(k); if (hit) return JSON.parse(hit);
    var rows;
    if (nom === 'Utilisateurs' && sourceUtilisateurs_() === 'bddorga') {
      try { rows = utilisateursBddorga_(brut_(nom)); }
      catch (e) { Logger.log('BDDORGA direct indisponible, repli sur Gateway_DB : ' + e.message); rows = brut_(nom); } // personne n'est bloqué si BDDORGA est illisible
    } else rows = brut_(nom);
    try { cache.put(k, JSON.stringify(rows), 120); } catch (e) { /* table > 100 Ko : lue directement à chaque appel */ } // 2 min : une modification manuelle du classeur est vue rapidement
    return rows;
  }
  function utilisateur(email) {
    email = String(email || '').toLowerCase();
    var l = table('Utilisateurs');
    for (var i = 0; i < l.length; i += 1) if (String(l[i].email).toLowerCase() === email) return l[i];
    return null;
  }
  function sourceUtilisateurs_() { return PropertiesService.getScriptProperties().getProperty('UTILISATEURS_SOURCE') || ''; }
  function utilisateursBddorga_(anciens) {
    var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
    var sh = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
    if (!sh) throw new Error('Onglet BDDORGA introuvable');
    var v = sh.getDataRange().getValues(), lu = Annuaire.lire(v);
    if (lu.erreur) throw new Error(lu.erreur);
    return UBD.construire(lu, Annuaire.colonnes(v), anciens, uidPour_);
  }
  /** Écrit dans BDDORGA les champs gérés ; retourne les champs restants (à écrire dans Gateway_DB), ou null si la personne n'y est pas. */
  function majBddorga_(email, valeurs) {
    var props = PropertiesService.getScriptProperties(), id = props.getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
    var sh = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
    var plan = UBD.planEcriture(sh.getDataRange().getValues(), email, valeurs, { nin: props.getProperty('ORGA_ECRIRE_NIN') === '1' });
    if (plan.erreur) return null;
    plan.ecritures.forEach(function (e) {
      if (e.entete) sh.getRange(e.ligneEntete, e.col).setValue(e.entete);
      var cell = sh.getRange(plan.ligne, e.col); cell.setNumberFormat('@'); cell.setValue(e.valeur);
    });
    return plan.reste;
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
    if (nom === 'Utilisateurs' && cles.email && sourceUtilisateurs_() === 'bddorga') {
      var ecrit = null;
      try { ecrit = majBddorga_(cles.email, valeurs); } catch (e) { Logger.log('Écriture BDDORGA : ' + e.message); journal('bddorga_echec', cles.email, String(e.message || e)); }
      // la copie Gateway_DB reste à jour (retour arrière sans perte) ; si la personne n'y a pas de ligne, on n'en crée pas (BDDORGA fait foi)
      if (ecrit && !trouver_(feuille_(nom), { email: cles.email }).ligne) { invalider_(nom); return; }
    }
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
