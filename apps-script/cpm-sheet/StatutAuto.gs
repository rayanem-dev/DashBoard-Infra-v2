/**
 * À COLLER dans le fichier « Suivi CPM V 5 » (Extensions → Apps Script) : quand l'avancement d'un dossier passe à 100 %,
 * son statut devient automatiquement « Contrat en exécution » (seulement s'il était « Attribué » ou « Dossier en cours » :
 * « Contrat échu », « Infructueux », « Bloqué »… ne sont jamais modifiés).
 * Colonnes : H = % Réalisé, I = Statut (les en-têtes sont aux lignes 1-2, les dossiers commencent à la ligne 3).
 */
var CPM_COL_POURCENT = 8, CPM_COL_STATUT = 9, CPM_PREMIERE_LIGNE = 3;
var CPM_STATUTS_A_CHANGER = ['attribue', 'dossier en cours'];
var CPM_STATUT_CIBLE = 'Contrat en exécution';

function cpmNormStatut_(s) { return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }

/** Avancement en pourcentage (0-100) : « 100% », « 100 », 1 (cellule au format %), 0,95… ; NaN si illisible. */
function cpmPourcent_(v) {
  if (typeof v === 'number') return v <= 1 ? v * 100 : v;
  var x = parseFloat(String(v == null ? '' : v).replace('%', '').replace(',', '.').trim());
  return isNaN(x) ? NaN : x;
}

/** Nouveau statut à écrire, ou '' s'il ne faut rien changer. */
function cpmStatutApres100_(pourcent, statut) {
  if (!(cpmPourcent_(pourcent) >= 100)) return '';
  return CPM_STATUTS_A_CHANGER.indexOf(cpmNormStatut_(statut)) !== -1 ? CPM_STATUT_CIBLE : '';
}

function onEdit(e) {
  var r = e && e.range; if (!r || r.getRow() < CPM_PREMIERE_LIGNE || r.getColumn() !== CPM_COL_POURCENT || r.getNumRows() !== 1) return;
  var sh = r.getSheet(); if (sh.getName() !== 'suivi') return;
  var st = sh.getRange(r.getRow(), CPM_COL_STATUT), nouveau = cpmStatutApres100_(r.getValue(), st.getValue());
  if (nouveau) st.setValue(nouveau);
}

if (typeof module !== 'undefined') module.exports = { cpmStatutApres100_: cpmStatutApres100_, cpmPourcent_: cpmPourcent_ };
