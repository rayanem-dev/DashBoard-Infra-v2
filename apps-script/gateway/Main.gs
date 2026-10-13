/**
 * API JSON de la passerelle. Le site (GitHub Pages) appelle  POST <url /exec>  avec un corps texte/JSON
 * (Content-Type: text/plain, pour éviter la pré-requête CORS) :  { action, token?, ...paramètres }
 * Réponse : { ok: true, ... } ou { ok: false, erreur, code }.
 *
 * Planning (module « planning ») : situation, rotation_enregistrer (soi-même : niveau 1 ; autrui : niveau 3), planning (niveau 2 : tout le monde).
 * Administration (niveau 3 sur le module « securite ») : admin_etat, admin_role, admin_actif, admin_droit, admin_exception, emettreCode.
 * Actions : liste, demanderCode, login, activer, reprendre (rester connecté), me, menu, logout, emettreCode (admin).
 * `ident` = identifiant opaque (uid) choisi dans le sélecteur ; l'e-mail est aussi accepté.
 * Les données métier ne sortent QUE par cette passerelle, jamais par un lien public.
 */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    out = { ok: true };
    var r = route_(req);
    for (var k in r) out[k] = r[k];
  } catch (err) {
    out = { ok: false, erreur: err.message, code: err.code || 'ERR' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'DashBoard-Infra gateway' })).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  switch (req.action) {
    case 'liste':        return { utilisateurs: Auth.liste() };
    case 'demanderCode': return Auth.demanderCode(req.ident);
    case 'login':   return Auth.login(req.ident, req.mdp, req.remember);
    case 'activer': return Auth.activer(req.ident, req.code, req.mdp, req.remember);
    case 'reprendre': return Auth.reprendre(req.rt);
    case 'logout':  Auth.logout(req.token, req.rt); return {};
    case 'me':      return { user: Auth.publique(Auth.userFromToken(req.token)), acces: acces_(Auth.userFromToken(req.token)) };
    case 'menu': {
      var u = Auth.userFromToken(req.token);
      return { user: Auth.publique(u), menu: Droits.menu(acces_(u), Store.table('Modules'), Store.table('Applications')) };
    }
    case 'emettreCode': {
      var admin = Auth.userFromToken(req.token);
      if ((acces_(admin).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
      Store.journal('code_active', admin.email, req.email);
      return { code: Auth.emettreCode(req.email) };
    }
    case 'situation': return situationDe_(Auth.userFromToken(req.token));
    case 'rotation_enregistrer': return rotationEnregistrer_(req);
    case 'planning': return planning_(req);
    case 'admin_etat': {
      admin_(req);
      return {
        roles: Droits.ROLES, modules: Store.table('Modules'), droitsRole: Store.table('DroitsRole'), exceptions: Store.table('Exceptions'),
        utilisateurs: Store.table('Utilisateurs').map(function (u) { return { email: u.email, nom: u.nom, service: u.service, fonction: u.fonction, role: u.role, actif: String(u.actif) !== '0' }; })
      };
    }
    case 'admin_role': {
      var a1 = admin_(req); var e1 = Droits.verifier(req.role); if (e1) throw new Error(e1);
      cible_(req.email);
      if (String(req.email).toLowerCase() === String(a1.email).toLowerCase()) throw new Error('Vous ne pouvez pas modifier votre propre rôle');
      Store.maj('Utilisateurs', { email: req.email }, { role: req.role });
      Store.journal('role', a1.email, req.email + ' -> ' + req.role); return {};
    }
    case 'admin_actif': {
      var a2 = admin_(req); cible_(req.email);
      if (String(req.email).toLowerCase() === String(a2.email).toLowerCase()) throw new Error('Vous ne pouvez pas désactiver votre propre compte');
      Store.maj('Utilisateurs', { email: req.email }, { actif: req.actif ? 1 : 0 });
      Store.journal(req.actif ? 'activation' : 'desactivation', a2.email, req.email); return {};
    }
    case 'admin_droit': {
      var a3 = admin_(req); var e3 = Droits.verifier(req.role, Number(req.niveau)); if (e3) throw new Error(e3);
      module_(req.module);
      if (String(req.role) === 'secretariat' && String(req.module) === 'securite' && Number(req.niveau) < 3) throw new Error('Le secrétariat doit garder l\'administration de la sécurité');
      if (Number(req.niveau) === 0) Store.supprimer('DroitsRole', { role: req.role, module: req.module });
      else Store.maj('DroitsRole', { role: req.role, module: req.module }, { niveau: Number(req.niveau) });
      Store.journal('droit_role', a3.email, req.role + '/' + req.module + '=' + req.niveau); return {};
    }
    case 'admin_exception': {
      var a4 = admin_(req); cible_(req.email); module_(req.module);
      if (req.niveau === null || req.niveau === undefined || req.niveau === '') Store.supprimer('Exceptions', { email: req.email, module: req.module });
      else { var e4 = Droits.verifier(undefined, Number(req.niveau)); if (e4) throw new Error(e4); Store.maj('Exceptions', { email: req.email, module: req.module }, { niveau: Number(req.niveau) }); }
      Store.journal('exception', a4.email, req.email + '/' + req.module + '=' + req.niveau); return {};
    }
    default: throw new Error('Action inconnue');
  }
}

function acces_(user) { return Droits.resolve(user, Store.table('DroitsRole'), Store.table('Exceptions')); }

function admin_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function cible_(email) { if (!Store.utilisateur(email)) throw new Error('Utilisateur inconnu'); }
function module_(id) {
  if (!Store.table('Modules').some(function (m) { return String(m.id).toLowerCase() === String(id).toLowerCase(); })) throw new Error('Module inconnu');
}

// ---------- Planning (rotations) ----------
function jour_(v) {
  var s = String(v == null ? '' : v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(v); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function rotationDe_(email) {
  var l = Store.table('Rotations'); email = String(email).toLowerCase();
  for (var i = 0; i < l.length; i += 1) if (String(l[i].email).toLowerCase() === email) {
    return { statut: String(l[i].statut), depuis: jour_(l[i].depuis), jours_travail: Number(l[i].jours_travail), jours_repos: Number(l[i].jours_repos) };
  }
  return null;
}
function situationDe_(u) {
  if ((acces_(u).planning || 0) < 1) return { acces: false };
  var rot = rotationDe_(u.email);
  if (!rot) return { acces: true, configuree: false, nom: u.nom };
  return { acces: true, configuree: true, nom: u.nom, rotation: rot, situation: Planning.situation(rot, [], Dates.today()) };
}
function rotationEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); var niv = acces_(u).planning || 0;
  var email = String(req.email || u.email).toLowerCase();
  if (email !== String(u.email).toLowerCase()) { if (niv < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); cible_(email); }
  else if (niv < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var rot = { statut: String(req.statut), depuis: String(req.depuis), jours_travail: Number(req.jours_travail), jours_repos: Number(req.jours_repos) };
  var err = Planning.valider(rot, Dates.today()); if (err) throw new Error(err);
  Store.maj('Rotations', { email: email }, { statut: rot.statut, depuis: rot.depuis, jours_travail: rot.jours_travail, jours_repos: rot.jours_repos, maj_par: u.email, maj_le: new Date().toISOString() });
  Store.journal('rotation', u.email, email + ' ' + rot.statut + ' depuis ' + rot.depuis + ' (' + rot.jours_travail + '/' + rot.jours_repos + ')');
  return situationDe_(Store.utilisateur(email));
}
function planning_(req) {
  var u = Auth.userFromToken(req.token); var niv = acces_(u).planning || 0;
  if (niv < 2) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var auj = Dates.today();
  var debut = Dates.isDate(req.debut) ? req.debut : Dates.addDays(auj, -7);
  var n = Math.max(7, Math.min(62, Number(req.jours) || 35));
  var lignes = Store.table('Utilisateurs').filter(function (x) { return String(x.actif) !== '0' && x.email; }).map(function (x) {
    var l = { nom: x.nom, service: x.service, fonction: x.fonction, configuree: false };
    if (niv >= 3) l.email = x.email;
    var rot = rotationDe_(x.email);
    if (!rot) return l;
    var s = Planning.situation(rot, [], auj);
    l.configuree = true; l.rotation = { jours_travail: rot.jours_travail, jours_repos: rot.jours_repos, statut: rot.statut, depuis: rot.depuis };
    l.situation = s; l.grille = Planning.grille(rot, [], debut, n);
    return l;
  });
  return { aujourdhui: auj, debut: debut, jours: n, peutModifier: niv >= 3, lignes: lignes };
}
