/**
 * API JSON de la passerelle. Le site (GitHub Pages) appelle  POST <url /exec>  avec un corps texte/JSON
 * (Content-Type: text/plain, pour éviter la pré-requête CORS) :  { action, token?, ...paramètres }
 * Réponse : { ok: true, ... } ou { ok: false, erreur, code }.
 *
 * Administration (niveau 3 sur le module « securite ») : admin_etat, admin_role, admin_actif, admin_droit, admin_exception, emettreCode.
 * Actions : liste, demanderCode, login, activer, me, menu, logout, emettreCode (admin).
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
    case 'login':   return Auth.login(req.ident, req.mdp);
    case 'activer': return Auth.activer(req.ident, req.code, req.mdp);
    case 'logout':  Auth.logout(req.token); return {};
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
