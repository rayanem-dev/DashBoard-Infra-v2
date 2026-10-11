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
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 3, apps: [] }
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
  function erreur(msg, code) { var e = new Error(msg); e.code = code || 'ERR'; return e; }

  function demo(action, p) {
    var u = DEMO_USERS.filter(function (x) { return x.uid === p.ident; })[0];
    switch (action) {
      case 'liste': return { utilisateurs: DEMO_USERS.map(function (x) { return { uid: x.uid, nom: x.nom, service: x.service }; }) };
      case 'demanderCode': if (!u) throw erreur('Utilisateur inconnu'); return { masque: u.email.slice(0, 2) + '***@exemple.dz', minutes: 30 };
      case 'activer': if (!u || p.code !== '123456') throw erreur('Code invalide ou expiré'); return connecterDemo(u);
      case 'login': if (!u || p.mdp !== 'Demo2026!') throw erreur('Identifiant ou mot de passe incorrect'); return connecterDemo(u);
      case 'menu': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { user: pub(demoState.user), menu: DEMO_MENU[demoState.user.role] || [] };
      case 'logout': demoState.user = null; return {};
    }
    throw erreur('Action inconnue');
  }
  function pub(u) { return { email: u.email, nom: u.nom, role: u.role, service: u.service }; }
  function connecterDemo(u) { demoState.user = u; return { token: 'demo', user: pub(u) }; }

  window.Api = {
    demo: DEMO,
    token: function () { try { return sessionStorage.getItem(CLE) || ''; } catch (e) { return ''; } },
    setToken: function (t) { try { t ? sessionStorage.setItem(CLE, t) : sessionStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ } },
    call: function (action, params) {
      params = params || {};
      if (DEMO) {
        // Le mode démo ne garde pas d'état entre deux pages : on rejoue la connexion mémorisée.
        try { var m = sessionStorage.getItem(CLE + '_demo'); if (m && !demoState.user) demoState.user = JSON.parse(m); } catch (e) {}
        return new Promise(function (ok, ko) { setTimeout(function () {
          try { var r = demo(action, params); if (demoState.user) { try { sessionStorage.setItem(CLE + '_demo', JSON.stringify(demoState.user)); } catch (e) {} } else { try { sessionStorage.removeItem(CLE + '_demo'); } catch (e) {} } ok(r); } catch (e) { ko(e); }
        }, 250); });
      }
      var corps = Object.assign({ action: action, token: this.token() }, params);
      return fetch(window.GATEWAY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j.ok) throw erreur(j.erreur || 'Erreur', j.code); return j; });
    }
  };
})();
