// ============================================================
//  CLASSEMENT AUTOMATIQUE PAR STATUT — à COLLER à la fin du script du fichier « Suivi CPM V 5 »
//  Ordre (du haut vers le bas) : Bloqué · Non démarré · Dossier en cours · Attribué · Contrat en exécution · Contrat échu · Infructueux
//  Une colonne « Ordre statut » (masquée, tout à droite) reçoit le rang de chaque ligne, puis la feuille est triée sur ce rang.
// ============================================================
const H_ORDRE = 'ordre statut';

// Rang d'un statut (1 = tout en haut) ; 99 = vide ou inconnu (en bas). Utilise normalize() du script.
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

if (typeof module !== 'undefined') module.exports = { rangStatut: rangStatut };
