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
  Utilisateurs: ['uid', 'email', 'matricule', 'nom', 'service', 'fonction', 'dependance', 'role', 'actif', 'telephone', 'civilite'],
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
 * Donne le mot de passe provisoire (CFG.MDP_DEFAUT, « 0000 ») aux comptes actifs qui n'ont PAS encore de mot de passe,
 * valable `jours` jours (7 par défaut) puis refusé automatiquement. Ne remplace jamais un mot de passe déjà choisi.
 *
 * Par prudence, les comptes à large visibilité (secrétariat, chef de division, chefs de service et intérims, et tout compte ayant
 * accès au module « securite ») en sont EXCLUS : le site est joignable par Internet et la liste du personnel s'affiche à la connexion.
 * Ils se connectent avec « Première connexion ou mot de passe oublié ? » (code par e-mail).
 * Pour les inclure quand même : definirMotDePasseParDefaut(7, true).
 */
function definirMotDePasseParDefaut(jours, inclurePrivilegies) {
  jours = Number(jours) > 0 ? Number(jours) : 7;
  chargerRoles_();
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  var users = Store.table('Utilisateurs');
  var droits = Store.table('DroitsRole'), exc = Store.table('Exceptions');
  var LARGES = ['secretariat', 'chef_division', 'chef_service', 'interim_chef_service'];
  var sec = SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants');
  var v = sec.getDataRange().getValues();
  var index = {}; for (var i = 1; i < v.length; i += 1) index[String(v[i][0]).toLowerCase()] = i;
  var expire = Date.now() + jours * 86400000;
  var nb = 0, deja = 0, exclus = [];
  users.forEach(function (u) {
    var email = String(u.email || '').trim().toLowerCase();
    if (!email || String(u.actif) === '0') return;
    var role = Droits.roleCanon(u.role);
    var priv = LARGES.indexOf(role) !== -1 || (Droits.resolve(u, droits, exc).securite || 0) >= 1;
    if (priv && !inclurePrivilegies) { exclus.push(u.nom + ' (' + role + ')'); return; }
    var k = index[email];
    if (k !== undefined && v[k][1] && v[k][2] && !(Number(v[k][6]) > 1)) { deja += 1; return; } // a déjà choisi son mot de passe
    var e = Auth.empreinteDe(CFG.MDP_DEFAUT);
    var ligne = [email, e.sel, e.empreinte, '', '', '', expire];
    if (k !== undefined) v[k] = ligne; else { index[email] = v.length; v.push(ligne); }
    nb += 1;
  });
  sec.getRange(1, 1, v.length, 7).setValues(v);
  Store.journal('mdp_defaut', 'script', nb + ' comptes, expire ' + new Date(expire).toISOString());
  Logger.log('Mot de passe provisoire donné à ' + nb + ' compte(s), valable jusqu\'au ' + new Date(expire).toLocaleString('fr-FR') +
    '. Ignorés (ont déjà un mot de passe) : ' + deja + '. Exclus (large visibilité) : ' + exclus.length + (exclus.length ? ' → ' + exclus.join(' ; ') : ''));
}

/** Coupe-circuit : retire immédiatement le mot de passe provisoire de tous les comptes qui l'utilisent encore. */
function retirerMotsDePasseParDefaut() {
  var sec = SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants');
  var v = sec.getDataRange().getValues(); var n = 0;
  for (var i = 1; i < v.length; i += 1) if (Number(v[i][6]) > 1) { v[i] = [v[i][0], '', '', '', '', '', 0]; n += 1; }
  sec.getRange(1, 1, v.length, 7).setValues(v);
  Logger.log(n + ' mot(s) de passe provisoire(s) retiré(s).');
}
