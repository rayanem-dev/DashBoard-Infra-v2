/* Client de la passerelle + mode démo (données fictives, aucune requête réseau). */
(function () {
  var DEMO = !window.GATEWAY_URL || /[?&]demo\b/.test(location.search);
  var CLE = 'infra_v2_token';
  var demoState = { token: null, user: null };
  var DEMO_USERS = [
    { uid: 'u1', nom: 'BENALI Karim', service: 'Division Infrastructures', role: 'chef_division', email: 'k.benali@exemple.dz' },
    { uid: 'u2', nom: 'MEZIANE Sofia', service: 'Service Construction', role: 'conducteur', email: 's.meziane@exemple.dz' },
    { uid: 'u3', nom: 'TAHRI Yacine', service: 'Cellule Passation de marché', role: 'cpm', email: 'y.tahri@exemple.dz' }
  ];
  var DEMO_MENU = {
    chef_division: [
      { id: 'pilotage', titre: 'Pilotage & Projets', icone: '📊', niveau: 3, apps: [
        { titre: 'Avancement Chantiers', description: 'Vue d\'ensemble de l\'avancement des chantiers.', emoji: '📊', url: 'Avancement_des_Chantiers.html' },
        { titre: 'Suivi Chantier', description: 'Détail du suivi par chantier.', emoji: '🗂️', url: 'Suivi_Chantier.html' } ] },
      { id: 'cpm', titre: 'Cellule Passation Marché', icone: '📑', niveau: 3, apps: [
        { titre: 'Dossiers CPM — Détail', description: 'Dossiers de passation de marché et échéances.', emoji: '🗂️', url: 'Dossiers_CPM.html' } ] },
      { id: 'planning', titre: 'Planning & Rotations', icone: '🗓️', niveau: 2, apps: [
        { titre: 'Planning global', description: 'Qui est au travail, qui est en repos : vue d\'ensemble des rotations.', emoji: '🗓️', url: 'planning.html' } ] },
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 3, apps: [] },
      { id: 'securite', titre: 'Sécurité & Accès', icone: '🔐', niveau: 3, apps: [
        { titre: 'Gestion des privilèges', description: 'Rôles, droits par module, exceptions individuelles, comptes et codes de secours.', emoji: '🛡️', url: 'privileges.html' } ] }
    ],
    conducteur: [
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 2, apps: [] },
      { id: 'pilotage', titre: 'Pilotage & Projets', icone: '📊', niveau: 1, apps: [
        { titre: 'Avancement Chantiers', description: 'Vue d\'ensemble de l\'avancement des chantiers.', emoji: '📊', url: 'Avancement_des_Chantiers.html' } ] }
    ],
    cpm: [
      { id: 'cpm', titre: 'Cellule Passation Marché', icone: '📑', niveau: 3, apps: [
        { titre: 'Dossiers CPM — Détail', description: 'Dossiers de passation de marché et échéances.', emoji: '🗂️', url: 'Dossiers_CPM.html' } ] }
    ]
  };
  var DEMO_ROLES = ['agent', 'conducteur', 'chef_service', 'chef_division', 'secretariat', 'cpm'];
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
                    's.meziane@exemple.dz': { statut: 'R', depuis: plus(auj(), -3), jours_travail: 14, jours_repos: 14 } }; }
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

  function erreur(msg, code) { var e = new Error(msg); e.code = code || 'ERR'; return e; }

  function demo(action, p) {
    var u = DEMO_USERS.filter(function (x) { return x.uid === p.ident; })[0];
    switch (action) {
      case 'liste': return { utilisateurs: DEMO_USERS.map(function (x) { return { uid: x.uid, nom: x.nom, service: x.service }; }) };
      case 'demanderCode': if (!u) throw erreur('Utilisateur inconnu'); return { masque: u.email.slice(0, 2) + '***@exemple.dz', minutes: 30 };
      case 'activer': if (!u || p.code !== '123456') throw erreur('Code invalide ou expiré');
        if (String(p.mdp || '').length < 4) throw erreur('Mot de passe : 4 caractères minimum'); return connecterDemo(u, p.remember);
      case 'login': if (!u || p.mdp !== 'Demo2026!') throw erreur('Identifiant ou mot de passe incorrect'); return connecterDemo(u, p.remember);
      case 'reprendre': { var m = /^demo-rm-(.+)$/.exec(p.rt || ''); var ur = m && DEMO_USERS.filter(function (x) { return x.uid === m[1]; })[0];
        if (!ur) throw erreur('Session expirée', 'SESSION'); return connecterDemo(ur, true); }
      case 'menu': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { user: pub(demoState.user), menu: DEMO_MENU[demoState.user.role] || [] };
      case 'logout': demoState.user = null; return {};
      case 'admin_etat': exigerAdmin();
        return { roles: DEMO_ROLES, modules: DEMO_MODULES, droitsRole: demoDroits, exceptions: demoExceptions,
          utilisateurs: DEMO_USERS.map(function (x) { return { email: x.email, nom: x.nom, service: x.service, fonction: '', role: x.role, actif: x.actif !== false }; }) };
      case 'admin_role': exigerAdmin(); if (p.email === demoState.user.email) throw erreur('Vous ne pouvez pas modifier votre propre rôle');
        cibleDemo(p.email).role = p.role; return {};
      case 'admin_actif': exigerAdmin(); if (p.email === demoState.user.email) throw erreur('Vous ne pouvez pas désactiver votre propre compte');
        cibleDemo(p.email).actif = !!p.actif; return {};
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
        if (demoState.user.role !== 'chef_division') throw erreur('Droits insuffisants', 'DROITS');
        var d0 = plus(auj(), -7), n = 35, all = demoRots();
        return { aujourdhui: auj(), debut: d0, jours: n, peutModifier: true, lignes: DEMO_USERS.map(function (x) {
          var r = all[x.email], l = { nom: x.nom, service: x.service, fonction: '', email: x.email, configuree: !!r };
          if (r) { l.rotation = r; l.situation = demoSituation(r); l.grille = demoGrille(r, d0, n); }
          return l; }) }; }
      case 'emettreCode': exigerAdmin(); return { code: String(Math.floor(100000 + Math.random() * 900000)) };
    }
    throw erreur('Action inconnue');
  }
  function exigerAdmin() {
    if (!demoState.user) throw erreur('Session expirée', 'SESSION');
    if (demoState.user.role !== 'chef_division') throw erreur('Droits insuffisants', 'DROITS');
  }
  function cibleDemo(email) { var u = DEMO_USERS.filter(function (x) { return x.email === email; })[0]; if (!u) throw erreur('Utilisateur inconnu'); return u; }
  function pub(u) { return { email: u.email, nom: u.nom, role: u.role, service: u.service }; }
  function connecterDemo(u, remember) { demoState.user = u; var r = { token: 'demo', user: pub(u) }; if (remember) r.remember = 'demo-rm-' + u.uid; return r; }

  var CLE_RM = 'infra_v2_remember';
  var SANS_REPRISE = { login: 1, activer: 1, reprendre: 1, liste: 1, demanderCode: 1 };

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
      var corps = Object.assign({ action: action, token: this.token() }, params);
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
    }
  };
})();
