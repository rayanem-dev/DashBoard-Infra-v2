/**
 * Catalogue des applications (onglet « Applications » : module, titre, description, emoji, url, niveau_min).
 * Amorçage depuis l'accueil actuel ; les liens pointent d'abord vers les ORIGINAUX, puis
 * pointerVersCopies() les remplace par les copies de l'organisation v2 (via Registre_Migration).
 */
var SEED_APPS = [
 ["securite", "Gestion des privilèges", "Rôles, droits par module, exceptions individuelles, comptes et codes de secours.", "🛡️", "privileges.html", 3],
 [
  "logistique",
  "Prises en Charge + Autorisation d'Accès",
  "Application unifiée et intelligente regroupant la création, la vérification et le suivi des prises en charge ainsi que des autorisations d'accès. Des fragments d'intelligence artificielle ont été utilisés pour automatiser la saisie et accélérer le traitement des dossiers.",
  "🧾🪪",
  "https://script.google.com/macros/s/AKfycbyda46CXhmCrzE9MOvR7ARj77gsrS8BHgiekhInVJrgNwQi1rO2Tc9XnPktopvLEsX4/exec",
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
  "https://docs.google.com/spreadsheets/u/0/d/1REasn3g8Tg77GldihvZFeDu6vtAIkm2clJNnjYeVajk/edit",
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
  "Générateur Requête Transport",
  "Application de génération des requêtes de transport pour la division Infrastructure.",
  "🚚",
  "https://script.google.com/macros/s/AKfycbzdT9ccbrUmHZfTHCdFC09ZFG-KX3TR95qvpe5fyuIjE_tSMe-1hVEQDKknD629KHoU/exec",
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
  "https://docs.google.com/presentation/d/1FLFP453C8F1Sb8hZBnxboqoJtSq33rEu/edit?usp=sharing&ouid=114100570299093678332&rtpof=true&sd=true",
  1
 ],
 [
  "pilotage",
  "Avancement Chantiers",
  "Tableau de bord global des chantiers d'infrastructure en cours, suivi de l'avancement physique et financier en temps réel.",
  "📊",
  "https://rayanem-dev.github.io/DashBoard-Infra/Avancement_des_Chantiers.html",
  1
 ],
 [
  "pilotage",
  "Suivi Chantier",
  "Suivi détaillé chantier par chantier : jalons, documents et état d'avancement consolidé.",
  "🗂️",
  "https://rayanem-dev.github.io/DashBoard-Infra/Suivi_Chantier.html",
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
  "https://docs.google.com/spreadsheets/d/1QFoEEsoosl3vGdwyAlzmQbHt3Vv76llfWfrO-prmAuY/edit?usp=sharing",
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
  "Base de données des prestataires, sous-traitants et partenaires avec critères de qualification et évaluation.",
  "🏢",
  "https://docs.google.com/spreadsheets/d/1olPzVux6UclQVytVphOIFFvIxCEbhfgUJieqwipls7g/edit?gid=1473964080#gid=1473964080",
  1
 ],
 [
  "cpm",
  "Inscription au Vivier des Entreprises",
  "Formulaire à transmettre aux entreprises et prestataires souhaitant intégrer le vivier — collecte de leurs informations pour qualification.",
  "📝",
  "https://docs.google.com/forms/d/1l-6f3oqFmToPe7MFd78wq6gxfcrw2rZNrNntVR1k2FY/viewform?edit_requested=true",
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
  "rh",
  "Organigramme — Division Infrastructure",
  "Structure hiérarchique complète de la division, dépliable section par section, avec les numéros déjà vérifiés.",
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
  "Enquêtes Administratives / التحقيقات الادارية",
  "Suivi et archivage des enquêtes administratives internes pour assurer la conformité réglementaire et la traçabilité.",
  "🔍",
  "https://docs.google.com/spreadsheets/d/1wkbd3-ct19GifHZriKFLIRCPqUBiLjU0/edit?usp=sharing&ouid=114100570299093678332&rtpof=true&sd=true",
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
  sh.getRange(2, 1, SEED_APPS.length, 6).setValues(SEED_APPS);
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
  var existants = sh.getDataRange().getValues().slice(1).map(function (l) { return String(l[1]); });
  var nouveaux = SEED_APPS.filter(function (r) { return existants.indexOf(String(r[1])) === -1; });
  if (nouveaux.length) sh.getRange(sh.getLastRow() + 1, 1, nouveaux.length, 6).setValues(nouveaux);
  Logger.log(nouveaux.length + ' application(s) ajoutée(s).');
}
