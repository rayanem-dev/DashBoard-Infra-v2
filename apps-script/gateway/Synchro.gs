/**
 * Synchronisation avec l'onglet BDDORGA du fichier « Organigrame Div Infra » (voir Annuaire.gs).
 *
 *  previsualiserSynchro()          : montre ce qui changerait, sans rien écrire (à lancer en premier).
 *  synchroniserDepuisBDDORGA()     : applique (ajoute les nouveaux, met à jour l'identité des existants).
 *  activerSynchroQuotidienne()     : programme la synchronisation chaque jour vers 6 h.
 *  desactiverSynchroQuotidienne()  : l'arrête.
 *
 * Règles : les nouveaux arrivent SANS rôle (donc sans accès) tant que vous ne leur en donnez pas un dans la page Privilèges ;
 * personne n'est supprimé ni désactivé automatiquement (les absents de la source sont seulement listés) ;
 * role, actif, uid et civilite ne sont jamais modifiés ; seules les colonnes d'identité sont lues dans le fichier source.
 */
var ORGA_ID_DEFAUT = '1Thk_-DUr1q9fetPX7W8qg2_SVNRhF_7LtD3xTZfn-OA'; // « Organigrame Div Infra » (compte du secrétariat)

function uidPour_(email) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, prop_('PEPPER') + 'uid' + String(email).toLowerCase());
  return Utilities.base64EncodeWebSafe(d).slice(0, 12);
}

function synchro_(appliquer) {
  var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var src = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  if (!src) throw new Error('Onglet BDDORGA introuvable dans le fichier Organigramme');
  var lu = Annuaire.lire(src.getDataRange().getValues());
  if (lu.erreur) throw new Error(lu.erreur);

  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Utilisateurs');
  var v = sh.getDataRange().getValues(); var h = v[0].map(String);
  var existants = v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; h.forEach(function (c, i) { o[c] = r[i]; }); return o; });
  var f = Annuaire.fusionner(existants, lu.personnes);

  var ligneDe = {}; for (var i = 1; i < v.length; i += 1) ligneDe[String(v[i][h.indexOf('email')]).toLowerCase()] = i + 1;
  if (appliquer) {
    f.maj.forEach(function (m) {
      Object.keys(m.champs).forEach(function (k) { var c = h.indexOf(k); if (c >= 0) sh.getRange(ligneDe[m.email], c + 1).setValue(m.champs[k]); });
    });
    f.ajouts.forEach(function (p) {
      sh.appendRow(h.map(function (c) { return c === 'uid' ? uidPour_(p.email) : c === 'actif' ? 1 : c === 'role' ? '' : (p[c] === undefined ? '' : p[c]); }));
    });
    CacheService.getScriptCache().remove('TBL_Utilisateurs');
    Store.journal('synchro_bddorga', 'script', f.ajouts.length + ' ajouts, ' + f.maj.length + ' mises à jour');
  }

  var l = [];
  l.push((appliquer ? 'APPLIQUÉ' : 'APERÇU (rien n\'est écrit)') + ' — source : ' + lu.personnes.length + ' personne(s) avec e-mail valide.');
  l.push('Nouveaux (' + f.ajouts.length + ') : ' + (f.ajouts.map(function (p) { return p.nom; }).join(' ; ') || 'aucun') + (f.ajouts.length ? '  → sans rôle : à régler dans Privilèges' : ''));
  l.push('Mis à jour (' + f.maj.length + ') : ' + (f.maj.map(function (m) { return m.nom + ' [' + Object.keys(m.champs).join(', ') + ']'; }).join(' ; ') || 'aucun'));
  l.push('Inchangés : ' + f.inchanges);
  l.push('Dans la passerelle mais absents de BDDORGA (' + f.absents.length + ', non modifiés) : ' + (f.absents.join(' ; ') || 'aucun'));
  l.push('Lignes ignorées (' + lu.ignores.length + ') : ' + (lu.ignores.map(function (x) { return 'ligne ' + x.ligne + ' ' + (x.nom || '(sans nom)') + ' — ' + x.raison; }).join(' ; ') || 'aucune'));
  Logger.log(l.join('\n'));
  return f;
}

function previsualiserSynchro() { synchro_(false); }
function synchroniserDepuisBDDORGA() { synchro_(true); }

function activerSynchroQuotidienne() {
  desactiverSynchroQuotidienne();
  ScriptApp.newTrigger('synchroniserDepuisBDDORGA').timeBased().everyDays(1).atHour(6).create();
  Logger.log('Synchronisation quotidienne programmée (vers 6 h).');
}
function desactiverSynchroQuotidienne() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'synchroniserDepuisBDDORGA') ScriptApp.deleteTrigger(t); });
}
