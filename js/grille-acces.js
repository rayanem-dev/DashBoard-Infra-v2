/**
 * Grille « qui a accès à quoi » (page Privilèges) : application × rôle, une case à cocher par couple.
 * Fonctions PURES (testées en Node : apps-script/gateway/test/grille.test.js) ; la page applique ensuite les opérations avec admin_droit / admin_app.
 *
 * Modèle existant, inchangé : un rôle a un niveau (0 à 3) par module ; une application demande un niveau minimal dans son module et peut limiter les rôles (liste vide = tous les rôles).
 *   accès(rôle, application) = niveau du rôle dans le module ≥ niveau minimal  ET  (liste de rôles vide OU rôle dans la liste)
 * Cocher / décocher une case ne touche QUE cette application : si cocher oblige à relever le niveau du rôle dans le module, les autres applications du module
 * qui deviendraient ainsi visibles à ce rôle sont d'abord réservées à leur public actuel.
 */
var GrilleAcces = (function () {
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function role(etat, id) { return etat.roles.filter(function (r) { return norm(r.id) === norm(id); })[0]; }
  function interdit(r, module) { return (r.interdits || []).map(norm).indexOf(norm(module)) !== -1; }
  function niveau(etat, id, module) {
    var r = role(etat, id); if (!r || interdit(r, module)) return 0;
    var d = etat.droitsRole.filter(function (x) { return norm(x.role) === norm(id) && norm(x.module) === norm(module); })[0];
    var n = d ? Number(d.niveau) || 0 : 0, max = Number(r.niveau_max) || 3; return Math.min(n, max);
  }
  function acces(etat, id, app) {
    if (niveau(etat, id, app.module) < (Number(app.niveau_min) || 1)) return false;
    return !app.roles || !app.roles.length || app.roles.map(norm).indexOf(norm(id)) !== -1;
  }
  function rolesAvecAcces(etat, app) { return etat.roles.filter(function (r) { return acces(etat, r.id, app); }).map(function (r) { return r.id; }); }

  /** { ops: [{ type: 'app', titre, niveau_min, roles } | { type: 'droit', role, module, niveau }], notes: [], erreur } pour cocher (voulu = true) ou décocher la case (rôle, application). */
  function plan(etat, id, titre, voulu) {
    var app = etat.applications.filter(function (a) { return a.titre === titre; })[0], r = role(etat, id);
    if (!app || !r) return { erreur: 'Application ou rôle inconnu' };
    var ops = [], notes = [], actuel = acces(etat, id, app);
    if (actuel === voulu) return { ops: [], notes: [] };
    var min = Number(app.niveau_min) || 1;
    if (voulu) {
      if (interdit(r, app.module)) return { erreur: 'Le rôle « ' + r.libelle + ' » ne peut pas accéder à ce module.' };
      if (min > (Number(r.niveau_max) || 3)) return { erreur: 'Le rôle « ' + r.libelle + ' » est plafonné à un niveau inférieur à celui que demande cette application (' + min + ').' };
      if (niveau(etat, id, app.module) < min) {
        var proteges = 0;
        etat.applications.forEach(function (b) {
          if (b.titre === app.titre || norm(b.module) !== norm(app.module) || (b.roles && b.roles.length) || acces(etat, id, b)) return;
          if ((Number(b.niveau_min) || 1) > min) return;                      // exige un niveau plus haut que celui qu'on donne : reste hors de portée
          var qui = rolesAvecAcces(etat, b); if (!qui.length) return;
          ops.push({ type: 'app', titre: b.titre, niveau_min: Number(b.niveau_min) || 1, roles: qui }); proteges += 1;
        });
        ops.push({ type: 'droit', role: id, module: app.module, niveau: min });
        notes.push('Niveau « ' + r.libelle + ' » dans le module : ' + niveau(etat, id, app.module) + ' → ' + min + (proteges ? ' (' + proteges + ' autre(s) application(s) du module gardent leur public actuel)' : '') + '.');
      }
      if (app.roles && app.roles.length && app.roles.map(norm).indexOf(norm(id)) === -1) ops.push({ type: 'app', titre: app.titre, niveau_min: min, roles: app.roles.concat([id]) });
    } else {
      var base = app.roles && app.roles.length ? app.roles.slice() : rolesAvecAcces(etat, app), reste = base.filter(function (x) { return norm(x) !== norm(id); });
      if (!reste.length) return { erreur: 'Une application doit rester accessible à au moins un rôle (sans rôle indiqué, elle serait ouverte à tous).' };
      ops.push({ type: 'app', titre: app.titre, niveau_min: min, roles: reste });
    }
    return { ops: ops, notes: notes };
  }
  return { acces: acces, niveau: niveau, plan: plan, rolesAvecAcces: rolesAvecAcces };
})();
if (typeof module !== 'undefined') module.exports = GrilleAcces;
