/**
 * API JSON de la passerelle. Le site (GitHub Pages) appelle  POST <url /exec>  avec un corps texte/JSON
 * (Content-Type: text/plain, pour éviter la pré-requête CORS) :  { action, token?, ...paramètres }
 * Réponse : { ok: true, ... } ou { ok: false, erreur, code }.
 *
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
    default: throw new Error('Action inconnue');
  }
}

function acces_(user) { return Droits.resolve(user, Store.table('DroitsRole'), Store.table('Exceptions')); }
