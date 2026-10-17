/**
 * Journal de connexion et aide au dépannage (réservé à l'administration de la sécurité) :
 *  - admin_connexions : derniers événements de connexion (réussies, refusées, codes envoyés ou en échec…), filtrables par personne ;
 *  - admin_diagnostic : état d'un compte (adresse e-mail, mot de passe, dernier code, blocages, quota d'e-mails) avec des conseils ;
 *  - admin_mdp        : définir un mot de passe provisoire (l'agent devra en choisir un autre à sa connexion) ;
 *  - admin_test_mail  : envoyer un e-mail de test à l'adresse enregistrée (vérifie que l'envoi part bien).
 * Aucun mot de passe ni code n'est jamais écrit dans le journal.
 */
var Connexions = (function () {
  var LIBELLES = {
    connexion: 'Connexion réussie', connexion_echec: 'Connexion refusée', connexion_bloque: 'Compte bloqué (trop d\'essais)',
    code_envoye: 'Code envoyé par e-mail', code_email: 'Code envoyé par e-mail', code_echec: 'Envoi du code impossible', code_limite: 'Trop de demandes de code',
    activation: 'Mot de passe défini avec le code', activation_echec: 'Code refusé', mdp_change: 'Mot de passe changé par l\'agent',
    mdp_admin: 'Mot de passe défini par le secrétariat', code_active: 'Code de secours remis par le secrétariat', test_mail: 'E-mail de test envoyé'
  };
  var ACTIONS = Object.keys(LIBELLES);
  function jour(d) { return Object.prototype.toString.call(d) === '[object Date]' ? d.toISOString() : String(d); }
  /** lignes [date, action, email, detail] (du plus ancien au plus récent) → événements de connexion, du plus récent au plus ancien. */
  function evenements(lignes, filtre, limite, noms) {
    var f = String(filtre || '').toLowerCase().trim(), out = [];
    for (var i = lignes.length - 1; i >= 0 && out.length < (limite || 200); i -= 1) {
      var r = lignes[i], a = String(r[1]);
      if (ACTIONS.indexOf(a) === -1) continue;
      var email = String(r[2] || '').toLowerCase(), nom = noms && noms[email] || '';
      if (f && (email + ' ' + nom.toLowerCase() + ' ' + String(r[3] || '').toLowerCase()).indexOf(f) === -1) continue;
      out.push({ date: jour(r[0]), action: a, libelle: LIBELLES[a], email: email, nom: nom, detail: String(r[3] || '') });
    }
    return out;
  }
  /** Conseils en clair d'après l'état d'un compte. */
  function conseils(d) {
    var c = [];
    if (!d.actif) c.push('Le compte est DÉSACTIVÉ : la personne ne peut pas se connecter (réactivez-le dans l\'onglet Utilisateurs).');
    if (!d.email) c.push('Aucune adresse e-mail enregistrée : aucun code ne peut être envoyé. Utilisez « Code de secours » ou « Mot de passe ».');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) c.push('L\'adresse e-mail enregistrée semble invalide (« ' + d.email + ' ») : corrigez-la dans BDDORGA.');
    if (d.bloque) c.push('Le compte est BLOQUÉ pour quelques minutes (trop d\'essais) : patientez 15 minutes ou définissez-lui un mot de passe.');
    if (d.demandes_code >= 3) c.push('3 demandes de code déjà faites cette heure : la personne doit attendre, ou utilisez « Code de secours » / « Mot de passe ».');
    if (d.etat === 'aucun') c.push('Aucun mot de passe défini : la personne n\'a jamais fini sa première connexion (« Première connexion ou mot de passe oublié ? »).');
    if (d.etat === 'provisoire_expire') c.push('Le mot de passe par défaut a expiré : « Première connexion… » ou définissez un nouveau mot de passe.');
    if (d.dernier_code_echec) c.push('Dernier envoi de code EN ÉCHEC : ' + d.dernier_code_echec);
    if (d.quota_mail !== '' && d.quota_mail != null && Number(d.quota_mail) <= 5) c.push('Quota d\'e-mails du jour presque épuisé (' + d.quota_mail + ' restants) : les codes ne partiront plus avant demain.');
    if (d.dernier_code_envoye && /sonatrach\.dz$/i.test(d.email)) c.push('Un code a bien été envoyé, mais l\'adresse est en @sonatrach.dz : vérifiez les courriers indésirables et la quarantaine anti-spam (l\'expéditeur est un compte Gmail externe). Demandez à l\'informatique d\'autoriser l\'expéditeur, ou utilisez « Mot de passe ».');
    if (d.dernier_code_envoye && !/sonatrach\.dz$/i.test(d.email) && d.email) c.push('Un code a bien été envoyé : demandez à la personne de regarder ses courriers indésirables (spam).');
    if (!c.length) c.push('Rien d\'anormal détecté. En cas de doute : « Envoyer un e-mail de test » ou « Mot de passe ».');
    return c;
  }
  return { evenements: evenements, conseils: conseils, LIBELLES: LIBELLES, ACTIONS: ACTIONS };
})();

function connexionsAdmin_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function connexionsLignes_(n) {
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Journal'), dernier = sh.getLastRow();
  if (dernier < 2) return [];
  var debut = Math.max(2, dernier - n + 1);
  return sh.getRange(debut, 1, dernier - debut + 1, 4).getValues();
}
function connexionsListe_(req) {
  connexionsAdmin_(req);
  var noms = {}; Store.table('Utilisateurs').forEach(function (x) { noms[String(x.email).toLowerCase()] = Annuaire.nomAffichable(x.nom, x.email); });
  return { evenements: Connexions.evenements(connexionsLignes_(4000), req.q, Math.min(Number(req.limite) || 200, 500), noms) };
}
function connexionsDiagnostic_(req) {
  connexionsAdmin_(req);
  var email = String(req.email || '').trim().toLowerCase(), u = Store.utilisateur(email);
  if (!u) throw new Error('Utilisateur inconnu');
  var cpt = Auth.compteurs(email), ev = Connexions.evenements(connexionsLignes_(4000), email, 100, {}), vu = function (a) { return ev.filter(function (e) { return e.action === a; })[0]; };
  var codeEchec = vu('code_echec'), codeOk = vu('code_envoye') || vu('code_email'), cnx = vu('connexion'), refus = vu('connexion_echec');
  var quota = ''; try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { quota = ''; }
  var d = { email: email, nom: Annuaire.nomAffichable(u.nom, u.email), actif: String(u.actif) !== '0', etat: Auth.etatSecret(email), bloque: cpt.essais >= CFG.MAX_TENTATIVES, essais: cpt.essais, demandes_code: cpt.demandes_code,
    dernier_login: cnx ? cnx.date : '', dernier_refus: refus ? refus.date + ' — ' + refus.detail : '', dernier_code_envoye: codeOk ? codeOk.date : '', dernier_code_echec: codeEchec ? codeEchec.date + ' — ' + codeEchec.detail : '', quota_mail: quota };
  d.conseils = Connexions.conseils(d);
  return d;
}
function connexionsMdp_(req) {
  var a = connexionsAdmin_(req), mdp = String(req.mdp || '').trim();
  if (!mdp) { var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789', m = ''; for (var i = 0; i < 8; i += 1) m += alphabet.charAt(Math.floor(Math.random() * alphabet.length)); mdp = m; }
  Auth.definirMdpAdmin(req.email, mdp);
  Store.journal('mdp_admin', String(req.email).toLowerCase(), 'défini par ' + a.email + ' (provisoire : à changer à la prochaine connexion)');
  return { mdp: mdp };
}
/** Donne le mot de passe provisoire (0000) à tous les comptes actifs qui n'ont encore AUCUN mot de passe. Les comptes à large accès en sont exclus sauf demande explicite. */
function connexionsMdpDefautTous_(req) {
  var a = connexionsAdmin_(req);
  var r = definirMotDePasseParDefaut(0, req.inclure === true);
  Store.journal('mdp_defaut_admin', a.email, r.donnes + ' compte(s)' + (req.inclure === true ? ' (comptes à large accès inclus)' : ''));
  return r;
}
function connexionsTestMail_(req) {
  var a = connexionsAdmin_(req), email = String(req.email || '').trim().toLowerCase();
  if (!Store.utilisateur(email)) throw new Error('Utilisateur inconnu');
  try {
    MailApp.sendEmail({ to: email, name: 'Division Infrastructure RNS', subject: 'Test du portail Infra', htmlBody: '<p>Ceci est un message de test du portail de la Division Infrastructure.</p><p>Si vous le lisez, vous recevrez bien les codes de connexion. Aucune action n\'est nécessaire.</p>' });
  } catch (e) {
    Store.journal('code_echec', email, 'e-mail de test impossible : ' + String(e && e.message || e));
    throw new Error('Envoi impossible : ' + String(e && e.message || e));
  }
  Store.journal('test_mail', email, 'envoyé par ' + a.email);
  return { envoye: true };
}

/** Rend visibles les caractères invisibles d'une adresse (ex. « jean⟦U+00A0⟧x@… »). */
function emailVisible_(s) { return String(s == null ? '' : s).replace(/[\u200B-\u200F\u2060\u2028\u2029\uFEFF\u00AD\u00A0\u202F\u3000]/g, function (c) { return '⟦U+' + ('0000' + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4) + '⟧'; }); }

/** Action « admin_emails » : contrôle de toutes les adresses e-mail (comptes du portail + lignes ignorées de BDDORGA). Ne modifie rien. */
function emailsControle_(req) {
  connexionsAdmin_(req);
  var us = Store.table('Utilisateurs'), probleme = [], vus = {};
  us.forEach(function (u) { var p = Annuaire.analyserEmail(u.email_contact || u.email).propre; if (p) (vus[p] = vus[p] || []).push(Annuaire.nomAffichable(u.nom, u.email)); });
  us.forEach(function (u) {
    var a = Annuaire.analyserEmail(u.email), c = u.email_contact ? Annuaire.analyserEmail(u.email_contact) : null, pb = a.problemes.slice(), utile = c && c.valide ? c : a;
    if (c && !c.valide) pb.push('adresse de contact invalide : ' + c.problemes.join(', '));
    var dup = vus[utile.propre] && vus[utile.propre].length > 1 ? vus[utile.propre] : null;
    if (dup) pb.push('même adresse que : ' + dup.filter(function (n) { return n !== Annuaire.nomAffichable(u.nom, u.email); }).join(', '));
    if (!pb.length || (pb.length === 1 && /^majuscules/.test(pb[0]))) return;
    probleme.push({ email: u.email, nom: Annuaire.nomAffichable(u.nom, u.email), brut: emailVisible_(u.email), contact: u.email_contact || '', propre: utile.propre, valide: utile.valide, problemes: pb,
      suggestion: utile.valide && (u.email_contact ? false : a.propre !== String(u.email).toLowerCase()) ? a.suggestion : (!utile.valide ? utile.suggestion : '') });
  });
  var ignores = [];
  try {
    var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT, src = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
    if (src) { var lu = Annuaire.lire(src.getDataRange().getValues()); if (!lu.erreur) ignores = lu.ignores.filter(function (x) { return /e-mail/.test(x.raison); }).map(function (x) { return { ligne: x.ligne, nom: x.nom, raison: x.raison }; }); }
  } catch (e) { ignores = []; }
  return { total: us.length, problemes: probleme, ignores_bddorga: ignores };
}
/** Action « admin_email_contact » : { email, contact } fixe (ou efface, si vide) l'adresse de contact d'un compte. */
function emailContactAdmin_(req) {
  var a = connexionsAdmin_(req), propre = Auth.definirEmailContact(String(req.email || '').toLowerCase(), String(req.contact || ''));
  Store.journal('email_contact', String(req.email).toLowerCase(), 'adresse de contact ' + (propre ? 'définie' : 'effacée') + ' par ' + a.email);
  return { contact: propre };
}
