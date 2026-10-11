/**
 * Authentification : e-mail + mot de passe (sel + poivre, SHA-256 itéré), sessions dans le cache du script.
 * L'identité vient de l'onglet Utilisateurs (copie nettoyée de BDDORGA). Les empreintes sont dans un AUTRE classeur.
 * Un compte s'ouvre avec un code d'activation à usage unique remis par l'administrateur (48 h) : personne ne peut
 * « réclamer » un compte juste parce que son e-mail figure dans la liste.
 */
var Auth = (function () {
  function hash(mdp, sel) {
    var d = prop_('PEPPER') + sel + mdp;
    for (var i = 0; i < CFG.HASH_ITER; i += 1) d = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, d));
    return d;
  }
  function tok_() { return Utilities.getUuid() + Utilities.getUuid().replace(/-/g, ''); }
  function erreur_(msg, code) { var e = new Error(msg); e.code = code || 'ERR'; return e; }
  function secrets_() { return SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants'); }

  function ligneSecret_(email) {
    var sh = secrets_(); var v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i += 1) if (String(v[i][0]).toLowerCase() === email) return { sh: sh, ligne: i + 1, row: v[i] };
    return null;
  }

  function limiter_(email) {
    var c = CacheService.getScriptCache(); var k = 'T_' + email; var n = Number(c.get(k) || 0);
    if (n >= CFG.MAX_TENTATIVES) throw erreur_('Trop de tentatives. Réessayez dans quelques minutes.', 'LIMITE');
    return function echec() { c.put(k, String(n + 1), CFG.FENETRE_SECONDES); };
  }

  function ouvrirSession_(user) {
    var t = tok_();
    CacheService.getScriptCache().put('S_' + t, user.email, CFG.SESSION_SECONDS);
    return t;
  }

  /** Administrateur : génère un code d'activation (à transmettre de vive voix / message privé). */
  function emettreCode(email) {
    email = String(email || '').trim().toLowerCase();
    if (!Store.utilisateur(email)) throw erreur_('Utilisateur inconnu');
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var sel = Utilities.getUuid().replace(/-/g, '');
    var exp = Date.now() + CFG.CODE_ACTIVATION_HEURES * 3600000;
    var l = ligneSecret_(email);
    var ligne = [email, l ? l.row[1] : '', l ? l.row[2] : '', sel, hash(code, sel), exp, 1];
    if (l) l.sh.getRange(l.ligne, 1, 1, 7).setValues([ligne]); else secrets_().appendRow(ligne);
    return code;
  }

  function activer(email, code, mdp) {
    email = String(email || '').trim().toLowerCase();
    var echec = limiter_(email);
    var l = ligneSecret_(email);
    if (!l || !l.row[3] || Number(l.row[5]) < Date.now() || hash(String(code || ''), l.row[3]) !== l.row[4]) { echec(); throw erreur_('Code invalide ou expiré'); }
    controleMdp_(mdp);
    var sel = Utilities.getUuid().replace(/-/g, '');
    l.sh.getRange(l.ligne, 1, 1, 7).setValues([[email, sel, hash(String(mdp), sel), '', '', '', 0]]);
    return connecter_(email);
  }

  function controleMdp_(mdp) {
    mdp = String(mdp || '');
    if (mdp.length < CFG.MDP_MIN) throw erreur_('Mot de passe : ' + CFG.MDP_MIN + ' caractères minimum');
    if (!/[A-Za-z]/.test(mdp) || !/[0-9]/.test(mdp)) throw erreur_('Mot de passe : au moins une lettre et un chiffre');
  }

  function login(email, mdp) {
    email = String(email || '').trim().toLowerCase();
    var echec = limiter_(email);
    var l = ligneSecret_(email);
    if (!l || !l.row[1] || hash(String(mdp || ''), l.row[1]) !== l.row[2]) { echec(); throw erreur_('E-mail ou mot de passe incorrect'); }
    return connecter_(email);
  }

  function connecter_(email) {
    var u = Store.utilisateur(email);
    if (!u || String(u.actif) === '0') throw erreur_('Compte désactivé');
    var token = ouvrirSession_(u);
    Store.journal('connexion', email, '');
    return { token: token, user: publique_(u) };
  }

  function publique_(u) { return { email: u.email, nom: u.nom, role: u.role, service: u.service, fonction: u.fonction }; }

  function userFromToken(token) {
    var email = token ? CacheService.getScriptCache().get('S_' + token) : null;
    if (!email) throw erreur_('Session expirée', 'SESSION');
    var u = Store.utilisateur(email);
    if (!u || String(u.actif) === '0') throw erreur_('Compte désactivé', 'SESSION');
    return u;
  }

  function logout(token) { if (token) CacheService.getScriptCache().remove('S_' + token); }

  return { login: login, activer: activer, emettreCode: emettreCode, userFromToken: userFromToken, logout: logout, publique: publique_ };
})();
