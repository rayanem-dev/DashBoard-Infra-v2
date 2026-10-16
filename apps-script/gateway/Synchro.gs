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
  if (appliquer && PropertiesService.getScriptProperties().getProperty('UTILISATEURS_SOURCE') === 'bddorga') { Logger.log('Synchronisation inutile : les utilisateurs sont lus directement dans BDDORGA.'); return null; }
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
  var numeriques = existants.filter(function (u) { return Annuaire.ressembleNumero(u.nom); });
  l.push('Noms inutilisables dans Utilisateurs (numéros à la place du nom) : ' + numeriques.length + (numeriques.length ? ' → ' + (appliquer ? 'corrigés ci-dessus quand la source donne un nom ou un e-mail' : 'seront corrigés par la synchronisation') : '') + '. Ils ne s\'affichent de toute façon plus jamais (nom déduit de l\'e-mail).');
  l.push('Avertissements (' + lu.avertissements.length + ') : ' + (lu.avertissements.map(function (x) { return 'ligne ' + x.ligne + ' — ' + x.texte; }).join(' ; ') || 'aucun'));
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

/** À lancer UNIQUEMENT après avoir restreint le partage du fichier Organigramme (plus de « tous les utilisateurs disposant du lien »). */
function autoriserEcritureNIN() { PropertiesService.getScriptProperties().setProperty('ORGA_ECRIRE_NIN', '1'); Logger.log('Écriture du NIN dans BDDORGA : ACTIVÉE'); }
function interdireEcritureNIN() { PropertiesService.getScriptProperties().deleteProperty('ORGA_ECRIRE_NIN'); Logger.log('Écriture du NIN dans BDDORGA : désactivée'); }

/**
 * Recopie dans BDDORGA ce que l'agent a saisi lui-même (matricule, matricule SAP, NIN) : le fichier reste la fiche de référence.
 * Ne bloque jamais l'agent : en cas d'échec, la valeur reste dans la passerelle et on le signale dans le journal.
 * Le NIN n'est recopié que si ORGA_ECRIRE_NIN = 1 (voir autoriserEcritureNIN) : à n'activer qu'une fois le partage du fichier restreint.
 */
function ecrireDansBddorga_(email, champs, etendu) {
  var props = PropertiesService.getScriptProperties(); var id = props.getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var sh = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  if (!sh) throw new Error('Onglet BDDORGA introuvable');
  var plan = Annuaire.planEcriture(sh.getDataRange().getValues(), email, champs, { nin: props.getProperty('ORGA_ECRIRE_NIN') === '1', etendu: etendu === true });
  if (plan.erreur) throw new Error(plan.erreur);
  plan.ecritures.forEach(function (e) {
    if (e.entete) sh.getRange(e.ligneEntete, e.col).setValue(e.entete);
    var cell = sh.getRange(plan.ligne, e.col); cell.setNumberFormat('@'); cell.setValue(e.valeur); // texte : un NIN de 18 chiffres perdrait ses derniers chiffres en nombre
  });
  return plan.ecritures.length;
}

/** À lancer UNIQUEMENT après avoir restreint le partage du fichier Organigramme (plus de « tous les utilisateurs disposant du lien »). */
function autoriserEcritureNIN() { PropertiesService.getScriptProperties().setProperty('ORGA_ECRIRE_NIN', '1'); Logger.log('Écriture du NIN dans BDDORGA : ACTIVÉE'); }
function interdireEcritureNIN() { PropertiesService.getScriptProperties().deleteProperty('ORGA_ECRIRE_NIN'); Logger.log('Écriture du NIN dans BDDORGA : désactivée'); }

/** Écrit le nouveau SERVICE d'une personne dans BDDORGA (cellule « Service » de sa ligne). Retourne l'ancien service. Lève une erreur si impossible. */
function ecrireServiceBddorga_(email, service) {
  var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var sh = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  if (!sh) throw new Error('Onglet BDDORGA introuvable');
  var plan = Annuaire.planAffectation(sh.getDataRange().getValues(), email, service);
  if (plan.erreur) throw new Error(plan.erreur);
  var cell = sh.getRange(plan.ligne, plan.col); cell.setNumberFormat('@'); cell.setValue(String(service));
  return plan.ancien;
}

/**
 * Nettoyage de la table Utilisateurs : lignes sans uid ni e-mail (anciennes lignes collées à la main).
 * Celles dont la personne existe déjà avec un e-mail sont des DOUBLONS (le même nom apparaît deux fois dans « Gestion des privilèges ») ;
 * les autres sont seulement listées : il faut leur adresse dans BDDORGA, puis une synchronisation.
 * apercuFantomes() : liste sans rien modifier (à lancer en premier). supprimerFantomes() : supprime uniquement les doublons.
 */
function fantomes_(supprimer) {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Utilisateurs');
  var v = sh.getDataRange().getValues(), h = v[0].map(String);
  var lignes = v.slice(1).map(function (r) { var o = {}; h.forEach(function (c, i) { o[c] = r[i]; }); return o; });
  var f = Annuaire.fantomes(lignes);
  if (supprimer) {
    f.doublons.map(function (d) { return d.ligne; }).sort(function (a, b) { return b - a; }).forEach(function (l) { sh.deleteRow(l); });
    CacheService.getScriptCache().remove('TBL_Utilisateurs');
    Store.journal('nettoyage_fantomes', 'script', f.doublons.length + ' doublon(s) supprimé(s)');
  }
  Logger.log((supprimer ? 'SUPPRIMÉS' : 'APERÇU (rien n\'est supprimé)') + ' — doublons sans e-mail (' + f.doublons.length + ') : ' + (f.doublons.map(function (d) { return d.nom + ' (ligne ' + d.ligne + ', existe avec ' + d.avec + (d.role !== d.roleAvec ? ' — RÔLE DIFFÉRENT : fantôme « ' + (d.role || 'aucun') + ' », compte « ' + (d.roleAvec || 'aucun') + ' » : vérifiez le rôle du compte' : '') + ')'; }).join(' ; ') || 'aucun'));
  Logger.log('Lignes sans e-mail, sans autre ligne pour la personne (' + f.seuls.length + ', conservées) : ' + (f.seuls.map(function (d) { return d.nom + ' (ligne ' + d.ligne + ')'; }).join(' ; ') || 'aucune'));
  return f;
}
function apercuFantomes() { fantomes_(false); }
function supprimerFantomes() { fantomes_(true); }

/**
 * BDDORGA comme base unique des utilisateurs (voir UtilisateursBDDORGA.gs).
 * 1) apercuMigrationBDDORGA()  : montre ce qui sera copié, sans rien écrire.
 * 2) migrerVersBDDORGA()       : crée les colonnes Rôle / Actif / E-mail de contact / Civilité dans BDDORGA et y copie les valeurs de l'ancienne table (cases vides seulement).
 * 3) activerBDDORGADirect()    : la passerelle lit désormais BDDORGA ; desactiverBDDORGADirect() revient à l'ancienne table.
 */
function migrationBddorga_(appliquer) {
  var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var sh = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  var v = sh.getDataRange().getValues(), c = Annuaire.colonnes(v), lu = Annuaire.lire(v);
  if (lu.erreur) throw new Error(lu.erreur);
  var db = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Utilisateurs'), dv = db.getDataRange().getValues(), dh = dv[0].map(String);
  var anciens = dv.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; dh.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  var parEmail = {}; anciens.forEach(function (u) { if (u.email) parEmail[String(u.email).toLowerCase()] = u; });
  var copies = 0, sansCompte = [], horsFichier = [], vus = {};
  lu.personnes.forEach(function (p) {
    vus[p.email] = true; var a = parEmail[p.email];
    if (!a) { sansCompte.push(p.nom); return; }
    var champs = {};
    if (!p.role && a.role) champs.role = a.role;
    if (p.actif === '' && a.actif !== '' && a.actif !== undefined) champs.actif = a.actif;
    if (!p.email_contact && a.email_contact) champs.email_contact = a.email_contact;
    if (!p.civilite && a.civilite) champs.civilite = a.civilite;
    if (!Object.keys(champs).length) return;
    copies += 1;
    if (appliquer) { v = sh.getDataRange().getValues(); var plan = UBD.planEcriture(v, p.email, champs, {}); if (plan.erreur) throw new Error(plan.erreur);
      plan.ecritures.forEach(function (e) { if (e.entete) sh.getRange(e.ligneEntete, e.col).setValue(e.entete); var cell = sh.getRange(plan.ligne, e.col); cell.setNumberFormat('@'); cell.setValue(e.valeur); }); }
  });
  anciens.forEach(function (a) { var e = String(a.email || '').toLowerCase(); if (e && !vus[e]) horsFichier.push(a.nom + ' <' + e + '> rôle « ' + (a.role || 'aucun') + ' »'); });
  if (appliquer) { CacheService.getScriptCache().remove('TBL_Utilisateurs'); Store.journal('migration_bddorga', 'script', copies + ' personne(s) copiée(s) dans BDDORGA'); }
  Logger.log((appliquer ? 'MIGRATION APPLIQUÉE' : 'APERÇU (rien n\'est écrit)') + ' — personnes dans BDDORGA : ' + lu.personnes.length + ' ; à compléter (rôle/actif/contact/civilité) : ' + copies);
  Logger.log('Dans BDDORGA mais sans compte dans la passerelle (' + sansCompte.length + ', créés sans rôle à l\'activation) : ' + (sansCompte.join(' ; ') || 'aucun'));
  Logger.log('Dans la passerelle mais ABSENTS de BDDORGA (' + horsFichier.length + ', conservés tels quels, à ajouter dans BDDORGA) : ' + (horsFichier.join(' ; ') || 'aucun'));
}
function apercuMigrationBDDORGA() { migrationBddorga_(false); }
function migrerVersBDDORGA() { migrationBddorga_(true); }
function activerBDDORGADirect() {
  PropertiesService.getScriptProperties().setProperty('UTILISATEURS_SOURCE', 'bddorga'); CacheService.getScriptCache().remove('TBL_Utilisateurs');
  Store.journal('bddorga_direct', 'script', 'activé'); Logger.log('Utilisateurs lus directement dans BDDORGA : ACTIVÉ (lancez migrerVersBDDORGA avant si ce n\'est pas fait).');
}
function desactiverBDDORGADirect() {
  PropertiesService.getScriptProperties().deleteProperty('UTILISATEURS_SOURCE'); CacheService.getScriptCache().remove('TBL_Utilisateurs');
  Store.journal('bddorga_direct', 'script', 'désactivé'); Logger.log('Retour à la table Utilisateurs de Gateway_DB.');
}
