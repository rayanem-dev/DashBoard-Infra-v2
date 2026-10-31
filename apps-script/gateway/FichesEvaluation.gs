/**
 * Fiches d'évaluation mensuelles : suivi de l'échéance affiché sur l'accueil (carte visible à partir du 22 de chaque mois).
 * Règle : toutes les fiches (une par contrat en exécution) doivent être ÉDITÉES (donc générées) au plus tard le 25, pour laisser le temps de la signature
 * des deux parties avant l'envoi des fiches le 1er du mois suivant. Les fiches sont lues dans l'archive de l'application « Fiche d'évaluation »
 * (dossier Drive « Fiches d’évaluation » : un PDF par fiche, ses réponses dans la description) ; les contrats attendus viennent du Suivi CPM (statut « En exécution »).
 * Partie PURE (testée en Node : test/fichesevaluation.test.js) puis la lecture de l'archive (Drive).
 */
var FichesEval = (function () {
  var JOUR_DEBUT = 22, JOUR_LIMITE = 25;   // la carte apparaît le 22 ; les fiches doivent être éditées le 25
  /** Clé comparable d'un n° de contrat : « 53.INFRA.25 », « I/53/RNS/INFRA/2025 » → « 53-25 » ; '' si illisible. */
  function cle(c) { var g = String(c || '').match(/\d+/g); if (!g || g.length < 2) return ''; var an = g[g.length - 1]; if (an.length === 4) an = an.slice(2); return String(Number(g[0])) + '-' + an; }
  function jours(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
  function finDeMois(auj) { var d = new Date(Date.UTC(+auj.slice(0, 4), +auj.slice(5, 7), 0)); return d.toISOString().slice(0, 10); }
  function plusUn(iso) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  /**
   * auj = 'AAAA-MM-JJ' ; contrats = contrats en exécution [{ contrat, entreprise, projet }] ; fiches = [{ contrat, entrepreneur, date, taux, cree }] (date de la fiche, sinon date de création).
   * Retourne null avant le 22 ; sinon { mois, jour, phase: 'preparation' (22 → 24) | 'echeance' (25 → fin de mois), joursAvantLimite, joursAvantEnvoi, dateLimite, dateEnvoi,
   *   attendues, creees, manquantes: [{ contrat, entreprise, projet }], faites: [{ contrat, entreprise, taux }], ignorees: [{ contrat, entreprise, projet, par, motif }], horsListe, total }.
   * manuelles = [{ cle, par, le }] : fiches faites À LA MAIN (hors générateur), déclarées « éditées » : comptées comme éditées (faites[].manuelle = true) tant qu'aucune fiche du générateur n'existe.
   * ignorees = [{ cle, par, motif }] : contrats écartés POUR CE MOIS (ils ne sont ni attendus ni manquants tant qu'aucune fiche n'existe).
   */
  function etat(auj, contrats, fiches, ignorees, manuelles) {
    var jour = Number(String(auj).slice(8, 10)); if (!(jour >= JOUR_DEBUT)) return null;
    var mois = String(auj).slice(0, 7), vues = {}, horsListe = 0, par = {};
    (fiches || []).forEach(function (f) {
      var d = /^\d{4}-\d{2}/.test(String(f.date || '')) ? String(f.date).slice(0, 7) : String(f.cree || '').slice(0, 7);   // date de la fiche ; à défaut, date de création du fichier
      if (d !== mois) return;                                       // fiche d'un autre mois
      var k = cle(f.contrat); if (k && par[k]) return;               // une seule fiche comptée par contrat
      if (k) par[k] = f; else horsListe += 1;
    });
    var attendues = [], faites = [], manquantes = [], exemptees = [], ign = {}, man = {}; (ignorees || []).forEach(function (x) { ign[x.cle] = x; }); (manuelles || []).forEach(function (x) { man[x.cle] = x; });
    (contrats || []).forEach(function (c) {
      var k = cle(c.contrat); if (!k || vues[k]) return; vues[k] = 1;
      if (par[k]) { attendues.push(c); faites.push({ contrat: c.contrat, entreprise: c.entreprise, projet: c.projet || '', taux: par[k].taux == null ? null : par[k].taux }); return; }
      if (man[k]) { attendues.push(c); faites.push({ contrat: c.contrat, entreprise: c.entreprise, projet: c.projet || '', taux: null, manuelle: true, par: man[k].par || '', le: man[k].le || '' }); return; }   // faite à la main, hors générateur
      if (ign[k]) { exemptees.push({ contrat: c.contrat, entreprise: c.entreprise, projet: c.projet || '', par: ign[k].par || '', motif: ign[k].motif || '' }); return; }   // écartée ce mois-là par le secrétariat ou un chef de service : ni attendue ni manquante
      attendues.push(c); manquantes.push({ contrat: c.contrat, entreprise: c.entreprise, projet: c.projet || '' });
    });
    Object.keys(par).forEach(function (k) { if (!vues[k]) horsListe += 1; });   // fiches du mois sans contrat en exécution (préparation, levée des réserves…)
    var limite = mois + '-' + (JOUR_LIMITE < 10 ? '0' : '') + JOUR_LIMITE, envoi = plusUn(finDeMois(auj));
    return { mois: mois, jour: jour, phase: jour >= JOUR_LIMITE ? 'echeance' : 'preparation', joursAvantLimite: Math.max(0, jours(auj, limite)), joursAvantEnvoi: jours(auj, envoi), dateLimite: limite, dateEnvoi: envoi,
      attendues: attendues.length, creees: faites.length, manquantes: manquantes, faites: faites, ignorees: exemptees, horsListe: horsListe, total: faites.length + horsListe };
  }
  /** Contrats en exécution du Suivi CPM (enregistrements de cpmEnregistrements_) : [{ contrat, entreprise, projet }], sans doublon de n° de contrat. */
  function contratsEnExecution(enr, cleStatut) {
    var vus = {}, out = [];
    ((enr && enr.ordre) || []).forEach(function (c) {
      var d = enr.dossiers[c]; if (!d || cleStatut(d.statut) !== 'execution') return;
      var k = cle(d.n_contrat); if (!k || vus[k]) return; vus[k] = 1; out.push({ contrat: d.n_contrat, entreprise: d.attribue_a || '', projet: d.intitule || '' });
    });
    return out;
  }
  /**
   * Qui relancer pour une fiche manquante : le SERVICE concerné (sa boîte de service, sinon ses chefs de service) et le ou les CONDUCTEURS affectés au chantier
   * (rôle « conducteur » dont le service est celui du chantier ou qui ont ce chantier parmi leurs projets en plus ; à défaut, ceux qui ont rapporté sur ce chantier ces derniers jours).
   * chantier = { id, service } ; utilisateurs = comptes ; boites = [{ nom, email }] des boîtes de service ; auteurs = e-mails de ceux qui ont rapporté sur ce chantier ; roleDe = Droits.roleCanon ; cleService = TB.cleService.
   * Retourne { service: [{ nom, email }], conducteurs: [{ nom, email }] } (adresses sans doublon).
   */
  function destinatairesRelance(chantier, utilisateurs, boites, auteurs, roleDe, cleService) {
    var norm = function (t) { return String(t == null ? '' : t).trim().toLowerCase(); }, svc = cleService(chantier && chantier.service), vus = {};
    var actifs = (utilisateurs || []).filter(function (u) { return norm(u.email_contact || u.email) && String(u.actif) !== '0' && u.actif !== false; });
    function ajout(l, nom, email) { var m = norm(email); if (!m || vus[m]) return; vus[m] = 1; l.push({ nom: nom || m, email: m }); }
    var service = [], conducteurs = [];
    var mots = { construction: /construction/, electromecanique: /electrom/, entretien: /entretien/ }[svc];
    var sansAccent = function (t) { return norm(t).normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    (boites || []).forEach(function (b) { if (mots && mots.test(sansAccent(b.nom))) ajout(service, b.nom, b.email); });
    if (!service.length) actifs.forEach(function (u) { var r = roleDe(u.role); if ((r === 'chef_service' || r === 'interim_chef_service') && svc !== 'autre' && cleService(u.service) === svc) ajout(service, u.nom, u.email_contact || u.email); });
    var ids = function (u) { return String(u.chantiers_sup || '').split(/[;,\s]+/).map(norm).filter(Boolean); };
    actifs.forEach(function (u) {
      if (roleDe(u.role) !== 'conducteur') return;
      var memeService = svc !== 'autre' && cleService(u.service) === svc, affecte = chantier && ids(u).indexOf(norm(chantier.id)) >= 0;
      if (memeService || affecte) ajout(conducteurs, u.nom, u.email_contact || u.email);
    });
    if (!conducteurs.length) (auteurs || []).forEach(function (e) { var u = actifs.filter(function (x) { return norm(x.email) === norm(e); })[0]; if (u) ajout(conducteurs, u.nom, u.email_contact || u.email); });
    return { service: service, conducteurs: conducteurs };
  }
  /** Fiches manquantes + dernière relance de chacune : relances = [{ cle, le, par }] du mois (la plus récente gagne). */
  function avecRelances(manquantes, relances) {
    var der = {}; (relances || []).forEach(function (r) { if (!der[r.cle] || r.le > der[r.cle].le) der[r.cle] = r; });
    return (manquantes || []).map(function (m) { var r = der[cle(m.contrat)]; var o = {}; Object.keys(m).forEach(function (k) { o[k] = m[k]; }); o.relance = r ? { le: r.le, par: r.par } : null; return o; });
  }
  return { destinatairesRelance: destinatairesRelance, avecRelances: avecRelances, JOUR_DEBUT: JOUR_DEBUT, JOUR_LIMITE: JOUR_LIMITE, cle: cle, etat: etat, contratsEnExecution: contratsEnExecution };
})();
if (typeof module !== 'undefined') module.exports = FichesEval;

// ---------- lecture de l'archive (Drive) ----------
var FICHES_DOSSIER_ = 'Fiches d’évaluation';
/** Fiches archivées : [{ contrat, entrepreneur, date, taux, cree }] ; lève une erreur si Drive n'est pas autorisé. Gardé 2 minutes en mémoire. */
function fichesEvalLire_() {
  var cache = CacheService.getScriptCache(), c = null; try { c = cache.get('FICHES_EVAL'); } catch (e) { c = null; }
  if (c) { try { return JSON.parse(c); } catch (e) { /* recalcul */ } }
  var out = [], dossiers = DriveApp.getFoldersByName(FICHES_DOSSIER_);
  while (dossiers.hasNext()) {
    var it = dossiers.next().getFilesByType(MimeType.PDF);
    while (it.hasNext()) {
      var f = it.next(), d = {}; try { d = JSON.parse(f.getDescription() || '{}'); } catch (e) { d = {}; }
      var ch = d.c || {}; out.push({ contrat: String(ch.contrat || ''), entrepreneur: String(ch.entrepreneur || ''), date: String(ch.date || ''), taux: d.taux == null ? null : d.taux, cree: f.getDateCreated().toISOString().slice(0, 10) });
    }
  }
  try { cache.put('FICHES_EVAL', JSON.stringify(out), 120); } catch (e) { /* trop gros : pas de cache */ }
  return out;
}
/** L'application « Fiche d'évaluation » du catalogue (ligne de la table) et le droit de la personne dessus : { carte, ok }. */
function fichesEvalAcces_(acces) {
  var carte = null; try { carte = Store.table('Applications').filter(function (x) { return /fiche d.?[ée]valuation/i.test(String(x.titre || '')) && String(x.actif) !== '0'; })[0] || null; } catch (e) { carte = null; }
  var module = carte ? String(carte.module || '').toLowerCase() : 'logistique', niveauMin = carte ? Number(carte.niveau_min) || 1 : 2;
  return { carte: carte, ok: (acces[module] || 0) >= niveauMin };
}
var FICHES_RELANCES_ENTETES_ = ['mois', 'cle', 'contrat', 'par', 'le'];
function fichesRelancesLire_(mois) {
  try {
    var v = cpmFeuille_('FichesRelances', FICHES_RELANCES_ENTETES_).getDataRange().getValues(), out = [];
    for (var i = 1; i < v.length; i += 1) if (String(v[i][0]) === mois) out.push({ cle: String(v[i][1]), contrat: String(v[i][2]), par: String(v[i][3]), le: String(v[i][4]) });
    return out;
  } catch (e) { return []; }
}
var FICHES_IGNOREES_ENTETES_ = ['mois', 'cle', 'contrat', 'par', 'motif', 'le'];
function fichesIgnoreesLire_(mois) {
  try {
    var v = cpmFeuille_('FichesIgnorees', FICHES_IGNOREES_ENTETES_).getDataRange().getValues(), out = [];
    for (var i = 1; i < v.length; i += 1) if (String(v[i][0]) === mois) out.push({ cle: String(v[i][1]), contrat: String(v[i][2]), par: String(v[i][3]), motif: String(v[i][4] || ''), le: String(v[i][5] || '') });
    return out;
  } catch (e) { return []; }
}
var FICHES_MANUELLES_ENTETES_ = ['mois', 'cle', 'contrat', 'par', 'le'];
function fichesManuellesLire_(mois) {
  try {
    var v = cpmFeuille_('FichesManuelles', FICHES_MANUELLES_ENTETES_).getDataRange().getValues(), out = [];
    for (var i = 1; i < v.length; i += 1) if (String(v[i][0]) === mois) out.push({ cle: String(v[i][1]), contrat: String(v[i][2]), par: String(v[i][3]), le: String(v[i][4] || '') });
    return out;
  } catch (e) { return []; }
}
/** Bloc « fiches_eval » du tableau de bord : seulement à partir du 22, et pour ceux qui ont accès à l'application « Fiche d'évaluation ». null sinon. */
function fichesEvalBloc_(u, acces, auj, enr) {
  if (!(Number(auj.slice(8, 10)) >= FichesEval.JOUR_DEBUT)) return null;
  var ac = fichesEvalAcces_(acces); if (!ac.ok) return null;
  var contrats = enr ? FichesEval.contratsEnExecution(enr, TB.cleStatut) : [], fiches = [], lecture = 'ok', message = '';
  try { fiches = fichesEvalLire_(); }
  catch (e) { lecture = 'indisponible'; message = 'Lecture des fiches impossible : l\'autorisation Google « Drive » de la passerelle n\'est pas activée (docs/RAPPORTS-MEDIAS.md).'; }
  var etat = FichesEval.etat(auj, contrats, fiches, fichesIgnoreesLire_(auj.slice(0, 7)), fichesManuellesLire_(auj.slice(0, 7))); if (!etat) return null;
  etat.manquantes = FichesEval.avecRelances(etat.manquantes, fichesRelancesLire_(etat.mois));   // dernière relance de chaque fiche manquante
  etat.lecture = lecture; etat.message = message; etat.url = ac.carte ? String(ac.carte.url || '') : ''; etat.titre = ac.carte ? String(ac.carte.titre || '') : 'Fiche d\'évaluation'; etat.emoji = ac.carte ? String(ac.carte.emoji || '') : '📝'; etat.sansContrats = !enr;
  etat.peut_relancer = lecture === 'ok' && optionPermise_(u, 'fiches.relance'); etat.peut_ignorer = lecture === 'ok' && optionPermise_(u, 'fiches.ignorer'); etat.peut_manuelle = lecture === 'ok' && optionPermise_(u, 'fiches.manuelle');
  return etat;
}
/**
 * Relance d'une fiche manquante, AU CLIC SEULEMENT : e-mail au service concerné et au(x) conducteur(s) affecté(s) au chantier. Une fiche déjà relancée depuis moins de 6 h n'est pas relancée une seconde fois.
 * Réponse : { envoye, destinataires: [noms], dernier } ; { envoye: false, raison } si rien n'est parti.
 */
function fichesRelancer_(req) {
  var u = Auth.userFromToken(req.token), a = acces_(u), auj = Dates.today();
  if (!fichesEvalAcces_(a).ok || !optionPermise_(u, 'fiches.relance')) throw Object.assign(new Error('La relance des fiches n\'est pas ouverte à votre rôle (réglage « Paramètres » du secrétariat)'), { code: 'DROITS' });
  var enr = null; try { enr = cpmEnregistrements_(lignesSource_('cpm')); } catch (e) { enr = null; }
  var etat = FichesEval.etat(auj, enr ? FichesEval.contratsEnExecution(enr, TB.cleStatut) : [], fichesEvalLire_(), fichesIgnoreesLire_(auj.slice(0, 7)), fichesManuellesLire_(auj.slice(0, 7)));
  if (!etat) throw new Error('La relance n\'est possible qu\'à partir du 22 du mois');
  var cle = FichesEval.cle(req.contrat), m = etat.manquantes.filter(function (x) { return FichesEval.cle(x.contrat) === cle; })[0];
  if (!m) return { envoye: false, raison: 'Cette fiche est déjà éditée (ou le contrat n\'est plus en exécution) : rien à relancer.' };
  var deja = fichesRelancesLire_(etat.mois).filter(function (r) { return r.cle === cle; }).sort(function (x, y) { return x.le < y.le ? 1 : -1; })[0];
  if (deja && Date.now() - Date.parse(deja.le) < 6 * 3600000) return { envoye: false, raison: 'Déjà relancée par ' + deja.par + ' le ' + Utilities.formatDate(new Date(deja.le), 'Africa/Algiers', 'dd/MM à HH:mm') + ' : une nouvelle relance est possible après 6 heures.', dernier: deja.le };
  // chantier du contrat : « Affectation chantier » (colonne contrat) ; service et conducteurs en dépendent
  var chantier = chantiersTous_().filter(function (c) { return FichesEval.cle(c.contrat) === cle; })[0];
  if (!chantier) return { envoye: false, raison: 'Aucun chantier lié à ce contrat dans « Affectation chantier » : indiquez son service là-bas pour pouvoir relancer.' };
  var auteurs = rapportsLus_().filter(function (r) { return r.chantier === chantier.id && r.date >= Dates.addDays(auj, -60); }).map(function (r) { return r.auteur_email; });
  var dest = FichesEval.destinatairesRelance(chantier, Store.table('Utilisateurs'), parametreAdresses_('rapports.boites_chef_service'), auteurs, Droits.roleCanon, TB.cleService);
  var to = dest.service.concat(dest.conducteurs).map(function (d) { return d.email; }).filter(function (e, i, t) { return t.indexOf(e) === i; });
  if (!to.length) return { envoye: false, raison: 'Aucun destinataire trouvé (ni boîte du service, ni conducteur affecté à ce chantier).' };
  var mois = MOIS_FR_RELANCE_[Number(etat.mois.slice(5, 7)) - 1] + ' ' + etat.mois.slice(0, 4), par = Annuaire.nomAffichable(u.nom, u.email), site = parametre_('portail.site_url');
  var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, fr = function (iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); };
  var depasse = etat.phase === 'echeance';
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:640px"><p>Bonjour,</p>' +
    '<p>La <b>fiche d\'évaluation de ' + esc(mois) + '</b> du contrat <b>' + esc(m.contrat) + '</b>' + (m.entreprise ? ' (' + esc(m.entreprise) + ')' : '') + (m.projet ? ' — ' + esc(m.projet) : '') + ' <b style="color:#B91C1C">n\'a pas encore été éditée</b>.</p>' +
    '<p>Toutes les fiches doivent être éditées au plus tard le <b>' + fr(etat.dateLimite) + '</b>' + (depasse ? ' (<b style="color:#B91C1C">échéance dépassée</b>)' : '') + ' pour laisser le temps de la signature des deux parties avant l\'envoi du <b>' + fr(etat.dateEnvoi) + '</b>.</p>' +
    '<p>Merci de l\'éditer dès que possible' + (site ? ' : <a href="' + esc(site) + '">ouvrir le portail</a> (Fiche d\'évaluation)' : '') + '.</p>' +
    '<p style="color:#666;font-size:12px">Relance envoyée par ' + esc(par) + ' — Division Infrastructure RNS. Concernés : ' + esc(dest.service.concat(dest.conducteurs).map(function (d) { return d.nom; }).join(', ')) + '.</p></div>';
  MailApp.sendEmail({ to: to.join(','), subject: 'Relance — fiche d\'évaluation ' + mois + ' — contrat ' + m.contrat, htmlBody: html, replyTo: u.email, name: 'Division Infrastructure RNS' });
  var maintenant = new Date().toISOString(), sh = cpmFeuille_('FichesRelances', FICHES_RELANCES_ENTETES_), rng = sh.getRange(sh.getLastRow() + 1, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([[etat.mois, cle, m.contrat, par, maintenant]]);
  Store.journal('fiche_relance', u.email, m.contrat + ' → ' + to.join(', '));
  return { envoye: true, destinataires: dest.service.concat(dest.conducteurs).map(function (d) { return d.nom; }), dernier: maintenant };
}
var MOIS_FR_RELANCE_ = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * « Ignorer » une fiche pour ce projet ET pour ce mois (contrat suspendu, pas d'activité, évaluation reportée…) : elle n'est plus attendue ni relancée ce mois-là ; « Rétablir » la remet dans la liste.
 * Réservé par le réglage « Paramètres » (secrétariat et chefs de service par défaut). Trace au journal. req = { contrat, ignorer: true|false, motif }.
 */
function fichesIgnorer_(req) {
  var u = Auth.userFromToken(req.token), a = acces_(u), auj = Dates.today();
  if (!fichesEvalAcces_(a).ok || !optionPermise_(u, 'fiches.ignorer')) throw Object.assign(new Error('Ignorer une fiche n\'est pas ouvert à votre rôle (réglage « Paramètres » du secrétariat)'), { code: 'DROITS' });
  if (!(Number(auj.slice(8, 10)) >= FichesEval.JOUR_DEBUT)) throw new Error('Disponible à partir du 22 du mois');
  var enr = null; try { enr = cpmEnregistrements_(lignesSource_('cpm')); } catch (e) { enr = null; }
  var mois = auj.slice(0, 7), cle = FichesEval.cle(req.contrat), c = (enr ? FichesEval.contratsEnExecution(enr, TB.cleStatut) : []).filter(function (x) { return FichesEval.cle(x.contrat) === cle; })[0];
  if (!cle || !c) throw new Error('Contrat inconnu parmi les contrats en exécution');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = cpmFeuille_('FichesIgnorees', FICHES_IGNOREES_ENTETES_), v = sh.getDataRange().getValues(), par = Annuaire.nomAffichable(u.nom, u.email);
    if (req.ignorer === false) {
      for (var i = v.length - 1; i >= 1; i -= 1) if (String(v[i][0]) === mois && String(v[i][1]) === cle) sh.deleteRow(i + 1);
      Store.journal('fiche_retablie', u.email, c.contrat + ' (' + mois + ')'); return { ignoree: false };
    }
    var existe = false; for (var j = 1; j < v.length; j += 1) if (String(v[j][0]) === mois && String(v[j][1]) === cle) existe = true;
    if (!existe) { var r = sh.getRange(sh.getLastRow() + 1, 1, 1, 6); r.setNumberFormat('@'); r.setValues([[mois, cle, c.contrat, par, String(req.motif || '').replace(/\s+/g, ' ').trim().slice(0, 160), new Date().toISOString()]]); }
    Store.journal('fiche_ignoree', u.email, c.contrat + ' (' + mois + ')' + (req.motif ? ' : ' + String(req.motif).slice(0, 80) : ''));
    return { ignoree: true };
  } finally { lock.releaseLock(); }
}

/**
 * « Rapport édité » : déclare qu'une fiche a été faite À LA MAIN (hors du générateur) pour ce contrat et ce mois : elle est alors comptée comme éditée et n'est plus relancée ;
 * la déclarer de nouveau en sens inverse (editee: false) la retire. Réservé par le réglage « Paramètres » (secrétariat et chefs de service par défaut). Tracé au journal.
 */
function fichesManuelle_(req) {
  var u = Auth.userFromToken(req.token), a = acces_(u), auj = Dates.today();
  if (!fichesEvalAcces_(a).ok || !optionPermise_(u, 'fiches.manuelle')) throw Object.assign(new Error('Déclarer une fiche éditée à la main n\'est pas ouvert à votre rôle (réglage « Paramètres » du secrétariat)'), { code: 'DROITS' });
  if (!(Number(auj.slice(8, 10)) >= FichesEval.JOUR_DEBUT)) throw new Error('Disponible à partir du 22 du mois');
  var enr = null; try { enr = cpmEnregistrements_(lignesSource_('cpm')); } catch (e) { enr = null; }
  var mois = auj.slice(0, 7), cle = FichesEval.cle(req.contrat), c = (enr ? FichesEval.contratsEnExecution(enr, TB.cleStatut) : []).filter(function (x) { return FichesEval.cle(x.contrat) === cle; })[0];
  if (!cle || !c) throw new Error('Contrat inconnu parmi les contrats en exécution');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = cpmFeuille_('FichesManuelles', FICHES_MANUELLES_ENTETES_), v = sh.getDataRange().getValues();
    if (req.editee === false) {
      for (var i = v.length - 1; i >= 1; i -= 1) if (String(v[i][0]) === mois && String(v[i][1]) === cle) sh.deleteRow(i + 1);
      Store.journal('fiche_manuelle_retiree', u.email, c.contrat + ' (' + mois + ')'); return { editee: false };
    }
    var existe = false; for (var j = 1; j < v.length; j += 1) if (String(v[j][0]) === mois && String(v[j][1]) === cle) existe = true;
    if (!existe) { var r = sh.getRange(sh.getLastRow() + 1, 1, 1, 5); r.setNumberFormat('@'); r.setValues([[mois, cle, c.contrat, Annuaire.nomAffichable(u.nom, u.email), new Date().toISOString()]]); }
    Store.journal('fiche_manuelle', u.email, c.contrat + ' (' + mois + ')');
    return { editee: true };
  } finally { lock.releaseLock(); }
}
