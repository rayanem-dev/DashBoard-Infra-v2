/**
 * Une seule base de données : les onglets de « Gateway_DB » (Utilisateurs, Applications, Modules, Droits, Journal, Badges, CPM…) rejoignent le fichier BDDORGA
 * (« Organigrame Div Infra »). Les mots de passe (empreintes) restent dans Gateway_Secrets : ils ne sont jamais copiés.
 *
 *  1) apercuFusionBase()    : liste ce qui serait copié et les onglets déjà présents dans BDDORGA (jamais écrasés).
 *  2) fusionnerBase()       : copie les onglets manquants dans BDDORGA (Gateway_DB n'est pas modifié).
 *  3) activerBaseUnique()   : recopie une dernière fois les données (rien de perdu) puis la passerelle travaille dans BDDORGA (propriété DB_ID).
 *     desactiverBaseUnique(): revient à Gateway_DB (ce qui a été écrit dans BDDORGA depuis l'activation n'y est pas reporté).
 */
function baseUnique_(appliquer) {
  var props = PropertiesService.getScriptProperties();
  var srcId = props.getProperty('DB_ID_ANCIEN') || props.getProperty('DB_ID'), cibleId = props.getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  if (srcId === cibleId) { Logger.log('La passerelle utilise déjà BDDORGA comme base unique.'); return null; }
  var src = SpreadsheetApp.openById(srcId), cible = SpreadsheetApp.openById(cibleId);
  var presents = {}; cible.getSheets().forEach(function (s) { presents[s.getName()] = true; });
  var aCopier = [], conflits = [];
  src.getSheets().forEach(function (s) { (presents[s.getName()] ? conflits : aCopier).push(s.getName()); });
  var copiees = JSON.parse(props.getProperty('BASE_COPIEES') || '[]');
  if (appliquer) {
    aCopier.forEach(function (nom) { src.getSheetByName(nom).copyTo(cible).setName(nom); copiees.push(nom); });
    props.setProperty('BASE_COPIEES', JSON.stringify(copiees));
  }
  Logger.log((appliquer ? 'COPIÉS' : 'APERÇU (rien n\'est copié)') + ' (' + aCopier.length + ') : ' + (aCopier.join(', ') || 'aucun'));
  Logger.log('Déjà présents dans BDDORGA, non touchés (' + conflits.length + ') : ' + (conflits.join(', ') || 'aucun') + (conflits.length ? ' → renommez-les dans BDDORGA ou dans Gateway_DB si la passerelle en a besoin' : ''));
  return { copiees: copiees, conflits: conflits };
}
function apercuFusionBase() { baseUnique_(false); }
function fusionnerBase() { baseUnique_(true); }

function activerBaseUnique() {
  var props = PropertiesService.getScriptProperties(), srcId = props.getProperty('DB_ID'), cibleId = props.getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  if (srcId === cibleId) { Logger.log('Déjà activée.'); return; }
  var copiees = JSON.parse(props.getProperty('BASE_COPIEES') || '[]'), src = SpreadsheetApp.openById(srcId), cible = SpreadsheetApp.openById(cibleId), manquants = [];
  src.getSheets().forEach(function (s) { if (!cible.getSheetByName(s.getName())) manquants.push(s.getName()); });
  if (manquants.length) throw new Error('Onglets absents de BDDORGA : ' + manquants.join(', ') + ' — lancez fusionnerBase() d\'abord.');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    copiees.forEach(function (nom) { // dernière recopie : les données écrites depuis la copie ne sont pas perdues
      var a = src.getSheetByName(nom), b = cible.getSheetByName(nom); if (!a || !b) return;
      var v = a.getDataRange().getValues(); b.clearContents(); if (v.length && v[0].length) b.getRange(1, 1, v.length, v[0].length).setValues(v);
    });
    props.setProperty('DB_ID_ANCIEN', srcId); props.setProperty('DB_ID', cibleId);
  } finally { lock.releaseLock(); }
  var c = CacheService.getScriptCache(); c.removeAll(src.getSheets().map(function (s) { return 'TBL_' + s.getName(); }).concat(['BADGES_SRC']));
  Store.journal('base_unique', 'script', 'activée : la passerelle travaille dans BDDORGA');
  Logger.log('Base unique ACTIVÉE : la passerelle travaille désormais dans BDDORGA. Retour possible avec desactiverBaseUnique().');
}
function desactiverBaseUnique() {
  var props = PropertiesService.getScriptProperties(), ancien = props.getProperty('DB_ID_ANCIEN');
  if (!ancien) { Logger.log('Rien à désactiver.'); return; }
  props.setProperty('DB_ID', ancien); props.deleteProperty('DB_ID_ANCIEN');
  CacheService.getScriptCache().removeAll(['TBL_Utilisateurs', 'TBL_Applications', 'TBL_Modules', 'TBL_DroitsRole', 'TBL_Exceptions', 'TBL_Roles', 'BADGES_SRC']);
  Logger.log('Retour à Gateway_DB.');
}
