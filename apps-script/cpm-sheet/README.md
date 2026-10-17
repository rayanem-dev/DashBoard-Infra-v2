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

## Classement automatique par statut
Ordre (haut → bas) : Bloqué · Non démarré · Dossier en cours · Attribué · Contrat en exécution · Contrat échu · Infructueux (statut vide ou inconnu : tout en bas).

1. Coller `TriStatut.gs` à la fin du script du fichier (fonctions `rangStatut` et `trierParStatut`).
2. Dans `onEdit`, juste après la boucle `for (var r = 0; r < numRows; r++) { … }` (avant l'accolade qui ferme `onEdit`) :
```js
  // 📚 Classement automatique : quand le Statut (ou ce qui le fait changer) est modifié
  var touche = [col(map, H.STATUT, true), col(map, H.ETAPE, true), col(map, H.POURCENT, true), col(map, H.TYPE, true)].some(function (c) { return c >= startCol && c < startCol + numCols; });
  if (touche && startRow + numRows - 1 >= DATA_START_ROW) trierParStatut(sheet, map);
```
3. Dans `rafraichirTouteLaFeuille`, juste après la boucle `for (var row = …) { … }` et avant `if (erreurs.length > 0)` :
```js
  try { trierParStatut(sheet, map); } catch (err) { erreurs.push('Tri : ' + err.message); }
```
La première fois, une colonne « Ordre statut » est créée tout à droite (masquée) : elle contient le rang de chaque ligne et sert de clé de tri. Après le tri, les listes déroulantes « Etape » sont remises d'aplomb selon le Type de chaque ligne.
Le tri se déclenche aussi quand le % Réalisé passe à 100 % (le statut change tout seul), donc la ligne descend dans « Contrat en exécution » sans rien faire.
