/**
 * Statistique des sous-traitants (page stats-soustraitants.html, onglet des Enquêtes) : par mois et par prestataire, le nombre d'agents pris en charge
 * (lus dans le « Journal_PEC » des prises en charge) et les heures travaillées (agents × heures par agent et par mois). Les lignes sont modifiables et supprimables ;
 * un nouveau calcul ne touche jamais une ligne modifiée à la main ni ne ressuscite une ligne supprimée.
 * Partie PURE (testée en Node : test/statsst.test.js) puis les actions de la passerelle.
 */
var StatsST = (function () {
  var HEURES_DEFAUT = 360;   // 12 h × 30 jours : 10 agents → 3 600 h, comme dans le fichier d'origine
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  /** « 2026-04-27 08:15 », « 27/04/2026 », « 2026-04-27T… » → « 2026-04-27 » ; '' si illisible. */
  function dateIso(s) {
    var t = String(s == null ? '' : s).trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
  }
  function plus(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function bornes(mois) {   // 'yyyy-MM' → { debut, fin }
    var m = /^(\d{4})-(\d{2})$/.exec(String(mois)); if (!m || +m[2] < 1 || +m[2] > 12) return null;
    var fin = new Date(Date.UTC(+m[1], +m[2], 0)).toISOString().slice(0, 10);
    return { debut: m[1] + '-' + m[2] + '-01', fin: fin };
  }
  /** « N° contrat - Entreprise - Intitulé » → { contrat, entreprise, intitule } (un organisme hors Suivi CPM n'a que son nom). */
  function decouper(option) {
    var p = String(option || '').split(' - ').map(function (x) { return x.trim(); });
    return p.length >= 2 ? { contrat: p[0], entreprise: p[1], intitule: p.slice(2).join(' - ') } : { contrat: '', entreprise: p[0] || '', intitule: '' };
  }
  /**
   * valeurs = contenu du Journal_PEC (en-tête comprise : date, prestataire, base, documents, nom, prenom, …, arrivee, depart) ; mois = 'yyyy-MM'.
   * Une personne compte pour un prestataire si son séjour [arrivée, départ] (départ = arrivée + 28 jours à défaut) touche le mois ; comptée une seule fois.
   * Retourne [{ cle, prestataire, effectif, heures }] trié ; le libellé porte l'intitulé du contrat quand l'entreprise a plusieurs contrats ce mois-là.
   */
  function compter(valeurs, mois, heuresParAgent) {
    var b = bornes(mois), H = Number(heuresParAgent) > 0 ? Number(heuresParAgent) : HEURES_DEFAUT; if (!b) return [];
    var par = {}, ordre = [];
    (valeurs || []).slice(1).forEach(function (r) {
      var presta = String(r[1] || '').trim(), nom = norm(r[4]), prenom = norm(r[5]); if (!presta || (!nom && !prenom)) return;
      var a = dateIso(r[10]) || dateIso(r[0]); if (!a) return;
      var d = dateIso(r[11]) || plus(a, 28);
      if (d < a) d = a;
      if (a > b.fin || d < b.debut) return;
      var cle = norm(presta); if (!par[cle]) { par[cle] = { cle: cle, option: presta, gens: {} }; ordre.push(cle); }
      par[cle].gens[nom + '|' + prenom] = true;
    });
    var parEnt = {}; ordre.forEach(function (k) { var e = norm(decouper(par[k].option).entreprise); parEnt[e] = (parEnt[e] || 0) + 1; });
    return ordre.map(function (k) {
      var x = par[k], dc = decouper(x.option), n = Object.keys(x.gens).length;
      var etiquette = dc.entreprise + (parEnt[norm(dc.entreprise)] > 1 && dc.intitule ? ' (' + dc.intitule + ')' : '');
      return { cle: k, prestataire: etiquette, effectif: n, heures: n * H };
    }).sort(function (p, q) { return p.prestataire < q.prestataire ? -1 : p.prestataire > q.prestataire ? 1 : 0; });
  }
  /**
   * existantes = lignes enregistrées du mois ([{ cle, origine, modifie, supprime, … }]) ; calcul = résultat de compter.
   * Retourne { ajouter: [calcul], maj: [{ ligne, effectif, heures }], }  :
   *  - ligne absente → à ajouter ; ligne automatique non modifiée → mise à jour des chiffres ; ligne modifiée à la main ou supprimée → intacte.
   */
  function fusionner(existantes, calcul) {
    var parCle = {}; (existantes || []).forEach(function (l) { if (l.cle) parCle[l.cle] = l; });
    var plan = { ajouter: [], maj: [] };
    (calcul || []).forEach(function (c) {
      var l = parCle[c.cle];
      if (!l) { plan.ajouter.push(c); return; }
      if (String(l.supprime) === '1' || String(l.modifie) === '1' || l.origine === 'manuel') return;
      if (Number(l.effectif) !== c.effectif || Number(l.heures) !== c.heures) plan.maj.push({ ligne: l, effectif: c.effectif, heures: c.heures });
    });
    return plan;
  }
  /**
   * Lignes en double (même mois et même clé) : deux ouvertures simultanées de la page ont pu calculer le mois deux fois. Retourne les numéros de ligne à supprimer ;
   * on garde, pour chaque clé, la ligne modifiée à la main (ou supprimée, pour garder la trace), à défaut la première.
   */
  function doublons(lignes) {
    var groupes = {}, a_supprimer = [];
    (lignes || []).forEach(function (l) { var k = String(l.mois) + '|' + String(l.cle); (groupes[k] = groupes[k] || []).push(l); });
    Object.keys(groupes).forEach(function (k) {
      var g = groupes[k]; if (g.length < 2) return;
      var gardee = g.filter(function (l) { return String(l.modifie) === '1' || String(l.supprime) === '1'; })[0] || g[0];
      g.forEach(function (l) { if (l !== gardee) a_supprimer.push(l.ligne); });
    });
    return a_supprimer.sort(function (a, b) { return b - a; });
  }
  return { doublons: doublons, HEURES_DEFAUT: HEURES_DEFAUT, norm: norm, dateIso: dateIso, bornes: bornes, decouper: decouper, compter: compter, fusionner: fusionner };
})();
if (typeof module !== 'undefined') module.exports = StatsST;

// ---------- passerelle ----------
var STATS_ST_ENTETES_ = ['id', 'mois', 'cle', 'prestataire', 'effectif', 'heures', 'observation', 'origine', 'modifie', 'supprime', 'maj_par', 'maj_le'];
function statsStHeures_() { return Number(PropertiesService.getScriptProperties().getProperty('STATS_ST_HEURES')) || StatsST.HEURES_DEFAUT; }
function statsStFeuille_() { return cpmFeuille_('StatsSousTraitants', STATS_ST_ENTETES_); }
function statsStLignes_() {
  var v = statsStFeuille_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i += 1) { if (!v[i][0]) continue; var o = { ligne: i + 1 }; STATS_ST_ENTETES_.forEach(function (c, k) { o[c] = v[i][k]; }); out.push(o); }
  return out;
}
function statsStDroit_(req) { return badgesDroit_(req, 2); }
function statsStMois_(req) { var m = String(req.mois || ''); if (!StatsST.bornes(m)) throw new Error('Mois invalide (AAAA-MM)'); return m; }
function statsStJournal_() {
  var sh = SpreadsheetApp.openById(PEC_SS_ID).getSheetByName('Journal_PEC');
  return sh && sh.getLastRow() > 1 ? sh.getDataRange().getDisplayValues() : [];
}
function statsStSortie_(mois) {
  var l = statsStLignes_().filter(function (x) { return String(x.mois) === mois && String(x.supprime) !== '1'; })
    .map(function (x) { return { id: String(x.id), prestataire: String(x.prestataire), effectif: Number(x.effectif) || 0, heures: Number(x.heures) || 0, observation: String(x.observation || ''), origine: String(x.origine), modifie: String(x.modifie) === '1' };  });
  l.sort(function (a, b) { return a.prestataire < b.prestataire ? -1 : a.prestataire > b.prestataire ? 1 : 0; });
  var tousMois = {}; statsStLignes_().forEach(function (x) { if (x.mois) tousMois[String(x.mois)] = true; });
  return { mois: mois, lignes: l, heures_par_agent: statsStHeures_(), mois_saisis: Object.keys(tousMois).sort() };
}
/** Calcule et enregistre le mois (première ouverture ou bouton « Recalculer »). */
function statsStCalculer_(mois, par) {
  var calcul = StatsST.compter(statsStJournal_(), mois, statsStHeures_()), sh = statsStFeuille_();
  var plan = StatsST.fusionner(statsStLignes_().filter(function (x) { return String(x.mois) === mois; }), calcul), maintenant = new Date().toISOString();
  plan.maj.forEach(function (m) { sh.getRange(m.ligne.ligne, 5, 1, 2).setValues([[m.effectif, m.heures]]); sh.getRange(m.ligne.ligne, 11, 1, 2).setValues([[par, maintenant]]); });
  if (plan.ajouter.length) {
    var debut = sh.getLastRow() + 1, rng = sh.getRange(debut, 1, plan.ajouter.length, STATS_ST_ENTETES_.length); rng.setNumberFormat('@');
    rng.setValues(plan.ajouter.map(function (c) { return [Utilities.getUuid().slice(0, 8), mois, c.cle, c.prestataire, c.effectif, c.heures, '', 'auto', 0, 0, par, maintenant]; }));
  }
  return { ajoutees: plan.ajouter.length, mises_a_jour: plan.maj.length };
}
/** Supprime les lignes en double (voir StatsST.doublons) ; retourne leur nombre. */
function statsStNettoyer_() {
  var sh = statsStFeuille_(), d = StatsST.doublons(statsStLignes_());
  d.forEach(function (n) { sh.deleteRow(n); });
  return d.length;
}
function statsStLire_(req) {
  var u = statsStDroit_(req), mois = statsStMois_(req), lock = LockService.getScriptLock(); lock.waitLock(30000);   // un seul calcul à la fois : deux ouvertures simultanées doublaient les lignes
  try {
    statsStNettoyer_();
    if (!statsStLignes_().some(function (x) { return String(x.mois) === mois; })) { try { statsStCalculer_(mois, Annuaire.nomAffichable(u.nom, u.email)); } catch (e) { Logger.log('Stats sous-traitants : ' + e.message); } }
    return statsStSortie_(mois);
  } finally { lock.releaseLock(); }
}
function statsStRecalculer_(req) {
  var u = statsStDroit_(req), mois = statsStMois_(req), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { statsStNettoyer_(); var r = statsStCalculer_(mois, Annuaire.nomAffichable(u.nom, u.email)); Store.journal('stats_st_recalcul', u.email, mois + ' : ' + r.ajoutees + ' ajoutée(s), ' + r.mises_a_jour + ' mise(s) à jour'); var s = statsStSortie_(mois); s.resume = r; return s; }
  finally { lock.releaseLock(); }
}
function statsStNombre_(v, max) { var n = Math.round(Number(v)); if (!(n >= 0 && n <= max)) throw new Error('Nombre invalide'); return n; }
function statsStMaj_(req) {
  var u = statsStDroit_(req), id = String(req.id || ''), l = statsStLignes_().filter(function (x) { return String(x.id) === id; })[0];
  if (!l) throw new Error('Ligne introuvable');
  var c = req.champs || {}, sh = statsStFeuille_(), propre = function (s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n); };
  var v = { prestataire: String(l.prestataire), effectif: Number(l.effectif) || 0, heures: Number(l.heures) || 0, observation: String(l.observation || '') };
  if (c.prestataire !== undefined) { v.prestataire = propre(c.prestataire, 160); if (!v.prestataire) throw new Error('Le nom du sous-traitant est obligatoire'); }
  if (c.effectif !== undefined) v.effectif = statsStNombre_(c.effectif, 5000);
  if (c.heures !== undefined) v.heures = statsStNombre_(c.heures, 2000000);
  if (c.observation !== undefined) v.observation = propre(c.observation, 300);
  sh.getRange(l.ligne, 4, 1, 4).setNumberFormat('@').setValues([[v.prestataire, v.effectif, v.heures, v.observation]]);
  sh.getRange(l.ligne, 9, 1, 4).setNumberFormat('@').setValues([[1, l.supprime === '' ? 0 : l.supprime, Annuaire.nomAffichable(u.nom, u.email), new Date().toISOString()]]);
  Store.journal('stats_st_maj', u.email, String(l.mois) + ' ' + v.prestataire + ' : ' + v.effectif + ' agents');
  return statsStSortie_(String(l.mois));
}
function statsStSupprimer_(req) {
  var u = statsStDroit_(req), id = String(req.id || ''), l = statsStLignes_().filter(function (x) { return String(x.id) === id; })[0];
  if (!l) throw new Error('Ligne introuvable');
  var sh = statsStFeuille_();
  if (l.origine === 'manuel') sh.deleteRow(l.ligne);
  else sh.getRange(l.ligne, 10).setNumberFormat('@').setValue(1);   // ligne automatique : on garde la trace pour qu'un recalcul ne la remette pas
  Store.journal('stats_st_suppr', u.email, String(l.mois) + ' ' + String(l.prestataire));
  return statsStSortie_(String(l.mois));
}
function statsStAjouter_(req) {
  var u = statsStDroit_(req), mois = statsStMois_(req), nom = String(req.prestataire || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!nom) throw new Error('Le nom du sous-traitant est obligatoire');
  var eff = statsStNombre_(req.effectif || 0, 5000), h = req.heures === undefined || req.heures === '' ? eff * statsStHeures_() : statsStNombre_(req.heures, 2000000), sh = statsStFeuille_();
  var rng = sh.getRange(sh.getLastRow() + 1, 1, 1, STATS_ST_ENTETES_.length); rng.setNumberFormat('@');
  rng.setValues([[Utilities.getUuid().slice(0, 8), mois, 'manuel:' + StatsST.norm(nom), nom, eff, h, String(req.observation || '').slice(0, 300), 'manuel', 1, 0, Annuaire.nomAffichable(u.nom, u.email), new Date().toISOString()]]);
  Store.journal('stats_st_ajout', u.email, mois + ' ' + nom);
  return statsStSortie_(mois);
}
