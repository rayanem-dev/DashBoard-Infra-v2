/**
 * Changement d'adresse e-mail de connexion d'un compte (erreur de saisie) : fonctions PURES (test/courriel.test.js).
 * L'adresse sert de clé dans plusieurs onglets : on la remplace partout où elle apparaît (l'historique du Journal reste tel quel).
 */
var Courriel = (function () {
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function valide(s) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(s || '').trim()) && String(s).trim().length <= 120; }
  /** Onglets et colonnes où l'adresse d'un compte est enregistrée. */
  var REFERENCES = [['Utilisateurs', ['email']], ['Exceptions', ['email']], ['Rotations', ['email']], ['Rapports', ['auteur_email']], ['Modifications', ['email', 'emetteur', 'decide_par']],
    ['Affectations', ['email', 'par']], ['Profils', ['email']], ['DemandesAcces', ['email', 'traite_par']]];
  /** valeurs = tableau de tableaux (1re ligne = en-têtes) ; remplace ancien → nouveau dans les colonnes nommées. Retourne { valeurs, n, cellules } (copie, n = cellules changées). */
  function remplacer(valeurs, colonnes, ancien, nouveau) {
    var a = norm(ancien), h = (valeurs[0] || []).map(String), n = 0, cellules = [];
    var cols = colonnes.map(function (c) { return h.indexOf(c); }).filter(function (i) { return i >= 0; });
    var out = valeurs.map(function (r, i) {
      if (i === 0) return r.slice();
      var l = r.slice(); cols.forEach(function (c) { if (norm(l[c]) === a) { l[c] = nouveau; n += 1; cellules.push([i + 1, c + 1]); } }); return l;
    });
    return { valeurs: out, n: n, cellules: cellules };   // cellules : [ligne, colonne] à partir de 1, pour n'écrire que ces cases
  }
  return { norm: norm, valide: valide, REFERENCES: REFERENCES, remplacer: remplacer };
})();
if (typeof module !== 'undefined') module.exports = Courriel;
