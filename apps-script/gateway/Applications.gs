/**
 * Catalogue des applications (onglet « Applications » : module, titre, description, emoji, url, niveau_min).
 * Amorçage depuis l'accueil actuel ; les liens pointent d'abord vers les ORIGINAUX, puis
 * pointerVersCopies() les remplace par les copies de l'organisation v2 (via Registre_Migration).
 */
var SEED_APPS = [
 ["badges", "Badges prestataires", "Prépare et imprime les badges des prestataires (recto-verso, A4), numérotation automatique et historique de tout ce qui a été imprimé. Entreprises et contrats lus dans le CPM, noms et fonctions dans les Enquêtes administratives.", "🪪", "badges.html", 1, ""],
 ["rapports", "Rapports journaliers", "Saisie du rapport du jour par chantier (effectif, travaux, difficultés, commentaire) et suivi par la hiérarchie.", "📝", "rapports.html", 1],
 ["planning", "Planning & rotations", "Votre planning et, selon vos droits, celui de la division : 1 mois, 3 mois, 6 mois, 1 an.", "🗓️", "planning.html", 1],
 ["affectation", "Affectation du personnel", "Changez le service d'une personne directement dans l'Organigramme (BDDORGA) et dans le portail, avec historique et e-mail à l'intéressé, au chef de division et au secrétariat.", "🔀", "affectation.html", 2],
 ["simulation", "Simulation de planning", "Testez une modification de rotation sans rien enregistrer, mettez deux agents en vis-à-vis, puis émettez la demande de modification à signer.", "🧪", "simulation.html", 1],
 ["admin", "Contrôle de l'annuaire", "Compare les fiches contact avec BDDORGA et liste les divergences (téléphone, e-mail, matricule, identifiant SONA, employeur) pour les corriger.", "🔎", "divergences.html", 3, "secretariat"],
 ["admin", "Gestion des privilèges", "Rôles, droits par module, exceptions individuelles, comptes et codes de secours.", "🛡️", "privileges.html", 3, "secretariat"],
 [
  "logistique",
  "Prises en Charge + Autorisation d'Accès",
  "Application unifiée et intelligente regroupant la création, la vérification et le suivi des prises en charge ainsi que des autorisations d'accès. Des fragments d'intelligence artificielle ont été utilisés pour automatiser la saisie et accélérer le traitement des dossiers.",
  "🧾🪪",
  "prise-en-charge.html",
  1
 ],
 [
  "logistique",
  "Demande de réservation",
  "Réservation de places d'avion ALGER ⇄ RNS : le nombre de personnes crée les lignes, le nom se choisit dans l'organigramme (fonction et société se remplissent seules, mention « Rattaché à la division Infra » hors SONATRACH) et le bouton Envoyer adresse la demande au secrétariat.",
  "✈️",
  "reservation.html",
  1
 ],
 [
  "logistique",
  "Affectation Véhicule – Division Infra",
  "Suivi des véhicules de service, affectations au personnel et gestion des plannings de disponibilité.",
  "🚗",
  "https://docs.google.com/spreadsheets/d/1pvGALmksWQ-oLkxXrv74yjZk6QGyVbqHzgWfc6ol6SE/edit?usp=sharing",
  1
 ],
 [
  "logistique",
  "Table Stock Magasin RNS",
  "Inventaire détaillé des stocks du magasin RNS avec double codification pour une traçabilité complète des articles.",
  "📦",
  "https://docs.google.com/spreadsheets/d/1OnDa-w4dyb2t1QyRk0DpoSJR5cmjJ9R1/edit?usp=sharing&ouid=114100570299093678332&rtpof=true&sd=true",
  1
 ],
 [
  "logistique",
  "Suivi des Écarts Inventaire",
  "Contrôle et analyse des écarts matériels entre inventaire théorique et réel pour correction et régularisation.",
  "⚖️",
  "https://docs.google.com/spreadsheets/d/1VOKT3OrWK3MVA9duOQxI2y--SDWuBB2O/edit?gid=1567107022#gid=1567107022",
  1
 ],
 [
  "logistique",
  "Liste Radio INFRA RNS",
  "Répertoire complet des équipements radio, fréquences et affectations au sein de la division Infrastructure RNS.",
  "📡",
  "https://docs.google.com/spreadsheets/d/1REasn3g8Tg77GldihvZFeDu6vtAIkm2clJNnjYeVajk/edit",
  1
 ],
 [
  "logistique",
  "Statistiques Sous-traitants – Avril 2026",
  "Compilation des données statistiques sur les sous-traitants : effectifs déployés, missions réalisées et indicateurs de performance.",
  "📊",
  "https://docs.google.com/spreadsheets/d/1_qZp9x1cgeq9dzZpJU4Bdpz1BGnuav02/edit?usp=sharing&ouid=114100570299093678332&rtpof=true&sd=true",
  1
 ],
 [
  "logistique",
  "Commande de Pièces – Service Électromécanique",
  "Application de commande de pièces détachées pour le service Électromécanique, avec suivi des demandes et de leur traitement.",
  "🔩",
  "https://script.google.com/macros/s/AKfycbwNIhTZ7NwMJfoAVeDjpUEC6mriA85kcd0lz9l2hFFyU4DXJi2KoctyXXWFRAhDpvRA/exec",
  1
 ],
 [
  "logistique",
  "Requête de transport de personnel",
  "Requête de transport de personnel de la division Infrastructure : les personnes se choisissent dans BDDORGA (nom et téléphone repris), le nombre se calcule seul ; document prêt à imprimer en un clic.",
  "🚚",
  "documents.html#transport",
  1
 ],
 [
  "logistique",
  "Bon de sortie matériel",
  "Établit le bon de sortie de matériel (personnes choisies dans BDDORGA, matériel en chiffre et en lettre, lieux, visas), génère le PDF et l'envoie par e-mail ou à l'imprimante.",
  "📦",
  "https://script.google.com/macros/s/AKfycbyFYSS2YZN0TqEvtkpT9FeezZybqlZ2bTPrycZSwM5qUCXfFgoa_zHBl9nM9m8a0m7xMA/exec",
  1
 ],
 [
  "rh",
  "Feuille de pointage",
  "Feuille de pointage hebdomadaire de la division (semaine du … au …, matin et soir) : noms et fonctions de BDDORGA pour l'effectif de la division uniquement (les autres sont à l'atelier), imprimable en un clic.",
  "🗓️",
  "pointage.html",
  1
 ],
 [
  "rh",
  "Documents administratifs",
  "Ordres de mission, demandes de prêt, de mutation, de primes, attestations… : 25 formulaires de la Direction Régionale préremplis avec vos informations, prêts à imprimer ou à enregistrer en PDF.",
  "📄",
  "documents.html",
  1
 ],
 [
  "rh",
  "Renommage de documents",
  "Renomme les PDF, JPG et scans (type de document, agent, dates) selon les règles de la division, et apprend de vos corrections au fil de l'eau. Les fichiers restent sur votre ordinateur.",
  "🏷️",
  "renommage.html",
  1
 ],
 [
  "logistique",
  "Fiche d'évaluation",
  "Fiche d'évaluation mensuelle des travaux et prestations : cartouche remplie depuis le Suivi CPM, cases à cliquer, taux de satisfaction calculé automatiquement, PDF et archive des fiches éditées.",
  "📝",
  "https://script.google.com/macros/s/AKfycbzHk520IN5bl93shq4y1tArmIbWt3dvkITqvvx-qWUpkpS-lKA9R7z19BbTUAu-KZJd/exec",
  2
 ],
 [
  "logistique",
  "Autorisation GAZ-OIL",
  "Autorisation d'approvisionnement en GAZ-OIL (fûts) pour une entreprise : la quantité en litres est divisée en fûts de 200 L automatiquement ; impression en un clic et historique.",
  "⛽",
  "autorisation-gazoil.html",
  1
 ],
 [
  "logistique",
  "Ordre de travail",
  "Ordre de travail de la division (Division, Lieu et Imputation de l'Infrastructure par défaut, modifiables) : équipement, description, pièces de rechange, agents intervenants, approbations ; impression en un clic et historique.",
  "🛠",
  "ordre-travail.html",
  1
 ],
 [
  "rapports",
  "Affectation chantier",
  "Indiquez le service de chaque chantier (les conducteurs ne voient que ceux de leur service), activez ou désactivez un chantier et synchronisez la liste avec les contrats en exécution du Suivi CPM.",
  "🔀",
  "affectation-chantier.html",
  3
 ],
 [
  "badges",
  "Fichier des habilitations",
  "Extraction en vrac du fichier des Enquêtes administratives : choisissez les entreprises, la période de prise en charge et les colonnes à afficher, puis imprimez ou exportez en Excel.",
  "🗃️",
  "habilitations.html",
  1
 ],
 [
  "logistique",
  "Prise en charge hôtel",
  "Demande de prise en charge à l'hôtel (ex. Hôtel PLAZA à Boumerdes) pour un agent en mission : identité, ordre de mission, dates, nuitées calculées automatiquement, objet et imputation ; impression en un clic et historique.",
  "🏨",
  "hotel-prise-en-charge.html",
  1
 ],
 [
  "logistique",
  "Repas à emporter",
  "Prise en charge « repas à emporter » prête à imprimer : désignations, date, nombre de personnes, imputation analytique et observations, avec historique des prises en charge établies.",
  "🥡",
  "repas-emporter.html",
  1
 ],
 [
  "logistique",
  "Dotation Vivres & Eau Minérale",
  "Génération des fiches de dotation (vivres et eau minérale) pour le personnel présent, avec durées et quantités calculées automatiquement selon le service.",
  "🍞💧",
  "https://script.google.com/macros/s/AKfycbzwhfoD33zKvmQ2Vv_XhNJWIAMWlBys3NbfolmI_SXc5wFoaxptw-leI18IaHK8sC7M/exec",
  1
 ],
 [
  "pilotage",
  "Rapport Hebdomadaire Infra",
  "Suivi régulier des activités et avancement des projets. Synthèse hebdomadaire destinée à la direction.",
  "📈",
  "https://docs.google.com/presentation/d/1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20/edit?slide=id.p1#slide=id.p1",
  1
 ],
 [
  "pilotage",
  "Avancement Chantiers",
  "Tableau de bord global des chantiers d'infrastructure en cours, suivi de l'avancement physique et financier en temps réel.",
  "📊",
  "Avancement_des_Chantiers.html",
  1
 ],
 [
  "pilotage",
  "Suivi Chantier",
  "Suivi détaillé chantier par chantier : jalons, documents et état d'avancement consolidé.",
  "🗂️",
  "Suivi_Chantier.html",
  1
 ],
 [
  "pilotage",
  "Suivi des Tâches Journalières",
  "Planification et contrôle quotidien des activités opérationnelles. Tableau de suivi individuel et collectif.",
  "✅",
  "https://docs.google.com/spreadsheets/d/1Jlz8LmaawE4Fz7Dj1opxkg9kuk4G5fsO0UP4FOiRRWc/edit?usp=sharing",
  1
 ],
 [
  "pilotage",
  "Imputation SH RNS",
  "Répartition analytique des charges et imputations financières liées aux projets Sonatrach RNS.",
  "💰",
  "https://docs.google.com/spreadsheets/d/1LibEVNdujTDHAaGXz-EUh4oJr2SqXR2X0Q0wO2KDeoQ/edit?usp=sharing",
  1
 ],
 [
  "cpm",
  "Suivi CPM V5",
  "Préparation et suivi des projets via l'outil CPM. Gestion des délais, jalons et livrables des projets d'infrastructure.",
  "📋",
  "https://docs.google.com/spreadsheets/d/1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I/edit?usp=sharing",
  1
 ],
 [
  "cpm",
  "Dossiers CPM — Détail",
  "Fiche détaillée de chaque cahier des charges, regroupée par statut : attribution, contrat, coordonnées fournisseur et échéances.",
  "🗂️",
  "Dossiers_CPM.html",
  1
 ],
 [
  "cpm",
  "Vivier des Entreprises",
  "Vivier des prestataires, sous-traitants et partenaires : recherche par activité, ajout, correction et suppression d'une entreprise directement dans le portail.",
  "🏢",
  "vivier.html",
  1
 ],
 [
  "cpm",
  "Passation des Contrats — Outils CPM",
  "Portail Sonatrach Activité EP dédié à la passation des marchés : suivi et gestion des dossiers de contrats au niveau national.",
  "📑",
  "http://10.180.4.195/",
  1
 ],
 [
  "simulation",
  "Organigramme — Division Infrastructure",
  "Structure de la division, à jour avec BDDORGA : services, responsables, employeurs et téléphones (se met à jour à chaque affectation).",
  "🏢",
  "Organigramme.html",
  1
 ],
 [
  "rh",
  "Personnel de Permanence",
  "Gestion et planification des équipes de permanence, rotation des gardes et astreintes de la division.",
  "🌙",
  "https://docs.google.com/document/d/1_WTKk5_-nbKyR0yk7fE6bKiCku2ZtCez/edit?usp=sharing&ouid=114100570299093678332&rtpof=true&sd=true",
  1
 ],
 [
  "rh",
  "Planning de Formation",
  "Suivi des sessions de formation, planification des participants et évaluation des compétences acquises.",
  "🎓",
  "https://docs.google.com/spreadsheets/d/1KOoUvkV6DOXID9gRKohh7FJ0lA3p9PNOyFnjSNben0g/edit?usp=sharing",
  1
 ],
 [
  "rh",
  "Catalogue Formation",
  "Répertoire complet des formations disponibles, programmes, durées et organismes prestataires agréés.",
  "📚",
  "https://docs.google.com/spreadsheets/d/1v3SVsW36asErrhxIkHUuSFZCN0XA6RsjFcoOJO1Z0OA/edit?usp=sharing",
  1
 ],
 [
  "rh",
  "Planning de Visite Médicale",
  "Organisation et suivi des visites médicales obligatoires et périodiques pour le personnel de la division.",
  "🩺",
  "https://docs.google.com/spreadsheets/d/1Uq_WkNxu5fdaN9p_JEo4BPKpXEHKUMHC/edit?usp=sharing&ouid=100581094853869883670&rtpof=true&sd=true",
  1
 ],
 [
  "rh",
  "Veste en Cuir – Personnel Actif RNS",
  "Suivi de la distribution des équipements vestimentaires (vestes en cuir) au personnel actif de la région RNS.",
  "🧥",
  "https://docs.google.com/spreadsheets/d/10NA8xSQbbLpAK10dao1fLRNVVjUQGYsc/edit?usp=sharing&ouid=114100570299093678332&rtpof=true&sd=true",
  1
 ],
 [
  "rh",
  "Vidéos Formation SAP",
  "Ensemble des vidéos de formation SAP enregistrées, accessibles pour consultation et auto-formation du personnel.",
  "🎥",
  "https://drive.google.com/drive/folders/1b8JgLaV1lxF1wdgHTHSkA9XBTp7m46y6",
  1
 ],
 [
  "admin",
  "Suivi des Instances Courriers",
  "Gestion et traçabilité des courriers en attente de traitement, suivi des réponses et archivage des échanges officiels.",
  "📬",
  "https://docs.google.com/spreadsheets/d/1t9-Rks2tOPYAvwKBKM65mAOsSo5lzsSVyp4HrFayPc8/edit?usp=sharing",
  1
 ],
 [
  "admin",
  "Passation des Consignes",
  "Outil dédié au secrétariat pour la formalisation et transmission des consignes entre équipes lors des changements de poste.",
  "📝",
  "https://docs.google.com/spreadsheets/d/1yREJ3dZWTBv7g4UPiDUEB9Rd5WWxAMKcOb6mfvzbrNE/edit?hl=fr&gid=0#gid=0",
  1
 ],
 [
  "admin",
  "Ordres de Mission",
  "Plateforme dédiée à la création et à la gestion des ordres de mission du personnel de la division Infrastructure.",
  "🧳",
  "http://10.2.0.7:8070/login/",
  1
 ],
 [
  "admin",
  "HELPDESK Ticket support IT",
  "Support informatique & cybersécurité — création et suivi des tickets d'incidents et de demandes auprès de l'équipe IT (ManageEngine ServiceDesk Plus).",
  "🎧",
  "http://10.2.0.23/HomePage.do?view_type=my_view",
  1
 ],
 [
  "securite",
  "Accès, Partage & Privilèges",
  "Gestion centralisée des droits d'accès aux dossiers et fichiers, contrôle des niveaux de partage et des autorisations par profil.",
  "🗂️",
  "https://docs.google.com/spreadsheets/d/1QmrWV8Qg174ZEq5m8DaECI_h2Pjg74kiFJH7V-yf87c/edit?usp=sharing",
  1
 ],
 [
  "securite",
  "Email en Quarantaine (anti-spam)",
  "Quarantaine anti-spam / anti-virus des e-mails — à consulter pour retrouver un message reçu de l'extérieur de Sonatrach (expéditeur externe) bloqué par le filtre.",
  "📧",
  "https://quarantaine.sonatrach.dz/brightmail/",
  1
 ]
];

function amorcerApplications() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
  if (sh.getLastRow() > 1) throw new Error('Onglet Applications déjà rempli.');
  sh.getRange(2, 1, SEED_APPS.length, 7).setValues(SEED_APPS.map(function (r) { return r.length >= 7 ? r : r.concat(['']); }));
}

/** Remplace, dans les URL du catalogue, l'identifiant de chaque fichier original par celui de sa copie. */
function pointerVersCopies() {
  var it = DriveApp.getFilesByName('Registre_Migration');
  if (!it.hasNext()) throw new Error('Registre_Migration introuvable (lancer migrer() d\'abord).');
  var reg = SpreadsheetApp.open(it.next()).getSheets()[0].getDataRange().getValues().slice(1)
    .filter(function (l) { return l[4] === 'OK' && l[0] && l[1]; });
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
  var v = sh.getDataRange().getValues(); var iU = v[0].indexOf('url'); var n = 0;
  for (var i = 1; i < v.length; i += 1) {
    var u = String(v[i][iU]);
    reg.forEach(function (l) { if (u.indexOf(l[0]) !== -1) { u = u.split(l[0]).join(l[1]); n += 1; } });
    v[i][iU] = u;
  }
  sh.getRange(1, 1, v.length, v[0].length).setValues(v);
  Logger.log(n + ' lien(s) redirigé(s) vers les copies.');
}

/** Ajoute au catalogue les applications de SEED_APPS qui n'y figurent pas encore (par titre) : utile après une mise à jour. */
function ajouterApplicationsManquantes() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
  var lignes = sh.getDataRange().getValues().slice(1);
  var existants = lignes.map(function (l) { return String(l[1]); });
  var pages = lignes.map(function (l) { return String(l[4]); }); // une page du site (ex. planning.html) ne doit figurer qu'une fois, même renommée
  var nouveaux = SEED_APPS.filter(function (r) { return existants.indexOf(String(r[1])) === -1 && !(/^[\w\-]+\.html$/.test(String(r[4])) && pages.indexOf(String(r[4])) !== -1); });
  if (nouveaux.length) sh.getRange(sh.getLastRow() + 1, 1, nouveaux.length, 7).setValues(nouveaux.map(function (r) { return r.length >= 7 ? r : r.concat(['']); }));
  Logger.log(nouveaux.length + ' application(s) ajoutée(s).');
}

/**
 * Range la carte « Gestion des privilèges » dans le module Administration, visible du seul rôle « secrétariat »
 * (la page elle-même exige le niveau 3 sur « Sécurité & Accès », que seul le secrétariat a par défaut).
 */
function rangerCartes() {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications');
  var v = sh.getDataRange().getValues(); var h = v[0].map(String);
  var iM = h.indexOf('module'), iU = h.indexOf('url'), iN = h.indexOf('niveau_min'), iR = h.indexOf('roles');
  var n = 0;
  // Doublons : une même page du site (ex. planning.html) ne garde qu'une carte (la première) ; les autres lignes sont supprimées.
  var vues = {}, doublons = [];
  for (var d = 1; d < v.length; d += 1) {
    var page = String(v[d][iU]);
    if (!/^[\w\-]+\.html$/.test(page)) continue;
    if (vues[page]) doublons.push(d + 1); else vues[page] = true;
  }
  doublons.reverse().forEach(function (ligne) { sh.deleteRow(ligne); });
  if (doublons.length) { Logger.log(doublons.length + ' carte(s) en double supprimée(s).'); v = sh.getDataRange().getValues(); }
  for (var i = 1; i < v.length; i += 1) {
    if (String(v[i][iU]) === 'privileges.html') {
      sh.getRange(i + 1, iM + 1).setValue('admin'); sh.getRange(i + 1, iN + 1).setValue(3); if (iR >= 0) sh.getRange(i + 1, iR + 1).setValue('secretariat'); n += 1;
    }
  }
  CacheService.getScriptCache().remove('TBL_Applications');
  Logger.log(n + ' carte(s) rangée(s) dans Administration.');
}


/**
 * Fusionne, une seule fois, les deux anciennes cartes « Vivier des Entreprises » (Google Sheet) et « Inscription au Vivier des Entreprises » (Google Form)
 * en une seule carte vers vivier.html. Ne touche à aucune autre ligne ni au contenu de la feuille ou du formulaire.
 */
function fusionnerVivier_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('VIVIER_V1') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), v = sh.getDataRange().getValues();
    var garde = 0, suppr = [];
    for (var i = 1; i < v.length; i += 1) {
      var url = String(v[i][4]), titre = String(v[i][1]);
      if (url === 'vivier.html') { garde = garde || i + 1; continue; }
      if (/1olPzVux6UclQVytVphOIFFvIxCEbhfgUJieqwipls7g/.test(url) || /1l-6f3oqFmToPe7MFd78wq6gxfcrw2rZNrNntVR1k2FY/.test(url) || /^(Inscription au )?Vivier des Entreprises$/.test(titre)) {
        if (!garde && /^Vivier des Entreprises$/.test(titre)) { garde = i + 1; sh.getRange(i + 1, 3).setValue("Vivier des prestataires, sous-traitants et partenaires : recherche par activité, ajout, correction et suppression d'une entreprise directement dans le portail."); sh.getRange(i + 1, 5).setValue('vivier.html'); }
        else suppr.push(i + 1);
      }
    }
    suppr.reverse().forEach(function (l) { sh.deleteRow(l); });
    props.setProperty('VIVIER_V1', '1');
    ['TBL_Applications'].forEach(function (k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} });
  } catch (e) { /* on réessaiera à la requête suivante */ }
}


/**
 * Retire, une seule fois, les cartes « Prestataires présents sur site » (page supprimée, remplacée par le Fichier des habilitations)
 * et « Enquêtes Administratives » (lien direct vers la feuille Google : le fichier s'ouvre désormais depuis le Fichier des habilitations, réservé aux chefs et au secrétariat).
 */
function retirerCartesEnquetes_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ENQ_CARTES_V1') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), v = sh.getDataRange().getValues(), suppr = [];
    for (var i = 1; i < v.length; i += 1) {
      var url = String(v[i][4]), titre = String(v[i][1]);
      if (url === 'presents.html' || /^Enquêtes Administratives/.test(titre)) suppr.push(i + 1);
    }
    suppr.reverse().forEach(function (l) { sh.deleteRow(l); });
    props.setProperty('ENQ_CARTES_V1', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}


/**
 * Une seule fois : la carte « Prises en Charge + Autorisation d'Accès » ouvre désormais la page du portail (prise-en-charge.html, derrière la connexion)
 * au lieu de l'ancienne application ouverte à toute personne ayant le lien ; l'ancienne reste en carte « ancienne version », réservée au secrétariat.
 */
function migrerPriseEnCharge_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PEC_PORTAIL_V1') === '1' || props.getProperty('PEC_PORTAIL_PRET') !== '1') return;   // tant que les autorisations Docs / Drive ne sont pas accordées (autoriserPriseEnCharge), la carte garde l'ancienne application
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), v = sh.getDataRange().getValues(), h = v[0].map(String), iU = h.indexOf('url'), iT = h.indexOf('titre');
    var ancien = '';
    for (var i = 1; i < v.length; i += 1) {
      if (/^Prises en Charge \+ Autorisation/.test(String(v[i][iT])) && /script\.google\.com\/macros/.test(String(v[i][iU]))) { ancien = String(v[i][iU]); sh.getRange(i + 1, iU + 1).setValue('prise-en-charge.html'); break; }
    }
    props.setProperty('PEC_PORTAIL_V1', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}


/** Une seule fois : retire du catalogue la carte « Prises en Charge (ancienne version) » (l'ancienne application web n'existe plus). */
function retirerAnciennePec_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PEC_ANCIENNE_RETIREE') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), v = sh.getDataRange().getValues(), h = v[0].map(String), iU = h.indexOf('url'), iT = h.indexOf('titre'), suppr = [];
    for (var i = 1; i < v.length; i += 1) if (/^Prises en Charge \(ancienne version\)/.test(String(v[i][iT])) || (/script\.google\.com\/macros/.test(String(v[i][iU])) && /^Prises en Charge/.test(String(v[i][iT])))) suppr.push(i + 1);
    suppr.reverse().forEach(function (l) { sh.deleteRow(l); });
    props.setProperty('PEC_ANCIENNE_RETIREE', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}


/** Une seule fois : la carte « Générateur Requête Transport » (ancienne application externe) ouvre désormais le modèle « Requête de transport de personnel » du portail (documents.html#transport). */
function migrerRequeteTransport_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('TRANSPORT_PORTAIL_V1') === '1') return;
  try {
    var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), v = sh.getDataRange().getValues(), h = v[0].map(String), iT = h.indexOf('titre'), iD = h.indexOf('description'), iU = h.indexOf('url');
    for (var i = 1; i < v.length; i += 1) {
      if (/^Générateur Requête Transport/.test(String(v[i][iT]))) {
        sh.getRange(i + 1, iT + 1).setValue('Requête de transport de personnel'); sh.getRange(i + 1, iU + 1).setValue('documents.html#transport');
        sh.getRange(i + 1, iD + 1).setValue(SEED_APPS.filter(function (r) { return r[1] === 'Requête de transport de personnel'; })[0][2]); break;
      }
    }
    props.setProperty('TRANSPORT_PORTAIL_V1', '1');
    try { CacheService.getScriptCache().remove('TBL_Applications'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}
