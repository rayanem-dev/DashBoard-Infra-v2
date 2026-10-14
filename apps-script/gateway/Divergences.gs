/**
 * Contrôle de l'annuaire : compare les fiches contact (annuaire du portail, ANNUAIRE_DATA) avec BDDORGA et liste les divergences
 * (téléphone, e-mail, matricule, identifiant SONA, employeur) ainsi que les personnes présentes d'un seul côté.
 * Les prestataires (absents de BDDORGA) ne sont pas comparés. Réservé à l'administration de la sécurité (secrétariat). Ne modifie rien.
 */
var Divergences = (function () {
  function norme(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function jetons(s) { return norme(s).split(' ').filter(Boolean).sort().join(' '); }
  function chiffres(s) { return String(s == null ? '' : s).replace(/\D+/g, ''); }
  function neuf(s) { var d = chiffres(s); if (d.indexOf('213') === 0 && d.length > 9) d = d.slice(3); return d.length >= 9 ? d.slice(-9) : ''; }

  // ---- ressemblance de noms (fautes de frappe, accents, ordre des mots, initiales, prénoms composés) ----
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i += 1) { d[i] = [i]; } for (j = 1; j <= n; j += 1) d[0][j] = j;
    for (i = 1; i <= m; i += 1) for (j = 1; j <= n; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return d[m][n];
  }
  function simJeton(a, b) {
    if (a === b) return 1;
    if (a.length === 1 || b.length === 1) return a.charAt(0) === b.charAt(0) ? 0.6 : 0;
    return Math.max(0, 1 - lev(a, b) / Math.max(a.length, b.length));
  }
  /** 0..1 : ressemblance de deux noms (chaque mot du plus court cherche son meilleur vis-à-vis ; les mots en trop coûtent un peu). */
  function simNom(x, y) {
    var A = norme(x).split(' ').filter(Boolean), B = norme(y).split(' ').filter(Boolean);
    if (!A.length || !B.length) return 0;
    if (A.length > B.length) { var t = A; A = B; B = t; }
    var libres = B.slice(), somme = 0, pire = 1;
    A.forEach(function (a) {
      var meilleur = -1, k = 0;
      libres.forEach(function (b, i) { var v = simJeton(a, b); if (v > meilleur) { meilleur = v; k = i; } });
      somme += Math.max(0, meilleur); pire = Math.min(pire, Math.max(0, meilleur)); if (meilleur >= 0) libres.splice(k, 1);
    });
    // le mot le moins ressemblant pèse lourd : deux personnes qui ne partagent que le nom de famille ne sont pas la même personne
    return (somme / A.length) * (0.5 + 0.5 * pire) * (1 - 0.06 * (B.length - A.length));
  }
  function partieMail(e) { return norme(String(e || '').split('@')[0].replace(/[._-]+/g, ' ')); }
  /** Pour une fiche non appariée : meilleures personnes BDDORGA encore libres (score ≥ seuil), avec les indices qui les rapprochent. */
  function candidats(carte, libres, seuil) {
    var liste = libres.map(function (p) {
      var sc = simNom(carte.nom, p.nom), indices = [];
      if (sc >= 0.9) indices.push('nom presque identique');
      var tb = neuf(p.telephone);
      if (tb && carte.tels.indexOf(tb) !== -1) { sc += 0.35; indices.push('même téléphone'); }
      if (carte.email && p.email && simNom(partieMail(carte.email), partieMail(p.email)) >= 0.85) { sc += 0.2; indices.push('e-mail proche'); }
      if (empNorm(p.dependance) === empNorm(carte.employeur)) indices.push('même employeur');
      return { nom: p.nom, email: p.email, service: p.service, employeur: p.dependance || '', score: Math.min(1, Math.round(sc * 100) / 100), indices: indices };
    }).filter(function (c) { return c.score >= seuil; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
    if (liste.length > 1 && liste[0].score - liste[1].score < 0.08) liste[0].ambigu = true;
    return liste;
  }

  /** Détails d'une fiche personne → { tels:[9 chiffres], email, sona, matricule } */
  function analyserCarte(d) {
    var txt = String(d || ''), tels = [], m, re = /(?:\+?213|0)?[\d ]{9,14}/g;
    (txt.match(/📞[^|✉]*/g) || []).forEach(function (bloc) { (bloc.match(/[\d +]{9,}/g) || []).forEach(function (x) { var n = neuf(x); if (n && tels.indexOf(n) === -1) tels.push(n); }); });
    m = txt.match(/[\w.+-]+@[\w.-]+\.\w+/);
    var s = txt.match(/ID Sonatrach\s*:\s*(\S+)/i), mat = txt.match(/Matricule\s*:\s*([^|]+?)\s*(?:\||$)/i);
    return { tels: tels, email: m ? m[0].toLowerCase() : '', sona: s ? s[1].toLowerCase() : '', matricule: mat ? mat[1].trim().toUpperCase() : '' };
  }
  function cartesPersonnes(data) {
    var out = [];
    (data.rows || []).forEach(function (r) {
      var emp = String(r[4] || '').trim().toUpperCase();
      if (!emp) return; // fiche de poste ou de service, pas une personne
      var a = analyserCarte(r[2]);
      out.push({ nom: r[1], employeur: emp, section: String(r[3] || ''), tels: a.tels, email: a.email, sona: a.sona, matricule: a.matricule });
    });
    return out;
  }
  function empNorm(v) { var n = norme(v); if (!n || n === 'sh' || n === 'sonatrach') return 'SONATRACH'; return n.toUpperCase(); }

  function indexer(personnes) {
    var i = { mat: {}, sona: {}, mail: {}, nom: {} };
    personnes.forEach(function (p) { var k;
      if ((k = String(p.matricule || '').toUpperCase())) i.mat[k] = p; if ((k = String(p.sona || '').toLowerCase())) i.sona[k] = p; if ((k = String(p.email || '').toLowerCase())) i.mail[k] = p; if ((k = jetons(p.nom))) i.nom[k] = p; });
    return i;
  }
  /** Personne BDDORGA correspondant à une fiche : rapprochement confirmé, puis matricule, SONA, e-mail, nom identique. */
  function trouver(i, c, confirmees) {
    var conf = confirmees && confirmees[jetons(c.nom)];
    return (conf && i.mail[String(conf).toLowerCase()]) || (c.matricule && i.mat[c.matricule]) || (c.sona && i.sona[c.sona]) || (c.email && i.mail[c.email]) || i.nom[jetons(c.nom)] || null;
  }
  function tel10(v) { var d = chiffres(v); return d.length === 9 ? '0' + d : String(v || '').trim(); }

  /**
   * Annuaire du personnel construit depuis BDDORGA, complété par les fiches (et inversement) :
   * pour chaque personne de BDDORGA, valeur de BDDORGA sinon valeur de la fiche ; une adresse e-mail de la fiche différente de celle de BDDORGA est gardée en « e-mail 2 ».
   * Retourne { personnes: [...], remplace: [noms des fiches reprises] } ; les fiches sans personne dans BDDORGA et les prestataires ne sont pas touchés.
   */
  function fusionner(personnes, data, confirmees) {
    var staff = cartesPersonnes(data).filter(function (c) { return c.employeur !== 'PRESTATAIRE'; }), idx = indexer(personnes), parMail = {}, remplace = [];
    var cartesDe = {};
    staff.forEach(function (c) { var p = trouver(idx, c, confirmees); if (p) { cartesDe[String(p.email).toLowerCase()] = c; remplace.push(c.nom); } });
    var sortie = personnes.map(function (p) {
      var c = cartesDe[String(p.email).toLowerCase()] || null, emp = String(p.dependance || (c && c.employeur) || 'SONATRACH').toUpperCase();
      var tel = tel10(p.telephone) || (c && c.tels.length ? '0' + c.tels[0] : ''), alt = c ? c.tels.filter(function (x) { return x !== neuf(tel); }).map(function (x) { return '0' + x; }) : [];
      var mail = String(p.email || '').toLowerCase(), mail2 = c && c.email && c.email !== mail ? c.email : '';
      return { nom: c ? c.nom : p.nom, employeur: emp === 'SH' ? 'SONATRACH' : emp, section: c ? c.section : '', service: p.service || '', fonction: p.fonction || '',
        tel: tel, tels_alt: alt, email: mail, email2: mail2, sona: p.sona || (c && c.sona) || '', matricule: p.matricule || (c && c.matricule) || '' };
    });
    return { personnes: sortie, remplace: remplace };
  }

  /** personnes : résultat d'Annuaire.lire(...).personnes ; data : ANNUAIRE_DATA. */
  function comparer(personnes, data, confirmees) {
    confirmees = confirmees || {};
    var cartes = cartesPersonnes(data), prest = cartes.filter(function (c) { return c.employeur === 'PRESTATAIRE'; }).length;
    var staff = cartes.filter(function (c) { return c.employeur !== 'PRESTATAIRE'; });
    var idx = indexer(personnes);
    var div = [], sansBdd = [], utilises = {}, appariees = 0, rapproches = [];
    staff.forEach(function (c) {
      var p = trouver(idx, c, confirmees);
      if (!p) { sansBdd.push({ nom: c.nom, employeur: c.employeur, section: c.section, tels: c.tels, email: c.email, carte: c }); return; }
      appariees += 1; utilises[String(p.email).toLowerCase()] = true;
      if (confirmees[jetons(c.nom)] && String(confirmees[jetons(c.nom)]).toLowerCase() === String(p.email).toLowerCase()) rapproches.push({ nom: c.nom, bddorga: p.nom, email: p.email });
      function noter(champ, fiche, bdd, types) { div.push({ nom: c.nom, champ: champ, fiche: fiche, bddorga: bdd, genre: types, email_bddorga: p.email, valeur_fiche: champ === 'Téléphone' ? (c.tels.length ? '0' + c.tels[0] : '') : champ === 'Identifiant SONA' ? c.sona : champ === 'Matricule' ? c.matricule : '' }); }
      var tb = neuf(p.telephone);
      if (c.tels.length && tb) { if (c.tels.indexOf(tb) === -1) noter('Téléphone', c.tels.join(' / '), p.telephone, 'different'); }
      else if (tb && !c.tels.length) noter('Téléphone', '', p.telephone, 'manque_fiche');
      else if (!tb && c.tels.length) noter('Téléphone', c.tels.join(' / '), '', 'manque_bddorga');
      [['E-mail', c.email, String(p.email || '').toLowerCase()], ['Identifiant SONA', c.sona, String(p.sona || '').toLowerCase()], ['Matricule', c.matricule, String(p.matricule || '').toUpperCase()]].forEach(function (x) {
        if (x[1] && x[2]) { if (x[1] !== x[2]) noter(x[0], x[1], x[2], 'different'); }
        else if (x[2]) noter(x[0], '', x[2], 'manque_fiche'); else if (x[1]) noter(x[0], x[1], '', 'manque_bddorga');
      });
      var eb = empNorm(p.dependance), ef = empNorm(c.employeur);
      if (eb !== ef) noter('Employeur', c.employeur, p.dependance || '(vide)', 'different');
    });
    var libres = personnes.filter(function (p) { return !utilises[String(p.email).toLowerCase()]; });
    var probables = [], vraimentSans = [], reserves = {};
    sansBdd.forEach(function (x) {
      var cand = candidats(x.carte, libres, 0.62);
      if (cand.length) { probables.push({ nom: x.nom, employeur: x.employeur, section: x.section, tels: x.tels, email: x.email, candidats: cand }); cand.forEach(function (c) { reserves[String(c.email).toLowerCase()] = true; }); }
      else vraimentSans.push({ nom: x.nom, employeur: x.employeur, section: x.section });
    });
    var sansFiche = libres.filter(function (p) { return !reserves[String(p.email).toLowerCase()]; }).map(function (p) { return { nom: p.nom, service: p.service, employeur: p.dependance || '' }; });
    return { rapproches: rapproches, correspondances_probables: probables, divergences: div, fiches_sans_bddorga: vraimentSans, bddorga_sans_fiche: sansFiche, prestataires_non_compares: prest, appariees: appariees, fiches_personnes: staff.length, bddorga: personnes.length };
  }
  return { fusionner: fusionner, simNom: simNom, candidats: candidats, jetons: jetons, comparer: comparer, analyserCarte: analyserCarte, cartesPersonnes: cartesPersonnes, neuf: neuf };
})();

/** Action « contacts_divergences » (administration de la sécurité). */
function contactsDivergences_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  if (typeof ANNUAIRE_DATA === 'undefined') throw new Error('Données des fiches contact absentes de la passerelle (déploiement incomplet)');
  var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var src = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  if (!src) throw new Error('Onglet BDDORGA introuvable dans le fichier Organigramme');
  var lu = Annuaire.lire(src.getDataRange().getValues());
  if (lu.erreur) throw new Error(lu.erreur);
  return Divergences.comparer(lu.personnes, ANNUAIRE_DATA, correspondancesConfirmees_());
}

var CORRESP_ENTETES_ = ['nom_fiche', 'email', 'par', 'date'];
function correspondancesFeuille_() {
  var db = SpreadsheetApp.openById(prop_('DB_ID')), sh = db.getSheetByName('CorrespondancesContacts');
  if (!sh) { sh = db.insertSheet('CorrespondancesContacts'); sh.appendRow(CORRESP_ENTETES_); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
  return sh;
}
/** { clé de nom (mots triés) : e-mail BDDORGA } des rapprochements confirmés à la main. */
function correspondancesConfirmees_() {
  var m = {}; correspondancesFeuille_().getDataRange().getValues().slice(1).forEach(function (r) { if (r[0] && r[1]) m[Divergences.jetons(r[0])] = String(r[1]).toLowerCase(); });
  return m;
}
/** Action « contacts_confirmer » : { nom, email } enregistre « la fiche NOM est la personne EMAIL de BDDORGA » ; email vide : annule. */
function contactsConfirmer_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var nom = String(req.nom || '').trim(), email = String(req.email || '').trim().toLowerCase();
  if (!nom) throw new Error('Nom de la fiche manquant');
  var sh = correspondancesFeuille_(), v = sh.getDataRange().getValues(), cle = Divergences.jetons(nom), ligne = 0;
  for (var i = 1; i < v.length; i += 1) if (Divergences.jetons(v[i][0]) === cle) { ligne = i + 1; break; }
  if (!email) { if (ligne) sh.deleteRow(ligne); return { annule: true }; }
  var rec = [nom, email, u.email, new Date().toISOString().slice(0, 10)];
  if (ligne) sh.getRange(ligne, 1, 1, 4).setValues([rec]); else sh.appendRow(rec);
  Store.journal('contact_rapproche', u.email, nom + ' → ' + email);
  return { enregistre: true };
}

/**
 * Action « contacts_completer » : recopie dans BDDORGA les valeurs des fiches pour les cases VIDES (téléphone, identifiant SONA, matricule).
 * N'écrase jamais une case déjà remplie. { appliquer: false } (défaut) = aperçu ; { appliquer: true } = écriture. Réservé à l'administration de la sécurité.
 */
function contactsCompleter_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var rapport = contactsDivergences_(req), champs = { 'Téléphone': 'telephone', 'Identifiant SONA': 'sona', 'Matricule': 'matricule' };
  var plan = rapport.divergences.filter(function (d) { return d.genre === 'manque_bddorga' && champs[d.champ] && d.valeur_fiche; })
    .map(function (d) { return { nom: d.nom, email: d.email_bddorga, champ: d.champ, cle: champs[d.champ], valeur: d.valeur_fiche }; });
  if (req.appliquer !== true) return { appliquer: false, plan: plan.map(function (x) { return { nom: x.nom, champ: x.champ, valeur: x.valeur }; }) };
  var parPersonne = {}; plan.forEach(function (x) { (parPersonne[x.email] = parPersonne[x.email] || { nom: x.nom, champs: {} }).champs[x.cle] = x.valeur; });
  var ecrites = 0, echecs = [];
  Object.keys(parPersonne).forEach(function (email) {
    try { ecrites += ecrireDansBddorga_(email, parPersonne[email].champs, true); } catch (e) { echecs.push(parPersonne[email].nom + ' : ' + e.message); }
  });
  Store.journal('bddorga_complete', u.email, ecrites + ' case(s) vide(s) remplie(s) depuis les fiches contact' + (echecs.length ? ' ; échecs : ' + echecs.join(' | ') : ''));
  return { appliquer: true, ecrites: ecrites, echecs: echecs };
}

/** Action « annuaire_personnes » (toute personne connectée) : le personnel tel que BDDORGA le décrit, complété par les fiches. Mis en cache 5 minutes. */
function annuairePersonnes_(req) {
  Auth.userFromToken(req.token);
  var cache = CacheService.getScriptCache(), vu = cache.get('ANN_PERSONNES');
  if (vu) return JSON.parse(vu);
  if (typeof ANNUAIRE_DATA === 'undefined') throw new Error('Fiches contact absentes de la passerelle');
  var id = PropertiesService.getScriptProperties().getProperty('ORGA_ID') || ORGA_ID_DEFAUT;
  var src = SpreadsheetApp.openById(id).getSheetByName('BDDORGA');
  if (!src) throw new Error('Onglet BDDORGA introuvable dans le fichier Organigramme');
  var lu = Annuaire.lire(src.getDataRange().getValues());
  if (lu.erreur) throw new Error(lu.erreur);
  var res = Divergences.fusionner(lu.personnes, ANNUAIRE_DATA, correspondancesConfirmees_());
  try { cache.put('ANN_PERSONNES', JSON.stringify(res), 300); } catch (e) {}
  return res;
}
