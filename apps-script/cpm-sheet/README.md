# Script du fichier « Suivi CPM V 5 »

Le script du fichier (Extensions → Apps Script) n'est pas versionné ici : il se modifie directement dans le fichier.

## Statut automatique à 100 %
Ajouter cette fonction, et UNE ligne dans `processRow` (juste avant `verifierEcheanceDepassee(sheet, row, map);`) : `statutSiCent(sheet, row, map);`

```js
// ---------- À 100 % : le statut (Attribué / Dossier en cours) passe en « Contrat en exécution » ----------
function statutSiCent(sheet, row, map) {
  var cellStatut = sheet.getRange(row, col(map, H.STATUT, true));
  var pct = sheet.getRange(row, col(map, H.POURCENT, true)).getValue();
  var cent = (typeof pct === 'number') ? (pct === 1 || pct === 100) : normalize(pct).replace(/[\s%]/g, '') === '100';
  var s = normalize(cellStatut.getValue());
  if (cent && (s.includes('attribue') || s.includes('en cours'))) cellStatut.setValue('Contrat en exécution');
}
```

Pourquoi dans `processRow` et pas dans un nouveau `onEdit` : le % Réalisé est écrit par le script lui-même (quand on choisit l'Étape) ; une écriture faite par un script ne déclenche jamais `onEdit`. `processRow` est appelé après chaque modification et par le rafraîchissement quotidien, donc les dossiers déjà à 100 % sont corrigés aussi.
