/**
 * Badges prestataires (module « badges ») : liste des personnes, entreprises et contrats, historique des badges imprimés.
 *  - entreprises + n° de contrat : lus dans le Suivi CPM (colonnes « Attribué à » et « N° de contrat »), comme pour les autorisations d'accès ;
 *  - noms + fonctions : lus dans « Enquêtes administratives » (un onglet par prestataire) — le fichier doit être un VRAI Google Sheets
 *    (un .xlsx n'est pas lisible : Fichier ▸ Enregistrer en Google Sheets, puis propriété de script BADGES_ENQUETES_ID = nouvel identifiant) ;
 *  - corrections et ajouts manuels : onglets « BadgesPersonnes » et « BadgesEntreprises » (la source n'est jamais modifiée) ;
 *  - numéros et historique : onglet « BadgesHistorique » (un badge = un numéro par an, réimpression = même numéro).
 * Droits (module badges) : 1 = voir, 2 = modifier et imprimer, 3 = tout.
 * Le moteur (numérotation, lecture des Enquêtes) est partagé avec le site : badges/badges.js, copié en BadgesMoteur.gs au déploiement.
 */
var BADGES_ENQUETES_DEFAUT_ = '1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo'; // « التحقيقات الادارية » (Google Sheets converti ; la propriété BADGES_ENQUETES_ID, si elle existe, passe avant)
var BADGES_ENT_P_ = ['id', 'nom', 'prenom', 'fonction', 'entreprise', 'contrat', 'structure', 'nomAr', 'prenomAr', 'supprime', 'photo', 'maj'];
var BADGES_ENT_E_ = ['nom', 'contrats', 'supprime', 'maj', 'alias'];
var BADGES_ENT_H_ = ['date', 'ref', 'n', 'annee', 'cle', 'nom', 'prenom', 'fonction', 'entreprise', 'structure', 'contrat', 'imprime_par'];
var BADGES_MOTS_VIDES_ = { sarl: 1, eurl: 1, spa: 1, sas: 1, snc: 1, ets: 1, etb: 1, etbe: 1, unite: 1, groupe: 1, cie: 1, de: 1, du: 1, des: 1, et: 1, la: 1, le: 1, location: 1, entreprise: 1, societe: 1, corp: 1, algerie: 1, algeria: 1 };

// ---------- logique pure (testée en Node) ----------
function badgesJetons_(s) { return Badges.norm(s).split(' ').filter(function (t) { return t && !BADGES_MOTS_VIDES_[t]; }); }
/** Entreprise de la liste CPM qui correspond le mieux au nom lu dans les Enquêtes (au moins la moitié des mots, un mot significatif commun), sinon ''. */
function badgesAppariement_(nom, noms) {
  var a = badgesJetons_(nom), meilleur = '', score = 0;
  if (!a.length) return '';
  noms.forEach(function (n) {
    var b = badgesJetons_(n); if (!b.length) return;
    var commun = a.filter(function (t) { return b.indexOf(t) >= 0 || b.some(function (u) { return badgesProche_(t, u) || (t.length >= 4 && u.length >= 4 && (u.indexOf(t) === 0 || t.indexOf(u) === 0)); }); }).length;
    var s = commun / Math.max(a.length, b.length);
    if (commun >= Math.min(a.length, b.length) && s > score) { score = s; meilleur = n; } // l'un des deux noms est inclus dans l'autre (ZATOUT TAYEB ≠ ZATOUT ABDENCER)
  });
  return meilleur;
}
/** Deux mots de 5 lettres ou plus qui ne diffèrent que d'une lettre (MHENNI / MEHENNI) sont considérés comme le même. */
function badgesProche_(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  var c = a.length > b.length ? a : b, d = a.length > b.length ? b : a;
  return c.slice(i + 1) === d.slice(i);
}
function badgesHash_(s) { var h = 5381, i; s = String(s); for (i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

/** Entreprises et contrats depuis les enregistrements CPM (cpmEnregistrements_). */
function badgesEntreprisesCpm_(enr) {
  var par = {}, ordre = [];
  enr.ordre.forEach(function (k) {
    var d = enr.dossiers[k], nom = Badges.vide(d.attribue_a); if (!nom) return;
    var cle = Badges.norm(nom); if (!par[cle]) { par[cle] = { nom: nom, contrats: [] }; ordre.push(cle); }
    var num = Badges.vide(d.n_contrat);
    if (num && !par[cle].contrats.some(function (c) { return c.numero === num; })) par[cle].contrats.push({ numero: num, intitule: Badges.vide(d.intitule) });
  });
  return ordre.map(function (c) { return par[c]; });
}
/** Contrat porté par un onglet normalisé « ENTREPRISE · 60.INFRA.26 » (repris tel que dans le CPM si connu) ; '' pour un ancien nom d'onglet. */
function badgesContratOnglet_(onglet, contrats) {
  var p = String(onglet || '').split(' · '); if (p.length < 2) return '';
  var c = p.slice(1).join(' · ').trim(), k = Badges.norm(c).replace(/ /g, '');
  var connu = (contrats || []).filter(function (x) { return Badges.norm(x.numero).replace(/ /g, '') === k; })[0];
  return connu ? connu.numero : c;
}
/** Assemble : Enquêtes (un résultat par onglet) + entreprises CPM + corrections manuelles. */
function badgesFusion_(onglets, entCpm, surP, surE) {
  var entreprises = entCpm.map(function (e) { return { nom: e.nom, contrats: e.contrats.slice(), source: 'cpm' }; });
  var cpmNoms = entreprises.map(function (e) { return e.nom; });
  var aliasDe = {}; (surE || []).forEach(function (r) { if (r.alias && String(r.supprime) !== '1') aliasDe[Badges.norm(r.nom)] = String(r.alias); });
  var personnes = [], i;
  onglets.forEach(function (o) {
    if (!o.personnes.length) return;
    var nom = badgesAppariement_(o.entreprise, cpmNoms) || badgesAppariement_(o.onglet, cpmNoms) || o.entreprise;
    var al = aliasDe[Badges.norm(nom)] || aliasDe[Badges.norm(o.entreprise)]; if (al) nom = al; // rattachement décidé à la main
    if (!entreprises.some(function (e) { return Badges.norm(e.nom) === Badges.norm(nom); })) entreprises.push({ nom: nom, contrats: [], source: 'enquetes' });
    var contratOnglet = badgesContratOnglet_(o.onglet, (entreprises.filter(function (e) { return Badges.norm(e.nom) === Badges.norm(nom); })[0] || { contrats: [] }).contrats);
    o.personnes.forEach(function (p) {
      personnes.push({ id: 'e' + badgesHash_(o.onglet + '|' + Badges.cle({ nom: p.nom, prenom: p.prenom, entreprise: '' })), nom: p.nom, prenom: p.prenom, fonction: p.fonction, entreprise: nom, contrat: contratOnglet, structure: '', nomAr: p.nomAr, prenomAr: p.prenomAr, verifier: !!p.verifier, source: 'enquetes', onglet: o.onglet });
    });
  });
  // corrections d'entreprises
  var sE = {}; (surE || []).forEach(function (r) { if (!r.alias) sE[Badges.norm(r.nom)] = r; });
  entreprises = entreprises.filter(function (e) { var r = sE[Badges.norm(e.nom)]; return !(r && String(r.supprime) === '1'); }).map(function (e) { var r = sE[Badges.norm(e.nom)]; if (r) { try { e.contrats = JSON.parse(r.contrats || '[]'); } catch (x) { /* ligne illisible : ignorée */ } } return e; });
  (surE || []).forEach(function (r) { if (!r.alias && String(r.supprime) !== '1' && !entreprises.some(function (e) { return Badges.norm(e.nom) === Badges.norm(r.nom); })) { var c = []; try { c = JSON.parse(r.contrats || '[]'); } catch (x) { /* ignoré */ } entreprises.push({ nom: r.nom, contrats: c, source: 'manuel' }); } });
  // un seul contrat connu : repris d'office
  personnes.forEach(function (p) { var e = entreprises.filter(function (x) { return Badges.norm(x.nom) === Badges.norm(p.entreprise); })[0]; if (e && e.contrats.length === 1) p.contrat = e.contrats[0].numero; });
  // corrections de personnes
  var parId = {}; personnes.forEach(function (p, k) { parId[p.id] = k; });
  var cache = []; (surP || []).forEach(function (r) {
    var o = { id: String(r.id), nom: r.nom, prenom: r.prenom, fonction: r.fonction, entreprise: r.entreprise, contrat: r.contrat, structure: r.structure, nomAr: r.nomAr, prenomAr: r.prenomAr, photo: r.photo || '', verifier: false };
    if (parId[o.id] !== undefined) { if (String(r.supprime) === '1') cache.push(o.id); else { var b = personnes[parId[o.id]]; o.source = b.source; o.onglet = b.onglet; personnes[parId[o.id]] = o; } }
    else if (String(r.supprime) !== '1') { o.source = 'manuel'; personnes.push(o); }
  });
  personnes = personnes.filter(function (p) { return cache.indexOf(p.id) < 0; });
  return { personnes: personnes, entreprises: entreprises };
}
function badgesLignes_(rows, entetes) { return rows.slice(1).filter(function (r) { return String(r[0]) !== ''; }).map(function (r) { var o = {}; entetes.forEach(function (c, i) { o[c] = r[i] == null ? '' : String(r[i]); }); return o; }); }

/** Pur : numéros + lignes d'historique à ajouter (nouvelles attributions, et une ligne par réimpression). */
function badgesAttribuerEtNoter_(hist, items, annee, cfg, par, jour) {
  var r = Badges.attribuer(hist, items, annee, cfg), lignes = [], vus = {};
  r.items.forEach(function (it) {
    var k = it.n + '|' + Badges.cle(it); if (vus[k]) return; vus[k] = 1;
    lignes.push({ date: jour, ref: it.ref, n: it.n, annee: it.annee, cle: Badges.cle(it), nom: it.nom, prenom: it.prenom, fonction: it.fonction, entreprise: it.entreprise, structure: it.structure || cfg.structure, contrat: it.contrat, imprime_par: par });
  });
  return { items: r.items, lignes: lignes };
}

// ---------- accès aux feuilles ----------
function badgesEnquetes_() {
  var id = PropertiesService.getScriptProperties().getProperty('BADGES_ENQUETES_ID') || BADGES_ENQUETES_DEFAUT_, ss;
  try { ss = SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('Le fichier « Enquêtes administratives » n\'est pas lisible par la passerelle : il doit être un Google Sheets (Fichier ▸ Enregistrer en Google Sheets si c\'est un .xlsx) appartenant ou partagé au compte du secrétariat, puis son identifiant va dans la propriété de script BADGES_ENQUETES_ID.'); }
  return ss.getSheets().map(function (sh) { return Badges.analyserEnquetes(sh.getDataRange().getDisplayValues(), sh.getName()); });
}
function badgesCharger_() {
  var avert = [], onglets = [], entCpm = [];
  var cache = CacheService.getScriptCache(), vu = cache.get('BADGES_SRC');
  if (vu) { try { var o = JSON.parse(vu); onglets = o.onglets; entCpm = o.entCpm; avert = o.avert; } catch (e) { vu = null; } }
  if (!vu) {
    try { entCpm = badgesEntreprisesCpm_(cpmEnregistrements_(lignesSource_('cpm'))); } catch (e) { avert.push('Suivi CPM : ' + e.message); }
    try { onglets = badgesEnquetes_(); } catch (e) { avert.push(e.message); }
    try { var txt = JSON.stringify({ onglets: onglets, entCpm: entCpm, avert: avert }); if (txt.length < 95000) cache.put('BADGES_SRC', txt, 300); } catch (e) { /* trop gros : pas de cache */ }
  }
  var surP = badgesLignes_(cpmFeuille_('BadgesPersonnes', BADGES_ENT_P_).getDataRange().getValues(), BADGES_ENT_P_);
  var surE = badgesLignes_(cpmFeuille_('BadgesEntreprises', BADGES_ENT_E_).getDataRange().getValues(), BADGES_ENT_E_);
  var f = badgesFusion_(onglets, entCpm, surP, surE); f.avertissements = avert; return f;
}
function badgesHistorique_() {
  return badgesLignes_(cpmFeuille_('BadgesHistorique', BADGES_ENT_H_).getDataRange().getValues(), BADGES_ENT_H_).map(function (h) { h.n = Number(h.n); h.annee = Number(h.annee); return h; });
}
function badgesDroit_(req, min) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).badges || 0) < min) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function badgesCfg_(c) {
  c = c || {};
  return Badges.config({ base: String(c.base || '').slice(0, 80) || undefined, formatNumero: String(c.formatNumero || '').slice(0, 80) || undefined, chiffres: Number(c.chiffres) > 0 && Number(c.chiffres) < 8 ? Number(c.chiffres) : undefined, numeroDepart: Number(c.numeroDepart) > 0 ? Number(c.numeroDepart) : undefined, structure: String(c.structure || '').slice(0, 60) || undefined });
}

// ---------- actions ----------
function badgesDonnees_(req) {
  var u = badgesDroit_(req, 1), f = badgesCharger_();
  return { personnes: f.personnes, entreprises: f.entreprises, historique: badgesHistorique_(), utilisateur: u.nom || u.email, avertissements: f.avertissements, niveau: acces_(u).badges || 0 };
}
function badgesVider_(s) { return Badges.vide(s).slice(0, 200); }
function badgesPersonnesSauver_(req) {
  badgesDroit_(req, 2);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cpmFeuille_('BadgesPersonnes', BADGES_ENT_P_), rows = sh.getDataRange().getValues(), pos = {};
    rows.forEach(function (r, i) { if (i) pos[String(r[0])] = i + 1; });
    var maj = new Date().toISOString(), ajout = [];
    function ligne(p, suppr) { return BADGES_ENT_P_.map(function (c) { if (c === 'supprime') return suppr ? '1' : ''; if (c === 'maj') return maj; if (c === 'id') return String(p.id).slice(0, 40); if (c === 'photo') { var ph = String(p.photo || ''); return ph.length < 45000 && /^data:image\//.test(ph) ? ph : ''; } return badgesVider_(p[c]); }); }
    (req.personnes || []).slice(0, 800).forEach(function (p) { if (!p || !p.id) return; var l = ligne(p, false); if (pos[p.id]) sh.getRange(pos[p.id], 1, 1, l.length).setValues([l]); else { ajout.push(l); pos[p.id] = -1; } });
    (req.supprimer || []).slice(0, 800).forEach(function (id) { var l = ligne({ id: id }, true); if (pos[id] > 0) sh.getRange(pos[id], 1, 1, l.length).setValues([l]); else ajout.push(l); });
    if (ajout.length) sh.getRange(sh.getLastRow() + 1, 1, ajout.length, BADGES_ENT_P_.length).setValues(ajout);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function badgesEntreprisesSauver_(req) {
  badgesDroit_(req, 2);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cpmFeuille_('BadgesEntreprises', BADGES_ENT_E_), rows = sh.getDataRange().getValues(), pos = {};
    rows.forEach(function (r, i) { if (i) pos[Badges.norm(r[0])] = i + 1; });
    var maj = new Date().toISOString(), ajout = [];
    function ecrire(nom, contrats, suppr, alias) {
      var l = [badgesVider_(nom), JSON.stringify((contrats || []).slice(0, 40).map(function (c) { return { numero: badgesVider_(c.numero), intitule: badgesVider_(c.intitule) }; })), suppr ? '1' : '', maj, alias ? badgesVider_(alias) : ''], k = Badges.norm(nom);
      if (pos[k] > 0) sh.getRange(pos[k], 1, 1, l.length).setValues([l]); else { ajout.push(l); pos[k] = -1; }
    }
    (req.entreprises || []).slice(0, 300).forEach(function (e) { if (e && e.nom) ecrire(e.nom, e.contrats, false); });
    (req.supprimer || []).slice(0, 300).forEach(function (n) { ecrire(n, [], true); });
    (req.alias || []).slice(0, 100).forEach(function (a) { if (a && a.de && a.vers) { ecrire(a.de, [], false, a.vers); } });
    if (ajout.length) sh.getRange(sh.getLastRow() + 1, 1, ajout.length, BADGES_ENT_E_.length).setValues(ajout);
    CacheService.getScriptCache().remove('BADGES_SRC');
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/** Attribue les numéros (même personne + même entreprise = même numéro dans l'année) et enregistre CHAQUE impression dans l'historique. */
function badgesNumeroter_(req) {
  var u = badgesDroit_(req, 2), cfg = badgesCfg_(req.cfg), annee = Number(req.annee) || new Date().getFullYear();
  var items = (req.items || []).slice(0, 500).map(function (p) { return { nom: badgesVider_(p.nom), prenom: badgesVider_(p.prenom), fonction: badgesVider_(p.fonction), entreprise: badgesVider_(p.entreprise), contrat: badgesVider_(p.contrat), structure: badgesVider_(p.structure), n: p.n && req.reimpression ? Number(p.n) : undefined, id: p.id, nomAr: badgesVider_(p.nomAr), prenomAr: badgesVider_(p.prenomAr) }; });
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cpmFeuille_('BadgesHistorique', BADGES_ENT_H_), hist = badgesHistorique_(), r = badgesAttribuerEtNoter_(hist, items, annee, cfg, u.nom || u.email, Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd'));
    if (r.lignes.length) sh.getRange(sh.getLastRow() + 1, 1, r.lignes.length, BADGES_ENT_H_.length).setValues(r.lignes.map(function (l) { return BADGES_ENT_H_.map(function (c) { return l[c] == null ? '' : l[c]; }); }));
    return { items: r.items, historique: hist.concat(r.lignes) };
  } finally { lock.releaseLock(); }
}
/** À lancer depuis l'éditeur : vérifie que les deux sources sont lisibles (journal d'exécution). */
function badgesVerifierSources() {
  var f = badgesCharger_();
  Logger.log('Entreprises : ' + f.entreprises.length + ' — personnes : ' + f.personnes.length);
  (f.avertissements || []).forEach(function (a) { Logger.log('ATTENTION : ' + a); });
}
