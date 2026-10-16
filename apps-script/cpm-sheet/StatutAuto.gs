/**
 * À COLLER dans le fichier « Suivi CPM V 5 » (Extensions → Apps Script) :
 * quand le % Réalisé (colonne H) d'un dossier passe à 100 %, son Statut (colonne I) devient « Contrat en exécution ».
 */
function onEdit(e) {
  var r = e.range;
  if (r.getColumn() !== 8 || r.getRow() < 3 || r.getSheet().getName() !== 'suivi') return;
  var v = r.getValue(); // 1 ou 100 selon le format de la cellule
  if (v === 1 || v === 100 || String(v).replace(/[\s%]/g, '') === '100') r.offset(0, 1).setValue('Contrat en exécution');
}
