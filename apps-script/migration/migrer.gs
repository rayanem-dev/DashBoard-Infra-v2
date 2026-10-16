/**
 * Migration v2 — copie des fichiers vers la nouvelle organisation.
 *
 * À LANCER DEPUIS LE COMPTE sec.infra.rns@gmail.com (script.google.com > Nouveau projet).
 *  - Les ORIGINAUX ne sont jamais modifiés, déplacés ni supprimés (lecture + copie seulement).
 *  - Les copies appartiennent au compte qui lance le script, en accès RESTREINT.
 *  - Relançable sans risque : un fichier déjà copié (registre) est ignoré.
 *  - Le fichier « Organigrame Div Infra » n'est PAS copié : il contient des mots de passe
 *    en clair. On en extraira plus tard un onglet propre (identité seulement).
 *
 * Utilisation : exécuter  migrer()  une première fois (autoriser les droits),
 * puis relire le journal (Affichage > Journaux d'exécution) et la feuille « Registre_Migration ».
 */

const RACINE = 'DashBoard-Infra v2';
const DOSSIERS = [
  '00_Securite_Acces', '01_Pilotage_Projets', '02_CPM', '03_RH_Personnel',
  '04_Logistique_Stocks', '05_Administration', '06_Chantiers_Fiches_Suiveuses',
  '07_Rapports_Journaliers', '08_Planning_Rotations', '09_Badges_Prestataires',
  '98_Systeme_Donnees', '99_Sauvegardes'
];

const FICHIERS = [
  {
    "id": "1pvGALmksWQ-oLkxXrv74yjZk6QGyVbqHzgWfc6ol6SE",
    "name": "Affectation Véhicule – Division Infra",
    "type": "Google Sheet",
    "folder": "04_Logistique_Stocks"
  },
  {
    "id": "1OnDa-w4dyb2t1QyRk0DpoSJR5cmjJ9R1",
    "name": "Table Stock Magasin RNS",
    "type": "Google Sheet",
    "folder": "04_Logistique_Stocks"
  },
  {
    "id": "1VOKT3OrWK3MVA9duOQxI2y--SDWuBB2O",
    "name": "Suivi des Écarts Inventaire",
    "type": "Google Sheet",
    "folder": "04_Logistique_Stocks"
  },
  {
    "id": "1REasn3g8Tg77GldihvZFeDu6vtAIkm2clJNnjYeVajk",
    "name": "Liste Radio INFRA RNS",
    "type": "Google Sheet",
    "folder": "04_Logistique_Stocks"
  },
  {
    "id": "1_qZp9x1cgeq9dzZpJU4Bdpz1BGnuav02",
    "name": "Statistiques Sous-traitants – Avril 2026",
    "type": "Google Sheet",
    "folder": "04_Logistique_Stocks"
  },
  {
    "id": "1FLFP453C8F1Sb8hZBnxboqoJtSq33rEu",
    "name": "Rapport Hebdomadaire Infra",
    "type": "Google Slides",
    "folder": "01_Pilotage_Projets"
  },
  {
    "id": "1Jlz8LmaawE4Fz7Dj1opxkg9kuk4G5fsO0UP4FOiRRWc",
    "name": "Suivi des Tâches Journalières",
    "type": "Google Sheet",
    "folder": "01_Pilotage_Projets"
  },
  {
    "id": "1LibEVNdujTDHAaGXz-EUh4oJr2SqXR2X0Q0wO2KDeoQ",
    "name": "Imputation SH RNS",
    "type": "Google Sheet",
    "folder": "01_Pilotage_Projets"
  },
  {
    "id": "1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I",
    "name": "Suivi CPM V5",
    "type": "Google Sheet",
    "folder": "02_CPM"
  },
  {
    "id": "1olPzVux6UclQVytVphOIFFvIxCEbhfgUJieqwipls7g",
    "name": "Vivier des Entreprises",
    "type": "Google Sheet",
    "folder": "02_CPM"
  },
  {
    "id": "1l-6f3oqFmToPe7MFd78wq6gxfcrw2rZNrNntVR1k2FY",
    "name": "Inscription au Vivier des Entreprises",
    "type": "Google Form",
    "folder": "02_CPM"
  },
  {
    "id": "1_WTKk5_-nbKyR0yk7fE6bKiCku2ZtCez",
    "name": "Personnel de Permanence",
    "type": "Google Doc",
    "folder": "03_RH_Personnel"
  },
  {
    "id": "1KOoUvkV6DOXID9gRKohh7FJ0lA3p9PNOyFnjSNben0g",
    "name": "Planning de Formation",
    "type": "Google Sheet",
    "folder": "03_RH_Personnel"
  },
  {
    "id": "1v3SVsW36asErrhxIkHUuSFZCN0XA6RsjFcoOJO1Z0OA",
    "name": "Catalogue Formation",
    "type": "Google Sheet",
    "folder": "03_RH_Personnel"
  },
  {
    "id": "1Uq_WkNxu5fdaN9p_JEo4BPKpXEHKUMHC",
    "name": "Planning de Visite Médicale",
    "type": "Google Sheet",
    "folder": "03_RH_Personnel"
  },
  {
    "id": "10NA8xSQbbLpAK10dao1fLRNVVjUQGYsc",
    "name": "Veste en Cuir – Personnel Actif RNS",
    "type": "Google Sheet",
    "folder": "03_RH_Personnel"
  },
  {
    "id": "1t9-Rks2tOPYAvwKBKM65mAOsSo5lzsSVyp4HrFayPc8",
    "name": "Suivi des Instances Courriers",
    "type": "Google Sheet",
    "folder": "05_Administration"
  },
  {
    "id": "1wkbd3-ct19GifHZriKFLIRCPqUBiLjU0",
    "name": "Enquêtes Administratives / التحقيقات الادارية",
    "type": "Google Sheet",
    "folder": "05_Administration"
  },
  {
    "id": "1yREJ3dZWTBv7g4UPiDUEB9Rd5WWxAMKcOb6mfvzbrNE",
    "name": "Passation des Consignes",
    "type": "Google Sheet",
    "folder": "05_Administration"
  },
  {
    "id": "1QmrWV8Qg174ZEq5m8DaECI_h2Pjg74kiFJH7V-yf87c",
    "name": "Accès, Partage & Privilèges",
    "type": "Google Sheet",
    "folder": "00_Securite_Acces"
  },
  {
    "id": "1gD_aQEw7YUU2DBGMrJchqUGvuFuEeyn8EG9XHf7gxkw",
    "name": "Forage RNS — 3 puits d'eau (fiche suiveuse)",
    "type": "Google Sheet",
    "folder": "06_Chantiers_Fiches_Suiveuses"
  },
  {
    "id": "1_bL3vv2dtYJWmvs0ZqZqq2agACVEZdAr14UP2unoUhM",
    "name": "Terrassement RNS (fiche suiveuse)",
    "type": "Google Sheet",
    "folder": "06_Chantiers_Fiches_Suiveuses"
  },
  {
    "id": "1Pk0n5UNT8yf5A7yZNe8rwHyevn7XHsB4",
    "name": "Maintenance Installations Électriques (fiche suiveuse)",
    "type": "Google Sheet",
    "folder": "06_Chantiers_Fiches_Suiveuses"
  }
];

function migrer() {
  const racine = dossier_(DriveApp.getRootFolder(), RACINE);
  const sousDossiers = {};
  DOSSIERS.forEach(n => sousDossiers[n] = dossier_(racine, n));
  const registre = registre_(racine);
  const deja = {};
  registre.getDataRange().getValues().slice(1).forEach(l => { if (l[4] === 'OK') deja[l[0]] = true; });

  const debut = Date.now();
  FICHIERS.forEach(f => {
    if (deja[f.id]) return;
    if (Date.now() - debut > 5 * 60 * 1000) { Logger.log('Temps presque écoulé : relancer migrer().'); return; }
    try {
      const src = DriveApp.getFileById(f.id);
      const copie = src.makeCopy(src.getName(), sousDossiers[f.folder]);
      copie.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      registre.appendRow([f.id, copie.getId(), f.name, f.folder, 'OK', new Date(), '']);
      Logger.log('OK  ' + f.name);
    } catch (e) {
      registre.appendRow([f.id, '', f.name, f.folder, 'ERREUR', new Date(), String(e.message)]);
      Logger.log('ERR ' + f.name + ' : ' + e.message);
    }
  });
}

function dossier_(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

function registre_(racine) {
  const sys = dossier_(racine, '98_Systeme_Donnees');
  const it = sys.getFilesByName('Registre_Migration');
  if (it.hasNext()) return SpreadsheetApp.open(it.next()).getSheets()[0];
  const ss = SpreadsheetApp.create('Registre_Migration');
  DriveApp.getFileById(ss.getId()).moveTo(sys);
  const sh = ss.getSheets()[0];
  sh.appendRow(['id_original', 'id_copie', 'nom', 'dossier', 'statut', 'date', 'detail']);
  sh.setFrozenRows(1);
  return sh;
}
