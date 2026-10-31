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
  /** Adresse où envoyer les codes : « email_contact » (corrigée par l'agent ou le secrétariat) si elle est valable, sinon l'adresse du compte NETTOYÉE (espaces, caractères invisibles retirés). */
  function adresseEnvoi_(u) {
    var c = Annuaire.analyserEmail(u.email_contact); if (c.valide) return c.propre;
    var d = Annuaire.analyserEmail(u.email); return d.valide ? d.propre : '';
  }
  /** Journal de connexion : jamais de mot de passe ni de code dans le détail. */
  function noter_(action, email, detail) { try { Store.journal(action, email || '', String(detail || '').slice(0, 200)); } catch (e) { /* le journal ne doit jamais bloquer une connexion */ } }
  function quotaMail_() { try { return typeof MailApp !== 'undefined' && MailApp.getRemainingDailyQuota ? MailApp.getRemainingDailyQuota() : ''; } catch (e) { return ''; } }
  function secrets_() { return SpreadsheetApp.openById(prop_('SECRETS_ID')).getSheetByName('Identifiants'); }

  function ligneSecret_(email) {
    var sh = secrets_(); var v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i += 1) if (String(v[i][0]).toLowerCase() === email) return { sh: sh, ligne: i + 1, row: v[i] };
    return null;
  }

  function limiter_(email) {
    var c = CacheService.getScriptCache(); var k = 'T_' + email; var n = Number(c.get(k) || 0);
    if (n >= CFG.MAX_TENTATIVES) { noter_('connexion_bloque', email, 'trop de tentatives (' + CFG.MAX_TENTATIVES + ' en ' + Math.round(CFG.FENETRE_SECONDES / 60) + ' min)'); throw erreur_('Trop de tentatives. Réessayez dans quelques minutes.', 'LIMITE'); }
    return function echec() { c.put(k, String(n + 1), CFG.FENETRE_SECONDES); };
  }

  function ouvrirSession_(user) {
    var t = tok_();
    CacheService.getScriptCache().put('S_' + t, user.email, CFG.SESSION_SECONDS);
    return t;
  }

  function poserCode_(email, dureeMs) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var sel = Utilities.getUuid().replace(/-/g, '');
    var l = ligneSecret_(email);
    var ligne = [email, l ? l.row[1] : '', l ? l.row[2] : '', sel, hash(code, sel), Date.now() + dureeMs, 1];
    if (l) l.sh.getRange(l.ligne, 1, 1, 7).setValues([ligne]); else secrets_().appendRow(ligne);
    return code;
  }

  /** Administrateur : code de secours (48 h) à remettre de vive voix, pour qui n'a pas d'adresse e-mail. */
  function emettreCode(email) {
    email = String(email || '').trim().toLowerCase();
    if (!Store.utilisateur(email)) throw erreur_('Utilisateur inconnu');
    return poserCode_(email, CFG.CODE_ACTIVATION_HEURES * 3600000);
  }

  /**
   * Recherche pour la page de connexion (publique) : AUCUNE liste complète n'est jamais renvoyée.
   * Il faut au moins 3 lettres ; on renvoie au plus 8 personnes dont le nom contient tous les mots tapés
   * (sans tenir compte des accents ni des majuscules). Jamais d'e-mail, de matricule ni de numéro.
   */
  function liste(q) {
    var mots = Annuaire.norm(q).split(' ').filter(Boolean);
    if (Annuaire.norm(q).replace(/ /g, '').length < 3) return { utilisateurs: [], plus: false, court: true };
    var trouves = Store.table('Utilisateurs')
      .filter(function (u) { return String(u.actif) !== '0' && u.uid; })
      .map(function (u) { return { uid: u.uid, nom: Annuaire.nomAffichable(u.nom, u.email), service: u.service }; })
      .filter(function (u) { var h = Annuaire.norm(u.nom); return mots.every(function (m) { return h.indexOf(m) !== -1; }); })
      .sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom), 'fr'); });
    return { utilisateurs: trouves.slice(0, 8), plus: trouves.length > 8, court: false };
  }

  function resoudre_(ident) {
    var u = Store.parUid(ident) || Store.utilisateur(ident);
    return u && String(u.actif) !== '0' ? u : null;
  }

  /** Première connexion ou mot de passe oublié : un code à usage unique (30 min) part par e-mail. */
  function demanderCode(ident) {
    var u = resoudre_(ident);
    if (!u) { noter_('code_echec', '', 'demande de code : identifiant inconnu (' + String(ident || '').slice(0, 40) + ')'); throw erreur_('Utilisateur inconnu'); }
    var email = String(u.email || '').trim().toLowerCase(), dest = adresseEnvoi_(u);
    if (!email) { noter_('code_echec', '', 'aucune adresse e-mail pour ' + (u.nom || u.uid)); throw erreur_('Aucune adresse e-mail pour ce compte : contactez le secrétariat.', 'SANS_EMAIL'); }
    if (!dest) {
      noter_('code_echec', email, 'adresse e-mail inutilisable : ' + Annuaire.analyserEmail(u.email).problemes.join(', '));
      throw erreur_('L\'adresse e-mail enregistrée pour ce compte n\'est pas valable. Connectez-vous avec le mot de passe fourni par le secrétariat (ou 0000) puis corrigez votre adresse sur la page d\'accueil, ou contactez le secrétariat.', 'ADRESSE');
    }
    var c = CacheService.getScriptCache(); var k = 'C_' + email; var n = Number(c.get(k) || 0);
    if (n >= 3) { noter_('code_limite', email, '3 demandes de code déjà faites cette heure'); throw erreur_('Trop de demandes. Réessayez dans une heure.', 'LIMITE'); }
    c.put(k, String(n + 1), 3600);
    var code = poserCode_(email, CFG.CODE_EMAIL_MINUTES * 60000);
    try { Mail.envoyerCode(dest, u.nom, code, CFG.CODE_EMAIL_MINUTES); }
    catch (err) {
      noter_('code_echec', email, 'envoi impossible : ' + String(err && err.message || err) + ' (quota restant : ' + quotaMail_() + ')');
      throw erreur_('Le code n\'a pas pu être envoyé par e-mail : contactez le secrétariat (il peut vous remettre un code de secours).', 'MAIL');
    }
    noter_('code_envoye', email, 'envoyé à ' + Mail.masquer(dest) + (dest !== email ? ' (adresse de contact)' : '') + ' (quota restant : ' + quotaMail_() + ')');
    return { masque: Mail.masquer(dest), minutes: CFG.CODE_EMAIL_MINUTES };
  }

  function activer(ident, code, mdp, remember) {
    var u0 = resoudre_(ident); if (!u0) { noter_('activation_echec', '', 'identifiant inconnu'); throw erreur_('Code invalide ou expiré'); }
    var email = String(u0.email || '').trim().toLowerCase();
    var echec = limiter_(email);
    var l = ligneSecret_(email);
    if (!l || !l.row[3] || Number(l.row[5]) < Date.now() || hash(String(code || ''), l.row[3]) !== l.row[4]) {
      echec(); noter_('activation_echec', email, !l || !l.row[3] ? 'aucun code en attente' : Number(l.row[5]) < Date.now() ? 'code expiré' : 'code incorrect'); throw erreur_('Code invalide ou expiré');
    }
    controleMdp_(mdp);
    var sel = Utilities.getUuid().replace(/-/g, '');
    l.sh.getRange(l.ligne, 1, 1, 7).setValues([[email, sel, hash(String(mdp), sel), '', '', '', 0]]);
    noter_('activation', email, 'mot de passe défini avec le code');
    return connecter_(email, remember);
  }

  function controleMdp_(mdp) {
    mdp = String(mdp == null ? '' : mdp);
    if (mdp.length < CFG.MDP_MIN) throw erreur_('Mot de passe : ' + CFG.MDP_MIN + ' caractères minimum');
  }

  /** Installe le mot de passe par défaut (provisoire, sans expiration : 2) d'un compte qui n'en a pas encore ; retourne la ligne de secret. */
  function installerMdpDefaut_(email, l) {
    var e = empreinteDe(CFG.MDP_DEFAUT), ligne = [email, e.sel, e.empreinte, '', '', '', 2];
    if (l) l.sh.getRange(l.ligne, 1, 1, 7).setValues([ligne]); else secrets_().appendRow(ligne);
    noter_('mdp_defaut_auto', email, 'mot de passe par défaut installé à la première connexion');
    return ligneSecret_(email);
  }

  function login(ident, mdp, remember) {
    var u0 = resoudre_(ident); if (!u0) { noter_('connexion_echec', '', 'identifiant inconnu ou compte désactivé (' + String(ident || '').slice(0, 40) + ')'); throw erreur_('Identifiant ou mot de passe incorrect'); }
    var email = String(u0.email || '').trim().toLowerCase();
    var echec = limiter_(email);
    var l = ligneSecret_(email);
    if ((!l || !l.row[1]) && String(mdp || '') === String(CFG.MDP_DEFAUT) && typeof mdpDefautAutorise_ === 'function' && mdpDefautAutorise_(u0)) l = installerMdpDefaut_(email, l);   // jamais connecté : « 0000 » (provisoire, sans expiration) ouvre le compte
    if (!l || !l.row[1] || hash(String(mdp || ''), l.row[1]) !== l.row[2]) { echec(); noter_('connexion_echec', email, !l || !l.row[1] ? 'aucun mot de passe défini (première connexion à faire)' : 'mot de passe incorrect'); throw erreur_('Identifiant ou mot de passe incorrect'); }
    // doit_changer : 0 = mot de passe choisi · 2 = provisoire SANS expiration (jusqu'à ce que la personne le change) · > 2 = provisoire jusqu'à cette date (ms).
    var exp = Number(l.row[6]) || 0;
    if (exp > 2 && Date.now() > exp) { noter_('connexion_echec', email, 'mot de passe par défaut expiré'); throw erreur_('Le mot de passe par défaut a expiré : utilisez « Première connexion ou mot de passe oublié ? ».', 'DEFAUT_EXPIRE'); }
    return connecter_(email, remember);
  }

  function connecter_(email, remember) {
    var u = Store.utilisateur(email);
    if (!u || String(u.actif) === '0') throw erreur_('Compte désactivé');
    var token = ouvrirSession_(u);
    Store.journal('connexion', email, remember ? 'rester connecté' : '');
    var out = { token: token, user: publique_(u) };
    if (remember) out.remember = emettreRemember_(email);
    return out;
  }

  // « Rester connecté » : jeton aléatoire long, seule son empreinte est gardée (propriétés du script), 30 jours, à usage unique (renouvelé à chaque reprise).
  function rmKey_(t) { return 'RM_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t))).replace(/[^A-Za-z0-9]/g, '').slice(0, 40); }
  function emettreRemember_(email) {
    var props = PropertiesService.getScriptProperties(); var now = Date.now();
    var all = props.getProperties();
    Object.keys(all).forEach(function (k) { if (k.indexOf('RM_') === 0) { try { if (JSON.parse(all[k]).x < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } } });
    var t = tok_() + tok_();
    props.setProperty(rmKey_(t), JSON.stringify({ e: email, x: now + CFG.REMEMBER_DAYS * 86400000 }));
    return t;
  }
  function reprendre(rt) {
    var props = PropertiesService.getScriptProperties(); var k = rmKey_(rt || '');
    var v = null; try { v = JSON.parse(props.getProperty(k) || 'null'); } catch (e) { v = null; }
    if (!rt || !v || v.x < Date.now()) { if (v) props.deleteProperty(k); throw erreur_('Session expirée', 'SESSION'); }
    props.deleteProperty(k);
    var u = Store.utilisateur(v.e);
    if (!u || String(u.actif) === '0') throw erreur_('Compte désactivé', 'SESSION');
    return { token: ouvrirSession_(u), user: publique_(u), remember: emettreRemember_(u.email) };
  }

  /** « 123456789012345678 » → « 1234••••••5678 » : la fiche n'affiche jamais le NIN en entier. */
  function masquer_(v) { var x = String(v == null ? '' : v).replace(/\s+/g, ''); return x.length < 8 ? (x ? '••••' : '') : x.slice(0, 4) + '••••••' + x.slice(-4); }

  function publique_(u) {
    return { email: u.email, nom: Annuaire.nomAffichable(u.nom, u.email), civilite: u.civilite || '', matricule: u.matricule || '', role: u.role, service: u.service, fonction: u.fonction,
             dependance: u.dependance || '', telephone: u.telephone || '', email_contact: u.email_contact || '',
             sona: u.sona || '', date_integration: Annuaire.dateIso(u.date_integration),
             wifi_user: u.wifi_user || '', sap: u.sap || '', nin_masque: masquer_(u.nin), nin_renseigne: !!String(u.nin || '').trim() };
  }

  /**
   * Mode support : une session au nom d'un autre compte, ouverte par un administrateur (jamais pour son propre compte), 2 h au plus.
   * La session garde la trace de qui l'a ouverte (« I_<jeton> ») : elle ne peut ni changer de mot de passe, ni toucher aux privilèges, ni en ouvrir une autre.
   */
  function usurper(admin, email) {
    var cible = Store.utilisateur(email);
    if (!cible) throw erreur_('Utilisateur inconnu');
    if (String(cible.actif) === '0') throw erreur_('Compte désactivé : réactivez-le d\'abord');
    if (String(cible.email).toLowerCase() === String(admin.email).toLowerCase()) throw erreur_('C\'est déjà votre compte');
    var t = tok_(), c = CacheService.getScriptCache(), duree = Math.min(CFG.SESSION_SECONDS, 2 * 3600);
    c.put('S_' + t, cible.email, duree); c.put('I_' + t, admin.email, duree);
    noter_('support_usurpation', admin.email, 'au nom de ' + cible.email);
    return { token: t, user: publique_(cible), par: admin.email, expire_s: duree };
  }
  function estUsurpation(token) { return !!(token && CacheService.getScriptCache().get('I_' + token)); }

  function userFromToken(token) {
    var email = token ? CacheService.getScriptCache().get('S_' + token) : null;
    if (!email) throw erreur_('Session expirée', 'SESSION');
    var u = Store.utilisateur(email);
    if (!u || String(u.actif) === '0') throw erreur_('Compte désactivé', 'SESSION');
    return u;
  }

  /** Empreinte d'un mot de passe avec un sel neuf : { sel, empreinte } (pour l'installation du mot de passe par défaut). */
  function empreinteDe(mdp) { var sel = Utilities.getUuid().replace(/-/g, ''); return { sel: sel, empreinte: hash(String(mdp), sel) }; }

  /** true si le compte utilise encore le mot de passe par défaut (non expiré). */
  function estParDefaut(email) {
    var l = ligneSecret_(String(email || '').toLowerCase());
    var v = l ? Number(l.row[6]) || 0 : 0;
    return v === 2 || v > Date.now();
  }

  /** Changer son mot de passe (connecté) : l'ancien est exigé. Le mot de passe par défaut ne peut pas être réutilisé. */
  function changerMdp(token, ancien, nouveau) {
    var u = userFromToken(token); var email = String(u.email).toLowerCase();
    var echec = limiter_(email);
    var l = ligneSecret_(email);
    if (!l || !l.row[1] || hash(String(ancien || ''), l.row[1]) !== l.row[2]) { echec(); throw erreur_('Ancien mot de passe incorrect'); }
    controleMdp_(nouveau);
    if (String(nouveau) === String(CFG.MDP_DEFAUT)) throw erreur_('Choisissez un autre mot de passe que celui par défaut');
    var sel = Utilities.getUuid().replace(/-/g, '');
    l.sh.getRange(l.ligne, 1, 1, 7).setValues([[email, sel, hash(String(nouveau), sel), '', '', '', 0]]);
    Store.journal('mdp_change', email, '');
    return {};
  }

  /** Administrateur : définit un mot de passe PROVISOIRE (sans expiration ; la personne devra en choisir un autre dès sa connexion) et lève les blocages. */
  function definirMdpAdmin(email, mdp) {
    email = String(email || '').trim().toLowerCase();
    if (!Store.utilisateur(email)) throw erreur_('Utilisateur inconnu');
    controleMdp_(mdp);
    var sel = Utilities.getUuid().replace(/-/g, ''), l = ligneSecret_(email), ligne = [email, sel, hash(String(mdp), sel), '', '', '', 2];
    if (l) l.sh.getRange(l.ligne, 1, 1, 7).setValues([ligne]); else secrets_().appendRow(ligne);
    var c = CacheService.getScriptCache(); c.remove('T_' + email); c.remove('C_' + email);
    return true;
  }
  /** État du mot de passe d'un compte, sans rien révéler de secret : aucun | choisi | provisoire | provisoire_expire | code_en_attente. */
  function etatSecret(email) {
    var l = ligneSecret_(String(email || '').trim().toLowerCase());
    if (!l) return 'aucun';
    var exp = Number(l.row[6]) || 0, codeValide = l.row[3] && Number(l.row[5]) > Date.now();
    if (!l.row[1]) return codeValide ? 'code_en_attente' : 'aucun';
    if (exp > 2 && Date.now() > exp) return 'provisoire_expire';
    if (exp === 2 || exp > Date.now()) return 'provisoire';
    return codeValide ? 'code_en_attente' : 'choisi';
  }
  function compteurs(email) { var c = CacheService.getScriptCache(); return { essais: Number(c.get('T_' + email) || 0), demandes_code: Number(c.get('C_' + email) || 0) }; }

  /** Agent connecté : demande de changer l'adresse où arrivent ses codes. Un code est envoyé à la NOUVELLE adresse pour la confirmer. */
  function demanderEmailContact(user, adresse) {
    var a = Annuaire.analyserEmail(adresse), email = String(user.email).toLowerCase();
    if (!a.valide) throw erreur_('Adresse e-mail invalide' + (a.problemes.length ? ' : ' + a.problemes[0] : ''), 'ADRESSE');
    var c = CacheService.getScriptCache(), k = 'ECN_' + email, n = Number(c.get(k) || 0);
    if (n >= 3) { noter_('code_limite', email, 'changement d\'adresse : 3 demandes cette heure'); throw erreur_('Trop de demandes. Réessayez dans une heure.', 'LIMITE'); }
    c.put(k, String(n + 1), 3600);
    var code = String(Math.floor(100000 + Math.random() * 900000)), sel = Utilities.getUuid().replace(/-/g, '');
    c.put('EC_' + email, JSON.stringify({ a: a.propre, s: sel, h: hash(code, sel) }), 1800);
    try { Mail.envoyerCode(a.propre, user.nom, code, 30, 'adresse'); }
    catch (err) { noter_('code_echec', email, 'changement d\'adresse : envoi impossible : ' + String(err && err.message || err)); throw erreur_('Le code n\'a pas pu être envoyé à cette adresse. Vérifiez-la ou contactez le secrétariat.', 'MAIL'); }
    noter_('email_contact_code', email, 'code envoyé à ' + Mail.masquer(a.propre));
    return { masque: Mail.masquer(a.propre) };
  }
  function confirmerEmailContact(user, code) {
    var email = String(user.email).toLowerCase(), echec = limiter_(email), c = CacheService.getScriptCache(), v = c.get('EC_' + email), o = null;
    try { o = v ? JSON.parse(v) : null; } catch (e) { o = null; }
    if (!o || hash(String(code || '').trim(), o.s) !== o.h) { echec(); noter_('activation_echec', email, 'changement d\'adresse : code ' + (o ? 'incorrect' : 'absent ou expiré')); throw erreur_('Code invalide ou expiré'); }
    Store.maj('Utilisateurs', { email: user.email }, { email_contact: o.a });
    c.remove('EC_' + email);
    noter_('email_contact', email, 'adresse de contact changée : ' + Mail.masquer(o.a));
    return { email_contact: o.a };
  }
  /** Administrateur : fixe l'adresse de contact d'un compte (nettoyée et vérifiée). */
  function definirEmailContact(email, adresse) {
    if (!Store.utilisateur(email)) throw erreur_('Utilisateur inconnu');
    var a = Annuaire.analyserEmail(adresse);
    if (adresse && !a.valide) throw erreur_('Adresse e-mail invalide' + (a.problemes.length ? ' : ' + a.problemes[0] : ''), 'ADRESSE');
    Store.maj('Utilisateurs', { email: email }, { email_contact: adresse ? a.propre : '' });
    return a.propre;
  }

  function logout(token, rt) {
    if (token) CacheService.getScriptCache().remove('S_' + token);
    if (rt) PropertiesService.getScriptProperties().deleteProperty(rmKey_(rt));
  }

  return { adresseEnvoi: adresseEnvoi_, demanderEmailContact: demanderEmailContact, confirmerEmailContact: confirmerEmailContact, definirEmailContact: definirEmailContact, definirMdpAdmin: definirMdpAdmin, etatSecret: etatSecret, compteurs: compteurs, empreinteDe: empreinteDe, estParDefaut: estParDefaut, changerMdp: changerMdp, reprendre: reprendre, controleMdp: controleMdp_, liste: liste, demanderCode: demanderCode, login: login, activer: activer, emettreCode: emettreCode, userFromToken: userFromToken, usurper: usurper, estUsurpation: estUsurpation, logout: logout, publique: publique_ };
})();

if (typeof module !== 'undefined') module.exports = Auth;
