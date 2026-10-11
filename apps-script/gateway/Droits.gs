/**
 * Calcul des privilèges (fonctions pures, testées en Node : test/droits.test.js).
 *
 * Un MODULE est un ensemble de logiciels (ex. « cpm », « logistique »).
 * Niveaux : 0 = aucun, 1 = lecture, 2 = saisie (écriture), 3 = administration du module.
 *
 *  - droitsRole  : [{ role, module, niveau }]            droits donnés par le rôle
 *  - exceptions  : [{ email, module, niveau }]           exceptions individuelles
 *                  niveau 0 = retrait explicite (l'emporte toujours), niveau > 0 = ajout
 *
 * Résultat : { module: niveau } pour les seuls modules accessibles (niveau >= 1).
 */
var Droits = (function () {
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function resolve(user, droitsRole, exceptions) {
    var res = {};
    var role = norm(user.role);
    (droitsRole || []).forEach(function (d) {
      if (norm(d.role) !== role) return;
      var n = Number(d.niveau) || 0;
      if (n > (res[norm(d.module)] || 0)) res[norm(d.module)] = n;
    });
    var email = norm(user.email);
    var retraits = {};
    (exceptions || []).forEach(function (x) {
      if (norm(x.email) !== email) return;
      var m = norm(x.module); var n = Number(x.niveau) || 0;
      if (n === 0) retraits[m] = true;
      else if (n > (res[m] || 0)) res[m] = n;
    });
    Object.keys(retraits).forEach(function (m) { delete res[m]; });
    Object.keys(res).forEach(function (m) { if (res[m] < 1) delete res[m]; });
    return res;
  }

  /** Menu : modules accessibles (triés) avec leurs applications dont le niveau minimal est atteint. */
  function menu(acces, catalogue, applications) {
    return (catalogue || [])
      .filter(function (m) { return acces[norm(m.id)] >= 1 && String(m.actif) !== '0'; })
      .sort(function (a, b) { return (Number(a.ordre) || 0) - (Number(b.ordre) || 0); })
      .map(function (m) {
        var niv = acces[norm(m.id)];
        var apps = (applications || [])
          .filter(function (x) { return norm(x.module) === norm(m.id) && niv >= (Number(x.niveau_min) || 1); })
          .map(function (x) { return { titre: x.titre, description: x.description, emoji: x.emoji, url: x.url }; });
        return { id: m.id, titre: m.titre, icone: m.icone, niveau: niv, apps: apps };
      });
  }

  return { resolve: resolve, menu: menu };
})();

if (typeof module !== 'undefined') module.exports = Droits;
