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
  ['agent', 'planning', 1], ['agent', 'rapports', 1],
  ['conducteur', 'planning', 1], ['conducteur', 'rapports', 2], ['conducteur', 'pilotage', 1], ['conducteur', 'logistique', 2],
  ['dessinateur', 'planning', 1], ['dessinateur', 'rapports', 1], ['dessinateur', 'pilotage', 1],
  ['chef_atelier', 'planning', 1], ['chef_atelier', 'rapports', 2], ['chef_atelier', 'pilotage', 1], ['chef_atelier', 'logistique', 2],
  ['chef_service', 'planning', 2], ['chef_service', 'rapports', 2], ['chef_service', 'pilotage', 2], ['chef_service', 'cpm', 1], ['chef_service', 'logistique', 2], ['chef_service', 'rh', 1], ['chef_service', 'admin', 1],
  ['interim_chef_service', 'planning', 2], ['interim_chef_service', 'rapports', 2], ['interim_chef_service', 'pilotage', 2], ['interim_chef_service', 'cpm', 1], ['interim_chef_service', 'logistique', 2], ['interim_chef_service', 'rh', 1], ['interim_chef_service', 'admin', 1],
  ['cadre_sup', 'planning', 2], ['cadre_sup', 'rapports', 2], ['cadre_sup', 'pilotage', 2], ['cadre_sup', 'cpm', 1], ['cadre_sup', 'logistique', 2], ['cadre_sup', 'rh', 1], ['cadre_sup', 'admin', 1],
  ['chef_division', 'planning', 2], ['chef_division', 'rapports', 3], ['chef_division', 'pilotage', 3], ['chef_division', 'cpm', 3], ['chef_division', 'logistique', 3], ['chef_division', 'rh', 3], ['chef_division', 'admin', 3], ['chef_division', 'badges', 2],
  ['ordonnateur', 'planning', 1], ['ordonnateur', 'rapports', 1], ['ordonnateur', 'pilotage', 2], ['ordonnateur', 'cpm', 1], ['ordonnateur', 'logistique', 1], ['ordonnateur', 'admin', 1],
  ['secretariat', 'admin', 3], ['secretariat', 'rh', 2], ['secretariat', 'badges', 3], ['secretariat', 'securite', 3], ['secretariat', 'planning', 2],
  ['cpm', 'cpm', 3], ['cpm', 'pilotage', 1]
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
  Utilisateurs: ['uid', 'email', 'matricule', 'nom', 'service', 'fonction', 'dependance', 'role', 'actif'],
  Modules: ['id', 'titre', 'icone', 'ordre', 'actif'],
  Applications: ['module', 'titre', 'description', 'emoji', 'url', 'niveau_min', 'roles'],
  Roles: ['id', 'libelle', 'niveau_max', 'interdits'],
  DroitsRole: ['role', 'module', 'niveau'],
  Exceptions: ['email', 'module', 'niveau'],
  Rotations: ['email', 'statut', 'depuis', 'jours_travail', 'jours_repos', 'maj_par', 'maj_le'],
  Chantiers: ['id', 'nom', 'service', 'actif'],
  Rapports: ['id', 'date', 'chantier', 'auteur_email', 'auteur_nom', 'service', 'effectif', 'travaux', 'difficultes', 'commentaire', 'avancement', 'cree_le', 'modifie_le', 'visa_par', 'visa_note', 'visa_le'],
  Journal: ['date', 'action', 'email', 'detail']
};

/** Colonnes de dates en TEXTE brut : Sheets ne doit pas les convertir en dates (décalage de fuseau). */
function formaterTextes_(db) {
  var sh = db.getSheetByName('Rotations'); if (sh) { sh.getRange('C:C').setNumberFormat('@'); sh.getRange('G:G').setNumberFormat('@'); }
  // Rapports et chantiers : tout en TEXTE brut (aucune formule possible, aucune date convertie).
  ['Rapports', 'Chantiers'].forEach(function (n) { var x = db.getSheetByName(n); if (x) x.getRange('A:Z').setNumberFormat('@'); });
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
  ajouterChantiersParDefaut();
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
  for (var i = 1; i < v.length; i += 1) {
    if (v[i][iE] && !v[i][iU]) {
      var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, prop_('PEPPER') + 'uid' + String(v[i][iE]).toLowerCase());
      sh.getRange(i + 1, iU + 1).setValue(Utilities.base64EncodeWebSafe(d).slice(0, 12));
    }
  }
}

function ajouterChantiersParDefaut_installation_(db) {
  var sh = db.getSheetByName('Chantiers');
  sh.getRange(2, 1, CHANTIERS_DEFAUT_.length, 4).setValues(CHANTIERS_DEFAUT_);
}
