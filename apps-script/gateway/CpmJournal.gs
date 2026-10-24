/**
 * Journal des changements du Suivi CPM.
 *  - chaque nuit : lecture de la feuille Suivi CPM, comparaison avec l'état de la veille (onglet « CpmEtat »), les différences sont notées
 *    dans l'onglet « CpmJournal » (nouveau dossier, dossier retiré, champ modifié) ;
 *  - chaque samedi matin : rapport « ce qui a bougé cette semaine » (semaine du samedi au vendredi) envoyé par e-mail à la direction (chefs de division et secrétariat,
 *    plus les adresses de la propriété de script CPM_RAPPORT_DESTINATAIRES) ;
 *  - dans le portail (page Dossiers CPM) : liste des derniers changements (action cpm_journal).
 * La première exécution ne fait que mémoriser l'état de départ (aucun changement n'est inventé).
 * Installation des déclencheurs : lancer UNE fois installerJournalCpm() depuis l'éditeur Apps Script.
 */
var CPM_CHAMPS_ = [
  { k: 'intitule', c: 3, l: 'Intitulé' }, { k: 'etape', c: 4, l: 'Étape' }, { k: 'date_limite', c: 5, l: 'Date limite' },
  { k: 'echeance_g', c: 6, l: 'Échéance (passation)' }, { k: 'pourcent', c: 7, l: 'Avancement' }, { k: 'statut', c: 8, l: 'Statut' },
  { k: 'commentaire', c: 9, l: 'Commentaire' }, { k: 'attribution_finale', c: 10, l: 'Attribution finale' }, { k: 'attribue_a', c: 12, l: 'Attribué à' },
  { k: 'n_contrat', c: 13, l: 'N° de contrat' }, { k: 'montant', c: 14, l: 'Montant' }, { k: 'date_signature', c: 15, l: 'Date de signature' },
  { k: 'date_ods', c: 16, l: 'Date ODS' }, { k: 'duree_contrat', c: 17, l: 'Durée du contrat (mois)' }, { k: 'echeance', c: 18, l: 'Échéance du contrat' }
];
var CPM_COL_N_DOSSIER_ = 2, CPM_COL_TYPE_ = 1;
var CPM_URL_PORTAIL_ = 'https://rayanem-dev.github.io/DashBoard-Infra-v2/Dossiers_CPM.html';

// ---------- logique pure (testée en Node) ----------
function cpmNorm_(s) { return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function cpmVal_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

/** lignes (tableau de tableaux) → { ordre: [cle], dossiers: { cle: { cle, n_dossier, intitule, … } } } */
function cpmEnregistrements_(lignes) {
  var h = -1;
  for (var i = 0; i < lignes.length && h === -1; i += 1) if (lignes[i].some(function (c) { return cpmNorm_(c) === 'statut'; })) h = i;
  if (h === -1) h = 1;
  var ordre = [], dossiers = {}, vus = {};
  lignes.slice(h + 1).forEach(function (r) {
    var intitule = cpmVal_(r[3]), statut = cpmVal_(r[8]);
    if (!intitule && !statut) return;
    var n = cpmVal_(r[CPM_COL_N_DOSSIER_]);
    var cle = n ? 'N:' + cpmNorm_(n) : 'T:' + cpmNorm_(intitule);
    if (vus[cle]) { vus[cle] += 1; cle += '#' + vus[cle]; } else vus[cle] = 1;
    var rec = { cle: cle, n_dossier: n, categorie: cpmVal_(r[CPM_COL_TYPE_]) };
    CPM_CHAMPS_.forEach(function (f) { rec[f.k] = cpmVal_(r[f.c]); });
    dossiers[cle] = rec; ordre.push(cle);
  });
  return { ordre: ordre, dossiers: dossiers };
}

function cpmEgal_(a, b) { return String(a).replace(/\s/g, '').toLowerCase() === String(b).replace(/\s/g, '').toLowerCase(); }

/** Différences entre deux états { dossiers } : liste d'événements { date, cle, dossier, type: nouveau|retire|modifie, champ, libelle, avant, apres }. */
function cpmDiff_(avant, apres, dateIso) {
  var ev = [];
  Object.keys(apres.dossiers).forEach(function (cle) {
    var n = apres.dossiers[cle], a = avant.dossiers[cle];
    if (!a) { ev.push({ date: dateIso, cle: cle, dossier: n.intitule || n.n_dossier, type: 'nouveau', champ: '', libelle: '', avant: '', apres: n.statut, categorie: n.categorie, n_dossier: n.n_dossier }); return; }
    CPM_CHAMPS_.forEach(function (f) {
      if (!cpmEgal_(a[f.k], n[f.k])) ev.push({ date: dateIso, cle: cle, dossier: n.intitule || a.intitule, type: 'modifie', champ: f.k, libelle: f.l, avant: a[f.k], apres: n[f.k], categorie: n.categorie, n_dossier: n.n_dossier });
    });
  });
  Object.keys(avant.dossiers).forEach(function (cle) {
    if (!apres.dossiers[cle]) { var a = avant.dossiers[cle]; ev.push({ date: dateIso, cle: cle, dossier: a.intitule || a.n_dossier, type: 'retire', champ: '', libelle: '', avant: a.statut, apres: '', categorie: a.categorie, n_dossier: a.n_dossier }); }
  });
  return ev;
}

function cpmDateFr_(s) {
  var p = String(s || '').trim().split('/'); if (p.length !== 3) return null;
  var d = parseInt(p[0], 10), m = parseInt(p[1], 10), y = parseInt(p[2], 10); if (!d || !m || !y || y < 1990) return null;
  var dt = new Date(y, m - 1, d); return isNaN(dt.getTime()) ? null : dt;
}
function cpmFrIso_(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || ''); }

/** Contrats en exécution ayant consommé au moins 60 % de leur délai (même règle que la page Dossiers CPM). */
function cpmEcheances_(etat, aujourdhui) {
  var auj = new Date(aujourdhui), res = [];
  auj.setHours(0, 0, 0, 0);
  Object.keys(etat.dossiers).forEach(function (cle) {
    var d = etat.dossiers[cle];
    if (cpmNorm_(d.statut).indexOf('execution') === -1) return;
    var ods = cpmDateFr_(d.date_ods), duree = parseFloat(String(d.duree_contrat).replace(',', '.')) || null, ech = cpmDateFr_(d.echeance);
    if (!ech && ods && duree) { ech = new Date(ods); ech.setMonth(ech.getMonth() + Math.round(duree)); }
    if (!ech || !ods) return;
    var total = Math.round((ech - ods) / 864e5), restants = Math.round((ech - auj) / 864e5);
    if (total <= 0) return;
    var pct = Math.max(0, Math.min(100, Math.round(((total - restants) / total) * 100)));
    if (pct >= 60) res.push({ dossier: d.intitule, restants: restants, pct: pct, echeance: ech });
  });
  return res.sort(function (a, b) { return a.restants - b.restants; });
}

function cpmEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function cpmAff_(v) { return v === '' || v == null ? '<i>vide</i>' : cpmEsc_(v); }
function cpmPluriel_(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

/** { sujet, html } du rapport hebdomadaire. */
function cpmRapport_(evenements, echeances, duIso, auIso) {
  var statut = evenements.filter(function (e) { return e.type === 'modifie' && e.champ === 'statut'; });
  var nouveaux = evenements.filter(function (e) { return e.type === 'nouveau'; });
  var retires = evenements.filter(function (e) { return e.type === 'retire'; });
  var autres = evenements.filter(function (e) { return e.type === 'modifie' && e.champ !== 'statut'; });
  var du = cpmFrIso_(duIso), au = cpmFrIso_(auIso);
  var bloc = function (titre, lignes) { return lignes.length ? '<h3 style="margin:18px 0 6px;font-size:15px;color:#1A1A2E">' + titre + '</h3><ul style="margin:0;padding-left:20px;line-height:1.6">' + lignes.join('') + '</ul>' : ''; };
  var li = function (t) { return '<li>' + t + '</li>'; };
  var h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:680px">' +
    '<h2 style="margin:0 0 4px;color:#E85D04">Suivi CPM — ce qui a bougé cette semaine</h2><p style="margin:0 0 12px;color:#666">Du ' + du + ' au ' + au + '</p>';
  if (!evenements.length) h += '<p>Aucun changement dans le suivi CPM cette semaine.</p>';
  else {
    h += '<p><b>' + [cpmPluriel_(statut.length, 'changement de statut', 'changements de statut'), cpmPluriel_(nouveaux.length, 'nouveau dossier', 'nouveaux dossiers'),
      cpmPluriel_(autres.length, 'autre modification', 'autres modifications'), cpmPluriel_(retires.length, 'dossier retiré', 'dossiers retirés')].join(' · ') + '</b></p>';
    h += bloc('Changements de statut', statut.map(function (e) { return li('<b>' + cpmEsc_(e.dossier) + '</b> : ' + cpmAff_(e.avant) + ' → <b>' + cpmAff_(e.apres) + '</b>'); }));
    h += bloc('Nouveaux dossiers', nouveaux.map(function (e) { return li('<b>' + cpmEsc_(e.dossier) + '</b>' + (e.apres ? ' (' + cpmEsc_(e.apres) + ')' : '')); }));
    h += bloc('Autres modifications', autres.slice(0, 40).map(function (e) { return li('<b>' + cpmEsc_(e.dossier) + '</b> — ' + cpmEsc_(e.libelle) + ' : ' + cpmAff_(e.avant) + ' → ' + cpmAff_(e.apres)); }).concat(autres.length > 40 ? [li('… et ' + (autres.length - 40) + ' autres (voir le portail)')] : []));
    h += bloc('Dossiers retirés du suivi', retires.map(function (e) { return li('<b>' + cpmEsc_(e.dossier) + '</b>'); }));
  }
  h += bloc('Contrats à surveiller (60 % du délai écoulé ou plus)', echeances.slice(0, 15).map(function (x) {
    return li('<b>' + cpmEsc_(x.dossier) + '</b> — ' + (x.restants >= 0 ? 'il reste ' + x.restants + ' jour' + (x.restants > 1 ? 's' : '') : 'échu depuis ' + (-x.restants) + ' jour' + (x.restants < -1 ? 's' : '')) + ' (' + x.pct + ' % du délai)');
  }));
  h += '<p style="margin-top:20px"><a href="' + CPM_URL_PORTAIL_ + '" style="color:#E85D04;font-weight:bold">Ouvrir le suivi CPM dans le portail</a></p>' +
    '<p style="color:#888;font-size:12px">— Tableau de bord Division Infrastructure (message automatique)</p></div>';
  var tot = evenements.length;
  return { sujet: '[Suivi CPM] Semaine du ' + du + ' au ' + au + (tot ? ' : ' + cpmPluriel_(tot, 'changement', 'changements') : ' : aucun changement'), html: h };
}

// ---------- parties liées à Google (feuilles, e-mail, déclencheurs) ----------
var CPM_ENTETES_ETAT_ = ['cle', 'donnees'];
var CPM_ENTETES_JOURNAL_ = ['date', 'cle', 'dossier', 'type', 'champ', 'libelle', 'avant', 'apres', 'categorie', 'n_dossier'];

function cpmFeuille_(nom, entetes) {
  var db = SpreadsheetApp.openById(prop_('DB_ID'));
  var sh = db.getSheetByName(nom);
  if (!sh) { sh = db.insertSheet(nom); sh.appendRow(entetes); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
  else if (sh.getLastColumn() < entetes.length) sh.getRange(1, 1, 1, entetes.length).setValues([entetes]); // onglet créé par une version plus ancienne : colonnes ajoutées
  return sh;
}
function cpmAujourdhui_() { return Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd'); }

/** Lit la feuille CPM, la compare à l'état mémorisé, enregistre les changements et le nouvel état. Retourne { base, evenements }. */
function cpmInstantane_(dateIso) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var apres = cpmEnregistrements_(lignesSource_('cpm'));
    if (!apres.ordre.length) throw new Error('Feuille CPM vide ou illisible : instantané ignoré');
    var etat = cpmFeuille_('CpmEtat', CPM_ENTETES_ETAT_), journal = cpmFeuille_('CpmJournal', CPM_ENTETES_JOURNAL_);
    var v = etat.getDataRange().getValues().slice(1).filter(function (r) { return r[0] !== ''; });
    var avant = { dossiers: {} }; v.forEach(function (r) { try { avant.dossiers[String(r[0])] = JSON.parse(String(r[1])); } catch (e) { /* ligne illisible : traitée comme absente */ } });
    var base = v.length === 0;
    var ev = base ? [] : cpmDiff_(avant, apres, dateIso || cpmAujourdhui_());
    if (ev.length) journal.getRange(journal.getLastRow() + 1, 1, ev.length, CPM_ENTETES_JOURNAL_.length).setValues(ev.map(function (e) { return CPM_ENTETES_JOURNAL_.map(function (c) { return e[c]; }); }));
    etat.clearContents(); etat.getRange(1, 1, 1, 2).setValues([CPM_ENTETES_ETAT_]);
    var lignes = apres.ordre.map(function (cle) { return [cle, JSON.stringify(apres.dossiers[cle])]; });
    etat.getRange(2, 1, lignes.length, 2).setValues(lignes);
    PropertiesService.getScriptProperties().setProperty('CPM_DERNIER_INSTANTANE', new Date().toISOString());
    return { base: base, evenements: ev.length, dossiers: apres.ordre.length };
  } finally { lock.releaseLock(); }
}
/** Lancé vers 2 h : l'état lu est celui de la fin de la veille ; les changements sont donc datés de la veille (une semaine finit bien le vendredi soir). */
function cpmInstantaneNuit() { var r = cpmInstantane_(cpmJoursAvant_(1)); Logger.log('Instantané CPM : ' + r.dossiers + ' dossiers, ' + r.evenements + ' changement(s)' + (r.base ? ' (état de départ)' : '')); }

function cpmEvenementsDepuis_(depuisIso) {
  var sh = cpmFeuille_('CpmJournal', CPM_ENTETES_JOURNAL_);
  return sh.getDataRange().getValues().slice(1).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var o = {}; CPM_ENTETES_JOURNAL_.forEach(function (c, i) { o[c] = String(r[i]); }); return o;
  }).filter(function (e) { return e.date >= depuisIso; });
}
function cpmDestinataires_() {
  var mails = Store.table('Utilisateurs').filter(function (u) { return (u.role === 'chef_division' || u.role === 'secretariat') && String(u.actif) !== '0' && u.actif !== false && u.email; }).map(function (u) { return String(u.email).toLowerCase(); });
  var extra = String(PropertiesService.getScriptProperties().getProperty('CPM_RAPPORT_DESTINATAIRES') || '').split(/[,;\s]+/).filter(Boolean);
  return mails.concat(extra).filter(function (m, i, t) { return t.indexOf(m) === i; });
}
function cpmJoursAvant_(n) { var d = new Date(); d.setDate(d.getDate() - n); return Utilities.formatDate(d, 'Africa/Algiers', 'yyyy-MM-dd'); }

/**
 * Envoie le rapport de la semaine écoulée (du samedi au vendredi précédents) ; déclenché le samedi matin.
 * `essai` = true : prend un instantané, couvre les 7 derniers jours et n'écrit qu'au compte qui lance la fonction.
 */
function cpmRapportSemaine(essai) {
  var du, au;
  if (essai === true) { cpmInstantane_(); du = cpmJoursAvant_(7); au = cpmAujourdhui_(); }
  else { du = cpmJoursAvant_(7); au = cpmJoursAvant_(1); } // exécuté un samedi : du samedi dernier au vendredi d'hier
  var ev = cpmEvenementsDepuis_(du).filter(function (e) { return e.date <= au; });
  var etat = { dossiers: {} };
  cpmFeuille_('CpmEtat', CPM_ENTETES_ETAT_).getDataRange().getValues().slice(1).forEach(function (r) { try { etat.dossiers[String(r[0])] = JSON.parse(String(r[1])); } catch (e) {} });
  var rap = cpmRapport_(ev, cpmEcheances_(etat, new Date()), du, au);
  var dest = essai === true ? [Session.getActiveUser().getEmail()] : cpmDestinataires_();
  if (!dest.length) { Logger.log('Rapport CPM : aucun destinataire'); return { envoye: 0 }; }
  MailApp.sendEmail({ to: dest.join(','), name: 'Division Infrastructure RNS', subject: rap.sujet, htmlBody: rap.html });
  Logger.log('Rapport CPM envoyé à ' + dest.length + ' personne(s).');
  return { envoye: dest.length };
}
/** Pour essayer sans déranger la direction : envoie le rapport à vous seul. */
function cpmRapportEssai() { return cpmRapportSemaine(true); }

/** À lancer UNE fois depuis l'éditeur : instantané chaque nuit vers 2 h, rapport chaque samedi vers 7 h (heure d'Alger). */
function installerJournalCpm() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['cpmInstantaneNuit', 'cpmRapportSemaine'].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cpmInstantaneNuit').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('cpmRapportSemaine').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(7).create();
  var r = cpmInstantane_();
  Logger.log('Déclencheurs installés. État de départ : ' + r.dossiers + ' dossiers' + (r.base ? ' (premier instantané, aucun changement à signaler)' : ''));
}

/** Installe seul le déclencheur de nuit (une fois ; sans lancer d'instantané). Le rapport du samedi (e-mail) reste réservé à installerJournalCpm. Appelée à l'ouverture du portail. */
function preparerJournalCpm_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('CPM_DECLENCHEURS_PRET') === '1') return;
  try {
    var noms = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
    if (noms.indexOf('cpmInstantaneNuit') === -1) ScriptApp.newTrigger('cpmInstantaneNuit').timeBased().everyDays(1).atHour(2).create();
    props.setProperty('CPM_DECLENCHEURS_PRET', '1');
  } catch (e) { /* autorisation manquante : on réessaiera, et le portail relit le suivi lui-même */ }
}

// ---------- actions du portail ----------
function cpmJournalListe_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).cpm || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var ev = cpmEvenementsDepuis_(cpmJoursAvant_(90)).reverse().slice(0, 300);
  var p = PropertiesService.getScriptProperties();
  return { evenements: ev, dernier_instantane: p.getProperty('CPM_DERNIER_INSTANTANE') || '', peut_supprimer: (acces_(u).cpm || 0) >= 2 };
}
/** Indices (0 = en-tête) des lignes du journal qui correspondent à un changement { date, cle, type, champ, avant, apres }. Pur : testé en Node. */
function cpmLignesJournal_(valeurs, e) {
  var res = [];
  for (var i = 1; i < valeurs.length; i += 1) {
    var r = valeurs[i];
    if (String(r[0]) === String(e.date) && String(r[1]) === String(e.cle) && String(r[3]) === String(e.type) && String(r[4]) === String(e.champ || '') && String(r[6]) === String(e.avant || '') && String(r[7]) === String(e.apres || '')) res.push(i);
  }
  return res;
}
/** Retire du journal (donc aussi du rapport du samedi) un changement sans importance ou une erreur de saisie. Ne touche ni au Suivi CPM ni à l'état de comparaison. */
function cpmJournalSupprimer_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).cpm || 0) < 2) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var e = req.evenement || {}; if (!e.date || !e.cle || !e.type) throw new Error('Changement invalide');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cpmFeuille_('CpmJournal', CPM_ENTETES_JOURNAL_), idx = cpmLignesJournal_(sh.getDataRange().getValues(), e);
    idx.reverse().forEach(function (i) { sh.deleteRow(i + 1); });
    Store.journal('cpm_journal_suppr', u.email, e.date + ' ' + e.cle + ' ' + e.type + ' ' + (e.champ || ''));
    return { supprimees: idx.length };
  } finally { lock.releaseLock(); }
}
function cpmInstantaneMaintenant_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).cpm || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  // bouton « Actualiser » du portail : au plus un instantané par minute (les clics répétés ne relisent pas la feuille pour rien)
  var dernier = Date.parse(PropertiesService.getScriptProperties().getProperty('CPM_DERNIER_INSTANTANE') || '');
  if (dernier && Date.now() - dernier < 60000) return { recent: true, base: false, evenements: 0, dossiers: 0 };
  return cpmInstantane_();
}
