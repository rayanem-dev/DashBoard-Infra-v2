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
  // ---- Démonstration : feuille « Suivi CPM » fictive (mêmes colonnes que la vraie) ----
  function demoCpmCsv() {
    var auj = new Date(); function fr(j) { var d = new Date(auj); d.setDate(d.getDate() + j); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
    var cols = 27, vide = function () { var r = []; for (var i = 0; i < cols; i += 1) r.push(''); return r; };
    function L(titre, statut, extra) { var r = vide(); r[2] = 'CPM-' + (100 + titre.length); r[3] = titre; r[8] = statut; Object.keys(extra || {}).forEach(function (k) { r[k] = extra[k]; }); return r; }
    var tete = vide(); ['Début CDC', 'Type', 'N° dossier', 'Intitulé', 'Étape', 'Date limite', 'Échéance', '%', 'Statut'].forEach(function (c, i) { tete[i] = c; });
    var lignes = [vide(), tete,
      L('Réhabilitation du réseau d\'eau — base de vie', 'Contrat en exécution', { 16: fr(-200), 17: '8', 18: fr(40), 14: '18 500 000' }),
      L('Maintenance des installations électriques', 'Contrat en exécution', { 16: fr(-60), 17: '12', 18: fr(300), 14: '9 200 000' }),
      L('Travaux de terrassement — plateforme B', 'Contrat en exécution', { 16: fr(-150), 17: '6', 18: fr(30), 14: '41 000 000' }),
      L('Fourniture de pièces détachées', 'Attribué', { 12: 'Entreprise Atlas', 14: '3 400 000' }),
      L('Entretien des espaces verts', 'Dossier en cours', {}),
      L('Étude de faisabilité — pont d\'accès', 'Dossier en cours', {}),
      L('Location d\'engins', 'Contrat échu', { 16: fr(-500), 17: '12', 18: fr(-130) }),
      L('Nettoyage des bacs', 'Bloqué', {}),
      L('Vérification des extincteurs', 'Infructueux', {}),
      L('Peinture des bâtiments', 'Non démarré', {})];
    return lignes.map(function (l) { return l.map(function (c) { var t = String(c); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(','); }).join('\n');
  }
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
      { id: 'simulation', titre: 'Simulation de planning', icone: '🧪', niveau: 3, apps: [
        { titre: 'Simulation de planning', description: 'Testez une modification de rotation sans rien enregistrer, mettez deux agents en vis-à-vis, puis émettez la demande à signer.', emoji: '🧪', url: 'simulation.html' } ] },
      { id: 'rh', titre: 'RH & Personnel', icone: '👥', niveau: 3, apps: [
        { titre: 'Organigramme — Division Infrastructure', description: 'Structure de la division, à jour avec BDDORGA : services, responsables, employeurs, téléphones.', emoji: '🏢', url: 'Organigramme.html' } ] },
      { id: 'affectation', titre: 'Affectation (Organigramme)', icone: '🔀', niveau: 3, apps: [
        { titre: 'Affectation du personnel', description: 'Changez le service d\'une personne directement dans l\'Organigramme (BDDORGA), avec historique et e-mail.', emoji: '🔀', url: 'affectation.html' } ] },
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 3, apps: [
        { titre: 'Rapports journaliers', description: 'Saisie du rapport du jour par chantier et suivi par la hiérarchie.', emoji: '📝', url: 'rapports.html' } ] },
      { id: 'securite', titre: 'Sécurité & Accès', icone: '🔐', niveau: 3, apps: [
        { titre: 'Contrôle de l\'annuaire', description: 'Compare les fiches contact avec BDDORGA.', emoji: '🔎', url: 'divergences.html' },
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

  // Affectations de démonstration (le service modifié est gardé dans le navigateur ; le vrai changement écrit dans BDDORGA côté passerelle).
  var CLE_AFF = 'infra_v2_demo_aff';
  function demoAff() { try { return JSON.parse(localStorage.getItem(CLE_AFF) || 'null') || { services: {}, hist: [] }; } catch (e) { return { services: {}, hist: [] }; } }
  function saveAff(o) { try { localStorage.setItem(CLE_AFF, JSON.stringify(o)); } catch (e) {} }
  function demoService(u) { return demoAff().services[u.uid] || u.service; }
  function demoServices() { var s = {}; DEMO_USERS.forEach(function (u) { s[demoService(u)] = true; }); return Object.keys(s).sort(); }

  // Demandes de modification de planning de démonstration (stockées dans le navigateur ; le calcul réel est celui de Simulation / Modifications.gs).
  var CLE_MOD = 'infra_v2_demo_modifs';
  function demoMods() { try { return JSON.parse(localStorage.getItem(CLE_MOD) || '[]'); } catch (e) { return []; } }
  function saveMods(l) { try { localStorage.setItem(CLE_MOD, JSON.stringify(l)); } catch (e) {} }
  function demoGrilleDe(email, debut, n) {
    var rot = demoRots()[email], g = demoGrille(rot, debut, n);
    demoMods().filter(function (m) { return m.statut === 'approuvee' && m.email === email; }).forEach(function (m) { g = Simulation.appliquer(g, debut, m.modif, rot); });
    return g;
  }
  function demoDoc(m) {
    var u = DEMO_USERS.filter(function (x) { return x.email === m.email; })[0] || {}, p = String(u.nom || '').split(/\s+/);
    var emet = DEMO_USERS.filter(function (x) { return x.email === m.emetteur; })[0] || {}, dec = DEMO_USERS.filter(function (x) { return x.email === m.decide_par; })[0];
    return { numero: m.numero, ville: 'Rhourde Nouss', date: m.cree_le.slice(0, 10), statut: m.statut,
      agent: { nom: p[0] || '', prenom: p.slice(1).join(' '), matricule: u.matricule || '', fonction: u.fonction || '', service: u.service || '', division: 'INFRA' },
      motif: m.motif, actuel: m.actuel, modifie: m.modifie, emetteur: emet.nom || '', decide_par: dec ? dec.nom : '', decide_le: m.decide_le || '', commentaire: m.commentaire || '' };
  }

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
      case 'donnees': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        if (p.source === 'cpm') return { csv: demoCpmCsv(), maj: new Date().toISOString() };
        throw erreur('Données de démonstration non disponibles pour cette source');
      case 'contacts_confirmer': if (!demoState.user) throw erreur('Session expirée', 'SESSION'); demoState.rapproches = demoState.rapproches || {};
        if (p.email) demoState.rapproches[p.nom] = p.email; else delete demoState.rapproches[p.nom]; return { enregistre: true };
      case 'contacts_completer': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        if (p.appliquer !== true) return { appliquer: false, plan: [{ nom: 'HADJADJ Lamine', champ: 'Téléphone', valeur: '0660514275' }, { nom: 'KHATIRI Mohammed Sadek Elslam', champ: 'Identifiant SONA', valeur: 'sona29432' }, { nom: 'KHATIRI Mohammed Sadek Elslam', champ: 'Matricule', valeur: '77589N' }] };
        return { appliquer: true, ecrites: 3, echecs: [] };
      case 'contacts_divergences': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var rap = demoState.rapproches || {}, khat = !!rap['KHATIRI Mohammed Sadek Elslam'];
        return { appariees: khat ? 42 : 41, fiches_personnes: 49, bddorga: 52, prestataires_non_compares: 58,
          rapproches: khat ? [{ nom: 'KHATIRI Mohammed Sadek Elslam', bddorga: 'KHATIRI MOHAMED SADEK ELISLAM', email: 'k@exemple.dz' }] : [],
          correspondances_probables: khat ? [] : [
            { nom: 'KHATIRI Mohammed Sadek Elslam', employeur: 'SONATRACH', section: 'SECTION ÉLECTRICITÉ', tels: ['562303481'], email: '', candidats: [{ nom: 'KHATIRI MOHAMED SADEK ELISLAM', email: 'k@exemple.dz', service: 'Travaux Entretien', employeur: 'SONATRACH', score: 0.97, indices: ['même téléphone', 'même employeur'] }] },
            { nom: 'BENALI Karimaa', employeur: 'ACOSCO', section: 'SECTION FROID', tels: ['600000001'], email: '', candidats: [{ nom: 'BENALI KARIMA', email: 'bk@exemple.dz', service: 'Service Construction', employeur: 'ACOSCO', score: 0.9, ambigu: true, indices: ['même employeur'] }, { nom: 'BENALI KARIMA', email: 'bk2@exemple.dz', service: 'Travaux Entretien', employeur: 'ACOSCO', score: 0.9, indices: ['même employeur'] }] }],
          divergences: [
            { nom: 'AZEGGAGH Loucif', champ: 'Téléphone', fiche: '661383013', bddorga: '0661383099', genre: 'different' },
            { nom: 'BOUAZIZ Hocine', champ: 'Employeur', fiche: 'GTP', bddorga: 'ACOSCO', genre: 'different' },
            { nom: 'BOUAZIZ Hocine', champ: 'Identifiant SONA', fiche: '', bddorga: 'sona20001', genre: 'manque_fiche' },
            { nom: 'HADJADJ Lamine', champ: 'E-mail', fiche: 'lamine.hadjadj@sonatrach.dz', bddorga: 'l.hadjadj@sonatrach.dz', genre: 'different' },
            { nom: 'MEKKI Sofiane', champ: 'Matricule', fiche: '90210X', bddorga: '', genre: 'manque_bddorga' } ].concat(khat ? [{ nom: 'KHATIRI Mohammed Sadek Elslam', champ: 'Téléphone', fiche: '562303481', bddorga: '0562000000', genre: 'different' }] : []),
          fiches_sans_bddorga: [{ nom: 'INCONNU Paul', employeur: 'SONATRACH', section: 'SECTION FROID' }],
          bddorga_sans_fiche: [{ nom: 'NOUVEAU Karim', service: 'Travaux Entretien', employeur: 'ACOSCO' }] };
      case 'cpm_journal': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { dernier_instantane: new Date().toISOString(), evenements: [
          { date: '2026-10-13', cle: 'a', n_dossier: 'N°39/SH-PROD/RNS/INFRA/2025', categorie: 'Dossier Appel Offre DAO', dossier: 'Travaux et prestations en génie civil', type: 'modifie', champ: 'commentaire', libelle: 'Commentaire', avant: '', apres: 'Réserves non suspensives levées le 16/09/2026' },
          { date: '2026-10-13', cle: 'a', n_dossier: 'N°39/SH-PROD/RNS/INFRA/2025', categorie: 'Dossier Appel Offre DAO', dossier: 'Travaux et prestations en génie civil', type: 'modifie', champ: 'statut', libelle: 'Statut', avant: 'Dossier en cours', apres: 'Attribué' },
          { date: '2026-10-13', cle: 'b', n_dossier: '', categorie: 'Gré à Gré Contrat d\'application', dossier: 'Nettoyage des bacs', type: 'nouveau', champ: '', libelle: '', avant: '', apres: 'Non démarré' },
          { date: '2026-10-12', cle: 'c', n_dossier: 'N°55/RNS/2026', categorie: 'Gré à Gré Contrat d\'application', dossier: 'Clôtures rigides des installations', type: 'modifie', champ: 'commentaire', libelle: 'Commentaire', avant: 'Contrat signé par l\'entrepreneur', apres: 'Contrat signé par Mr le Directeur de la Division Production' },
          { date: '2026-10-12', cle: 'e', n_dossier: 'CF N°38/SH/RNS/INFRA/2026', categorie: 'Gré à Gré Convention Cadre', dossier: 'Réfection de l\'étanchéité des infrastructures', type: 'modifie', champ: 'echeance_g', libelle: 'Échéance (passation)', avant: '19/09/2026', apres: '03/10/2026' },
          { date: '2026-10-09', cle: 'd', n_dossier: 'X', categorie: 'Bon De Commande', dossier: 'Ancien dossier test', type: 'retire', champ: '', libelle: '', avant: 'Non démarré', apres: '' } ] };
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
        return rr ? { acces: true, configuree: true, nom: demoState.user.nom, rotation: rr, reliquat: rr.reliquat === undefined ? null : rr.reliquat, reliquat_renseigne: rr.reliquat !== undefined, situation: demoSituation(rr) } : { acces: true, configuree: false, nom: demoState.user.nom }; }
      case 'reliquat_enregistrer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var tr = demoRots(), me = tr[demoState.user.email];
        if (!me) throw erreur('Renseignez d\'abord votre rotation'); var rl = Number(p.reliquat);
        if (p.reliquat === '' || p.reliquat == null || !isFinite(rl) || Math.floor(rl) !== rl || Math.abs(rl) > 365) throw erreur('Reliquat : un nombre entier de jours entre −365 et 365 (0 si vous n\'en avez pas)');
        me.reliquat = rl; saveRots(tr); return { acces: true, configuree: true, reliquat: rl, reliquat_renseigne: true }; }
      case 'rotation_enregistrer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var cible = p.email || demoState.user.email;
        if (cible !== demoState.user.email && demoState.user.role !== 'chef_division') throw erreur('Droits insuffisants', 'DROITS');
        if (p.statut !== 'T' && p.statut !== 'R') throw erreur('Indiquez si vous êtes en travail ou en repos');
        if (!p.depuis || p.depuis > auj()) throw erreur('La date ne peut pas être dans le futur');
        if (!(p.jours_travail >= 1 && p.jours_travail <= 90 && p.jours_repos >= 1 && p.jours_repos <= 90)) throw erreur('Rotation invalide (1 à 90 jours)');
        var tous = demoRots(), ancienRel = tous[cible] && tous[cible].reliquat; tous[cible] = { statut: p.statut, depuis: p.depuis, jours_travail: p.jours_travail, jours_repos: p.jours_repos };
        if (p.reliquat !== undefined && p.reliquat !== null && p.reliquat !== '') tous[cible].reliquat = Number(p.reliquat); else if (ancienRel !== undefined) tous[cible].reliquat = ancienRel; saveRots(tous);
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
      case 'organigramme': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var gr = {}, ordre = [];
        DEMO_USERS.forEach(function (x) { var sv = demoService(x); if (!gr[sv]) { gr[sv] = { nom: sv, racine: false, membres: [] }; ordre.push(sv); }
          var chef = x.role === 'chef_division'; if (chef) gr[sv].racine = true;
          gr[sv].membres.push({ nom: x.nom, fonction: x.fonction || (chef ? 'Chef de division' : ''), dependance: x.dependance || '', role: x.role, chef: chef, telephone: '0555 00 00 0' + x.uid.slice(1) }); });
        var sv2 = ordre.map(function (k) { return gr[k]; }).sort(function (a, b) { return (b.racine ? 1 : 0) - (a.racine ? 1 : 0) || (a.nom < b.nom ? -1 : 1); });
        return { services: sv2, total: DEMO_USERS.length }; }
      case 'aff_personnes': exigerAdmin();
        return { niveau: 3, moi: demoState.user.uid, services: demoServices(), personnes: DEMO_USERS.map(function (x) { return { uid: x.uid, nom: x.nom, service: demoService(x), fonction: x.fonction || '', dependance: x.dependance || '' }; }) };
      case 'aff_changer': { exigerAdmin(); var ca = DEMO_USERS.filter(function (x) { return x.uid === p.uid; })[0]; if (!ca) throw erreur('Personne inconnue');
        var nsv = String(p.service || '').replace(/\s+/g, ' ').trim(), asv = demoService(ca);
        if (nsv.length < 2) throw erreur('Service : de 2 à 60 caractères'); if (nsv.toLowerCase() === asv.toLowerCase()) throw erreur('Cette personne est déjà dans ce service');
        var ex = demoServices().filter(function (x) { return x.toLowerCase() === nsv.toLowerCase(); })[0];
        if (ex) nsv = ex; else if (!p.creer) throw erreur('Ce service n\'existe pas encore : confirmez sa création');
        var ov = demoAff(); ov.services[ca.uid] = nsv; var idA = 'AFF-' + new Date().getFullYear() + '-' + ('000' + (ov.hist.length + 1)).slice(-4);
        ov.hist.unshift({ id: idA, date: new Date().toISOString(), nom: ca.nom, ancien: asv, nouveau: nsv, par: demoState.user.nom, motif: String(p.motif || ''), date_effet: p.date_effet || '' }); saveAff(ov);
        return { id: idA, ancien: asv, nouveau: nsv, emails: 4 }; }
      case 'aff_historique': exigerAdmin(); return { historique: demoAff().hist };
      case 'simu_agents': exigerAdmin();
        return { niveau: 3, moi: demoState.user.uid, agents: DEMO_USERS.map(function (x) { return { uid: x.uid, nom: x.nom, service: x.service, fonction: x.fonction || '', dependance: x.dependance || 'SONATRACH', configuree: !!demoRots()[x.email] }; }) };
      case 'simu_donnees': { exigerAdmin(); var cu = DEMO_USERS.filter(function (x) { return x.uid === p.uid; })[0], rr0 = cu && demoRots()[cu.email];
        if (!rr0) throw erreur('Cet agent n\'a pas encore renseigné sa rotation');
        var d0s = /^\d{4}-\d{2}-\d{2}$/.test(p.debut || '') ? p.debut : plus(auj(), -35), ns = Math.max(30, Math.min(400, Number(p.jours) || 240));
        var netsA = 0; demoMods().forEach(function (m) { if (m.statut === 'approuvee' && m.email === cu.email) netsA += m.rq_net || 0; });
        return { uid: cu.uid, nom: cu.nom, service: cu.service, fonction: cu.fonction || '', rotation: rr0, aujourdhui: auj(), debut: d0s, jours: ns, grille: demoGrilleDe(cu.email, d0s, ns), reliquat_initial: rr0.reliquat === undefined ? null : rr0.reliquat, solde: (rr0.reliquat || 0) + netsA }; }
      case 'simu_valider': { exigerAdmin(); var itemsV = Array.isArray(p.lot) && p.lot.length ? p.lot : [p], motifV = String(p.motif || 'Raison de service').trim();
        if (motifV.length < 3) throw erreur('Indiquez le motif de la demande');
        var prepV = itemsV.map(function (it) {
          var cv = DEMO_USERS.filter(function (x) { return x.uid === it.uid; })[0], rv = cv && demoRots()[cv.email];
          if (!rv) throw erreur('Cet agent n\'a pas encore renseigné sa rotation');
          var mv = { debut: it.debut, periodes: it.periodes, reprise: it.reprise }, ev = Simulation.valider(mv, rv, auj()); if (ev) throw erreur(cv.nom + ' : ' + ev);
          var cy = rv.jours_travail + rv.jours_repos, F = plus(mv.debut, -(cy + 30)); if (F < rv.depuis) F = rv.depuis;
          var fin = plus(Simulation.dateReprise(mv), 2 * cy - 1), nn = ecart(F, fin) + 1, off = demoGrilleDe(cv.email, F, nn), mod = Simulation.appliquer(off, F, mv, rv);
          var du = mv.debut; if (du > F) { var ii = ecart(F, du) - 1, cc = off.charAt(ii); while (ii > 0 && off.charAt(ii - 1) === cc) ii -= 1; du = plus(F, ii); }
          return { cv: cv, mv: mv, rq: Simulation.reliquatDetail(off, mod, F, mv), actuel: Simulation.tableau(off, F, du, fin).slice(0, 14), modifie: Simulation.tableau(mod, F, du, fin).slice(0, 14) };
        });
        var lm = demoMods(), numerosV = [], docsV = [];
        prepV.forEach(function (q) {
          var numero = 'MOD-' + new Date().getFullYear() + '-' + ('000' + (lm.length + 1)).slice(-4);
          var nm = { numero: numero, cree_le: new Date().toISOString(), email: q.cv.email, emetteur: demoState.user.email, motif: motifV, modif: q.mv, statut: 'en_attente', rq_net: q.rq.net, actuel: q.actuel, modifie: q.modifie };
          lm.push(nm); numerosV.push(numero); docsV.push(demoDoc(nm));
        });
        saveMods(lm); return { numero: numerosV[0], numeros: numerosV, emails: 4, demande: docsV[0], demandes: docsV }; }
      case 'simu_liste': { var lq = demoMods().slice().reverse().map(function (m) { var u2 = DEMO_USERS.filter(function (x) { return x.email === m.email; })[0] || {};
          return { numero: m.numero, cree_le: m.cree_le, agent: u2.nom, service: u2.service, debut: m.modif.debut, reprise_le: Simulation.dateReprise(m.modif), motif: m.motif, statut: m.statut,
                   emetteur: (DEMO_USERS.filter(function (x) { return x.email === m.emetteur; })[0] || {}).nom, decide_par: m.decide_par || '', decide_le: m.decide_le || '', commentaire: m.commentaire || '',
                   peut_decider: m.statut === 'en_attente' && demoState.user.role === 'chef_division' }; });
        return { niveau: demoState.user.role === 'chef_division' ? 3 : 0, demandes: lq }; }
      case 'simu_demande': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var dm = demoMods().filter(function (m) { return m.numero === p.numero; })[0];
        if (!dm) throw erreur('Demande introuvable'); return { demande: demoDoc(dm) }; }
      case 'simu_decider': { exigerAdmin(); var ld = demoMods(), dd = ld.filter(function (m) { return m.numero === p.numero; })[0];
        if (!dd) throw erreur('Demande introuvable'); if (dd.statut !== 'en_attente') throw erreur('Cette demande a déjà été traitée');
        if (p.decision !== 'approuvee' && p.decision !== 'refusee') throw erreur('Décision invalide');
        dd.statut = p.decision; dd.decide_par = demoState.user.email; dd.decide_le = new Date().toISOString(); dd.commentaire = String(p.commentaire || ''); saveMods(ld);
        return { demande: { numero: dd.numero, statut: dd.statut }, emails: 4 }; }
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
