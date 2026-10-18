/**
 * API JSON de la passerelle. Le site (GitHub Pages) appelle  POST <url /exec>  avec un corps texte/JSON
 * (Content-Type: text/plain, pour éviter la pré-requête CORS) :  { action, token?, ...paramètres }
 * Réponse : { ok: true, ... } ou { ok: false, erreur, code }.
 *
 * Planning (module « planning ») : situation, rotation_enregistrer (soi-même : niveau 1 ; autrui : niveau 3), planning (niveau 2 : tout le monde).
 * Organigramme dynamique (module « rh », voir Organigramme.gs) : organigramme.
 * Affectation du personnel (module « affectation », voir Affectations.gs) : aff_personnes, aff_changer, aff_historique.
 * Simulation de planning (module « simulation », voir Modifications.gs) : simu_agents, simu_donnees, simu_valider, simu_liste, simu_demande, simu_decider.
 * Rapports journaliers (module « rapports ») : rapports_chantiers, rapport_enregistrer, rapports_liste, rapport_viser, rapports_synthese (niveau 3).
 * Administration (niveau 3 sur le module « securite ») : admin_etat, admin_role, admin_actif, admin_droit, admin_exception, emettreCode.
 * Actions : liste (recherche : { q } — 3 lettres minimum, 8 résultats au plus), demanderCode, login, activer, reprendre (rester connecté), me, menu, logout, admin_app, emettreCode (admin).
 * `ident` = identifiant opaque (uid) choisi dans le sélecteur ; l'e-mail est aussi accepté.
 * Les données métier ne sortent QUE par cette passerelle, jamais par un lien public.
 */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    out = { ok: true };
    var r = route_(req);
    for (var k in r) out[k] = r[k];
  } catch (err) {
    out = { ok: false, erreur: err.message, code: err.code || 'ERR' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'DashBoard-Infra gateway' })).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  chargerRoles_();
  // Mode support : pas de changement de mot de passe, d'e-mail de contact ni d'administration au nom du compte emprunté
  if (req.token && /^(admin_|changer_mdp$|email_contact_)/.test(String(req.action)) && Auth.estUsurpation(req.token)) throw new Error('Action interdite en mode support : revenez à votre compte.');
  switch (req.action) {
    case 'liste':        return Auth.liste(req.q);
    case 'demanderCode': return Auth.demanderCode(req.ident);
    case 'login':   return Auth.login(req.ident, req.mdp, req.remember);
    case 'activer': return Auth.activer(req.ident, req.code, req.mdp, req.remember);
    case 'reprendre': return Auth.reprendre(req.rt);
    case 'logout':  Auth.logout(req.token, req.rt); return {};
    case 'changer_mdp': return Auth.changerMdp(req.token, req.ancien, req.nouveau);
    case 'me':      { var um = Auth.userFromToken(req.token); return { user: pubUser_(um), acces: acces_(um) }; }
    case 'menu': {
      var u = Auth.userFromToken(req.token);
      if (typeof preparerStructure_ === 'function') preparerStructure_();
      if (typeof preparerSimulation_ === 'function') preparerSimulation_();
      if (typeof preparerAffectation_ === 'function') preparerAffectation_();
      if (typeof preparerPages_ === 'function') preparerPages_();
      if (typeof preparerAnnuaire_ === 'function') preparerAnnuaire_();
      if (typeof preparerLiens_ === 'function') preparerLiens_();
      if (typeof preparerLiensRapport_ === 'function') preparerLiensRapport_();
      if (typeof preparerCarteBadges_ === 'function') preparerCarteBadges_();
      return { user: pubUser_(u), mdp_par_defaut: Auth.estParDefaut(u.email), menu: Droits.menu(acces_(u), Store.table('Modules'), Store.table('Applications'), u.role) };
    }
    case 'emettreCode': {
      var admin = Auth.userFromToken(req.token);
      if ((acces_(admin).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
      Store.journal('code_active', admin.email, req.email);
      return { code: Auth.emettreCode(req.email) };
    }
    case 'profil_enregistrer': return profilEnregistrer_(req);
    case 'situation': return situationDe_(Auth.userFromToken(req.token));
    case 'rotation_enregistrer': return rotationEnregistrer_(req);
    case 'reliquat_enregistrer': return reliquatEnregistrer_(req);
    case 'planning': return planning_(req);
    case 'organigramme': return organigramme_(req);
    case 'aff_personnes': return affPersonnes_(req);
    case 'aff_changer': return affChanger_(req);
    case 'aff_historique': return affHistorique_(req);
    case 'simu_agents': return simuAgents_(req);
    case 'simu_donnees': return simuDonnees_(req);
    case 'simu_valider': return simuValider_(req);
    case 'simu_liste': return simuListe_(req);
    case 'simu_demande': return simuDemande_(req);
    case 'simu_decider': return simuDecider_(req);
    case 'donnees': return donneesCsv_(req);
    case 'badges_donnees': return badgesDonnees_(req);
    case 'badges_enquetes_verifier': return badgesEnquetesVerifier_(req);
    case 'badges_enquetes_saisir': return badgesEnquetesSaisir_(req);
    case 'badges_fiche': return badgesFiche_(req);
    case 'badges_enquetes_export': return badgesEnquetesExport_(req);
    case 'badges_fiche_maj': return badgesFicheMaj_(req);
    case 'badges_photo_archiver': return badgesPhotoArchiver_(req);
    case 'badges_personnes_sauver': return badgesPersonnesSauver_(req);
    case 'badges_entreprises_sauver': return badgesEntreprisesSauver_(req);
    case 'badges_numeroter': return badgesNumeroter_(req);
    case 'contacts_divergences': return contactsDivergences_(req);
    case 'contacts_confirmer': return contactsConfirmer_(req);
    case 'contacts_completer': return contactsCompleter_(req);
    case 'admin_connexions': return connexionsListe_(req);
    case 'admin_diagnostic': return connexionsDiagnostic_(req);
    case 'admin_mdp': return connexionsMdp_(req);
    case 'admin_mdp_defaut': return connexionsMdpDefautTous_(req);
    case 'admin_emails': return emailsControle_(req);
    case 'admin_email_contact': return emailContactAdmin_(req);
    case 'email_contact_demander': { var ue = Auth.userFromToken(req.token); if (typeof preparerStructure_ === 'function') preparerStructure_(); return Auth.demanderEmailContact(ue, req.adresse); }
    case 'email_contact_confirmer': { var uc = Auth.userFromToken(req.token); if (typeof preparerStructure_ === 'function') preparerStructure_(); return Auth.confirmerEmailContact(uc, req.code); }
    case 'admin_test_mail': return connexionsTestMail_(req);
    case 'annuaire_personnes': return annuairePersonnes_(req);
    case 'cpm_journal': return cpmJournalListe_(req);
    case 'cpm_instantane': return cpmInstantaneMaintenant_(req);
    case 'donnees_multi': return donneesMulti_(req);
    case 'rapport_diapos': return rapportDiaposInjecter_(req);
    case 'rapports_chantiers': return rapportsChantiers_(req);
    case 'rapport_enregistrer': return rapportEnregistrer_(req);
    case 'rapports_liste': return rapportsListe_(req);
    case 'rapport_viser': return rapportViser_(req);
    case 'rapports_synthese': return rapportsSynthese_(req);
    case 'admin_etat': {
      admin_(req);
      var us = Store.table('Utilisateurs'); var nb = {};
      us.forEach(function (u) { var c = Droits.roleCanon(u.role); nb[c] = (nb[c] || 0) + 1; });
      return {
        roles: ROLES_INFO_.map(function (r) { return { id: r.id, libelle: r.libelle, niveau_max: r.niveau_max, interdits: r.interdits, nb_utilisateurs: nb[r.id] || 0 }; }),
        modules: Store.table('Modules'), droitsRole: Store.table('DroitsRole'), exceptions: Store.table('Exceptions'),
        applications: Store.table('Applications').map(function (x) { return { module: x.module, titre: x.titre, niveau_min: Number(x.niveau_min) || 1, roles: Droits.rolesDe(x.roles) }; }),
        utilisateurs: us.map(function (u) { return { email: u.email, nom: Annuaire.nomAffichable(u.nom, u.email), service: u.service, fonction: u.fonction, dependance: u.dependance || '', role: Droits.roleCanon(u.role), actif: String(u.actif) !== '0' }; })
      };
    }
    case 'admin_inviter': {
      // Invitation par e-mail : lien, première connexion et applications accordées. { emails: [...] } ou { email }
      var ai = admin_(req), cibles = Array.isArray(req.emails) ? req.emails : (req.email ? [req.email] : []);
      var lienSite = PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://rayanem-dev.github.io/DashBoard-Infra-v2/';
      lienSite = lienSite.replace(/\/?$/, '/') + 'connexion.html';
      var envoyes = [], echecs = [], quota = typeof MailApp !== 'undefined' && MailApp.getRemainingDailyQuota ? MailApp.getRemainingDailyQuota() : 100;
      cibles.slice(0, 60).forEach(function (em) {
        try {
          var ui = Store.utilisateur(em); if (!ui || String(ui.actif) === '0') { echecs.push(em + ' : compte inactif ou inconnu'); return; }
          var dest = Auth.adresseEnvoi(ui); if (!dest) { echecs.push(em + ' : pas d\'adresse e-mail valide'); return; }
          if (envoyes.length >= quota) { echecs.push(em + ' : quota d\'envoi du jour atteint'); return; }
          Mail.envoyerInvitation(dest, Annuaire.nomAffichable(ui.nom, ui.email), Droits.menu(acces_(ui), Store.table('Modules'), Store.table('Applications'), ui.role), lienSite, Auth.estParDefaut(ui.email));
          Store.journal('invitation', ai.email, ui.email); envoyes.push(ui.email);
        } catch (e) { echecs.push(em + ' : ' + e.message); }
      });
      return { envoyes: envoyes, echecs: echecs };
    }
    case 'admin_usurper': {
      var au = admin_(req); cible_(req.email);
      // SUPER_ADMINS (propriété du script, e-mails séparés par des virgules) : si elle est renseignée, seuls ces comptes peuvent ouvrir une session de support
      var sa = String(PropertiesService.getScriptProperties().getProperty('SUPER_ADMINS') || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
      if (sa.length && sa.indexOf(String(au.email).toLowerCase()) === -1) throw Object.assign(new Error('Réservé aux super-administrateurs'), { code: 'DROITS' });
      return Auth.usurper(au, req.email);
    }
    case 'admin_role_enregistrer': return roleEnregistrer_(req);
    case 'admin_role_supprimer': return roleSupprimer_(req);
    case 'admin_role': {
      var a1 = admin_(req); var e1 = Droits.verifier(req.role); if (e1) throw new Error(e1);
      cible_(req.email);
      if (String(req.email).toLowerCase() === String(a1.email).toLowerCase()) throw new Error('Vous ne pouvez pas modifier votre propre rôle');
      Store.maj('Utilisateurs', { email: req.email }, { role: Droits.roleCanon(req.role) });
      Store.journal('role', a1.email, req.email + ' -> ' + req.role); return {};
    }
    case 'admin_actif': {
      var a2 = admin_(req); cible_(req.email);
      if (String(req.email).toLowerCase() === String(a2.email).toLowerCase()) throw new Error('Vous ne pouvez pas désactiver votre propre compte');
      Store.maj('Utilisateurs', { email: req.email }, { actif: req.actif ? 1 : 0 });
      Store.journal(req.actif ? 'activation' : 'desactivation', a2.email, req.email); return {};
    }
    case 'admin_droit': {
      var a3 = admin_(req); module_(req.module); var e3 = Droits.verifier(req.role, Number(req.niveau), req.module); if (e3) throw new Error(e3);
      if (String(req.role) === 'secretariat' && String(req.module) === 'securite' && Number(req.niveau) < 3) throw new Error('Le secrétariat doit garder l\'administration de la sécurité');
      var rc3 = Droits.roleCanon(req.role);
      if (Number(req.niveau) === 0) Store.supprimer('DroitsRole', { role: rc3, module: req.module });
      else Store.maj('DroitsRole', { role: rc3, module: req.module }, { niveau: Number(req.niveau) });
      Store.journal('droit_role', a3.email, req.role + '/' + req.module + '=' + req.niveau); return {};
    }
    case 'admin_exception': {
      var a4 = admin_(req); cible_(req.email); module_(req.module);
      if (req.niveau === null || req.niveau === undefined || req.niveau === '') Store.supprimer('Exceptions', { email: req.email, module: req.module });
      else { var rc4 = Droits.roleCanon(Store.utilisateur(req.email).role); var e4 = Droits.verifier(Droits.ROLES.indexOf(rc4) === -1 ? undefined : rc4, Number(req.niveau), req.module); if (e4) throw new Error(e4); Store.maj('Exceptions', { email: req.email, module: req.module }, { niveau: Number(req.niveau) }); }
      Store.journal('exception', a4.email, req.email + '/' + req.module + '=' + req.niveau); return {};
    }
    case 'admin_app': {
      var a5 = admin_(req);
      var ap = Store.table('Applications').filter(function (x) { return String(x.titre) === String(req.titre); })[0];
      if (!ap) throw new Error('Application inconnue');
      var nm = Number(req.niveau_min); if (!(nm === 1 || nm === 2 || nm === 3)) throw new Error('Niveau minimal invalide (1 à 3)');
      var liste = (req.roles || []).map(Droits.roleCanon);
      liste.forEach(function (r) { if (Droits.ROLES.indexOf(r) === -1) throw new Error('Rôle inconnu : ' + r); });
      Store.maj('Applications', { titre: req.titre }, { niveau_min: nm, roles: liste.join(',') });
      Store.journal('application', a5.email, req.titre + ' niveau>=' + nm + ' roles=' + (liste.join(',') || 'tous')); return {};
    }
    default: throw new Error('Action inconnue');
  }
}

function acces_(user) { return Droits.resolve(user, Store.table('DroitsRole'), Store.table('Exceptions')); }

function admin_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function cible_(email) { if (!Store.utilisateur(email)) throw new Error('Utilisateur inconnu'); }
function module_(id) {
  if (!Store.table('Modules').some(function (m) { return String(m.id).toLowerCase() === String(id).toLowerCase(); })) throw new Error('Module inconnu');
}

// ---------- Planning (rotations) ----------
function jour_(v) {
  var s = String(v == null ? '' : v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(v); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function rotationDe_(email) {
  var l = Store.table('Rotations'); email = String(email).toLowerCase();
  for (var i = 0; i < l.length; i += 1) if (String(l[i].email).toLowerCase() === email) {
    var rq = l[i].reliquat;
    return { statut: String(l[i].statut), depuis: jour_(l[i].depuis), jours_travail: Number(l[i].jours_travail), jours_repos: Number(l[i].jours_repos), reliquat: (rq === '' || rq == null || isNaN(Number(rq))) ? null : Number(rq) };
  }
  return null;
}
function situationDe_(u) {
  if ((acces_(u).planning || 0) < 1) return { acces: false };
  var rot = rotationDe_(u.email);
  if (!rot) return { acces: true, configuree: false, nom: u.nom };
  return { acces: true, configuree: true, nom: u.nom, rotation: rot, reliquat: rot.reliquat, reliquat_renseigne: rot.reliquat !== null, situation: Planning.situation(rot, correctionsDe_(u.email), Dates.today()) };
}
function rotationEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); var niv = acces_(u).planning || 0;
  var email = String(req.email || u.email).toLowerCase();
  if (email !== String(u.email).toLowerCase()) { if (niv < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); cible_(email); }
  else if (niv < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var rot = { statut: String(req.statut), depuis: String(req.depuis), jours_travail: Number(req.jours_travail), jours_repos: Number(req.jours_repos) };
  var err = Planning.valider(rot, Dates.today()); if (err) throw new Error(err);
  var champsRot = { statut: rot.statut, depuis: rot.depuis, jours_travail: rot.jours_travail, jours_repos: rot.jours_repos, maj_par: u.email, maj_le: new Date().toISOString() };
  if (req.reliquat !== undefined && req.reliquat !== null && req.reliquat !== '') champsRot.reliquat = reliquatValide_(req.reliquat); // sinon le reliquat déjà saisi est conservé
  Store.maj('Rotations', { email: email }, champsRot);
  Store.journal('rotation', u.email, email + ' ' + rot.statut + ' depuis ' + rot.depuis + ' (' + rot.jours_travail + '/' + rot.jours_repos + ')');
  return situationDe_(Store.utilisateur(email));
}
/** Reliquat initial : entier de jours (+ : jours de congé dus, − : jours pris en avance). */
function reliquatValide_(x) {
  var n = Number(x);
  if (x === '' || x === null || x === undefined || !isFinite(n) || Math.floor(n) !== n || Math.abs(n) > 365) throw new Error('Reliquat : un nombre entier de jours entre −365 et 365 (0 si vous n\'en avez pas)');
  return n;
}
function reliquatEnregistrer_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).planning || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  if (!rotationDe_(u.email)) throw new Error('Renseignez d\'abord votre rotation');
  var v = reliquatValide_(req.reliquat);
  Store.maj('Rotations', { email: u.email }, { reliquat: v, maj_par: u.email, maj_le: new Date().toISOString() });
  Store.journal('reliquat', u.email, 'reliquat initial : ' + v);
  return situationDe_(u);
}
function planning_(req) {
  var u = Auth.userFromToken(req.token); var niv = acces_(u).planning || 0;
  if (niv < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var auj = Dates.today();
  var debut = Dates.isDate(req.debut) ? req.debut : Dates.addDays(auj, -7);
  var n = Math.max(7, Math.min(370, Number(req.jours) || 35));
  var tous = niv >= 2; // 1 = son propre planning seulement ; 2 = tout le monde ; 3 = tout le monde + modification
  var moi = String(u.email).toLowerCase();
  var mods = correctionsParEmail_(); // demandes de modification approuvées
  var lignes = Store.table('Utilisateurs').filter(function (x) {
    return String(x.actif) !== '0' && x.email && (tous || String(x.email).toLowerCase() === moi);
  }).map(function (x) {
    var l = { nom: Annuaire.nomAffichable(x.nom, x.email), service: x.service, fonction: x.fonction, dependance: x.dependance || '', configuree: false, moi: String(x.email).toLowerCase() === moi };
    if (niv >= 3) l.email = x.email;
    var rot = rotationDe_(x.email);
    if (!rot) return l;
    var corr = mods[String(x.email).toLowerCase()] || [];
    var s = Planning.situation(rot, corr, auj);
    l.configuree = true; l.rotation = { jours_travail: rot.jours_travail, jours_repos: rot.jours_repos, statut: rot.statut, depuis: rot.depuis, reliquat: rot.reliquat };
    l.situation = s; l.grille = Planning.grille(rot, corr, debut, n);
    return l;
  });
  return { aujourdhui: auj, debut: debut, jours: n, peutVoirTous: tous, peutModifier: niv >= 3, lignes: lignes };
}

// ---------- Rôles modifiables (onglet « Roles ») ----------
var ROLES_INFO_ = [];

/** Charge les rôles de l'onglet « Roles » ; à défaut (onglet absent ou vide), les rôles d'origine. Le secrétariat est toujours présent (anti-verrouillage). */
function chargerRoles_() {
  var l = [];
  try { l = Store.table('Roles'); } catch (e) { l = []; }
  var defs = l.map(function (r) {
    return { id: Droits.roleCanon(r.id), libelle: String(r.libelle || r.id), niveau_max: Number(r.niveau_max) || 0,
             interdits: String(r.interdits || '').split(/[,;]/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean) };
  }).filter(function (r) { return r.id; });
  if (defs.length && !defs.some(function (r) { return r.id === 'secretariat'; })) defs.push({ id: 'secretariat', libelle: 'Secrétariat', niveau_max: 0, interdits: [] });
  Droits.configurer(defs);
  ROLES_INFO_ = defs.length ? defs : Droits.rolesParDefaut();
}
function libelleRole_(role) {
  var c = Droits.roleCanon(role);
  for (var i = 0; i < ROLES_INFO_.length; i += 1) if (ROLES_INFO_[i].id === c) return ROLES_INFO_[i].libelle;
  return role || '';
}
function pubUser_(u) { var p = Auth.publique(u); p.role_libelle = libelleRole_(u.role); return p; }

/** Si l'onglet « Roles » est vide, y recopie d'abord les rôles d'origine (sinon le premier rôle créé ferait disparaître les autres). */
function semerRoles_() {
  var l = []; try { l = Store.table('Roles'); } catch (e) { throw new Error('Onglet « Roles » absent : exécutez mettreAJourStructure dans l\'éditeur Apps Script'); }
  if (l.length) return;
  Droits.rolesParDefaut().forEach(function (r) { Store.maj('Roles', { id: r.id }, { libelle: r.libelle, niveau_max: r.niveau_max, interdits: r.interdits.join(',') }); });
}
function roleEnregistrer_(req) {
  var a = admin_(req); semerRoles_(); chargerRoles_();
  var def = { id: req.id, libelle: req.libelle, niveau_max: Number(req.niveau_max) || 0, interdits: req.interdits || [] };
  var mods = Store.table('Modules').map(function (x) { return String(x.id).toLowerCase(); });
  var err = Droits.validerRole(def, Droits.ROLES, mods, !!req.creation); if (err) throw new Error(err);
  var id = Droits.roleCanon(def.id || def.libelle);
  if (!req.creation && Droits.ROLES.indexOf(id) === -1) throw new Error('Rôle inconnu');
  if (id === 'secretariat' && (def.niveau_max || def.interdits.length)) throw new Error('Le rôle secrétariat ne peut pas être restreint');
  Store.maj('Roles', { id: id }, { libelle: String(def.libelle).trim(), niveau_max: def.niveau_max, interdits: def.interdits.map(function (x) { return String(x).toLowerCase(); }).join(',') });
  Store.journal(req.creation ? 'role_cree' : 'role_modifie', a.email, id);
  return { id: id };
}
function roleSupprimer_(req) {
  var a = admin_(req); semerRoles_(); chargerRoles_();
  var id = Droits.roleCanon(req.id);
  if (id === 'secretariat') throw new Error('Le rôle secrétariat ne peut pas être supprimé');
  if (Droits.ROLES.indexOf(id) === -1) throw new Error('Rôle inconnu');
  var nb = Store.table('Utilisateurs').filter(function (u) { return Droits.roleCanon(u.role) === id; }).length;
  if (nb) throw new Error('Impossible : ' + nb + ' utilisateur' + (nb > 1 ? 's ont' : ' a') + ' ce rôle. Changez d\'abord leur rôle.');
  // Droits et limitations d'applications qui le mentionnent
  var vus = {};
  Store.table('DroitsRole').forEach(function (d) { if (Droits.roleCanon(d.role) === id) vus[String(d.role)] = true; });
  Object.keys(vus).forEach(function (r) { Store.supprimerTout('DroitsRole', { role: r }); });
  Store.table('Applications').forEach(function (x) {
    var l = Droits.rolesDe(x.roles);
    if (l.indexOf(id) !== -1) Store.maj('Applications', { titre: x.titre }, { roles: l.filter(function (r) { return r !== id; }).join(',') });
  });
  Store.supprimer('Roles', { id: id });
  Store.journal('role_supprime', a.email, id);
  return {};
}

// ---------- Rapports journaliers ----------
function niveauRapports_(u, min) {
  var n = acces_(u).rapports || 0;
  if (n < (min || 1)) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return n;
}
function chantiersActifs_() {
  return Store.table('Chantiers').filter(function (c) { return String(c.actif) !== '0' && c.id; })
    .map(function (c) { return { id: String(c.id).toLowerCase(), nom: c.nom, service: c.service, actif: 1 }; });
}
function rapportsLus_() {
  return Store.table('Rapports').map(function (r) {
    return { id: String(r.id), date: jour_(r.date), chantier: String(r.chantier).toLowerCase(), auteur_email: String(r.auteur_email), auteur_nom: r.auteur_nom, service: r.service,
      effectif: Number(r.effectif) || 0, travaux: String(r.travaux || ''), difficultes: String(r.difficultes || ''), commentaire: String(r.commentaire || ''),
      avancement: r.avancement === '' || r.avancement == null ? '' : Number(r.avancement),
      visa_par: String(r.visa_par || ''), visa_note: String(r.visa_note || ''), visa_le: String(r.visa_le || '') };
  });
}
function rapportsChantiers_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 1);
  return { chantiers: chantiersActifs_() };
}
function rapportEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); var niv = niveauRapports_(u, 2);
  var ids = chantiersActifs_().map(function (c) { return c.id; });
  var v = Rapports.valider(req, Dates.today(), niv, ids); if (v.erreur) throw new Error(v.erreur);
  var r = v.rapport; var id = Rapports.cle(r.date, r.chantier, u.email);
  var maintenant = new Date().toISOString();
  var existe = Store.table('Rapports').some(function (x) { return String(x.id) === id; });
  var valeurs = { date: r.date, chantier: r.chantier, auteur_email: u.email, auteur_nom: Annuaire.nomAffichable(u.nom, u.email), service: u.service || '', effectif: r.effectif, travaux: r.travaux,
                  difficultes: r.difficultes, commentaire: r.commentaire, avancement: r.avancement, modifie_le: maintenant };
  if (!existe) valeurs.cree_le = maintenant;
  Store.maj('Rapports', { id: id }, valeurs);
  Store.journal(existe ? 'rapport_modifie' : 'rapport_cree', u.email, id);
  return { id: id, modifie: existe };
}
function rapportsListe_(req) {
  var u = Auth.userFromToken(req.token); var niv = niveauRapports_(u, 1);
  var auj = Dates.today();
  var du = Dates.isDate(req.du) ? req.du : Dates.addDays(auj, -6);
  var au = Dates.isDate(req.au) ? req.au : auj;
  var liste = Rapports.filtrer(rapportsLus_(), u, niv, { du: du, au: au, chantier: req.chantier || '', auteur: niv >= 2 ? (req.auteur || '') : '' });
  var out = liste.slice(0, 300).map(function (r) { r.peut_viser = Rapports.peutViser(u, niv, r); r.le_mien = String(r.auteur_email).toLowerCase() === String(u.email).toLowerCase(); return r; });
  return { du: du, au: au, niveau: niv, rapports: out, tronque: liste.length > 300 };
}
function rapportViser_(req) {
  var u = Auth.userFromToken(req.token); var niv = niveauRapports_(u, 2);
  var r = rapportsLus_().filter(function (x) { return x.id === String(req.id); })[0];
  if (!r) throw new Error('Rapport introuvable');
  if (!Rapports.peutViser(u, niv, r)) throw Object.assign(new Error('Vous ne pouvez pas viser ce rapport'), { code: 'DROITS' });
  Store.maj('Rapports', { id: r.id }, { visa_par: Annuaire.nomAffichable(u.nom, u.email), visa_note: Rapports.nettoyer(req.note, 500), visa_le: new Date().toISOString() });
  Store.journal('rapport_vise', u.email, r.id);
  return {};
}
function rapportsSynthese_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var auj = Dates.today(); var date = Dates.isDate(req.date) ? req.date : auj;
  return Rapports.synthese(chantiersActifs_(), rapportsLus_(), date);
}

/**
 * L'agent complète lui-même sa fiche (matricule, matricule SAP, NIN). Une valeur DÉJÀ renseignée n'est jamais écrasée :
 * pour la corriger, il passe par le secrétariat. Le NIN n'est jamais renvoyé en entier ni écrit dans le journal.
 */
function profilEnregistrer_(req) {
  var u = Auth.userFromToken(req.token);
  var regles = { matricule: /^[A-Za-z0-9\-]{3,15}$/, sap: /^[A-Za-z0-9\-]{3,15}$/, nin: /^\d{18}$/ };
  var noms = { matricule: 'Matricule', sap: 'Matricule SAP', nin: 'NIN (18 chiffres)' };
  var champs = {}, faits = [];
  Object.keys(regles).forEach(function (k) {
    var v = String(req[k] == null ? '' : req[k]).replace(/\s+/g, '');
    if (!v) return;
    if (String(u[k] || '').trim()) return; // déjà renseigné : on ne touche pas
    if (!regles[k].test(v)) throw new Error(noms[k] + ' : format invalide.');
    champs[k] = v; faits.push(k);
  });
  if (!faits.length) throw new Error('Rien à enregistrer : ces champs sont déjà renseignés (pour les corriger, contactez le secrétariat).');
  Store.maj('Utilisateurs', { email: u.email }, champs);
  Store.journal('profil', u.email, 'champs renseignés : ' + faits.join(', '));
  var versOrga = {}; faits.forEach(function (k) { versOrga[k] = champs[k]; });
  try { var n = ecrireDansBddorga_(u.email, versOrga); Store.journal('profil_bddorga', u.email, n + ' cellule(s) écrite(s) dans BDDORGA'); }
  catch (err) { Store.journal('profil_bddorga_echec', u.email, String(err.message || err)); } // l'agent n'est pas bloqué : la valeur est déjà dans la passerelle
  return { user: pubUser_(Store.utilisateur(u.email)) };
}
