/**
 * ============================================================
 *  SCRIPT SUIVI CPM — v5
 *  Les colonnes sont retrouvées par leur NOM D'EN-TÊTE (ligne 2)
 *  et non par numéro fixe : plus aucun risque de décalage si une
 *  colonne est ajoutée/déplacée dans la feuille.
 * ============================================================
 *  - Date Début Cahier des Charges = colonne A existante
 *    ("Date debut Edition") → tant qu'elle n'est pas remplie,
 *    AUCUN calcul/couleur n'est appliqué sur la ligne.
 *  - "Date Attribution Finale" et "Durée Passation (jours)" sont
 *    créées automatiquement juste après la colonne "Statut" si
 *    elles n'existent pas encore (une seule fois).
 *  - Durée Passation = Date Attribution Finale − Date Début CDC,
 *    en jours. Elle se fige dès que la Date Attribution Finale
 *    est saisie (elle ne dépend jamais de la date du jour).
 *  - Si la Date d'Échéance (colonne "Échéance") est dépassée pour
 *    un contrat "en exécution", le Statut passe automatiquement
 *    à "Contrat échu".
 *  - À 100 % d'avancement, le Statut (Attribué / Dossier en cours)
 *    passe automatiquement à "Contrat en exécution".
 *  - Classement automatique par Statut : Bloqué · Non démarré ·
 *    Dossier en cours · Attribué · Contrat en exécution ·
 *    Contrat échu · Infructueux (vide en bas).
 * ============================================================
 */

const HEADER_ROW = 2;
const DATA_START_ROW = 3;

const H = {
  DEBUT_CDC: 'date debut cahier des charges',
  TYPE: 'type',
  ETAPE: 'etape',
  DATE_LIMITE: 'date limite',
  POURCENT: '% realise',
  STATUT: 'statut',
  ATTRIBUTION: 'attribution',
  DATE_SIGNATURE: 'date signature de contrat',
  DATE_ODS: 'date ods',
  DUREE_CONTRAT: 'duree du contrat (mois)',
  ECHEANCE: 'echeance',
  ATTRIB_FINALE: 'date attribution finale',
  DUREE_PASSATION: 'duree passation (jours)'
};

const H_ORDRE = 'ordre statut'; // colonne d'aide (masquée, tout à droite) pour le classement par statut

const TYPE_CONFIG = {
  'Consultation Fournisseur CF': 0,
  'Dossier Appel Offre DAO': 1,
  'Bon De Commande': 2,
  'Gré à Gré Convention Cadre': 3,
  'Gré à Gré Contrat Application': 4
};

const SEUIL_PASSATION_BON = 60;
const SEUIL_PASSATION_MOYEN = 120;

const STATUT_ECHU_LABEL = 'Contrat échu';

// ---------- UTILITAIRES ----------
function normalize(str) {
  if (str === null || str === undefined) return '';
  return str.toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Construit un dictionnaire {nom_normalise: numeroColonne} à partir de la ligne d'en-tête
function buildColumnMap(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) {
    var key = normalize(h);
    if (key) map[key] = i + 1; // colonnes 1-indexées
  });
  return map;
}

function col(map, key, required) {
  var idx = map[key];
  if (!idx && required) {
    throw new Error('Colonne introuvable : "' + key + '". Vérifie l\'en-tête en ligne ' + HEADER_ROW + '.');
  }
  return idx;
}

// ============================================================
//  onEdit
// ============================================================
function onEdit(e) {
  if (!e) return;
  var sheet = e.source.getActiveSheet();
  if (!sheet.getName().toLowerCase().includes('suivi')) return;

  var map = buildColumnMap(sheet);
  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var startCol = range.getColumn();
  var numCols = range.getNumColumns();

  for (var r = 0; r < numRows; r++) {
    var row = startRow + r;
    if (row < DATA_START_ROW) continue;

    var debutCdcCol = col(map, H.DEBUT_CDC, true);
    var debutCdcVal = sheet.getRange(row, debutCdcCol).getValue();
    var ligneVierge = !(debutCdcVal instanceof Date);

    var aBloqueQuelqueChose = false;
    for (var c = 0; c < numCols; c++) {
      var colIdx = startCol + c;

      // 🚧 Verrou : tant que "Date Début Cahier des Charges" n'est pas remplie,
      // aucune autre cellule de la ligne ne peut être renseignée.
      if (ligneVierge && colIdx !== debutCdcCol) {
        var celluleBloquee = sheet.getRange(row, colIdx);
        if (celluleBloquee.getValue() !== '' && celluleBloquee.getValue() !== null) {
          celluleBloquee.clearContent();
          aBloqueQuelqueChose = true;
        }
        continue;
      }

      processCellEdit(sheet, row, colIdx, map, e);
    }

    if (aBloqueQuelqueChose) {
      SpreadsheetApp.getUi().alert(
        '⚠️ Ligne bloquée',
        'Merci de renseigner d\'abord la "Date Début Cahier des Charges" (colonne ' +
        columnLetter(debutCdcCol) + ') avant de remplir le reste de cette ligne.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

    try {
      processRow(sheet, row, map);
    } catch (err) {
      SpreadsheetApp.getUi().alert('⚠️ Erreur ligne ' + row + ' : ' + err.message);
    }
  }

  // 📚 Classement automatique : quand le Statut (ou ce qui le fait changer) est modifié
  var touche = [col(map, H.STATUT, true), col(map, H.ETAPE, true), col(map, H.POURCENT, true), col(map, H.TYPE, true)].some(function (c) { return c >= startCol && c < startCol + numCols; });
  if (touche && startRow + numRows - 1 >= DATA_START_ROW) trierParStatut(sheet, map);
}

// ---------- Convertit un numéro de colonne (1, 2, 3...) en lettre (A, B, C...) ----------
function columnLetter(colIdx) {
  var letter = '';
  while (colIdx > 0) {
    var rem = (colIdx - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colIdx = Math.floor((colIdx - 1) / 26);
  }
  return letter;
}

// ---------- Traitement d'une cellule éditée (dropdowns dynamiques, verrous, dates) ----------
function processCellEdit(sheet, row, colIdx, map, e) {
  var deadLineCol = col(map, H.DATE_LIMITE, true) + 1; // colonne juste après "Date Limite", sans en-tête
  var pourcentCol = col(map, H.POURCENT, true);

  // 🔒 Colonnes calculées : verrouillées
  if (colIdx === deadLineCol || colIdx === pourcentCol) {
    var cell = sheet.getRange(row, colIdx);
    var val = cell.getValue();
    if (val !== '' && val !== null) {
      cell.clearContent();
      SpreadsheetApp.getUi().alert('⚠️ Cette colonne est gérée automatiquement, saisie manuelle interdite.');
    }
    return;
  }

  // ✅ Colonnes date obligatoires
  var dateCols = [col(map, H.DATE_LIMITE, true), col(map, H.DATE_SIGNATURE), col(map, H.DATE_ODS),
                   col(map, H.DEBUT_CDC, true), col(map, H.ATTRIB_FINALE)];
  if (dateCols.indexOf(colIdx) !== -1) {
    var cellD = sheet.getRange(row, colIdx);
    var valD = cellD.getValue();
    if (valD !== '' && valD !== null && Object.prototype.toString.call(valD) !== '[object Date]') {
      cellD.clearContent();
      SpreadsheetApp.getUi().alert('⚠️ Merci de saisir une date valide.');
    }
    return;
  }

  // 🎯 Type → dropdown dynamique en colonne Etape
  var typeCol = col(map, H.TYPE, true);
  var etapeCol = col(map, H.ETAPE, true);
  if (colIdx === typeCol) {
    var choix = sheet.getRange(row, typeCol).getValue();
    var etapeCell = sheet.getRange(row, etapeCol);
    var configSheet = e.source.getSheetByName('config');
    if (!configSheet) { SpreadsheetApp.getUi().alert('⚠️ Feuille "config" introuvable.'); return; }
    var idx = TYPE_CONFIG[choix];
    if (idx !== undefined) {
      var lastRow = Math.max(configSheet.getLastRow(), 1);
      var plage = configSheet.getRange(1, idx + 1, lastRow, 1);
      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(plage).setAllowInvalid(false).build();
      etapeCell.setDataValidation(rule);
      etapeCell.setValue('');
    } else {
      etapeCell.clearContent();
      etapeCell.clearDataValidations();
    }
    return;
  }

  // 📥 Etape → met à jour % Réalisé depuis config
  if (colIdx === etapeCol) {
    var choixProc = sheet.getRange(row, typeCol).getValue();
    var etape = sheet.getRange(row, etapeCol).getValue();
    var configSheet2 = e.source.getSheetByName('config');
    var cellPourcent = sheet.getRange(row, pourcentCol);
    if (!configSheet2) { cellPourcent.clearContent(); return; }
    var colRecherche = TYPE_CONFIG[choixProc];
    var valeurTrouvee = null;
    if (colRecherche !== undefined && etape !== '' && etape !== null) {
      var valeurs = configSheet2.getRange(1, 1, configSheet2.getLastRow(), 6).getValues();
      for (var i = 0; i < valeurs.length; i++) {
        if (normalize(valeurs[i][colRecherche]) === normalize(etape)) { valeurTrouvee = valeurs[i][5]; break; }
      }
    }
    if (valeurTrouvee !== null) cellPourcent.setValue(valeurTrouvee);
    else cellPourcent.clearContent();
    return;
  }
}

// ---------- Traitement complet d'une ligne (appelé après chaque édition + par le rafraîchissement quotidien) ----------
function processRow(sheet, row, map) {
  var debutCdcCol = col(map, H.DEBUT_CDC, true);
  var debutCdc = sheet.getRange(row, debutCdcCol).getValue();

  // 🚧 Rien ne se passe tant que "Date Début Cahier des Charges" n'est pas renseignée
  if (!(debutCdc instanceof Date)) {
    return;
  }
  statutSiCent(sheet, row, map);
  verifierEcheanceDepassee(sheet, row, map);
  updateDeadLine(sheet, row, map);
  updateRowColorFromStatut(sheet, row, map);
  updateObligatoires(sheet, row, map);
  updatePassationDuration(sheet, row, map, debutCdc);
}

// ---------- À 100 % : le statut (Attribué / Dossier en cours) passe en « Contrat en exécution » ----------
function statutSiCent(sheet, row, map) {
  var cellStatut = sheet.getRange(row, col(map, H.STATUT, true));
  var pct = sheet.getRange(row, col(map, H.POURCENT, true)).getValue();
  var cent = (typeof pct === 'number') ? (pct === 1 || pct === 100) : normalize(pct).replace(/[\s%]/g, '') === '100';
  var s = normalize(cellStatut.getValue());
  if (cent && (s.includes('attribue') || s.includes('en cours'))) cellStatut.setValue('Contrat en exécution');
}

// ---------- Bascule automatiquement le Statut en "Contrat échu" si l'Échéance est dépassée ----------
function verifierEcheanceDepassee(sheet, row, map) {
  var statutCol = col(map, H.STATUT, true);
  var statut = normalize(sheet.getRange(row, statutCol).getValue());

  // Ne concerne que les contrats actuellement "en exécution" — les autres statuts
  // (attribué, bloqué, non démarré...) n'ont pas d'échéance de contrat en cours.
  if (!statut.includes('execution')) return;

  var echeanceCol = col(map, H.ECHEANCE, true);
  var echeanceVal = sheet.getRange(row, echeanceCol).getValue();
  var echeanceDate = null;

  if (echeanceVal instanceof Date) {
    echeanceDate = echeanceVal;
  } else {
    var valO = sheet.getRange(row, col(map, H.DATE_ODS, true)).getValue();
    var valP = sheet.getRange(row, col(map, H.DUREE_CONTRAT, true)).getValue();
    if (valO instanceof Date && valP) {
      echeanceDate = new Date(valO);
      echeanceDate.setMonth(echeanceDate.getMonth() + Number(valP));
    }
  }
  if (!echeanceDate) return;

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var echCompare = new Date(echeanceDate); echCompare.setHours(0, 0, 0, 0);

  if (echCompare < today) {
    sheet.getRange(row, statutCol).setValue(STATUT_ECHU_LABEL);
  }
}

// ---------- Dead Line (colonne juste après "Date Limite") ----------
function updateDeadLine(sheet, row, map) {
  var dateLimiteCol = col(map, H.DATE_LIMITE, true);
  var deadLineCol = dateLimiteCol + 1;
  var valF = sheet.getRange(row, dateLimiteCol).getValue();
  var cellG = sheet.getRange(row, deadLineCol);

  if (valF instanceof Date) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var limite = new Date(valF); limite.setHours(0, 0, 0, 0);
    var diffDays = Math.ceil((limite - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      cellG.setValue(0);
      cellG.setBackground('#000000');
      cellG.setFontColor('#ffffff');
    } else if (diffDays <= 7) {
      cellG.setValue(diffDays);
      cellG.setBackground('#ea4335');
      cellG.setFontColor(null);
    } else if (diffDays <= 15) {
      cellG.setValue(diffDays);
      cellG.setBackground('#fbbc04');
      cellG.setFontColor(null);
    } else {
      cellG.setValue(diffDays);
      cellG.setBackground('#34a853');
      cellG.setFontColor(null);
    }
  } else {
    cellG.clearContent();
    cellG.setBackground(null);
    cellG.setFontColor(null);
  }
}

// ---------- Coloration de ligne selon Statut ----------
function updateRowColorFromStatut(sheet, row, map) {
  var statutCol = col(map, H.STATUT, true);
  var statut = normalize(sheet.getRange(row, statutCol).getValue());
  var ligne = sheet.getRange(row, 1, 1, sheet.getLastColumn());

  if (statut.includes('infructueux')) ligne.setBackground('#3d3d3d');
  else if (statut.includes('bloque')) ligne.setBackground('#b10202');
  else if (statut.includes('attribue')) ligne.setBackground('#7cd5b0');
  else if (statut.includes('execution')) ligne.setBackground('#bfe1f6');
  else if (statut.includes('en cours')) ligne.setBackground('#d4edbc');
  else if (statut.includes('echu') || statut.includes('termine')) ligne.setBackground('#8b8d91');
  else if (statut.includes('non demarre')) ligne.setBackground('#fff6e8');
  else ligne.setBackground(null);

  updateDeadLine(sheet, row, map); // ne pas laisser la coloration de ligne écraser celle du Dead Line
}

// ---------- Colonnes obligatoires une fois Statut = attribué / exécution / échu ----------
function updateObligatoires(sheet, row, map) {
  var statutCol = col(map, H.STATUT, true);
  var statut = normalize(sheet.getRange(row, statutCol).getValue());
  var doitEtreRempli = statut.includes('attribue') || statut.includes('execution') || statut.includes('echu') || statut.includes('termine');
  if (!doitEtreRempli) return;

  var attributionCol = col(map, H.ATTRIBUTION, true);
  var echeanceCol = col(map, H.ECHEANCE, true);
  var attribFinaleCol = col(map, H.ATTRIB_FINALE, true);
  var ligneColor = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getBackgrounds()[0][0];

  // Colonnes "Attribution" → "Échéance" obligatoires
  for (var c = attributionCol; c <= echeanceCol; c++) {
    var cell = sheet.getRange(row, c);
    cell.setBackground(cell.getValue() ? ligneColor : '#ff0000');
  }
  // Date Attribution Finale obligatoire elle aussi
  var cellAttribFinale = sheet.getRange(row, attribFinaleCol);
  cellAttribFinale.setBackground(cellAttribFinale.getValue() ? ligneColor : '#ff0000');

  // Échéance calculée depuis Date ODS + Durée du contrat
  var valO = sheet.getRange(row, col(map, H.DATE_ODS, true)).getValue();
  var valP = sheet.getRange(row, col(map, H.DUREE_CONTRAT, true)).getValue();
  var cellQ = sheet.getRange(row, echeanceCol);

  if (!valO || !valP) { cellQ.clearContent(); cellQ.setBackground('#ff0000'); return; }

  var echeance = new Date(valO);
  echeance.setMonth(echeance.getMonth() + Number(valP));
  cellQ.setValue(echeance);

  // 🎨 Coloration selon le temps RESTANT avant échéance (à partir d'aujourd'hui) :
  //    > 1 an → vert · entre 6 mois et 1 an → orange · < 6 mois (ou dépassé) → rouge
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var echeanceCompare = new Date(echeance); echeanceCompare.setHours(0, 0, 0, 0);
  var joursRestants = Math.round((echeanceCompare - today) / (1000 * 60 * 60 * 24));

  if (joursRestants > 365) cellQ.setBackground('#7cd5b0');
  else if (joursRestants >= 182) cellQ.setBackground('#fbbc04');
  else cellQ.setBackground('#ea4335');
}

// ---------- Durée Passation = Date Attribution Finale − Date Début CDC (se fige une fois calculée) ----------
function updatePassationDuration(sheet, row, map, debutCdc) {
  var attribFinaleCol = col(map, H.ATTRIB_FINALE, true);
  var dureeCol = col(map, H.DUREE_PASSATION, true);
  var attribFinale = sheet.getRange(row, attribFinaleCol).getValue();
  var cellDuree = sheet.getRange(row, dureeCol);

  if (attribFinale instanceof Date) {
    var diffJours = Math.round((attribFinale - debutCdc) / (1000 * 60 * 60 * 24));
    cellDuree.setValue(diffJours);
    if (diffJours <= SEUIL_PASSATION_BON) cellDuree.setBackground('#7cd5b0');
    else if (diffJours <= SEUIL_PASSATION_MOYEN) cellDuree.setBackground('#fbbc04');
    else cellDuree.setBackground('#f28b82');
  } else {
    cellDuree.clearContent();
    cellDuree.setBackground(null);
  }
}

// ============================================================
//  CLASSEMENT AUTOMATIQUE PAR STATUT
//  Ordre (haut → bas) : Bloqué · Non démarré · Dossier en cours · Attribué · Contrat en exécution · Contrat échu · Infructueux
//  Une colonne « Ordre statut » (masquée, tout à droite) reçoit le rang de chaque ligne, puis la feuille est triée sur ce rang.
// ============================================================

// Rang d'un statut (1 = tout en haut) ; 99 = vide ou inconnu (en bas)
function rangStatut(statut) {
  var s = normalize(statut);
  if (!s) return 99;
  if (s.includes('bloque')) return 1;
  if (s.includes('non demarre')) return 2;
  if (s.includes('execution')) return 5;
  if (s.includes('attribue')) return 4;
  if (s.includes('echu') || s.includes('termine')) return 6;
  if (s.includes('infructueux')) return 7;
  if (s.includes('en cours')) return 3;
  return 99;
}

function trierParStatut(sheet, map) {
  var statutCol = col(map, H.STATUT, true);
  var dernier = sheet.getLastRow();
  var nb = dernier - DATA_START_ROW + 1;
  if (nb < 2) return;

  // colonne d'aide « Ordre statut » : créée et masquée la première fois
  var ordreCol = map[H_ORDRE];
  if (!ordreCol) {
    ordreCol = sheet.getLastColumn() + 1;
    sheet.getRange(HEADER_ROW, ordreCol).setValue('Ordre statut');
    sheet.hideColumns(ordreCol);
  }
  var rangs = sheet.getRange(DATA_START_ROW, statutCol, nb, 1).getValues().map(function (r) { return [rangStatut(r[0])]; });
  sheet.getRange(DATA_START_ROW, ordreCol, nb, 1).setValues(rangs);
  SpreadsheetApp.flush();

  sheet.getRange(DATA_START_ROW, 1, nb, sheet.getLastColumn()).sort({ column: ordreCol, ascending: true });

  // la liste déroulante « Etape » dépend du Type de chaque ligne : on la remet d'aplomb après le tri
  var cfg = sheet.getParent().getSheetByName('config');
  if (cfg) {
    var typeCol = col(map, H.TYPE, true), etapeCol = col(map, H.ETAPE, true), lastCfg = Math.max(cfg.getLastRow(), 1), regles = {};
    var regs = sheet.getRange(DATA_START_ROW, typeCol, nb, 1).getValues().map(function (r) {
      var i = TYPE_CONFIG[r[0]];
      if (i === undefined) return [null];
      if (!regles[i]) regles[i] = SpreadsheetApp.newDataValidation().requireValueInRange(cfg.getRange(1, i + 1, lastCfg, 1)).setAllowInvalid(false).build();
      return [regles[i]];
    });
    sheet.getRange(DATA_START_ROW, etapeCol, nb, 1).setDataValidations(regs);
  }
}

// ============================================================
//  onOpen — création des colonnes manquantes + validations + protections + trigger
// ============================================================
function onOpen() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .find(function (s) { return s.getName().toLowerCase().includes('suivi'); });
  if (!sheet) return;

  creerColonnesManquantes(sheet);

  var map = buildColumnMap(sheet);
  var lastRow = Math.max(sheet.getLastRow(), DATA_START_ROW);
  var numRows = lastRow - DATA_START_ROW + 1;

  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  [H.DATE_LIMITE, H.DATE_SIGNATURE, H.DATE_ODS, H.DEBUT_CDC, H.ATTRIB_FINALE].forEach(function (key) {
    var c = map[key];
    if (c) sheet.getRange(DATA_START_ROW, c, numRows, 1).setDataValidation(dateRule);
  });

  protegerColonnesCalculees(sheet, map, numRows);
  creerTriggerQuotidienSiAbsent();
}

// ---------- Crée "Date Attribution Finale" et "Durée Passation (jours)" juste après "Statut" si absentes ----------
function creerColonnesManquantes(sheet) {
  var map = buildColumnMap(sheet);
  if (map[H.ATTRIB_FINALE] && map[H.DUREE_PASSATION]) return; // déjà en place

  var statutCol = col(map, H.STATUT, true);

  if (!map[H.ATTRIB_FINALE]) {
    sheet.insertColumnAfter(statutCol);
    sheet.getRange(HEADER_ROW, statutCol + 1).setValue('Date Attribution Finale');
  }
  map = buildColumnMap(sheet); // recalcul après insertion
  var attribFinaleCol = map[H.ATTRIB_FINALE];

  if (!map[H.DUREE_PASSATION]) {
    sheet.insertColumnAfter(attribFinaleCol);
    sheet.getRange(HEADER_ROW, attribFinaleCol + 1).setValue('Durée Passation (jours)');
  }
}

function protegerColonnesCalculees(sheet, map, numRows) {
  var deadLineCol = col(map, H.DATE_LIMITE, true) + 1;
  var colonnes = [deadLineCol, map[H.POURCENT], map[H.DUREE_PASSATION]].filter(Boolean);
  colonnes.forEach(function (c) {
    var range = sheet.getRange(DATA_START_ROW, c, numRows, 1);
    var dejaProtegee = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) {
      var r = p.getRange();
      return r.getColumn() === c && r.getRow() === DATA_START_ROW;
    });
    if (!dejaProtegee) {
      range.protect().setDescription('Colonne calculée automatiquement').setWarningOnly(true);
    }
  });
}

function creerTriggerQuotidienSiAbsent() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'rafraichirTouteLaFeuille'; });
  if (!existe) {
    ScriptApp.newTrigger('rafraichirTouteLaFeuille').timeBased().everyDays(1).atHour(6).create();
  }
}

// ---------- Rafraîchissement quotidien (et manuel) : EN BLOC (toute la feuille lue puis écrite en quelques appels, quelques secondes) ----------
function rafraichirTouteLaFeuille() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .find(function (s) { return s.getName().toLowerCase().includes('suivi'); });
  if (!sheet) return;
  var map = buildColumnMap(sheet);
  var erreurs = [];

  try { rafraichirEnBloc(sheet, map); } catch (err) { erreurs.push('Rafraîchissement : ' + err.message); }

  // 📚 Classement par statut une fois toutes les lignes à jour
  try { trierParStatut(sheet, map); } catch (err) { erreurs.push('Tri : ' + err.message); }

  if (erreurs.length > 0) {
    SpreadsheetApp.getUi().alert('⚠️ Rafraîchissement terminé avec ' + erreurs.length + ' erreur(s)', erreurs.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('✅ Rafraîchissement terminé sans erreur (' + Math.max(0, sheet.getLastRow() - DATA_START_ROW + 1) + ' lignes).');
  }
}

// Mêmes règles que processRow (statut à 100 %, échéance dépassée, dead line, couleurs, champs obligatoires, durée de passation), mais sur toute la feuille d'un coup
function rafraichirEnBloc(sheet, map) {
  var nb = sheet.getLastRow() - DATA_START_ROW + 1;
  if (nb < 1) return;
  var nbCol = sheet.getLastColumn();
  var plage = sheet.getRange(DATA_START_ROW, 1, nb, nbCol);
  var V = plage.getValues(), B = plage.getBackgrounds(), F = plage.getFontColors();
  var cDebut = col(map, H.DEBUT_CDC, true) - 1, cStatut = col(map, H.STATUT, true) - 1, cPct = col(map, H.POURCENT, true) - 1,
      cLim = col(map, H.DATE_LIMITE, true) - 1, cDead = cLim + 1, cAttr = col(map, H.ATTRIBUTION, true) - 1, cEch = col(map, H.ECHEANCE, true) - 1,
      cAF = col(map, H.ATTRIB_FINALE, true) - 1, cODS = col(map, H.DATE_ODS, true) - 1, cDur = col(map, H.DUREE_CONTRAT, true) - 1, cPass = col(map, H.DUREE_PASSATION, true) - 1;
  var auj = new Date(); auj.setHours(0, 0, 0, 0);
  var JOUR = 1000 * 60 * 60 * 24;
  function minuit(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function plusMois(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + Number(n)); return x; }

  for (var i = 0; i < nb; i++) {
    var v = V[i];
    if (!(v[cDebut] instanceof Date)) continue; // ligne sans Date Début CDC : rien ne change

    // 1) 100 % → Contrat en exécution
    var pct = v[cPct];
    var cent = (typeof pct === 'number') ? (pct === 1 || pct === 100) : normalize(pct).replace(/[\s%]/g, '') === '100';
    var st = normalize(v[cStatut]);
    if (cent && (st.includes('attribue') || st.includes('en cours'))) { v[cStatut] = 'Contrat en exécution'; st = normalize(v[cStatut]); }

    // 2) échéance dépassée → Contrat échu
    if (st.includes('execution')) {
      var ech0 = v[cEch] instanceof Date ? v[cEch] : ((v[cODS] instanceof Date && v[cDur]) ? plusMois(v[cODS], v[cDur]) : null);
      if (ech0 && minuit(ech0) < auj) { v[cStatut] = STATUT_ECHU_LABEL; st = normalize(v[cStatut]); }
    }

    // 3) couleur de ligne selon le statut
    var coul = '#ffffff';
    if (st.includes('infructueux')) coul = '#3d3d3d';
    else if (st.includes('bloque')) coul = '#b10202';
    else if (st.includes('attribue')) coul = '#7cd5b0';
    else if (st.includes('execution')) coul = '#bfe1f6';
    else if (st.includes('en cours')) coul = '#d4edbc';
    else if (st.includes('echu') || st.includes('termine')) coul = '#8b8d91';
    else if (st.includes('non demarre')) coul = '#fff6e8';
    for (var c = 0; c < nbCol; c++) B[i][c] = coul;

    // 4) Dead Line (colonne après « Date Limite »)
    if (v[cLim] instanceof Date) {
      var diff = Math.ceil((minuit(v[cLim]) - auj) / JOUR);
      if (diff <= 0) { v[cDead] = 0; B[i][cDead] = '#000000'; F[i][cDead] = '#ffffff'; }
      else { v[cDead] = diff; B[i][cDead] = diff <= 7 ? '#ea4335' : (diff <= 15 ? '#fbbc04' : '#34a853'); F[i][cDead] = '#000000'; }
    } else { v[cDead] = ''; B[i][cDead] = '#ffffff'; F[i][cDead] = '#000000'; }

    // 5) champs obligatoires (Attribué / En exécution / Échu) + échéance calculée
    if (st.includes('attribue') || st.includes('execution') || st.includes('echu') || st.includes('termine')) {
      for (var k = cAttr; k <= cEch; k++) B[i][k] = v[k] ? coul : '#ff0000';
      B[i][cAF] = v[cAF] ? coul : '#ff0000';
      if (!v[cODS] || !v[cDur]) { v[cEch] = ''; B[i][cEch] = '#ff0000'; }
      else {
        var ech = plusMois(v[cODS], v[cDur]);
        v[cEch] = ech;
        var restant = Math.round((minuit(ech) - auj) / JOUR);
        B[i][cEch] = restant > 365 ? '#7cd5b0' : (restant >= 182 ? '#fbbc04' : '#ea4335');
      }
    }

    // 6) Durée de passation = Date Attribution Finale − Date Début CDC
    if (v[cAF] instanceof Date) {
      var dj = Math.round((v[cAF] - v[cDebut]) / JOUR);
      v[cPass] = dj;
      B[i][cPass] = dj <= SEUIL_PASSATION_BON ? '#7cd5b0' : (dj <= SEUIL_PASSATION_MOYEN ? '#fbbc04' : '#f28b82');
    } else { v[cPass] = ''; B[i][cPass] = '#ffffff'; }
  }

  // Écriture : uniquement les colonnes calculées (les autres valeurs ne sont pas réécrites), puis couleurs
  [cStatut, cDead, cEch, cPass].forEach(function (c) {
    sheet.getRange(DATA_START_ROW, c + 1, nb, 1).setValues(V.map(function (r) { return [r[c]]; }));
  });
  plage.setBackgrounds(B);
  plage.setFontColors(F);
}
