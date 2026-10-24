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
 * Résultat de resolve : { module: niveau } pour les seuls modules accessibles (niveau >= 1).
 * Chaque APPLICATION peut en plus être limitée à certains rôles (colonne « roles » du catalogue) et à un niveau minimal.
 */
var Droits = (function () {
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  // ---- Rôles ----
  var ROLES = ['agent', 'conducteur', 'dessinateur', 'chef_atelier', 'chef_service', 'interim_chef_service', 'cadre_sup', 'chef_division',
               'ordonnateur', 'cpm', 'secretariat', 'stagiaire', 'prestataire', 'guest'];
  // Variantes de saisie courantes → rôle canonique (accents, majuscules, « _ » ou espace, fautes fréquentes).
  var ALIAS = {
    'secretaire': 'secretariat', 'secretariat': 'secretariat',
    'chef division': 'chef_division', 'chef de division': 'chef_division',
    'chef service': 'chef_service', 'chef de service': 'chef_service',
    'interim chef service': 'interim_chef_service', 'interim chef de service': 'interim_chef_service',
    'chef atelier': 'chef_atelier', 'chef d atelier': 'chef_atelier',
    'cadre sup': 'cadre_sup', 'cadre superieur': 'cadre_sup',
    'ordonateur': 'ordonnateur', 'ordonnateur': 'ordonnateur',
    'conducteur': 'conducteur', 'conducteur des travaux': 'conducteur', 'conducteur de travaux': 'conducteur',
    'dessinateur': 'dessinateur', 'agent': 'agent', 'cpm': 'cpm', 'stagiaire': 'stagiaire',
    'prestataire': 'prestataire', 'invite': 'guest', 'guest': 'guest', 'visiteur': 'guest'
  };
  // Plafonds de sécurité : quoi qu'on configure, ces rôles ne dépassent jamais ce niveau ni n'ouvrent ces modules.
  var PLAFOND = { guest: 1, stagiaire: 1, prestataire: 2 };
  var INTERDITS = {
    guest: ['securite', 'rh', 'admin', 'planning', 'badges'],
    stagiaire: ['securite', 'rh', 'admin', 'badges'],
    prestataire: ['securite', 'rh', 'admin']
  };

  // Définition des rôles fournis d'origine (graine de l'onglet « Roles ») : { id, libelle, niveau_max (0 = sans plafond), interdits }.
  var LIBELLES = {
    agent: 'Agent', conducteur: 'Conducteur des travaux', dessinateur: 'Dessinateur', chef_atelier: 'Chef d\'atelier',
    chef_service: 'Chef de service', interim_chef_service: 'Chef de service (intérim)', cadre_sup: 'Cadre supérieur',
    chef_division: 'Chef de division', ordonnateur: 'Ordonnateur', cpm: 'Cellule Passation de marché',
    secretariat: 'Secrétariat', stagiaire: 'Stagiaire', prestataire: 'Prestataire', guest: 'Invité (lecture seule)'
  };
  // Photographie des rôles d'origine, prise une fois pour toutes (configurer() modifie ROLES / PLAFOND / INTERDITS).
  var DEFAUT = ROLES.map(function (id) { return { id: id, libelle: LIBELLES[id] || id, niveau_max: PLAFOND[id] || 0, interdits: (INTERDITS[id] || []).slice() }; });
  function rolesParDefaut() {
    return DEFAUT.map(function (r) { return { id: r.id, libelle: r.libelle, niveau_max: r.niveau_max, interdits: r.interdits.slice() }; });
  }
  /**
   * Remplace la liste des rôles, plafonds et modules interdits par ceux de l'onglet « Roles » (modifiable par l'administrateur).
   * defs : [{ id, niveau_max, interdits: [] }]. Liste vide → définitions d'origine.
   */
  function configurer(defs) {
    var src = defs && defs.length ? defs : DEFAUT;
    ROLES.length = 0; Object.keys(PLAFOND).forEach(function (k) { delete PLAFOND[k]; }); Object.keys(INTERDITS).forEach(function (k) { delete INTERDITS[k]; });
    src.forEach(function (r) {
      var id = roleCanon(r.id); if (!id || ROLES.indexOf(id) !== -1) return;
      ROLES.push(id);
      var n = Number(r.niveau_max) || 0; if (n >= 1 && n <= 2) PLAFOND[id] = n;
      var i = (r.interdits || []).map(norm).filter(Boolean); if (i.length) INTERDITS[id] = i;
    });
  }
  /** Contrôle d'une définition de rôle ; retourne le message d'erreur ou ''. */
  function validerRole(def, idsExistants, idsModules, creation) {
    var id = roleCanon(def.id || def.libelle);
    if (!/^[a-z0-9_]{2,30}$/.test(id)) return 'Identifiant invalide : 2 à 30 lettres, chiffres ou _';
    if (creation && idsExistants.indexOf(id) !== -1) return 'Ce rôle existe déjà';
    if (!String(def.libelle || '').trim()) return 'Donnez un nom au rôle';
    var n = Number(def.niveau_max) || 0; if (!(n === 0 || n === 1 || n === 2 || n === 3)) return 'Niveau maximum invalide';
    var bad = (def.interdits || []).filter(function (m) { return idsModules.indexOf(norm(m)) === -1; });
    if (bad.length) return 'Module inconnu : ' + bad[0];
    return '';
  }

  function roleCanon(r) {
    var s = norm(r).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return ALIAS[s] || s.replace(/ /g, '_');
  }
  function permis(role, module) { return (INTERDITS[roleCanon(role)] || []).indexOf(norm(module)) === -1; }
  function plafonner(role, niveau) { var p = PLAFOND[roleCanon(role)]; return p ? Math.min(niveau, p) : niveau; }

  function resolve(user, droitsRole, exceptions) {
    var res = {};
    var role = roleCanon(user.role);
    (droitsRole || []).forEach(function (d) {
      if (roleCanon(d.role) !== role) return;
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
    Object.keys(res).forEach(function (m) {
      if (!permis(role, m)) { delete res[m]; return; }
      res[m] = plafonner(role, res[m]);
      if (res[m] < 1) delete res[m];
    });
    return res;
  }

  function rolesDe(x) {
    return String(x == null ? '' : x).split(/[,;]/).map(roleCanon).filter(function (r) { return r; });
  }

  /** Menu : modules accessibles (triés) avec leurs applications (niveau minimal atteint ET rôle autorisé si une liste est définie). */
  function menu(acces, catalogue, applications, role) {
    var rc = roleCanon(role);
    return (catalogue || [])
      .filter(function (m) { return acces[norm(m.id)] >= 1 && String(m.actif) !== '0'; })
      .sort(function (a, b) { return (Number(a.ordre) || 0) - (Number(b.ordre) || 0); })
      .map(function (m) {
        var niv = acces[norm(m.id)];
        var apps = (applications || [])
          .filter(function (x) {
            if (norm(x.module) !== norm(m.id) || niv < (Number(x.niveau_min) || 1)) return false;
            var liste = rolesDe(x.roles);
            return !liste.length || liste.indexOf(rc) !== -1;
          })
          .map(function (x) { return { titre: x.titre, description: x.description, emoji: x.emoji, url: x.url, rubrique: String(x.rubrique || '') }; });
        return { id: m.id, titre: m.titre, icone: m.icone, niveau: niv, apps: apps };
      });
  }

  /** Contrôle d'une écriture (rôle, niveau, module) : retourne le message d'erreur ou ''. */
  function verifier(role, niveau, module) {
    if (role !== undefined && ROLES.indexOf(roleCanon(role)) === -1) return 'Rôle inconnu';
    if (niveau !== undefined && !(niveau === 0 || niveau === 1 || niveau === 2 || niveau === 3)) return 'Niveau invalide (0 à 3)';
    if (role !== undefined && module !== undefined && niveau > 0 && !permis(role, module)) return 'Ce rôle ne peut pas accéder à ce module';
    if (role !== undefined && niveau !== undefined && PLAFOND[roleCanon(role)] && niveau > PLAFOND[roleCanon(role)]) return 'Niveau maximum pour ce rôle : ' + PLAFOND[roleCanon(role)];
    return '';
  }

  return { resolve: resolve, menu: menu, verifier: verifier, roleCanon: roleCanon, rolesDe: rolesDe, configurer: configurer, validerRole: validerRole, rolesParDefaut: rolesParDefaut, ROLES: ROLES, PLAFOND: PLAFOND, INTERDITS: INTERDITS };
})();

if (typeof module !== 'undefined') module.exports = Droits;
