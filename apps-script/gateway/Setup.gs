/**
 * Installation (à lancer UNE fois depuis le compte du secrétariat) :
 *   1. crée le classeur « Gateway_DB » et le classeur « Gateway_Secrets » (empreintes, à ne partager avec personne) ;
 *   2. enregistre leurs identifiants et un poivre aléatoire dans les propriétés du script ;
 *   3. remplit Modules, rôles et droits par défaut.
 * Ensuite : coller dans « Utilisateurs » les lignes nettoyées de BDDORGA (voir docs/ARCHITECTURE-4.0.md),
 * puis déployer en application Web (Exécuter en tant que : moi ; Accès : tout le monde — protégé par la connexion).
 */
// Droits par défaut (1 lecture, 2 saisie, 3 administration) — à ajuster dans la page « Privilèges » ou l'onglet DroitsRole.
// « prestataire » et « guest » n'ont volontairement aucun droit par défaut : on les ouvre module par module.
var DROITS_DEFAUT_ = [
  ['stagiaire', 'planning', 1], ['stagiaire', 'simulation', 1],
  ['agent', 'planning', 1], ['agent', 'rapports', 1],
  ['conducteur', 'planning', 1], ['conducteur', 'rapports', 2], ['conducteur', 'pilotage', 1], ['conducteur', 'logistique', 2],
  ['dessinateur', 'planning', 1], ['dessinateur', 'rapports', 1], ['dessinateur', 'pilotage', 1],
  ['chef_atelier', 'planning', 1], ['chef_atelier', 'rapports', 2], ['chef_atelier', 'pilotage', 1], ['chef_atelier', 'logistique', 2],
  ['chef_service', 'planning', 2], ['chef_service', 'rapports', 2], ['chef_service', 'pilotage', 2], ['chef_service', 'cpm', 1], ['chef_service', 'logistique', 2], ['chef_service', 'rh', 1], ['chef_service', 'admin', 1],
  ['interim_chef_service', 'planning', 2], ['interim_chef_service', 'rapports', 2], ['interim_chef_service', 'pilotage', 2], ['interim_chef_service', 'cpm', 1], ['interim_chef_service', 'logistique', 2], ['interim_chef_service', 'rh', 1], ['interim_chef_service', 'admin', 1],
  ['cadre_sup', 'planning', 1], ['cadre_sup', 'rapports', 2], ['cadre_sup', 'pilotage', 2], ['cadre_sup', 'cpm', 1], ['cadre_sup', 'logistique', 2], ['cadre_sup', 'rh', 1], ['cadre_sup', 'admin', 1],
  ['chef_division', 'planning', 3], ['chef_division', 'rapports', 3], ['chef_division', 'pilotage', 3], ['chef_division', 'cpm', 3], ['chef_division', 'logistique', 3], ['chef_division', 'rh', 3], ['chef_division', 'admin', 3], ['chef_division', 'badges', 2],
  ['ordonnateur', 'planning', 1], ['ordonnateur', 'rapports', 1], ['ordonnateur', 'pilotage', 2], ['ordonnateur', 'cpm', 1], ['ordonnateur', 'logistique', 1], ['ordonnateur', 'admin', 1],
  ['secretariat', 'admin', 3], ['secretariat', 'rh', 2], ['secretariat', 'badges', 3], ['secretariat', 'securite', 3], ['secretariat', 'planning', 3],
  ['cpm', 'cpm', 3], ['cpm', 'pilotage', 1], ['cpm', 'planning', 1]
];

/** Ajoute les droits par défaut des rôles qui n'ont encore AUCUNE ligne dans DroitsRole (ne touche jamais aux réglages existants). */
function ajouterDroitsParDefaut() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('DroitsRole');
  var presents = {};
  sh.getDataRange().getValues().slice(1).forEach(function (l) { if (l[0]) presents[Droits.roleCanon(l[0])] = true; });
  var nouveaux = DROITS_DEFAUT_.filter(function (r) { return !presents[r[0]]; });
  if (nouveaux.length) sh.getRange(sh.getLastRow() + 1, 1, nouveaux.length, 3).setValues(nouveaux);
  Logger.log(nouveaux.length + ' droit(s) par défaut ajouté(s).');
}

// Module « simulation » : niveau 2 = pour son service (chef de service, intérim) ; 3 = pour tous (chef de division, secrétariat).
// Niveau 1 (tous les autres rôles) : l'agent simule et consulte son propre planning et ses vis-à-vis seulement.
var DROITS_SIMULATION_ = [['chef_service', 'simulation', 2], ['interim_chef_service', 'simulation', 2], ['chef_division', 'simulation', 3], ['secretariat', 'simulation', 3],
  ['agent', 'simulation', 1], ['conducteur', 'simulation', 1], ['dessinateur', 'simulation', 1], ['chef_atelier', 'simulation', 1], ['cadre_sup', 'simulation', 1], ['ordonnateur', 'simulation', 1], ['cpm', 'simulation', 1]];
/** Crée le module « simulation » et ses droits par défaut s'ils n'existent pas (ne touche jamais aux réglages existants). */
function ajouterModuleSimulation() {
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  var mo = db.getSheetByName('Modules');
  if (!mo.getDataRange().getValues().slice(1).some(function (l) { return String(l[0]).toLowerCase() === 'simulation'; })) mo.appendRow(['simulation', 'Simulation de planning', '🧪', 7, 1]);
  var dr = db.getSheetByName('DroitsRole'), v = dr.getDataRange().getValues().slice(1);
  var nouveaux = DROITS_SIMULATION_.filter(function (r) { return !v.some(function (l) { return Droits.roleCanon(l[0]) === r[0] && String(l[1]).toLowerCase() === 'simulation'; }); });
  if (nouveaux.length) dr.getRange(dr.getLastRow() + 1, 1, nouveaux.length, 3).setValues(nouveaux);
  CacheService.getScriptCache().removeAll(['TBL_Modules', 'TBL_DroitsRole']);
  Logger.log('Module simulation prêt (' + nouveaux.length + ' droit(s) ajouté(s)).');
}

// Module « affectation » : niveau 3 = tout le personnel (chef de division, secrétariat). Le niveau 2 (son service) s'accorde dans Privilèges.
var DROITS_AFFECTATION_ = [['chef_division', 'affectation', 3], ['secretariat', 'affectation', 3]];
function ajouterModuleAffectation() {
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  var mo = db.getSheetByName('Modules');
  if (!mo.getDataRange().getValues().slice(1).some(function (l) { return String(l[0]).toLowerCase() === 'affectation'; })) mo.appendRow(['affectation', 'Affectation (Organigramme)', '🔀', 8, 1]);
  var dr = db.getSheetByName('DroitsRole'), v = dr.getDataRange().getValues().slice(1);
  var nouveaux = DROITS_AFFECTATION_.filter(function (r) { return !v.some(function (l) { return Droits.roleCanon(l[0]) === r[0] && String(l[1]).toLowerCase() === 'affectation'; }); });
  if (nouveaux.length) dr.getRange(dr.getLastRow() + 1, 1, nouveaux.length, 3).setValues(nouveaux);
  CacheService.getScriptCache().removeAll(['TBL_Modules', 'TBL_DroitsRole']);
}
/**
 * Lot 2 : les pages Avancement_des_Chantiers et Suivi_Chantier faisaient encore pointer leur carte vers l'ancien site ;
 * elles sont maintenant servies par le portail (derrière la connexion). Réécrit une seule fois ces deux liens en pages relatives. Idempotent.
 */
function preparerPages_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PAGES_PRET') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
    var v = sh.getDataRange().getValues(), iU = v[0].map(String).indexOf('url');
    for (var i = 1; i < v.length; i += 1) {
      var m = /^https:\/\/rayanem-dev\.github\.io\/DashBoard-Infra\/(Avancement_des_Chantiers|Suivi_Chantier|Dossiers_CPM)\.html$/.exec(String(v[i][iU]));
      if (m) sh.getRange(i + 1, iU + 1).setValue(m[1] + '.html');
    }
    props.setProperty('PAGES_PRET', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}
/**
 * Retire des liens du catalogue le « /u/0/ » (ou /u/1/…) : ce fragment force l'ouverture avec le PREMIER compte Google connecté du navigateur,
 * qui n'est souvent pas celui qui a accès au fichier → page « Une autorisation est nécessaire » alors que le fichier est bien partagé. Une seule fois. Idempotent.
 */
function preparerLiens_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LIENS_PRET') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
    var v = sh.getDataRange().getValues(), iU = v[0].map(String).indexOf('url');
    for (var i = 1; i < v.length; i += 1) {
      var u = String(v[i][iU]), n = u.replace(/(docs\.google\.com\/(?:spreadsheets|document|presentation|forms))\/u\/\d+\//, '$1/').replace(/([?&])authuser=\d+&?/, '$1').replace(/[?&]$/, '');
      if (n !== u) sh.getRange(i + 1, iU + 1).setValue(n);
    }
    props.setProperty('LIENS_PRET', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera */ }
}
/** Anciennes adresses → adresses actuelles (fichiers remplacés : rapport hebdomadaire, Suivi CPM). Pur : testé en Node. */
var REMPLACEMENTS_LIENS_ = [
  [/docs\.google\.com\/presentation\/d\/(?:1FLFP453C8F1Sb8hZBnxboqoJtSq33rEu|1CF4JWBYkPvvlU0XiwVN_sQhxxdM29pgH|1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20)\/[^\s"]*/, 'docs.google.com/presentation/d/1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20/edit?slide=id.p1#slide=id.p1'],
  [/docs\.google\.com\/spreadsheets\/d\/1QFoEEsoosl3vGdwyAlzmQbHt3Vv76llfWfrO-prmAuY\/[^\s"]*/, 'docs.google.com/spreadsheets/d/1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I/edit?usp=sharing'],
  // Enquêtes administratives : l'ancien fichier (cassé) → le Google Sheets actuel
  [/docs\.google\.com\/spreadsheets\/d\/1BBT3DzzLUXAyEQT3SEXTei4wRuN9h1UZ\/?[^\s"]*/, 'docs.google.com/spreadsheets/d/1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo/']
];
function lienActuel_(url) { var u = String(url == null ? '' : url); REMPLACEMENTS_LIENS_.forEach(function (r) { u = u.replace(r[0], r[1]); }); return u; }
/**
 * Carte « Badges prestataires » : retrouve ce qu'il faut faire dans l'onglet Applications (lignes brutes + en-têtes). Pur : testé en Node.
 * { action: 'ok' } la carte existe dans le module « badges » ; { action: 'corriger', ligne } elle existe ailleurs (module) ; { action: 'ajouter' } elle manque (module vide « Bientôt disponible »).
 */
function carteBadgesAFaire_(valeurs) {
  var h = (valeurs[0] || []).map(String), iM = h.indexOf('module'), iU = h.indexOf('url'), iT = h.indexOf('titre');
  for (var i = 1; i < valeurs.length; i += 1) {
    if (String(valeurs[i][iU]) === 'badges.html' || String(valeurs[i][iT]) === 'Badges prestataires') return String(valeurs[i][iM]) === 'badges' ? { action: 'ok' } : { action: 'corriger', ligne: i + 1, colonne: iM + 1 };
  }
  return { action: 'ajouter' };
}
/** Une carte (par son titre) manque-t-elle au catalogue ? Pur : testé en Node. */
function carteManquante_(valeurs, titre) {
  var h = (valeurs[0] || []).map(String), iT = h.indexOf('titre');
  for (var i = 1; i < valeurs.length; i += 1) if (String(valeurs[i][iT]) === titre) return false;
  return true;
}
/** Cartes ajoutées au catalogue quand elles manquent (par titre ; les lignes viennent de SEED_APPS). */
var CARTES_NOUVELLES_ = ['Bon de sortie matériel', 'Fiche d\'évaluation', 'Documents administratifs', 'Renommage de documents', 'Repas à emporter', 'Ordre de travail', 'Autorisation GAZ-OIL', 'Feuille de pointage'];
/** Une seule fois : ajoute au catalogue les nouvelles cartes qui manquent. Idempotent ; une carte supprimée ensuite ne revient pas. */
function preparerCartesNouvelles_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('CARTES_NOUVELLES_PRET') === '7') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
    CARTES_NOUVELLES_.forEach(function (titre) {
      if (!carteManquante_(sh.getDataRange().getValues(), titre)) return;
      var g = SEED_APPS.filter(function (r) { return r[1] === titre; })[0];
      if (g) sh.getRange(sh.getLastRow() + 1, 1, 1, 7).setValues([g.length >= 7 ? g : g.concat([''])]);
    });
    props.setProperty('CARTES_NOUVELLES_PRET', '7');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}
/** Une seule fois : garantit que la carte « Badges prestataires » est dans le catalogue (sinon le module affiche « Bientôt disponible »). Idempotent. */
function preparerCarteBadges_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('CARTE_BADGES_PRET') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), f = carteBadgesAFaire_(sh.getDataRange().getValues());
    if (f.action === 'corriger') sh.getRange(f.ligne, f.colonne).setValue('badges');
    else if (f.action === 'ajouter') { var g = SEED_APPS.filter(function (r) { return r[0] === 'badges'; })[0]; sh.getRange(sh.getLastRow() + 1, 1, 1, 7).setValues([g.length >= 7 ? g : g.concat([''])]); }
    props.setProperty('CARTE_BADGES_PRET', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}
/** Met à jour, une seule fois, les liens du catalogue vers le rapport hebdomadaire (Google Slides) et le Suivi CPM actuels. Idempotent. */
function preparerLiensRapport_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LIENS_RAPPORT_PRET') === '3') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
    var v = sh.getDataRange().getValues(), iU = v[0].map(String).indexOf('url');
    for (var i = 1; i < v.length; i += 1) { var u = String(v[i][iU]), n = lienActuel_(u); if (n !== u) sh.getRange(i + 1, iU + 1).setValue(n); }
    props.setProperty('LIENS_RAPPORT_PRET', '3');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera */ }
}
/** Ajoute au catalogue la carte « Contrôle de l'annuaire » (administration, secrétariat) une seule fois. Idempotent. */
function preparerAnnuaire_() {
  var props = PropertiesService.getScriptProperties();
  // le catalogue se complète tout seul à chaque nouvelle application ajoutée au code (signature = les titres du catalogue de départ), sans relancer mettreAJourStructure à la main
  var sig = SEED_APPS.length + ':' + SEED_APPS.map(function (r) { return String(r[1]); }).join('|').length;
  if (props.getProperty('ANN_PRET') === sig) return;
  try { ajouterApplicationsManquantes(); props.setProperty('ANN_PRET', sig); try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {} } catch (e) { /* on réessaiera */ }
}
/** Prépare le module « affectation » tout seul au premier passage (onglet Affectations, module, droits, carte). Idempotent. */
function preparerAffectation_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('AFFECT_PRET') === '1') return;
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  try {
    if (lock) lock.waitLock(20000);
    if (props.getProperty('AFFECT_PRET') === '1') return;
    var db = SpreadsheetApp.openById(prop_('DB_ID'));
    if (!db.getSheetByName('Affectations')) { var sh = db.insertSheet('Affectations'); sh.appendRow(SCHEMA_.Affectations); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
    ajouterModuleAffectation();
    ajouterApplicationsManquantes();
    props.setProperty('AFFECT_PRET', '1');
    ['TBL_Modules', 'TBL_DroitsRole', 'TBL_Applications', 'TBL_Affectations'].forEach(function (k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} });
  } catch (e) { /* on réessaiera à la requête suivante */ }
  finally { if (lock) { try { lock.releaseLock(); } catch (e2) {} } }
}

/**
 * Prépare le module « simulation » tout seul au premier passage (onglet Modifications, module, droits par défaut, carte) : plus besoin de lancer
 * mettreAJourStructure pour l'ouvrir. Idempotent ; la propriété SIMU_PRET évite de le refaire. Ne touche à aucun réglage existant.
 */
/**
 * Une seule fois : Simulation et Organigramme/Vis-à-vis deviennent accessibles à tous (niveau 1 du module « simulation »), chacun ne voyant que lui et ses vis-à-vis ;
 * les chefs de division / de service voient tout le monde. L'application « Organigramme » passe dans le module « simulation » (le module « rh » ouvrait aussi la formation, la permanence…).
 */
function preparerVisibilite_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SIMU_VIS_V1') === '1') return;
  try {
    var db = SpreadsheetApp.openById(prop_('DB_ID'));
    ajouterModuleSimulation();
    var sh = db.getSheetByName('Applications'), v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i += 1) {
      var url = String(v[i][4]).toLowerCase();
      if (url === 'simulation.html') sh.getRange(i + 1, 6).setValue(1);
      if (url === 'organigramme.html') { sh.getRange(i + 1, 1).setValue('simulation'); sh.getRange(i + 1, 6).setValue(1); }
    }
    props.setProperty('SIMU_VIS_V1', '1');
    ['TBL_Modules', 'TBL_DroitsRole', 'TBL_Applications'].forEach(function (k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} });
  } catch (e) { /* on réessaiera à la requête suivante */ }
}
function preparerSimulation_() {
  var props = PropertiesService.getScriptProperties();
  if (typeof preparerVisibilite_ === 'function' && props.getProperty('SIMU_PRET') === '1') preparerVisibilite_();
  if (typeof fusionnerVivier_ === 'function' && props.getProperty('SIMU_PRET') === '1') fusionnerVivier_();
  if (typeof retirerCartesEnquetes_ === 'function' && props.getProperty('SIMU_PRET') === '1') retirerCartesEnquetes_();
  if (typeof migrerPriseEnCharge_ === 'function' && props.getProperty('SIMU_PRET') === '1') migrerPriseEnCharge_();
  if (typeof retablirGenerateurTransport_ === 'function' && props.getProperty('SIMU_PRET') === '1') retablirGenerateurTransport_();
  if (typeof ajouterCarteStatsSt_ === 'function' && props.getProperty('SIMU_PRET') === '1') ajouterCarteStatsSt_();
  if (typeof renommerReservationVol_ === 'function' && props.getProperty('SIMU_PRET') === '1') renommerReservationVol_();
  if (typeof migrerAffectationVehicule_ === 'function' && props.getProperty('SIMU_PRET') === '1') migrerAffectationVehicule_();
  if (typeof consoAutoAssurerDeclencheur_ === 'function' && props.getProperty('SIMU_PRET') === '1') { try { consoAutoAssurerDeclencheur_(); } catch (e) { /* autorisation manquante : signalé à l'ouverture de Rapports */ } }
  if (typeof rattraperVehiculesCfce_ === 'function' && props.getProperty('SIMU_PRET') === '1') rattraperVehiculesCfce_();
  if (typeof retirerAnciennePec_ === 'function' && props.getProperty('SIMU_PRET') === '1' && props.getProperty('PEC_PORTAIL_V1') === '1') retirerAnciennePec_();
  if (props.getProperty('SIMU_PRET') === '1') return;
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  try {
    if (lock) lock.waitLock(20000);
    if (props.getProperty('SIMU_PRET') === '1') return;
    var db = SpreadsheetApp.openById(prop_('DB_ID'));
    if (!db.getSheetByName('Modifications')) { var sh = db.insertSheet('Modifications'); sh.appendRow(SCHEMA_.Modifications); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
    ajouterModuleSimulation();
    ajouterApplicationsManquantes();
    props.setProperty('SIMU_PRET', '1');
    ['TBL_Modules', 'TBL_DroitsRole', 'TBL_Applications', 'TBL_Modifications'].forEach(function (k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} });
  } catch (e) { /* on réessaiera à la requête suivante ; le reste du portail n'est pas affecté */ }
  finally { if (lock) { try { lock.releaseLock(); } catch (e2) {} } }
}

/**
 * Ajoute, une fois par version de structure (propriété STRUCT_V), les colonnes manquantes de chaque onglet existant (ex. « reliquat » dans Rotations).
 * Idempotent, ne touche à aucune donnée. Appelée au premier passage du portail : plus besoin de lancer mettreAJourStructure.
 */
var STRUCT_VERSION_ = '4';
function preparerStructure_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('STRUCT_V') === STRUCT_VERSION_) return;
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  try {
    if (lock) lock.waitLock(20000);
    if (props.getProperty('STRUCT_V') === STRUCT_VERSION_) return;
    var db = SpreadsheetApp.openById(prop_('DB_ID'));
    Object.keys(SCHEMA_).forEach(function (n) {
      var sh = db.getSheetByName(n); if (!sh) return;
      var entetes = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
      SCHEMA_[n].forEach(function (c) { if (entetes.indexOf(c) === -1) { sh.getRange(1, entetes.length + 1).setValue(c); entetes.push(c); } });
      try { CacheService.getScriptCache().remove('TBL_' + n); } catch (e) {}
    });
    props.setProperty('STRUCT_V', STRUCT_VERSION_);
  } catch (e) { /* on réessaiera à la requête suivante */ }
  finally { if (lock) { try { lock.releaseLock(); } catch (e2) {} } }
}

/** Remplit l'onglet « Roles » avec les rôles d'origine s'il est vide. */
function ajouterRolesParDefaut() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Roles');
  if (sh.getLastRow() > 1) return;
  var l = Droits.rolesParDefaut().map(function (r) { return [r.id, r.libelle, r.niveau_max, r.interdits.join(',')]; });
  sh.getRange(2, 1, l.length, 4).setValues(l);
}

// Chantiers proposés à la saisie des rapports (reprend les chantiers ACTIFS de Avancement_des_Chantiers.html) — modifiables dans l'onglet « Chantiers ».
var CHANTIERS_DEFAUT_ = [
  ['forage_rns', 'Forage RNS — 3 puits d\'eau', 'Travaux Entretien', 1],
  ['terrassement_rns', 'Terrassement RNS (36 mois)', 'Travaux Entretien', 1],
  ['maintenance_electrique', 'Maintenance des installations électriques', 'Électromécanique', 1],
  ['froid_climatisation', 'Maintenance des installations de froid et climatisation', 'Électromécanique', 1]
];
function ajouterChantiersParDefaut() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Chantiers');
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, CHANTIERS_DEFAUT_.length, 4).setValues(CHANTIERS_DEFAUT_);
}

var SCHEMA_ = {
  Utilisateurs: ['uid', 'email', 'matricule', 'nom', 'service', 'fonction', 'dependance', 'role', 'actif', 'telephone', 'civilite', 'sona', 'date_integration', 'wifi_user', 'nin', 'sap', 'email_contact', 'portee', 'section', 'chantiers_sup'],
  Modules: ['id', 'titre', 'icone', 'ordre', 'actif'],
  Applications: ['module', 'titre', 'description', 'emoji', 'url', 'niveau_min', 'roles', 'rubrique'],
  Roles: ['id', 'libelle', 'niveau_max', 'interdits'],
  DroitsRole: ['role', 'module', 'niveau'],
  Exceptions: ['email', 'module', 'niveau'],
  Rotations: ['email', 'statut', 'depuis', 'jours_travail', 'jours_repos', 'maj_par', 'maj_le', 'reliquat'],
  Chantiers: ['id', 'nom', 'service', 'actif', 'contrat', 'entreprise', 'source', 'fiche', 'suivi'],
  Rapports: ['id', 'date', 'chantier', 'auteur_email', 'auteur_nom', 'service', 'effectif', 'travaux', 'difficultes', 'commentaire', 'avancement', 'cree_le', 'modifie_le', 'visa_par', 'visa_note', 'visa_le', 'lignes', 'corrige_par', 'corrige_le'],
  Modifications: ['numero', 'cree_le', 'email', 'emetteur', 'motif', 'debut', 'periodes', 'reprise', 'partenaire', 'actuel', 'modifie', 'statut', 'decide_par', 'decide_le', 'commentaire', 'reliquat', 'reliquat_net'],
  Affectations: ['id', 'date', 'email', 'ancien', 'nouveau', 'par', 'motif', 'date_effet'],
  VisAVis: ['uid', 'vis_travail', 'vis_chambre', 'maj_par', 'maj_le'],
  Profils: ['email', 'nom_affiche', 'civilite', 'telephone', 'date_integration', 'wifi_user', 'photo_mini', 'photo', 'maj_le'],
  DemandesAcces: ['numero', 'email', 'titre', 'motif', 'statut', 'cree_le', 'traite_par', 'traite_le'],
  Journal: ['date', 'action', 'email', 'detail']
};

/** Colonnes de dates en TEXTE brut : Sheets ne doit pas les convertir en dates (décalage de fuseau). */
function formaterTextes_(db) {
  // Utilisateurs : la date d'intégration en TEXTE (sinon Sheets la convertit en date et décale le fuseau)
  var us = db.getSheetByName('Utilisateurs');
  if (us && us.getLastColumn() > 0) { var en = us.getRange(1, 1, 1, us.getLastColumn()).getValues()[0].map(String); ['date_integration', 'matricule', 'sap', 'nin', 'sona', 'wifi_user'].forEach(function (nomCol) { var ci = en.indexOf(nomCol); if (ci >= 0) us.getRange(2, ci + 1, Math.max(1, us.getMaxRows() - 1), 1).setNumberFormat('@'); }); }
  var sh = db.getSheetByName('Rotations'); if (sh) { sh.getRange('C:C').setNumberFormat('@'); sh.getRange('G:G').setNumberFormat('@'); }
  // Rapports et chantiers : tout en TEXTE brut (aucune formule possible, aucune date convertie).
  ['Rapports', 'Chantiers', 'Modifications', 'Affectations'].forEach(function (n) { var x = db.getSheetByName(n); if (x) x.getRange('A:Z').setNumberFormat('@'); });
}

/**
 * Mise à jour de structure après une nouvelle version du code : crée les onglets et colonnes manquants, sans toucher aux données.
 * À lancer une fois après un déploiement qui ajoute des onglets (ex. « Rotations »).
 */
function mettreAJourStructure() {
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  Object.keys(SCHEMA_).forEach(function (n) {
    var sh = db.getSheetByName(n);
    if (!sh) { sh = db.insertSheet(n); sh.appendRow(SCHEMA_[n]); sh.setFrozenRows(1); Logger.log('Onglet créé : ' + n); return; }
    var entetes = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    SCHEMA_[n].forEach(function (c) {
      if (entetes.indexOf(c) === -1) { sh.getRange(1, entetes.length + 1).setValue(c); entetes.push(c); Logger.log('Colonne ajoutée : ' + n + '.' + c); }
    });
  });
  formaterTextes_(db);
  ajouterApplicationsManquantes();
  ajouterRolesParDefaut();
  ajouterDroitsParDefaut();
  ajouterModuleSimulation();
  ajouterModuleAffectation();
  ajouterChantiersParDefaut();
  rangerCartes();
}

function installer() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DB_ID')) throw new Error('Déjà installé. Supprimer les propriétés pour recommencer.');
  var db = SpreadsheetApp.create('Gateway_DB');
  var sec = SpreadsheetApp.create('Gateway_Secrets');
  props.setProperties({ DB_ID: db.getId(), SECRETS_ID: sec.getId(), PEPPER: Utilities.getUuid() + Utilities.getUuid() });

  var premiere = true;
  Object.keys(SCHEMA_).forEach(function (n) {
    var sh = premiere ? db.getSheets()[0].setName(n) : db.insertSheet(n); premiere = false;
    sh.appendRow(SCHEMA_[n]); sh.setFrozenRows(1);
  });
  formaterTextes_(db);
  var s = sec.getSheets()[0].setName('Identifiants');
  s.appendRow(['email', 'sel', 'empreinte', 'sel_code', 'empreinte_code', 'code_expire', 'doit_changer']); s.setFrozenRows(1);

  var modules = [
    ['pilotage', 'Pilotage & Projets', '📊', 1], ['cpm', 'Cellule Passation Marché', '📑', 2],
    ['logistique', 'Logistique & Stocks', '🚛', 3], ['rh', 'RH & Personnel', '👥', 4],
    ['admin', 'Administration', '📁', 5], ['planning', 'Planning & Rotations', '🗓️', 6],
    ['rapports', 'Rapports journaliers', '📝', 7], ['badges', 'Badges prestataires', '🪪', 8],
    ['securite', 'Sécurité & Accès', '🔐', 9]
  ];
  modules.forEach(function (m) { db.getSheetByName('Modules').appendRow(m.concat([1])); });

  ajouterChantiersParDefaut_installation_(db);
  DROITS_DEFAUT_.forEach(function (r) { db.getSheetByName('DroitsRole').appendRow(r); });
  Droits.rolesParDefaut().forEach(function (r) { db.getSheetByName('Roles').appendRow([r.id, r.libelle, r.niveau_max, r.interdits.join(',')]); });
  amorcerApplications();
  Logger.log('Installé. DB: ' + db.getUrl() + '  SECRETS: ' + sec.getUrl());
}

/** À lancer après avoir collé les utilisateurs dans l'onglet Utilisateurs : attribue un identifiant opaque (uid) à chacun. */
function genererUids() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Utilisateurs');
  var v = sh.getDataRange().getValues(); var h = v[0]; var iU = h.indexOf('uid'), iE = h.indexOf('email');
  for (var i = 1; i < v.length; i += 1) if (v[i][iE] && !v[i][iU]) sh.getRange(i + 1, iU + 1).setValue(uidPour_(v[i][iE]));
}

function ajouterChantiersParDefaut_installation_(db) {
  var sh = db.getSheetByName('Chantiers');
  sh.getRange(2, 1, CHANTIERS_DEFAUT_.length, 4).setValues(CHANTIERS_DEFAUT_);
}


// ---------------------------------------------------------------------------------------------
// Planning : droits, carte du menu
// ---------------------------------------------------------------------------------------------
// 1 = voit SON planning · 2 = voit tout le monde (filtre par service) · 3 = + modifie la rotation de chacun.
var PLANNING_NIVEAUX_ = {
  agent: 1, conducteur: 1, dessinateur: 1, chef_atelier: 1, cadre_sup: 1, ordonnateur: 1, cpm: 1,
  chef_service: 2, interim_chef_service: 2,
  chef_division: 3, secretariat: 3
};

/**
 * Fixe les niveaux du module « planning » comme ci-dessus (les autres modules et les rôles personnalisés ne sont pas touchés)
 * et remplace la carte « Planning global » par « Planning & rotations » accessible à tous.
 * À lancer UNE fois ; réversible depuis la page Privilèges.
 */
function appliquerDroitsPlanning() {
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  var sh = db.getSheetByName('DroitsRole');
  var v = sh.getDataRange().getValues();
  var fait = {};
  for (var i = 1; i < v.length; i += 1) {
    var r = Droits.roleCanon(v[i][0]);
    if (String(v[i][1]).toLowerCase() === 'planning' && PLANNING_NIVEAUX_[r] !== undefined) {
      sh.getRange(i + 1, 3).setValue(PLANNING_NIVEAUX_[r]); fait[r] = true;
    }
  }
  Object.keys(PLANNING_NIVEAUX_).forEach(function (r) { if (!fait[r]) sh.appendRow([r, 'planning', PLANNING_NIVEAUX_[r]]); });

  var ap = db.getSheetByName('Applications'); var a = ap.getDataRange().getValues(); var h = a[0].map(String);
  var iT = h.indexOf('titre'), iD = h.indexOf('description'), iN = h.indexOf('niveau_min'), iM = h.indexOf('module'), iU = h.indexOf('url');
  var trouve = false;
  for (var j = 1; j < a.length; j += 1) {
    if (String(a[j][iM]) === 'planning' && (String(a[j][iU]) === 'planning.html')) {
      ap.getRange(j + 1, iT + 1).setValue('Planning & rotations');
      ap.getRange(j + 1, iD + 1).setValue('Votre planning et, selon vos droits, celui de la division : 1 mois, 3 mois, 6 mois, 1 an.');
      ap.getRange(j + 1, iN + 1).setValue(1); trouve = true;
    }
  }
  if (!trouve) ap.appendRow(['planning', 'Planning & rotations', 'Votre planning et, selon vos droits, celui de la division : 1 mois, 3 mois, 6 mois, 1 an.', '🗓️', 'planning.html', 1, '']);
  CacheService.getScriptCache().removeAll(['TBL_DroitsRole', 'TBL_Applications']);
  Logger.log('Droits du planning appliqués : ' + JSON.stringify(PLANNING_NIVEAUX_));
}

// ---------------------------------------------------------------------------------------------
// Mot de passe PROVISOIRE (saisie des rotations par le secrétariat)
// ---------------------------------------------------------------------------------------------
/**
 * Donne le mot de passe provisoire (CFG.MDP_DEFAUT, « 0000 ») aux comptes actifs qui n'ont PAS encore de mot de passe.
 * Il N'EXPIRE JAMAIS : il reste valable jusqu'à ce que la personne en choisisse un (bannière « Changez votre mot de passe » au portail).
 * Option : definirMotDePasseParDefaut(7) l'arrête automatiquement après 7 jours. Ne remplace jamais un mot de passe déjà choisi.
 *
 * Par prudence, les comptes à large visibilité (secrétariat, chef de division, chefs de service et intérims, et tout compte ayant
 * accès au module « securite ») en sont EXCLUS : le site est joignable par Internet et la liste du personnel s'affiche à la connexion.
 * Ils se connectent avec « Première connexion ou mot de passe oublié ? » (code par e-mail).
 * Pour les inclure quand même : definirMotDePasseParDefaut(0, true).
 */
function definirMotDePasseParDefaut(jours, inclurePrivilegies) {
  jours = Number(jours) > 0 ? Number(jours) : 0; // 0 / absent = sans expiration
  chargerRoles_();
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  var users = Store.table('Utilisateurs');
  var droits = Store.table('DroitsRole'), exc = Store.table('Exceptions');
  var LARGES = ['secretariat', 'chef_division', 'chef_service', 'interim_chef_service'];
  var sec = SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants');
  var v = sec.getDataRange().getValues();
  var index = {}; for (var i = 1; i < v.length; i += 1) index[String(v[i][0]).toLowerCase()] = i;
  var expire = jours > 0 ? Date.now() + jours * 86400000 : 2; // 2 = provisoire sans expiration
  var nb = 0, deja = 0, exclus = [];
  users.forEach(function (u) {
    var email = String(u.email || '').trim().toLowerCase();
    if (!email || String(u.actif) === '0') return;
    var role = Droits.roleCanon(u.role);
    var priv = LARGES.indexOf(role) !== -1 || (Droits.resolve(u, droits, exc).securite || 0) >= 1;
    if (priv && !inclurePrivilegies) { exclus.push(u.nom + ' (' + role + ')'); return; }
    var k = index[email];
    if (k !== undefined && v[k][1] && v[k][2] && !(Number(v[k][6]) >= 2)) { deja += 1; return; } // a déjà choisi son mot de passe
    var e = Auth.empreinteDe(CFG.MDP_DEFAUT);
    var ligne = [email, e.sel, e.empreinte, '', '', '', expire];
    if (k !== undefined) v[k] = ligne; else { index[email] = v.length; v.push(ligne); }
    nb += 1;
  });
  if (v.length) sec.getRange(1, 1, v.length, 7).setValues(v);
  Store.journal('mdp_defaut', 'script', nb + ' comptes, ' + (jours > 0 ? 'expire dans ' + jours + ' j' : 'sans expiration'));
  Logger.log('Mot de passe provisoire donné à ' + nb + ' compte(s), ' + (jours > 0 ? 'valable jusqu\'au ' + new Date(expire).toLocaleString('fr-FR') : 'SANS expiration (jusqu\'à ce que chacun le change)') +
    '. Ignorés (ont déjà un mot de passe) : ' + deja + '. Exclus (large visibilité) : ' + exclus.length + (exclus.length ? ' → ' + exclus.join(' ; ') : ''));
  return { donnes: nb, deja: deja, exclus: exclus };
}

/** Coupe-circuit : retire immédiatement le mot de passe provisoire de tous les comptes qui l'utilisent encore. */
function retirerMotsDePasseParDefaut() {
  var sec = SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants');
  var v = sec.getDataRange().getValues(); var n = 0;
  for (var i = 1; i < v.length; i += 1) if (Number(v[i][6]) > 1) { v[i] = [v[i][0], '', '', '', '', '', 0]; n += 1; }
  sec.getRange(1, 1, v.length, 7).setValues(v);
  Logger.log(n + ' mot(s) de passe provisoire(s) retiré(s).');
}

/**
 * Diagnostic d'un compte : pourquoi (ou non) peut-il se connecter avec le mot de passe provisoire ? Exemple : diagnostiquerCompte('prenom.nom@sonatrach.dz').
 * N'affiche aucun secret : uniquement des constats.
 */
function diagnostiquerCompte(email) {
  email = String(email || '').trim().toLowerCase();
  chargerRoles_();
  var u = Store.utilisateur(email);
  var l = [];
  if (!u) { Logger.log('Absent de l\'onglet Utilisateurs de Gateway_DB : lancer previsualiserSynchro puis synchroniserDepuisBDDORGA.'); return; }
  l.push('Utilisateurs : trouvé (' + u.nom + ')');
  l.push('uid : ' + (u.uid ? 'présent' : 'MANQUANT → lancer genererUids (sinon la personne n\'apparaît pas dans la liste de connexion)'));
  l.push('actif : ' + (String(u.actif) === '0' ? 'NON (compte désactivé)' : 'oui'));
  var role = Droits.roleCanon(u.role);
  l.push('rôle : ' + (u.role ? role + (Droits.ROLES.indexOf(role) === -1 ? ' (INCONNU : aucun accès)' : '') : 'AUCUN (connexion possible mais aucun module)'));
  var acces = Droits.resolve(u, Store.table('DroitsRole'), Store.table('Exceptions'));
  var large = ['secretariat', 'chef_division', 'chef_service', 'interim_chef_service'].indexOf(role) !== -1 || (acces.securite || 0) >= 1;
  var sec = SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants').getDataRange().getValues();
  var ligne = null; for (var i = 1; i < sec.length; i += 1) if (String(sec[i][0]).toLowerCase() === email) ligne = sec[i];
  if (!ligne || !ligne[2]) l.push('mot de passe : AUCUN' + (large ? ' — compte à large visibilité : exclu du mot de passe provisoire (utiliser « Première connexion ou mot de passe oublié ? »)' : ' → lancer definirMotDePasseParDefaut'));
  else if (Number(ligne[6]) === 2) l.push('mot de passe : PROVISOIRE, sans expiration (la personne doit le changer)');
  else if (Number(ligne[6]) > 2) l.push('mot de passe : PROVISOIRE, ' + (Number(ligne[6]) > Date.now() ? 'valable jusqu\'au ' + new Date(Number(ligne[6])).toLocaleString('fr-FR') : 'EXPIRÉ le ' + new Date(Number(ligne[6])).toLocaleString('fr-FR') + ' → relancer definirMotDePasseParDefaut'));
  else l.push('mot de passe : choisi par la personne (le provisoire ne s\'applique pas)');
  Logger.log(l.join('\n'));
}
if (typeof module !== 'undefined') module.exports = { lienActuel_: lienActuel_, carteBadgesAFaire_: carteBadgesAFaire_, carteManquante_: carteManquante_ };
