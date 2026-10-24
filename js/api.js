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
      L('Réhabilitation du réseau d\'eau — base de vie', 'Contrat en exécution', { 12: 'ENCC SPA UNITE HAMIZ', 13: '43.INFRA.25', 16: fr(-200), 17: '8', 18: fr(40), 14: '18 500 000' }),
      L('Maintenance des installations électriques', 'Contrat en exécution', { 12: 'ACOSCO', 13: '27.INFRA.25', 16: fr(-60), 17: '12', 18: fr(300), 14: '9 200 000' }),
      L('Travaux de terrassement — plateforme B', 'Contrat en exécution', { 12: 'ETB ZATOUT ABDENACER', 13: '54.INFRA.25', 16: fr(-150), 17: '6', 18: fr(30), 14: '41 000 000' }),
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
        { titre: 'Organigramme — Division Infrastructure', description: 'Structure de la division, à jour avec BDDORGA : services, responsables, employeurs, téléphones.', emoji: '🏢', url: 'Organigramme.html' },
        { titre: 'Feuille de pointage', description: 'Feuille de pointage hebdomadaire de la division, imprimable en un clic.', emoji: '🗓️', url: 'pointage.html' },
        { titre: 'Documents administratifs', description: 'Ordres de mission, prêts, mutations, primes… : formulaires préremplis, prêts à imprimer.', emoji: '📄', url: 'documents.html' },
        { titre: 'Renommage de documents', description: 'Renomme les PDF, JPG et scans (type, agent, date) et apprend de vos corrections.', emoji: '🏷️', url: 'renommage.html' },
        { titre: 'Autorisation GAZ-OIL', description: 'Autorisation d\'approvisionnement en GAZ-OIL (fûts de 200 L), imprimable en un clic.', emoji: '⛽', url: 'autorisation-gazoil.html' },
        { titre: 'Ordre de travail', description: 'Ordre de travail de la division, imprimable en un clic, avec historique.', emoji: '🛠', url: 'ordre-travail.html' },
        { titre: 'Prise en charge hôtel', description: 'Demande de prise en charge à l\'hôtel pour un agent en mission, imprimable en un clic, avec historique.', emoji: '🏨', url: 'hotel-prise-en-charge.html' },
        { titre: 'Repas à emporter', description: 'Prise en charge repas à emporter prête à imprimer, avec historique.', emoji: '🥡', url: 'repas-emporter.html' } ] },
      { id: 'affectation', titre: 'Affectation (Organigramme)', icone: '🔀', niveau: 3, apps: [
        { titre: 'Affectation du personnel', description: 'Changez le service d\'une personne directement dans l\'Organigramme (BDDORGA), avec historique et e-mail.', emoji: '🔀', url: 'affectation.html' } ] },
      { id: 'rapports', titre: 'Rapports journaliers', icone: '📝', niveau: 3, apps: [
        { titre: 'Rapports journaliers', description: 'Saisie du rapport du jour par chantier et suivi par la hiérarchie.', emoji: '📝', url: 'rapports.html' } ] },
      { id: 'badges', titre: 'Badges prestataires', icone: '🪪', niveau: 3, apps: [
        { titre: 'Badges prestataires', description: 'Prépare et imprime les badges (recto-verso), numérotation automatique et historique.', emoji: '🪪', url: 'badges.html' },
        { titre: 'Prestataires présents sur site', description: 'Qui est présent sur site à une date choisie, par entreprise, avec impression et extraction Excel.', emoji: '🧑‍🏭', url: 'presents.html' },
        { titre: 'Fichier des habilitations', description: 'Extraction en vrac du fichier des Enquêtes, avec choix des colonnes à imprimer ou exporter.', emoji: '🗃️', url: 'habilitations.html' } ] },
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
  var CLE_BDG = 'infra_v2_demo_badges';
  function demoBdg() {
    try { var o = JSON.parse(localStorage.getItem(CLE_BDG) || 'null'); if (o) return o; } catch (e) {}
    var P = function (id, nom, prenom, fonction, entreprise, contrat) { return { id: id, nom: nom, prenom: prenom, fonction: fonction, entreprise: entreprise, contrat: contrat, structure: '', nomAr: '', prenomAr: '', source: 'enquetes' }; };
    return { ent: [{ nom: 'ENCC SPA', source: 'cpm', contrats: [{ numero: 'I/43/RNS/INFRA/2025', intitule: 'Génie civil base de vie' }] },
        { nom: 'ENAGEO', source: 'cpm', contrats: [{ numero: 'I/12/RNS/INFRA/2025', intitule: 'Forage' }, { numero: 'I/58/RNS/INFRA/2026', intitule: 'Géophysique' }] },
        { nom: 'ACOSCO', source: 'enquetes', contrats: [] }],
      pers: [P('e1', 'KACI', 'Farid', 'Chauffeur', 'ENAGEO', ''), P('e2', 'BOUSSAID', 'Abdallah', 'Chauffeur', 'ENAGEO', ''), P('e3', 'DEBILI', 'Fathi', 'Chauffeur', 'ENAGEO', ''),
        P('e4', 'BENDJEDDA', 'Athmane', 'Monteur assembleur', 'ENCC SPA', 'I/43/RNS/INFRA/2025'), P('e5', 'HAMOU', 'Wassim', 'Agent d\'entretien polyvalent', 'ENCC SPA', 'I/43/RNS/INFRA/2025'),
        P('e6', 'GHESKALI', 'Lakhdar', 'Chef de chantier', 'ENCC SPA', 'I/43/RNS/INFRA/2025'), P('e7', 'LACHI', 'Choayb', 'Préparateur', 'ACOSCO', ''), P('e8', 'ZERROUKI', 'Arezki', 'Conducteur de travaux génie civil', 'ACOSCO', '')],
      hist: [] };
  }
  function saveBdg(o) { try { localStorage.setItem(CLE_BDG, JSON.stringify(o)); } catch (e) {} }
  var CLE_AFF = 'infra_v2_demo_aff';
  function demoAff() { try { return JSON.parse(localStorage.getItem(CLE_AFF) || 'null') || { services: {}, hist: [] }; } catch (e) { return { services: {}, hist: [] }; } }
  function saveAff(o) { try { localStorage.setItem(CLE_AFF, JSON.stringify(o)); } catch (e) {} }
  function demoService(u) { return demoAff().services[u.uid] || u.service; }
  function demoVav() { try { return JSON.parse(sessionStorage.getItem('infra_v2_demo_vav') || '{}'); } catch (e) { return {}; } }
  function demoServices() { var s = {}; DEMO_USERS.forEach(function (u) { s[demoService(u)] = true; }); return Object.keys(s).sort(); }

  // Demandes de modification de planning de démonstration (stockées dans le navigateur ; le calcul réel est celui de Simulation / Modifications.gs).
  var CLE_MOD = 'infra_v2_demo_modifs';
  function demoMods() { try { return JSON.parse(localStorage.getItem(CLE_MOD) || '[]'); } catch (e) { return []; } }
  function saveMods(l) { try { localStorage.setItem(CLE_MOD, JSON.stringify(l)); } catch (e) {} }
  function demoGrilleDe(email, debut, n, valideesSeulement) {
    var rot = demoRots()[email], g = demoGrille(rot, debut, n);
    demoMods().filter(function (m) { return (m.statut === 'approuvee' || m.statut === 'initial' || (!valideesSeulement && m.statut === 'appliquee')) && m.email === email; }).sort(function (a, b) { return (a.statut === 'initial' ? 0 : 1) - (b.statut === 'initial' ? 0 : 1); }).forEach(function (m) { g = Simulation.appliquer(g, debut, m.modif, rot); });
    return g;
  }
  /** « Modifier mon planning » en démonstration : mêmes données que le serveur (modif_moi_donnees). */
  function demoModifDonnees(email) {
    var rot = demoRots()[email]; if (!rot) throw erreur('Renseignez d\'abord votre rotation');
    var a = auj(), F = plus(a, -60); if (F < rot.depuis) F = rot.depuis; var n = 420;
    var mine = demoMods().filter(function (m) { return m.email === email; }), en = mine.filter(function (m) { return m.statut === 'appliquee'; }).pop() || null, der = mine[mine.length - 1] || null;
    var net = 0; mine.forEach(function (m) { if (m.statut === 'approuvee') net += m.rq_net || 0; });
    function resume(m) { return m && { numero: m.numero, statut: m.statut, debut: m.modif.debut, motif: m.motif, decide_par: m.decide_par || '', decide_le: m.decide_le || '', cree_le: m.cree_le, commentaire: m.commentaire || '', hors_rotation: m.statut === 'appliquee' && !!m.hors }; }
    var normal = demoGrille(rot, F, n);
    return { rotation: rot, aujourdhui: a, debut: F, jours: n, grille_actuelle: demoGrilleDe(email, F, n, true), grille_demande: demoGrilleDe(email, F, n), grille_normale: normal,
             solde: (rot.reliquat || 0) + net, en_cours: resume(en), en_cours_modif: en ? en.modif : null, derniere: resume(der) };
  }
  function demoDoc(m) {
    var u = DEMO_USERS.filter(function (x) { return x.email === m.email; })[0] || {}, p = String(u.nom || '').split(/\s+/);
    var emet = DEMO_USERS.filter(function (x) { return x.email === m.emetteur; })[0] || {}, dec = DEMO_USERS.filter(function (x) { return x.email === m.decide_par; })[0];
    return { numero: m.numero, ville: 'Rhourde Nouss', date: m.cree_le.slice(0, 10), statut: m.statut,
      agent: { nom: p[0] || '', prenom: p.slice(1).join(' '), matricule: u.matricule || '', fonction: u.fonction || '', service: u.service || '', division: 'INFRA', dependance: u.dependance || 'SONATRACH' },
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

  var LECTURE = /^(liste|menu|situation|donnees|reprendre|annuaire|cpm_journal|planning|rotations|badges_donnees)/;
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
      case 'pointage_effectif': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { groupes: [{ t: 'Direction et services', l: [['DURAND Marc', 'CHEF Division Infrastructure'], ['MARTIN Hugo', 'CHEF SERVICE CONSTRUCTION']] }, { t: 'Génie civil et travaux', l: [['BERNARD Louis', 'INGÉNIEUR GÉNIE CIVIL'], ['LEROY Pierre Antoine', 'TECHNICIEN']] }] };
      case 'annuaire_fiches': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { groupes: ['Postes internes (4 chiffres)', 'Équipe Division Infrastructure — Collaborateurs & Bureaux › 🗒️ SECRÉTARIAT', 'Prestataires › MAINTENANCE'], rows: [
          [0, 'Réception', '📞 1000', 'Standard', ''], [0, 'Sûreté interne', '📞 1111', 'Poste de garde', ''],
          [1, 'DEMO Secrétaire', '📞 0555 00 00 00 | ✉️ secretariat@exemple.dz', 'SECRÉTAIRE', 'SONATRACH'], [2, 'Entreprise Atlas (démo)', '📞 0555 11 11 11', 'Maintenance', 'PRESTATAIRE']] };
      case 'annuaire_personnes': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        return { remplace: ['DURAND Marc', 'MARTIN Hugo', 'BERNARD Louis'], personnes: [
          { nom: 'DURAND Marc', employeur: 'SONATRACH', section: '🧑‍💼 CHEF DIVISION INFRASTRUCTURE', service: 'Division', fonction: 'CHEF DIVISION INFRASTRUCTURE', tel: '0550000001', tels_alt: [], email: 'marc.durand@exemple.dz', email2: '', sona: 'sona00001', matricule: '10001A' },
          { nom: 'MARTIN Hugo', employeur: 'GTP', section: '📑 CPM — CELLULE PASSATION MARCHÉ', service: 'CPM', fonction: 'CPM — CELLULE PASSATION MARCHÉ', tel: '0550000002', tels_alt: [], email: 'hugo.martin@example.com', email2: '', sona: 'sona00002', matricule: '' },
          { nom: 'BERNARD Louis', employeur: 'SONATRACH', section: '', service: 'Travaux Entretien', fonction: '', tel: '0550000003', tels_alt: [], email: 'louis.bernard@example.com', email2: 'louis.bernard@exemple.dz', sona: '', matricule: '' } ] };
      case 'email_contact_demander': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(p.adresse || '').replace(/\s+/g, ''))) throw erreur('Adresse e-mail invalide', 'ADRESSE');
        demoState.ec = String(p.adresse).replace(/\s+/g, '').toLowerCase(); return { masque: demoState.ec.slice(0, 2) + '***@' + demoState.ec.split('@')[1] };
      case 'email_contact_confirmer': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        if (String(p.code) !== '123456' || !demoState.ec) throw erreur('Code invalide ou expiré'); return { email_contact: demoState.ec };
      case 'admin_mdp_defaut': exigerAdmin(); return { donnes: 3, deja: 12, exclus: p.inclure ? [] : ['SECRÉTAIRE TEST (secretariat)'] };
      case 'admin_emails': exigerAdmin(); return { total: 6, problemes: [
        { email: 'a.test@exemple.dz', nom: 'OUALI Nadia', brut: 'n.ouali⟦U+00A0⟧@exemple.dz', contact: '', propre: 'n.ouali@exemple.dz', valide: true, problemes: ['caractères invisibles (espace insécable, caractère de largeur nulle…)'], suggestion: 'n.ouali@exemple.dz' },
        { email: 's.brahimi@gmial.com', nom: 'BRAHIMI Samir', brut: 's.brahimi@gmial.com', contact: '', propre: 's.brahimi@gmial.com', valide: true, problemes: ['domaine suspect : « gmial.com » ressemble à « gmail.com »'], suggestion: 's.brahimi@gmail.com' },
        { email: 'y.tahri', nom: 'TAHRI Yacine', brut: 'y.tahri', contact: '', propre: 'y.tahri', valide: false, problemes: ['pas de « @ »'], suggestion: '' } ],
        ignores_bddorga: [{ ligne: 41, nom: 'NOUVEAU Karim', raison: 'e-mail manquant ou invalide' }] };
      case 'admin_email_contact': exigerAdmin(); return { contact: String(p.contact || '').replace(/\s+/g, '').toLowerCase() };
      case 'admin_connexions': exigerAdmin(); return { evenements: [
        { date: '2026-10-15T08:12:00Z', action: 'connexion', libelle: 'Connexion réussie', email: 'k.benali@exemple.dz', nom: 'BENALI Karim', detail: '' },
        { date: '2026-10-15T08:05:00Z', action: 'connexion_echec', libelle: 'Connexion refusée', email: 's.brahimi@exemple.dz', nom: 'BRAHIMI Samir', detail: 'mot de passe incorrect' },
        { date: '2026-10-15T07:58:00Z', action: 'code_echec', libelle: 'Envoi du code impossible', email: 'n.ouali@exemple.dz', nom: 'OUALI Nadia', detail: 'envoi impossible : quota dépassé (quota restant : 0)' },
        { date: '2026-10-14T16:40:00Z', action: 'code_envoye', libelle: 'Code envoyé par e-mail', email: 'y.tahri@exemple.dz', nom: 'TAHRI Yacine', detail: 'envoyé à y.***@exemple.dz (quota restant : 87)' } ].filter(function (e) { return !p.q || (e.email + e.nom + e.detail).toLowerCase().indexOf(String(p.q).toLowerCase()) !== -1; }) };
      case 'admin_diagnostic': exigerAdmin(); return { email: p.email, nom: 'Agent de démonstration', actif: true, etat: 'choisi', bloque: false, essais: 1, demandes_code: 2, dernier_login: '2026-10-14T09:00:00Z', dernier_refus: '', dernier_code_envoye: '2026-10-14T08:50:00Z', dernier_code_echec: '', quota_mail: 87,
        conseils: ['Un code a bien été envoyé : demandez à la personne de regarder ses courriers indésirables (spam).'] };
      case 'admin_mdp': exigerAdmin(); return { mdp: p.mdp || 'k7m2p9xq' };
      case 'admin_test_mail': exigerAdmin(); return { envoye: true };
      case 'contacts_completer': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        if (p.appliquer !== true) return { appliquer: false, plan: [{ nom: 'DURAND Marc', champ: 'Téléphone', valeur: '0550000001' }, { nom: 'LEROY Pierre Antoine', champ: 'Identifiant SONA', valeur: 'sona00004' }, { nom: 'LEROY Pierre Antoine', champ: 'Matricule', valeur: '10004D' }] };
        return { appliquer: true, ecrites: 3, echecs: [] };
      case 'video_formation': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); throw erreur('Vidéo non disponible en démonstration'); }
      case 'presents_donnees': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var bp = demoBdg(), dd = String(p.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10), gr0 = {}, ordre0 = [], ex0 = { sorti: 0, avant: 0, hors_plage: 0, autre_base: 0 }, bases0 = {};
        function plus0(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
        bp.pers.forEach(function (x, i) { var entree = plus0('2026-10-05', -((i * 4) % 22)), defaut = i % 3 !== 0, sortie = defaut ? plus0(entree, 28) : plus0(entree, 10 + (i % 5)), base = i % 2 ? 'BASE DE VIE CENTRALE' : 'BASE ZINA'; bases0[base] = 1;
          if (entree > dd) { ex0.avant += 1; return; } if (!p.toutes && sortie < dd) { ex0.sorti += 1; return; } if ((p.reg_du && entree < p.reg_du) || (p.reg_au && entree > p.reg_au)) { ex0.hors_plage += 1; return; } if (p.base && base !== p.base) { ex0.autre_base += 1; return; }
          var k = x.entreprise; if (!gr0[k]) { gr0[k] = { entreprise: k, contrat: x.contrat || '', personnes: [] }; ordre0.push(k); } gr0[k].personnes.push({ nom: x.nom, prenom: x.prenom, fonction: x.fonction, base: base, entree: entree, sortie: sortie, sortie_defaut: defaut }); });
        var ent0 = ordre0.map(function (k) { return gr0[k]; });
        return { date: dd, entreprises: ent0, total: ent0.reduce(function (n, g) { return n + g.personnes.length; }, 0), exclus: ex0, bases: Object.keys(bases0).sort(), nb_sejours: bp.pers.length, duree_defaut: 28, peut_exporter: ['chef_division', 'chef_service', 'secretariat'].indexOf(demoState.user.role) !== -1 }; }
      case 'badges_enquetes_export': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var be = demoBdg(), ent1 = String(p.onglet || ''), ps = be.pers.filter(function (x) { return x.entreprise === ent1; });
        var tete = ['الرقم', 'الاسم و اللقب بالفرنسية', 'اللقب', 'الإسم', 'الوظيفة', 'تاريخ الازدياد', 'مكان الازدياد', 'الأب', 'الأم', 'العنوان', 'رقم التعريف الوطني', 'رقم الهاتف', 'تاريخ التسجيل — Date de prise en charge', 'القاعدة — Base d\'hébergement'], v0 = function () { return ['', '', '', '', '', '', '', '', '', '', '', '', '', '']; }, l1 = v0(), l3 = v0(); l1[0] = 'القائمة الإسمية لأعوان شركة ' + ent1.toUpperCase(); l3[0] = 'ولاية   إليزي';
        return { onglet: ent1, lignes: [l1, v0(), l3, tete].concat(ps.map(function (x, i) { return [String(i + 1), x.nom + ' ' + x.prenom, '', '', x.fonction, '1990-01-0' + (1 + (i % 9)), 'Alger', '', '', 'Hassi Messaoud', '1099000000000000' + (10 + i), '0550 00 00 ' + (10 + i), '1' + (i % 9) + '/0' + (1 + (i % 9)) + '/2026', i % 2 ? 'BASE DE VIE CENTRALE' : 'BASE ZINA']; })) }; }
      case 'habilitations_donnees': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var bh = demoBdg();
        return { niveau: 3, peut_exporter: ['chef_division', 'chef_service', 'secretariat'].indexOf(demoState.user.role) !== -1, fichier_url: 'https://docs.google.com/spreadsheets/', entreprises: bh.ent.map(function (e) { return e.nom; }), onglets: bh.ent.map(function (e) { return { onglet: e.nom, entreprise: e.nom, nb: bh.pers.filter(function (x) { return x.entreprise === e.nom; }).length }; }), colonnes: [['entreprise', 'Entreprise'], ['contrat', 'Contrat (onglet)'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['fonction', 'Fonction'], ['structure', 'Structure'], ['date_pec', 'Date de prise en charge'], ['base', 'Base d\'hébergement'], ['nomAr', 'Nom en arabe'], ['prenomAr', 'Prénom en arabe']].map(function (c) { return { id: c[0], libelle: c[1] }; }).concat([['naiss', 'Date de naissance'], ['nin', 'NIN'], ['tel', 'Téléphone']].map(function (c) { return { id: c[0], libelle: c[1], sensible: true }; })),
          lignes: bh.pers.map(function (x, i) { return { entreprise: x.entreprise, contrat: x.contrat || '', nom: x.nom, prenom: x.prenom, fonction: x.fonction, structure: x.structure || '', date_pec: '2026-0' + (1 + (i % 9)) + '-1' + (i % 9), base: i % 2 ? 'BASE DE VIE CENTRALE' : 'BASE ZINA', nomAr: '', prenomAr: '', naiss: '1990-01-0' + (1 + (i % 9)), nin: '1099000000000000' + (10 + i), tel: '0550 00 00 ' + (10 + i) }; }) }; }
      case 'badges_photos_profils': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); return { photos: (p.personnes || []).map(function () { return ''; }) }; }
      case 'badges_donnees': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var bd = demoBdg(); return { personnes: bd.pers, entreprises: bd.ent, historique: bd.hist, utilisateur: demoState.user.nom || 'Démo', avertissements: [], niveau: 3 };
      case 'badges_personnes_sauver': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var bp = demoBdg(); (p.personnes || []).forEach(function (x) { var i = -1; bp.pers.forEach(function (q, k) { if (q.id === x.id) i = k; }); if (i >= 0) bp.pers[i] = x; else bp.pers.push(x); });
        bp.pers = bp.pers.filter(function (q) { return (p.supprimer || []).indexOf(q.id) < 0; }); saveBdg(bp); return { ok: true };
      case 'badges_entreprises_sauver': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var be = demoBdg(); (p.entreprises || []).forEach(function (x) { var i = -1; be.ent.forEach(function (q, k) { if (q.nom === x.nom) i = k; }); if (i >= 0) be.ent[i].contrats = x.contrats; else be.ent.push({ nom: x.nom, contrats: x.contrats, source: 'manuel' }); });
        be.ent = be.ent.filter(function (q) { return (p.supprimer || []).indexOf(q.nom) < 0; }); saveBdg(be); return { ok: true };
      case 'badges_numeroter': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var bn = demoBdg(), B = window.Badges, cf = B.config(p.cfg || {}), at = B.attribuer(bn.hist, p.items || [], p.annee, cf), jour = new Date().toISOString().slice(0, 10), vus = {};
        at.items.forEach(function (it) { var k = it.n + '|' + B.cle(it); if (vus[k]) return; vus[k] = 1; bn.hist.push({ date: jour, ref: it.ref, n: it.n, annee: it.annee, cle: B.cle(it), nom: it.nom, prenom: it.prenom, fonction: it.fonction, entreprise: it.entreprise, structure: it.structure || cf.structure, contrat: it.contrat, imprime_par: demoState.user.nom || 'Démo' }); });
        saveBdg(bn); return { items: at.items, historique: bn.hist };
      case 'contacts_divergences': if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var rap = demoState.rapproches || {}, khat = !!rap['LEROY Pierre Antoine'];
        return { appariees: khat ? 42 : 41, fiches_personnes: 49, bddorga: 52, prestataires_non_compares: 58,
          rapproches: khat ? [{ nom: 'LEROY Pierre Antoine', bddorga: 'LEROY PIERRE ANTOINE', email: 'k@exemple.dz' }] : [],
          correspondances_probables: khat ? [] : [
            { nom: 'LEROY Pierre Antoine', employeur: 'SONATRACH', section: 'SECTION ÉLECTRICITÉ', tels: ['550000004'], email: '', candidats: [{ nom: 'LEROY PIERRE ANTOINE', email: 'k@exemple.dz', service: 'Travaux Entretien', employeur: 'SONATRACH', score: 0.97, indices: ['même téléphone', 'même employeur'] }] },
            { nom: 'BENALI Karimaa', employeur: 'ACOSCO', section: 'SECTION FROID', tels: ['600000001'], email: '', candidats: [{ nom: 'BENALI KARIMA', email: 'bk@exemple.dz', service: 'Service Construction', employeur: 'ACOSCO', score: 0.9, ambigu: true, indices: ['même employeur'] }, { nom: 'BENALI KARIMA', email: 'bk2@exemple.dz', service: 'Travaux Entretien', employeur: 'ACOSCO', score: 0.9, indices: ['même employeur'] }] }],
          divergences: [
            { nom: 'DUBOIS Loïc', champ: 'Téléphone', fiche: '661383013', bddorga: '0550000006', genre: 'different' },
            { nom: 'MARTIN Hugo', champ: 'Employeur', fiche: 'GTP', bddorga: 'ACOSCO', genre: 'different' },
            { nom: 'MARTIN Hugo', champ: 'Identifiant SONA', fiche: '', bddorga: 'sona00005', genre: 'manque_fiche' },
            { nom: 'DURAND Marc', champ: 'E-mail', fiche: 'marc.durand@exemple.dz', bddorga: 'm.durand@exemple.dz', genre: 'different' },
            { nom: 'GIRARD Paul', champ: 'Matricule', fiche: '10003C', bddorga: '', genre: 'manque_bddorga' } ].concat(khat ? [{ nom: 'LEROY Pierre Antoine', champ: 'Téléphone', fiche: '550000004', bddorga: '0550000007', genre: 'different' }] : []),
          fiches_sans_bddorga: [{ nom: 'INCONNU Paul', employeur: 'SONATRACH', section: 'SECTION FROID' }],
          bddorga_sans_fiche: [{ nom: 'NOUVEAU Karim', service: 'Travaux Entretien', employeur: 'ACOSCO' }] };
      case 'cpm_instantane': if (!demoState.user) throw erreur('Session expirée', 'SESSION'); return { base: false, evenements: 0, dossiers: 52 };
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
        return rr ? { acces: true, configuree: true, nom: demoState.user.nom, rotation: rr, reliquat: rr.reliquat === undefined ? null : rr.reliquat, solde: (rr.reliquat || 0) + demoMods().reduce(function (n, m) { return n + (m.statut === 'approuvee' && m.email === demoState.user.email ? m.rq_net || 0 : 0); }, 0), reliquat_renseigne: rr.reliquat !== undefined, situation: demoSituation(rr) } : { acces: true, configuree: false, nom: demoState.user.nom }; }
      case 'reliquat_enregistrer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var tr = demoRots(), cibleR = p.email || demoState.user.email; if (p.email && p.email !== demoState.user.email) exigerAdmin(); var me = tr[cibleR];
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
            var r = all[x.email], l = { uid: x.uid, nom: x.nom, service: x.service, fonction: x.fonction || '', dependance: x.dependance || 'SONATRACH', email: x.email, configuree: !!r, moi: x.email === demoState.user.email };
            if (r) { l.rotation = r; l.situation = demoSituation(r); l.grille = demoGrilleDe(x.email, d0, n); }
            return l; }) }; }
      case 'profil_enregistrer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var dp = demoProfil[demoState.user.email] = demoProfil[demoState.user.email] || {}, vu = pub(demoState.user), fait = 0;
        [['matricule', /^[A-Za-z0-9\-]{3,15}$/, 'Matricule'], ['sap', /^[A-Za-z0-9\-]{3,15}$/, 'Matricule SAP'], ['nin', /^\d{18}$/, 'NIN (18 chiffres)']].forEach(function (c) {
          var v = String(p[c[0]] || '').replace(/\s+/g, ''); if (!v || (c[0] === 'nin' ? vu.nin_renseigne : vu[c[0]])) return;
          if (!c[1].test(v)) throw erreur(c[2] + ' : format invalide.'); dp[c[0]] = v; fait += 1; });
        if (!fait) throw erreur('Rien à enregistrer : ces champs sont déjà renseignés (pour les corriger, contactez le secrétariat).');
        return { user: pub(demoState.user) }; }
      case 'me': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); return { user: pub(demoState.user), acces: {} }; }
      case 'profil_moi': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var mn = menuDemo(demoState.user.role), okU = {}, acc = [], non = [];
        mn.forEach(function (m) { m.apps.forEach(function (a) { okU[a.url] = true; acc.push({ titre: a.titre, emoji: a.emoji || '', url: a.url, module: m.titre }); }); });
        menuDemo('chef_division').forEach(function (m) { m.apps.forEach(function (a) { if (!okU[a.url]) { okU[a.url] = true; non.push({ titre: a.titre, emoji: a.emoji || '', description: a.description || '', module: m.titre }); } }); });
        var dd = []; try { dd = JSON.parse(localStorage.getItem('infra_v2_demo_acces') || '[]').filter(function (x) { return x.email === demoState.user.email; }); } catch (e) { dd = []; }
        return { user: pub(demoState.user), photo: (demoProfil[demoState.user.email] || {}).photo || '', acces: { accessibles: acc, non_accessibles: non }, demandes: dd }; }
      case 'profil_maj': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var dm = demoProfil[demoState.user.email] = demoProfil[demoState.user.email] || {}, nb = 0;
        ['nom_affiche', 'civilite', 'telephone', 'date_integration', 'wifi_user'].forEach(function (k) { if (p[k] !== undefined) { dm[k] = String(p[k]).trim(); nb += 1; } });
        if (!nb) throw erreur('Rien à enregistrer.'); return { user: pub(demoState.user) }; }
      case 'profil_photo': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var dq = demoProfil[demoState.user.email] = demoProfil[demoState.user.email] || {}; dq.photo = p.grand || ''; dq.mini = p.mini || ''; return { photo: dq.photo }; }
      case 'photos_mini': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var ph = {}; DEMO_USERS.forEach(function (x) { var q = demoProfil[x.email]; if (q && q.mini) ph[x.uid] = q.mini; }); return { photos: ph }; }
      case 'acces_demander': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var lst = []; try { lst = JSON.parse(localStorage.getItem('infra_v2_demo_acces') || '[]'); } catch (e) { lst = []; }
        if (lst.some(function (x) { return x.email === demoState.user.email && x.titre === p.titre && x.statut === 'en_attente'; })) throw erreur('Vous avez déjà une demande en attente pour cette application.');
        var no = 'ACC-DEMO-' + (lst.length + 1); lst.push({ numero: no, email: demoState.user.email, agent: demoState.user.nom, titre: p.titre, motif: p.motif || '', statut: 'en_attente', cree_le: new Date().toISOString() });
        try { localStorage.setItem('infra_v2_demo_acces', JSON.stringify(lst)); } catch (e) {} return { numero: no, emails: 0 }; }
      case 'profil_correction': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); if (!String(p.valeur || '').trim()) throw erreur('Indiquez la valeur correcte.');
        var l4 = []; try { l4 = JSON.parse(localStorage.getItem('infra_v2_demo_acces') || '[]'); } catch (e) { l4 = []; }
        var n4 = 'ACC-DEMO-' + (l4.length + 1); l4.push({ numero: n4, email: demoState.user.email, agent: demoState.user.nom, titre: 'Correction de fiche : ' + p.champ + ' → ' + p.valeur, motif: p.motif || '', statut: 'en_attente', cree_le: new Date().toISOString() });
        try { localStorage.setItem('infra_v2_demo_acces', JSON.stringify(l4)); } catch (e) {} return { numero: n4, emails: 0 }; }
      case 'acces_demandes': { exigerAdmin(); var l2 = []; try { l2 = JSON.parse(localStorage.getItem('infra_v2_demo_acces') || '[]'); } catch (e) { l2 = []; } return { demandes: l2.slice().reverse() }; }
      case 'acces_traiter': { exigerAdmin(); var l3 = []; try { l3 = JSON.parse(localStorage.getItem('infra_v2_demo_acces') || '[]'); } catch (e) { l3 = []; }
        l3.forEach(function (x) { if (x.numero === p.numero) { x.statut = p.statut === 'refusee' ? 'refusee' : 'accordee'; x.traite_par = demoState.user.email; } });
        try { localStorage.setItem('infra_v2_demo_acces', JSON.stringify(l3)); } catch (e) {} return { numero: p.numero, statut: p.statut }; }
      case 'organigramme': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var gr = {}, ordre = [];
        DEMO_USERS.forEach(function (x) { var sv = demoService(x); if (!gr[sv]) { gr[sv] = { nom: sv, racine: false, membres: [] }; ordre.push(sv); }
          var chef = x.role === 'chef_division'; if (chef) gr[sv].racine = true;
          gr[sv].membres.push({ uid: x.uid, nom: x.nom, fonction: x.fonction || (chef ? 'Chef de division' : ''), dependance: x.dependance || '', role: x.role, chef: chef, telephone: '0555 00 00 0' + x.uid.slice(1) }); });
        var sv2 = ordre.map(function (k) { return gr[k]; }).sort(function (a, b) { return (b.racine ? 1 : 0) - (a.racine ? 1 : 0) || (a.nom < b.nom ? -1 : 1); });
        return { services: sv2, total: DEMO_USERS.length }; }
      case 'visavis_liste': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var vl = demoVav();
        return { personnes: DEMO_USERS.map(function (x) { var l = vl[x.uid] || {}; return { uid: x.uid, nom: x.nom, fonction: x.fonction || '', service: demoService(x), dependance: x.dependance || '', telephone: '0555 00 00 0' + x.uid.slice(1), vis_travail: l.vis_travail || '', vis_chambre: l.vis_chambre || '', modifiable: true }; }) }; }
      case 'visavis_enregistrer': { exigerAdmin(); var vm = demoVav(), vu = DEMO_USERS.map(function (x) { return x.uid; });
        if (vu.indexOf(p.uid) < 0) throw erreur('Personne inconnue');
        [['vis_travail', p.vis_travail], ['vis_chambre', p.vis_chambre]].forEach(function (c) { var v = c[1] || ''; if (v && vu.indexOf(v) < 0) throw erreur('Vis-à-vis inconnu'); if (v === p.uid) throw erreur('Un agent ne peut pas être son propre vis-à-vis');
          var cur = (vm[p.uid] || {})[c[0]] || ''; if (cur === v) return; (vm[p.uid] = vm[p.uid] || {})[c[0]] = v;
          if (v) { if (!(vm[v] || {})[c[0]]) (vm[v] = vm[v] || {})[c[0]] = p.uid; } else if (cur && (vm[cur] || {})[c[0]] === p.uid) vm[cur][c[0]] = ''; });
        sessionStorage.setItem('infra_v2_demo_vav', JSON.stringify(vm)); return { enregistres: 1 }; }
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
        return { niveau: 3, moi: demoState.user.uid, agents: DEMO_USERS.map(function (x) { return { uid: x.uid, nom: x.nom, service: x.service, fonction: x.fonction || '', dependance: x.dependance || 'SONATRACH', configuree: !!demoRots()[x.email], vis_travail: (demoVav()[x.uid] || {}).vis_travail || '', vis_chambre: (demoVav()[x.uid] || {}).vis_chambre || '' }; }) };
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
          var fin = plus(Simulation.dateReprise(mv), 2 * cy - 1), nn = ecart(F, fin) + cy + 1, off = demoGrilleDe(cv.email, F, nn), mod = Simulation.appliquer(off, F, mv, rv);
          var du = mv.debut; if (du > F) { var ii = ecart(F, du) - 1, cc = off.charAt(ii); while (ii > 0 && off.charAt(ii - 1) === cc) ii -= 1; du = plus(F, ii); }
          return { cv: cv, mv: mv, rq: Simulation.reliquatDetail(off, mod, F, mv), actuel: Simulation.tableau(off, F, du, plus(fin, cy)).filter(function (x) { return x.du <= fin; }).slice(0, 14), modifie: Simulation.tableau(mod, F, du, plus(fin, cy)).filter(function (x) { return x.du <= fin; }).slice(0, 14) };
        });
        var lm = demoMods(), numerosV = [], docsV = [];
        prepV.forEach(function (q) {
          var numero = 'MOD-' + new Date().getFullYear() + '-' + ('000' + (lm.length + 1)).slice(-4);
          var nm = { numero: numero, cree_le: new Date().toISOString(), email: q.cv.email, emetteur: demoState.user.email, motif: motifV, modif: q.mv, statut: 'en_attente', rq_net: q.rq.net, actuel: q.actuel, modifie: q.modifie };
          lm.push(nm); numerosV.push(numero); docsV.push(demoDoc(nm));
        });
        saveMods(lm); return { numero: numerosV[0], numeros: numerosV, emails: 0, demande: docsV[0], demandes: docsV }; }
      case 'simu_liste': { var lq = demoMods().slice().reverse().map(function (m) { var u2 = DEMO_USERS.filter(function (x) { return x.email === m.email; })[0] || {};
          return { numero: m.numero, cree_le: m.cree_le, agent: u2.nom, service: u2.service, debut: m.modif.debut, reprise_le: Simulation.dateReprise(m.modif), motif: m.motif, statut: m.statut,
                   emetteur: (DEMO_USERS.filter(function (x) { return x.email === m.emetteur; })[0] || {}).nom, decide_par: m.decide_par || '', decide_le: m.decide_le || '', commentaire: m.commentaire || '',
                   peut_decider: (m.statut === 'en_attente' || m.statut === 'appliquee') && demoState.user.role === 'chef_division' && m.email !== demoState.user.email,
                   peut_informer: (m.statut === 'approuvee' || m.statut === 'refusee') && demoState.user.role === 'chef_division',
                   peut_annuler: ['en_attente', 'appliquee', 'approuvee'].indexOf(m.statut) !== -1 && demoState.user.role === 'chef_division',
                   peut_supprimer: ['refusee', 'annulee', 'remplacee'].indexOf(m.statut) !== -1 && demoState.user.role === 'chef_division' }; });
        return { niveau: demoState.user.role === 'chef_division' ? 3 : 0, demandes: lq }; }
      case 'simu_demande': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var dm = demoMods().filter(function (m) { return m.numero === p.numero; })[0];
        if (!dm) throw erreur('Demande introuvable'); return { demande: demoDoc(dm) }; }
      case 'simu_annuler': { exigerAdmin(); var la = demoMods(), da = la.filter(function (m) { return m.numero === p.numero; })[0];
        if (!da) throw erreur('Demande introuvable'); if (['en_attente', 'appliquee', 'approuvee'].indexOf(da.statut) === -1) throw erreur('Seules les demandes en attente, appliquées ou approuvées peuvent être annulées.');
        da.statut = 'annulee'; da.decide_par = demoState.user.email; da.decide_le = new Date().toISOString(); da.commentaire = 'Annulée par erreur de saisie'; saveMods(la); return { demande: { numero: da.numero, statut: 'annulee' } }; }
      case 'simu_supprimer': { exigerAdmin(); var ls = demoMods(), nums = Array.isArray(p.numeros) ? p.numeros : [p.numero], sup = [];
        ls = ls.filter(function (m) { if (nums.indexOf(m.numero) !== -1 && ['refusee', 'annulee', 'remplacee'].indexOf(m.statut) !== -1) { sup.push(m.numero); return false; } return true; });
        if (!sup.length) throw erreur('Seules les demandes refusées, annulées ou remplacées peuvent être supprimées.'); saveMods(ls); return { supprimees: sup, ignorees: [] }; }
      case 'simu_decider': { exigerAdmin(); var ld = demoMods(), dd = ld.filter(function (m) { return m.numero === p.numero; })[0];
        if (!dd) throw erreur('Demande introuvable'); if (dd.statut !== 'en_attente' && dd.statut !== 'appliquee') throw erreur('Cette demande a déjà été traitée');
        if (p.decision !== 'approuvee' && p.decision !== 'refusee') throw erreur('Décision invalide');
        dd.statut = p.decision; dd.decide_par = demoState.user.email; dd.decide_le = new Date().toISOString(); dd.commentaire = String(p.commentaire || ''); saveMods(ld);
        return { demande: { numero: dd.numero, statut: dd.statut }, emails: 0 }; }
      case 'planning_initial': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var emI = p.email || demoState.user.email; if (p.email && p.email !== demoState.user.email) exigerAdmin();
        var rotI = { statut: p.statut, depuis: p.depuis, jours_travail: Number(p.jours_travail), jours_repos: Number(p.jours_repos), reliquat: Number(p.reliquat) || 0 };
        if (rotI.statut !== 'T' && rotI.statut !== 'R') throw erreur('Indiquez si vous êtes en travail ou en repos'); if (!/^\d{4}-\d{2}-\d{2}$/.test(rotI.depuis || '') || rotI.depuis > auj()) throw erreur('Date invalide');
        var psI = Array.isArray(p.periodes) ? p.periodes : [], l1I = psI.length ? psI[0].jours : (rotI.statut === 'T' ? rotI.jours_travail : rotI.jours_repos);
        var l2I = psI.length > 1 ? psI[1].jours : (rotI.statut === 'T' ? rotI.jours_repos : rotI.jours_travail);
        if (plus(rotI.depuis, l1I + l2I - 1) < auj()) throw erreur('Date de début trop ancienne : indiquez le début de la rotation en cours (ou de la précédente)');
        var lmI = demoMods(); lmI.forEach(function (x) { if (x.email === emI) { if (x.statut === 'initial') x.statut = 'remplacee'; else if (x.statut === 'appliquee') x.statut = 'annulee'; } });
        if (psI.length) lmI.push({ numero: 'INI-' + (lmI.length + 1), cree_le: new Date().toISOString(), email: emI, emetteur: demoState.user.email, motif: 'Planning de départ', modif: { debut: rotI.depuis, periodes: psI, reprise: Simulation.autre(psI[psI.length - 1].type) }, statut: 'initial', rq_net: 0 });
        saveMods(lmI); var rtI = demoRots(); rtI[emI] = rotI; saveRots(rtI); return { acces: true, configuree: true, reliquat: rotI.reliquat, reliquat_renseigne: true }; }
      case 'planning_effacer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var emE = p.email || demoState.user.email; if (p.email && p.email !== demoState.user.email) exigerAdmin();
        var rtE = demoRots(); if (!rtE[emE]) throw erreur('Aucun planning à effacer'); delete rtE[emE]; saveRots(rtE);
        var lmE = demoMods(); lmE.forEach(function (x) { if (x.email === emE) x.statut = 'annulee'; }); saveMods(lmE); return { ok: true }; }
      case 'modif_moi_donnees': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); return demoModifDonnees(demoState.user.email); }
      case 'modif_agent_donnees': { exigerAdmin(); var ma = p.numero ? demoMods().filter(function (m) { return m.numero === p.numero; })[0] : null; if (p.numero && !ma) throw erreur('Demande introuvable');
        var emA = ma ? ma.email : p.email, uA = DEMO_USERS.filter(function (x) { return x.email === emA; })[0]; if (!uA) throw erreur('Agent inconnu');
        var da = demoModifDonnees(emA); da.agent = uA.nom; da.uid = uA.uid; da.email = uA.email; if (ma) { da.numero = ma.numero; da.en_cours_modif = ma.modif; } return da; }
      case 'modif_moi': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var em = demoState.user.email, rm = demoRots()[em]; if (!rm) throw erreur('Renseignez d\'abord votre rotation');
        var mm = { debut: p.debut, periodes: p.periodes, reprise: p.reprise }, evm = Simulation.valider(mm, rm, auj()); if (evm) throw erreur(evm);
        var lmm = demoMods(), cym = rm.jours_travail + rm.jours_repos, Fm = plus(mm.debut, -(cym + 30)); if (Fm < rm.depuis) Fm = rm.depuis;
        var nm2 = ecart(Fm, plus(Simulation.dateReprise(mm), 2 * cym)) + 1, offm = demoGrilleDe(em, Fm, nm2, true), modm = Simulation.appliquer(offm, Fm, mm, rm), vigm = demoGrilleDe(em, Fm, nm2);
        for (var im = 0; im < nm2; im += 1) if (plus(Fm, im) <= auj() && modm.charAt(im) !== vigm.charAt(im)) throw erreur('Les jours déjà passés ne peuvent pas être modifiés : commencez à la prochaine rotation');
        if (modm === offm) throw erreur('Aucune modification par rapport à votre planning');
        var rtm = Simulation.retour(demoGrille(rm, Fm, nm2), modm, Fm, cym), rqm = Simulation.reliquatDetail(offm, modm, Fm, mm);
        lmm.forEach(function (x) { if (x.email === em && x.statut === 'appliquee') { x.statut = 'remplacee'; } });
        var numm = 'MOD-' + new Date().getFullYear() + '-' + ('000' + (lmm.length + 1)).slice(-4);
        lmm.push({ numero: numm, cree_le: new Date().toISOString(), email: em, emetteur: em, motif: String(p.motif || 'Demande de l\'agent'), modif: mm, statut: 'appliquee', rq_net: rqm.net, hors: !rtm.ok, actuel: [], modifie: [] }); saveMods(lmm);
        return { numero: numm, statut: 'appliquee', hors_rotation: !rtm.ok, retour: rtm, reliquat: rqm.pic, reliquat_net: rqm.net }; }
      case 'modif_moi_annuler': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var lan = demoMods(), ean = lan.filter(function (x) { return x.email === demoState.user.email && x.statut === 'appliquee'; })[0];
        if (!ean) throw erreur('Aucune demande en cours'); ean.statut = 'annulee'; saveMods(lan); return { numero: ean.numero }; }
      case 'modif_alertes': { if (!demoState.user) throw erreur('Session expirée', 'SESSION');
        var mesd = demoMods().filter(function (x) { return (x.statut === 'appliquee' || x.statut === 'en_attente') && x.email === demoState.user.email; }).map(function (x) { return { numero: x.numero, debut: x.modif.debut, motif: x.motif, statut: x.statut }; });
        if (demoState.user.role !== 'chef_division') return { niveau: 0, alertes: [], mes: mesd };
        return { niveau: 3, alertes: demoMods().filter(function (x) { return (x.statut === 'appliquee' || x.statut === 'en_attente') && x.email !== demoState.user.email; }).reverse().map(function (x) {
          var u3 = DEMO_USERS.filter(function (y) { return y.email === x.email; })[0] || {};
          return { numero: x.numero, agent: u3.nom, service: u3.service, debut: x.modif.debut, motif: x.motif, statut: x.statut, hors_rotation: !!x.hors, peut_decider: true }; }).sort(function (a, b) { return (b.hors_rotation ? 1 : 0) - (a.hors_rotation ? 1 : 0); }), mes: mesd }; }
      case 'simu_envoyer': { if (!demoState.user) throw erreur('Session expirée', 'SESSION'); var cs = p.destinataires || {}, nb = (cs.secretariat ? 1 : 0) + (cs.chef_service ? 1 : 0) + (cs.chef_division ? 1 : 0) + (cs.agent ? 1 : 0);
        if (!nb) throw erreur('Cochez au moins un destinataire (ou aucune adresse trouvée)'); return { emails: nb }; }
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
    return { uid: u.uid, email: u.email, nom: u.nom, civilite: (demoProfil[u.email] || {}).civilite || u.civilite || '', matricule: (demoProfil[u.email] || {}).matricule || u.matricule || (u.role === 'chef_division' ? '10002B' : ''), role: u.role, role_libelle: ({ chef_division: 'Chef de division', conducteur: 'Conducteur des travaux', cpm: 'Cellule Passation de marché', agent: 'Agent' })[u.role] || u.role,
             service: u.service, fonction: u.fonction || '', dependance: u.dependance || 'SONATRACH', telephone: (demoProfil[u.email] || {}).telephone || u.telephone || '',
             sona: u.sona || ('sona' + (10000 + Number(String(u.uid).slice(1)))), date_integration: (demoProfil[u.email] || {}).date_integration || u.date_integration || '2025-03-17',
             wifi_user: ((demoProfil[u.email] || {}).wifi_user) || 'wf.' + String(u.email).split('@')[0], sap: (demoProfil[u.email] || {}).sap || '', nin_masque: masquerNin((demoProfil[u.email] || {}).nin), nin_renseigne: !!(demoProfil[u.email] || {}).nin,
             nom_affiche: (demoProfil[u.email] || {}).nom_affiche || u.nom, photo: !!(demoProfil[u.email] || {}).photo };
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
      if (this._reprise) return this._reprise; // plusieurs appels en parallèle : une seule reprise (le jeton « rester connecté » change à chaque fois)
      var fin = function () { self._reprise = null; };
      this._reprise = this.call('reprendre', { rt: rt }).then(function (r) {
        self.setToken(r.token); if (r.remember) self.setRemember(r.remember); return true;
      }).catch(function (e) { if (e.code === 'SESSION') self.setRemember(''); return false; });
      this._reprise.then(fin, fin);
      return this._reprise;
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
      // Google répond parfois par une page HTML (surcharge, quota, panne brève) au lieu du JSON : on le dit clairement, et les lectures sont rejouées.
      function appeler(essai) {
        return fetch(window.GATEWAY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) })
          .then(function (r) { return r.text().then(function (t) {
            try { return JSON.parse(t); } catch (x) {
              var brut = String(t).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
              var e = erreur('Le serveur Google n\'a pas répondu correctement' + (brut ? ' (« ' + brut + ' »)' : '') + '. Réessayez dans un instant.', 'SERVEUR'); e.rejouable = true; throw e;
            }
          }); })
          .catch(function (e) {
            if ((e.rejouable || e instanceof TypeError) && LECTURE.test(action) && essai < 3) return new Promise(function (ok) { setTimeout(ok, 700 * essai); }).then(function () { return appeler(essai + 1); });
            if (e instanceof TypeError) throw erreur('Connexion au serveur impossible : vérifiez le réseau.', 'RESEAU');
            throw e;
          });
      }
      return appeler(1)
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
