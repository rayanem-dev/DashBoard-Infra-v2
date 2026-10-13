/* Client de la passerelle + mode démo (données fictives, aucune requête réseau). */
(function () {
  var DEMO = !window.GATEWAY_URL || /[?&]demo\b/.test(location.search);
  var CLE = 'infra_v2_token';
  var demoState = { token: null, user: null };
  var DEMO_USERS = [
    { uid: 'u1', nom: 'BENALI Karim', service: 'Division Infrastructures', role: 'chef_division', email: 'k.benali@exemple.dz' },
    { uid: 'u2', nom: 'MEZIANE Sofia', service: 'Service Construction', role: 'conducteur', email: 's.meziane@exemple.dz', dependance: 'ACOSCO' },
    { uid: 'u3', nom: 'TAHRI Yacine', service: 'Cellule Passation de marché', role: 'cpm', email: 'y.tahri@exemple.dz' },
    { uid: 'u4', nom: 'KHELIFI Amine', service: 'Service Construction', role: 'conducteur', email: 'a.khelifi@exemple.dz', fonction: 'Conducteur des travaux', dependance: 'GTP' },
    { uid: 'u5', nom: 'OUALI Nadia', service: 'Travaux Entretien', role: 'agent', email: 'n.ouali@exemple.dz', fonction: 'Technicienne', dependance: 'ACOSCO' },
    { uid: 'u6', nom: 'BRAHIMI Samir', service: 'Travaux Entretien', role: 'agent', email: 's.brahimi@exemple.dz', fonction: 'Technicien' }
  ];
  // En démonstration, tout le monde a au moins le niveau 1 du module « planning » (comme les droits par défaut de la vraie passerelle).
  function menuDemo(role) {
    var m = (DEMO_MENU[role] || []).slice();
    if (!m.some(function (x) { return x.id === 'planning'; })) m.push({ id: 'planning', titre: 'Planning & Rotations', icone: '🗓️', niveau: 1, apps: [{ titre: 'Planning & rotations', description: 'Votre planning : 1 mois, 3 mois, 6 mois, 1 an.', emoji: '🗓️', url: 'planning.html' }] });
    return m;
  }
  var DEMO_MENU = {
    chef_division: [
      { id: 'pilotage', titre: 'Pilotage & Projets', icone: '📊', niveau: 3, apps: [
        { titre: 'Avancement Chantiers', description: 'Vue d\'ensemble de l\'avancement des chantiers.', emoji: '📊', url: 'Avancement_des_Chantiers.html' },
        { titre: 'Suivi Chantier', description: 'Détail du suivi par chantier.', emoji: '🗂️', url: 'Suivi_Chantier.html' } ] },
      { id: 'cpm', titre: 'Cellule Passation Marché', icone: '📑', niveau: 3, apps: [
        { titre: 'Dossiers CPM — Détail', description: 'Dossiers de passation de marché et échéances.', emoji: '🗂️', url: 'Dossiers_CPM.html' } ] },
      { id: 'planning', titre: 'Planning & Rotations', icone: '🗓️', niveau: 2, apps: [
        { titre: 'Planning global', description: 'Qui est au travail, qui est en repos : vue d\'ensemble des rotations.', emoji: '🗓️', url: 'planning.html' } ] },
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 3, apps: [
        { titre: 'Rapports journaliers', description: 'Saisie du rapport du jour par chantier et suivi par la hiérarchie.', emoji: '📝', url: 'rapports.html' } ] },
      { id: 'securite', titre: 'Sécurité & Accès', icone: '🔐', niveau: 3, apps: [
        { titre: 'Gestion des privilèges', description: 'Rôles, droits par module, exceptions individuelles, comptes et codes de secours.', emoji: '🛡️', url: 'privileges.html' } ] }
    ],
    conducteur: [
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 2, apps: [
        { titre: 'Rapports journaliers', description: 'Saisie du rapport du jour par chantier et suivi par la hiérarchie.', emoji: '📝', url: 'rapports.html' } ] },
      { id: 'pilotage', titre: 'Pilotage & Projets', icone: '📊', niveau: 1, apps: [
        { titre: 'Avancement Chantiers', description: 'Vue d\'ensemble de l\'avancement des chantiers.', emoji: '📊', url: 'Avancement_des_Chantiers.html' } ] }
    ],
    cpm: [
      { id: 'cpm', titre: 'Cellule Passation Marché', icone: '📑', niveau: 3, apps: [
        { titre: 'Dossiers CPM — Détail', description: 'Dossiers de passation de marché et échéances.', emoji: '🗂️', url: 'Dossiers_CPM.html' } ] }
    ]
  };
  var demoRoles = [
    { id: 'agent', libelle: 'Agent', niveau_max: 0, interdits: [] }, { id: 'conducteur', libelle: 'Conducteur des travaux', niveau_max: 0, interdits: [] },
    { id: 'chef_service', libelle: 'Chef de service', niveau_max: 0, interdits: [] }, { id: 'chef_division', libelle: 'Chef de division', niveau_max: 0, interdits: [] },
    { id: 'secretariat', libelle: 'Secrétariat', niveau_max: 0, interdits: [] }, { id: 'cpm', libelle: 'Cellule Passation de marché', niveau_max: 0, interdits: [] },
    { id: 'prestataire', libelle: 'Prestataire', niveau_max: 2, interdits: ['securite', 'rh', 'admin'] },
    { id: 'guest', libelle: 'Invité (lecture seule)', niveau_max: 1, interdits: ['securite', 'rh', 'admin', 'planning', 'badges'] }
  ];
  var demoApps = [
    { module: 'pilotage', titre: 'Avancement Chantiers', niveau_min: 1, roles: [] }, { module: 'pilotage', titre: 'Suivi Chantier', niveau_min: 1, roles: [] },
    { module: 'cpm', titre: 'Dossiers CPM — Détail', niveau_min: 1, roles: [] }, { module: 'planning', titre: 'Planning global', niveau_min: 2, roles: [] }
  ];
  var DEMO_MODULES = [
    { id: 'pilotage', titre: 'Pilotage & Projets' }, { id: 'cpm', titre: 'Cellule Passation Marché' },
    { id: 'logistique', titre: 'Logistique & Stocks' }, { id: 'rh', titre: 'RH & Personnel' },
    { id: 'admin', titre: 'Administration' }, { id: 'planning', titre: 'Planning & Rotations' },
    { id: 'rapports', titre: 'Rapports journaliers' }, { id: 'badges', titre: 'Badges prestataires' }, { id: 'securite', titre: 'Sécurité & Accès' }
  ];
  var demoDroits = [
    { role: 'conducteur', module: 'rapports', niveau: 2 }, { role: 'conducteur', module: 'pilotage', niveau: 1 },
    { role: 'cpm', module: 'cpm', niveau: 3 }, { role: 'chef_division', module: 'securite', niveau: 3 }, { role: 'chef_division', module: 'pilotage', niveau: 3 }
  ];
  var demoExceptions = [{ email: 's.meziane@exemple.dz', module: 'cpm', niveau: 1 }];
  // Rotations de démonstration (le vrai calcul est celui du moteur Sijil, côté passerelle).
  var CLE_ROT = 'infra_v2_demo_rot';
  function jourStr(d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function plus(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return jourStr(d); }
  function ecart(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
  function demoRots() {
    var d; try { d = JSON.parse(sessionStorage.getItem(CLE_ROT) || 'null'); } catch (e) { d = null; }
    if (!d) { d = { 'k.benali@exemple.dz': { statut: 'T', depuis: plus(auj(), -9), jours_travail: 28, jours_repos: 28 },
                    's.meziane@exemple.dz': { statut: 'R', depuis: plus(auj(), -3), jours_travail: 14, jours_repos: 14 },
                    'a.khelifi@exemple.dz': { statut: 'T', depuis: plus(auj(), -20), jours_travail: 28, jours_repos: 28 },
                    'n.ouali@exemple.dz': { statut: 'R', depuis: plus(auj(), -5), jours_travail: 4, jours_repos: 4 } }; }
    return d;
  }
  function saveRots(d) { try { sessionStorage.setItem(CLE_ROT, JSON.stringify(d)); } catch (e) {} }
  function statutAu(rot, jour) {
    var jt = rot.jours_travail, jr = rot.jours_repos, off = ecart(rot.depuis, jour);
    if (off < 0) return null;
    var premier = rot.statut === 'T' ? jt : jr, second = rot.statut === 'T' ? jr : jt, pos = off % (jt + jr);
    return pos < premier ? { st: rot.statut, jour: pos + 1, total: premier } : { st: rot.statut === 'T' ? 'R' : 'T', jour: pos - premier + 1, total: second };
  }
  function demoSituation(rot) {
    var a = auj(), x = statutAu(rot, a);
    if (!x) return { avant: true, debut: rot.depuis };
    var rest = x.total - x.jour + 1;
    return { statut: x.st, depuis: plus(a, -(x.jour - 1)), jour: x.jour, total: x.total, restants: rest, prochain: { date: plus(a, rest), statut: x.st === 'T' ? 'R' : 'T' }, prevu: true };
  }
  function demoGrille(rot, debut, n) { var o = ''; for (var i = 0; i < n; i += 1) { var x = statutAu(rot, plus(debut, i)); o += x ? x.st : '.'; } return o; }

  // Rapports de démonstration (la validation réelle est celle de Rapports.gs, côté passerelle).
  var CLE_RAP = 'infra_v2_demo_rapports';
  var DEMO_CHANTIERS = [
    { id: 'forage_rns', nom: 'Forage RNS — 3 puits d\'eau', service: 'Travaux Entretien', actif: 1 },
    { id: 'terrassement_rns', nom: 'Terrassement RNS (36 mois)', service: 'Travaux Entretien', actif: 1 },
    { id: 'maintenance_electrique', nom: 'Maintenance des installations électriques', service: 'Électromécanique', actif: 1 }
  ];
  var NIV_RAP = { chef_division: 3, conducteur: 2, cpm: 1 };
  function demoRapports() {
    var d; try { d = JSON.parse(sessionStorage.getItem(CLE_RAP) || 'null'); } catch (e) { d = null; }
    if (!d) d = [{ id: 'seed1', date: auj(), chantier: 'forage_rns', auteur_email: 'a.khelifi@exemple.dz', auteur_nom: 'KHELIFI Amine', service: 'Service Construction',
      effectif: 14, travaux: 'Forage du puits P2 : passage à 85 m, remontée des déblais.', difficultes: 'Venue d\'eau à 80 m, pompage nécessaire.', commentaire: 'Prévoir pièces de rechange pour la pompe.', avancement: 42, visa_par: '', visa_note: '', visa_le: '' }];
    return d;
  }
  function saveRap(d) { try { sessionStorage.setItem(CLE_RAP, JSON.stringify(d)); } catch (e) {} }
  function niveauRap() { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); return NIV_RAP[demoState.user.role] || 0; }
  function vuRap(r, niv) { var u = demoState.user; return niv >= 3 || r.auteur_email === u.email || (niv === 2 && r.service === u.service); }

  function erreur(msg, code) { var e = new Error(msg); e.code = code || 'ERR'; return e; }

  function demo(action, p) {
    var u = DEMO_USERS.filter(function (x) { return x.uid === p.ident; })[0];
    switch (action) {
      case 'liste': { var qn = String(p.q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(), mots = qn.split(/\s+/).filter(Boolean);
        if (qn.replace(/\s+/g, '').length < 3) return { utilisateurs: [], plus: false, court: true };
        var tr = DEMO_USERS.filter(function (x) { var h = x.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return mots.every(function (m) { return h.indexOf(m) !== -1; }); });
        return { utilisateurs: tr.slice(0, 8).map(function (x) { return { uid: x.uid, nom: x.nom, service: x.service }; }), plus: tr.length > 8, court: false }; }
      case 'demanderCode': if (!u) throw erreur('Utilisateur inconnu'); return { masque: u.email.slice(0, 2) + '***@exemple.dz', minutes: 30 };
      case 'activer': if (!u || p.code !== '123456') throw erreur('Code invalide ou expiré');
        if (String(p.mdp || '').length < 4) throw erreur('Mot de passe : 4 caractères minimum'); return connecterDemo(u, p.remember);
      case 'login': if (!u || p.mdp !== 'Demo2026!') throw erreur('Identifiant ou mot de passe incorrect'); return connecterDemo(u, p.remember);
      case 'reprendre': { var m = /^demo-rm-(.+)$/.exec(p.rt || ''); var ur = m && DEMO_USERS.filter(function (x) { return x.uid === m[1]; })[0];
        if (!ur) throw erreur('Session expirée', 'SESSION'); return connecterDemo(ur, true); }
      case 'menu': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { user: pub(demoState.user), mdp_par_defaut: demoState.user.uid === 'u6', menu: menuDemo(demoState.user.role) };
      case 'logout': demoState.user = null; return {};
      case 'changer_mdp': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        if (p.ancien !== 'Demo2026!' && p.ancien !== '0000') throw erreur('Ancien mot de passe incorrect');
        if (String(p.nouveau || '').length < 4) throw erreur('Mot de passe : 4 caractères minimum');
        if (p.nouveau === '0000') throw erreur('Choisissez un autre mot de passe que celui par défaut'); return {}; }
      case 'admin_etat': exigerAdmin();
        return { roles: demoRoles.map(function (r) { var n = DEMO_USERS.filter(function (u) { return u.role === r.id; }).length; return Object.assign({ nb_utilisateurs: n }, r); }),
          applications: demoApps, modules: DEMO_MODULES, droitsRole: demoDroits, exceptions: demoExceptions,
          utilisateurs: DEMO_USERS.map(function (x) { return { email: x.email, nom: x.nom, service: x.service, fonction: '', dependance: x.dependance || 'SONATRACH', role: x.role, actif: x.actif !== false }; }) };
      case 'admin_role': exigerAdmin(); if (p.email === demoState.user.email) throw erreur('Vous ne pouvez pas modifier votre propre rôle');
        cibleDemo(p.email).role = p.role; return {};
      case 'admin_actif': exigerAdmin(); if (p.email === demoState.user.email) throw erreur('Vous ne pouvez pas désactiver votre propre compte');
        cibleDemo(p.email).actif = !!p.actif; return {};
      case 'admin_role_enregistrer': { exigerAdmin();
        var lib = String(p.libelle || '').trim(); if (!lib) throw erreur('Donnez un nom au rôle');
        var rid = p.creation ? lib.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : p.id;
        var ex = demoRoles.filter(function (r) { return r.id === rid; })[0];
        if (p.creation && ex) throw erreur('Ce rôle existe déjà'); if (!p.creation && !ex) throw erreur('Rôle inconnu');
        if (rid === 'secretariat' && (p.niveau_max || (p.interdits || []).length)) throw erreur('Le rôle secrétariat ne peut pas être restreint');
        if (ex) { ex.libelle = lib; ex.niveau_max = p.niveau_max || 0; ex.interdits = p.interdits || []; } else demoRoles.push({ id: rid, libelle: lib, niveau_max: p.niveau_max || 0, interdits: p.interdits || [] });
        return { id: rid }; }
      case 'admin_role_supprimer': { exigerAdmin();
        if (p.id === 'secretariat') throw erreur('Le rôle secrétariat ne peut pas être supprimé');
        var nbu = DEMO_USERS.filter(function (u) { return u.role === p.id; }).length;
        if (nbu) throw erreur('Impossible : ' + nbu + ' utilisateur' + (nbu > 1 ? 's ont' : ' a') + ' ce rôle. Changez d\'abord leur rôle.');
        demoRoles = demoRoles.filter(function (r) { return r.id !== p.id; }); demoDroits = demoDroits.filter(function (d) { return d.role !== p.id; }); return {}; }
      case 'admin_app': { exigerAdmin(); var ap = demoApps.filter(function (x) { return x.titre === p.titre; })[0]; if (!ap) throw erreur('Application inconnue');
        ap.niveau_min = p.niveau_min; ap.roles = p.roles || []; return {}; }
      case 'admin_droit': exigerAdmin(); demoDroits = demoDroits.filter(function (d) { return !(d.role === p.role && d.module === p.module); });
        if (Number(p.niveau) > 0) demoDroits.push({ role: p.role, module: p.module, niveau: Number(p.niveau) }); return {};
      case 'admin_exception': exigerAdmin(); demoExceptions = demoExceptions.filter(function (d) { return !(d.email === p.email && d.module === p.module); });
        if (p.niveau !== null && p.niveau !== '' && p.niveau !== undefined) demoExceptions.push({ email: p.email, module: p.module, niveau: Number(p.niveau) }); return {};
      case 'situation': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var rr = demoRots()[demoState.user.email];
        return rr ? { acces: true, configuree: true, nom: demoState.user.nom, rotation: rr, situation: demoSituation(rr) } : { acces: true, configuree: false, nom: demoState.user.nom }; }
      case 'rotation_enregistrer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var cible = p.email || demoState.user.email;
        if (cible !== demoState.user.email && demoState.user.role !== 'chef_division') throw erreur('Droits insuffisants', 'DROITS');
        if (p.statut !== 'T' && p.statut !== 'R') throw erreur('Indiquez si vous êtes en travail ou en repos');
        if (!p.depuis || p.depuis > auj()) throw erreur('La date ne peut pas être dans le futur');
        if (!(p.jours_travail >= 1 && p.jours_travail <= 90 && p.jours_repos >= 1 && p.jours_repos <= 90)) throw erreur('Rotation invalide (1 à 90 jours)');
        var tous = demoRots(); tous[cible] = { statut: p.statut, depuis: p.depuis, jours_travail: p.jours_travail, jours_repos: p.jours_repos }; saveRots(tous);
        return { acces: true, configuree: true }; }
      case 'planning': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var tousP = demoState.user.role === 'chef_division', d0 = p.debut || plus(auj(), -7), n = Math.min(370, Math.max(7, Number(p.jours) || 35)), all = demoRots();
        return { aujourdhui: auj(), debut: d0, jours: n, peutVoirTous: tousP, peutModifier: tousP,
          lignes: DEMO_USERS.filter(function (x) { return tousP || x.email === demoState.user.email; }).map(function (x) {
            var r = all[x.email], l = { nom: x.nom, service: x.service, fonction: x.fonction || '', dependance: x.dependance || 'SONATRACH', email: x.email, configuree: !!r, moi: x.email === demoState.user.email };
            if (r) { l.rotation = r; l.situation = demoSituation(r); l.grille = demoGrille(r, d0, n); }
            return l; }) }; }
      case 'profil_enregistrer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var dp = demoProfil[demoState.user.email] = demoProfil[demoState.user.email] || {}, vu = pub(demoState.user), fait = 0;
        [['matricule', /^[A-Za-z0-9\-]{3,15}$/, 'Matricule'], ['sap', /^[A-Za-z0-9\-]{3,15}$/, 'Matricule SAP'], ['nin', /^\d{18}$/, 'NIN (18 chiffres)']].forEach(function (c) {
          var v = String(p[c[0]] || '').replace(/\s+/g, ''); if (!v || (c[0] === 'nin' ? vu.nin_renseigne : vu[c[0]])) return;
          if (!c[1].test(v)) throw erreur(c[2] + ' : format invalide.'); dp[c[0]] = v; fait += 1; });
        if (!fait) throw erreur('Rien à enregistrer : ces champs sont déjà renseignés (pour les corriger, contactez le secrétariat).');
        return { user: pub(demoState.user) }; }
      case 'emettreCode': exigerAdmin(); return { code: String(Math.floor(100000 + Math.random() * 900000)) };
    }
    throw erreur('Action inconnue');
  }
  function exigerAdmin() {
    if (!demoState.user) throw erreur('Session expirée', 'SESSION');
    if (demoState.user.role !== 'chef_division') throw erreur('Droits insuffisants', 'DROITS');
  }
  function cibleDemo(email) { var u = DEMO_USERS.filter(function (x) { return x.email === email; })[0]; if (!u) throw erreur('Utilisateur inconnu'); return u; }
  function pub(u) {
    return { email: u.email, nom: u.nom, civilite: u.civilite || '', matricule: (demoProfil[u.email] || {}).matricule || u.matricule || (u.role === 'chef_division' ? '90514B' : ''), role: u.role, role_libelle: ({ chef_division: 'Chef de division', conducteur: 'Conducteur des travaux', cpm: 'Cellule Passation de marché', agent: 'Agent' })[u.role] || u.role,
             service: u.service, fonction: u.fonction || '', dependance: u.dependance || 'SONATRACH', telephone: u.telephone || '',
             sona: u.sona || ('sona' + (10000 + Number(String(u.uid).slice(1)))), date_integration: u.date_integration || '2025-03-17',
             wifi_user: 'wf.' + String(u.email).split('@')[0], sap: (demoProfil[u.email] || {}).sap || '', nin_masque: masquerNin((demoProfil[u.email] || {}).nin), nin_renseigne: !!(demoProfil[u.email] || {}).nin };
  }
  var demoProfil = {};
  function masquerNin(v) { return v ? v.slice(0, 4) + '••••••' + v.slice(-4) : ''; }
  function connecterDemo(u, remember) { demoState.user = u; var r = { token: 'demo', user: pub(u) }; if (remember) r.remember = 'demo-rm-' + u.uid; return r; }

  var CLE_RM = 'infra_v2_remember';
  var SANS_REPRISE = { login: 1, activer: 1, reprendre: 1, liste: 1, demanderCode: 1 };

  // Un nouvel onglet démarre sans session (elle est propre à l'onglet) : il la demande aux autres onglets ouverts du même
  // navigateur (BroadcastChannel). Rien n'est écrit durablement ; sans onglet ouvert, on retombe sur la connexion.
  function jeton() { try { return sessionStorage.getItem(CLE) || ''; } catch (e) { return ''; } }
  var CANAL = 'infra_v2_session';
  var pret = Promise.resolve();
  if (!DEMO && typeof BroadcastChannel !== 'undefined') {
    try {
      var repondeur = new BroadcastChannel(CANAL);
      repondeur.onmessage = function (e) { if (e.data && e.data.type === 'demande' && jeton()) repondeur.postMessage({ type: 'jeton', jeton: jeton() }); };
      if (!jeton()) pret = new Promise(function (ok) {
        var bc = new BroadcastChannel(CANAL), fini = false;
        function fin() { if (!fini) { fini = true; try { bc.close(); } catch (e) {} ok(); } }
        bc.onmessage = function (e) { if (e.data && e.data.type === 'jeton' && e.data.jeton && !fini) { try { sessionStorage.setItem(CLE, e.data.jeton); } catch (x) {} fin(); } };
        bc.postMessage({ type: 'demande' }); setTimeout(fin, 400);
      });
    } catch (e) { pret = Promise.resolve(); }
  }

  window.Api = {
    demo: DEMO,
    remember: function () { try { return localStorage.getItem(CLE_RM) || ''; } catch (e) { return ''; } },
    setRemember: function (t) { try { t ? localStorage.setItem(CLE_RM, t) : localStorage.removeItem(CLE_RM); } catch (e) { /* stockage indisponible */ } },
    // Rouvre une session à partir du jeton « rester connecté » ; résout true/false.
    reprendre: function () {
      var self = this; var rt = this.remember();
      if (!rt) return Promise.resolve(false);
      return this.call('reprendre', { rt: rt }).then(function (r) {
        self.setToken(r.token); if (r.remember) self.setRemember(r.remember); return true;
      }).catch(function (e) { if (e.code === 'SESSION') self.setRemember(''); return false; });
    },
    token: function () { try { return sessionStorage.getItem(CLE) || ''; } catch (e) { return ''; } },
    setToken: function (t) { try { t ? sessionStorage.setItem(CLE, t) : sessionStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ } },
    call: function (action, params, dejaRepris) {
      params = params || {};
      var self = this;
      if (DEMO) {
        // Le mode démo ne garde pas d'état entre deux pages : on rejoue la connexion mémorisée.
        try { var m = sessionStorage.getItem(CLE + '_demo'); if (m && !demoState.user) demoState.user = JSON.parse(m); } catch (e) {}
        return new Promise(function (ok, ko) { setTimeout(function () {
          try { if (!demoState.user && !SANS_REPRISE[action] && self.remember()) { var rr = demo('reprendre', { rt: self.remember() }); self.setToken(rr.token); }
            var r = demo(action, params); if (demoState.user) { try { sessionStorage.setItem(CLE + '_demo', JSON.stringify(demoState.user)); } catch (e) {} } else { try { sessionStorage.removeItem(CLE + '_demo'); } catch (e) {} } ok(r); } catch (e) { ko(e); }
        }, 250); });
      }
      return (SANS_REPRISE[action] ? Promise.resolve() : pret).then(function () {
      var corps = Object.assign({ action: action, token: self.token() }, params);
      return fetch(window.GATEWAY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j.ok) throw erreur(j.erreur || 'Erreur', j.code); return j; })
        .catch(function (e) {
          // Session expirée : on tente une fois de la rouvrir avec « rester connecté », puis on rejoue l'appel.
          if (e.code === 'SESSION' && !dejaRepris && !SANS_REPRISE[action] && self.remember()) {
            return self.reprendre().then(function (ok) { if (!ok) throw e; return self.call(action, params, true); });
          }
          throw e;
        });
      });
    }
  };
})();
