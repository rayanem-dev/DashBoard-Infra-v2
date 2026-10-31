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
   *   attendues, creees, manquantes: [{ contrat, entreprise, projet }], faites: [{ contrat, entreprise, taux }], horsListe, total }.
   */
  function etat(auj, contrats, fiches) {
    var jour = Number(String(auj).slice(8, 10)); if (!(jour >= JOUR_DEBUT)) return null;
    var mois = String(auj).slice(0, 7), vues = {}, horsListe = 0, par = {};
    (fiches || []).forEach(function (f) {
      var d = /^\d{4}-\d{2}/.test(String(f.date || '')) ? String(f.date).slice(0, 7) : String(f.cree || '').slice(0, 7);   // date de la fiche ; à défaut, date de création du fichier
      if (d !== mois) return;                                       // fiche d'un autre mois
      var k = cle(f.contrat); if (k && par[k]) return;               // une seule fiche comptée par contrat
      if (k) par[k] = f; else horsListe += 1;
    });
    var attendues = [], faites = [], manquantes = [];
    (contrats || []).forEach(function (c) {
      var k = cle(c.contrat); if (!k || vues[k]) return; vues[k] = 1;
      attendues.push(c);
      if (par[k]) faites.push({ contrat: c.contrat, entreprise: c.entreprise, taux: par[k].taux == null ? null : par[k].taux }); else manquantes.push({ contrat: c.contrat, entreprise: c.entreprise, projet: c.projet || '' });
    });
    Object.keys(par).forEach(function (k) { if (!vues[k]) horsListe += 1; });   // fiches du mois sans contrat en exécution (préparation, levée des réserves…)
    var limite = mois + '-' + (JOUR_LIMITE < 10 ? '0' : '') + JOUR_LIMITE, envoi = plusUn(finDeMois(auj));
    return { mois: mois, jour: jour, phase: jour >= JOUR_LIMITE ? 'echeance' : 'preparation', joursAvantLimite: Math.max(0, jours(auj, limite)), joursAvantEnvoi: jours(auj, envoi), dateLimite: limite, dateEnvoi: envoi,
      attendues: attendues.length, creees: faites.length, manquantes: manquantes, faites: faites, horsListe: horsListe, total: faites.length + horsListe };
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
  return { JOUR_DEBUT: JOUR_DEBUT, JOUR_LIMITE: JOUR_LIMITE, cle: cle, etat: etat, contratsEnExecution: contratsEnExecution };
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
/** Bloc « fiches_eval » du tableau de bord : seulement à partir du 22, et pour ceux qui ont accès à l'application « Fiche d'évaluation ». null sinon. */
function fichesEvalBloc_(u, acces, auj, enr) {
  if (!(Number(auj.slice(8, 10)) >= FichesEval.JOUR_DEBUT)) return null;
  var carte = null; try { carte = Store.table('Applications').filter(function (x) { return /fiche d.?[ée]valuation/i.test(String(x.titre || '')) && String(x.actif) !== '0'; })[0] || null; } catch (e) { carte = null; }
  var module = carte ? String(carte.module || '').toLowerCase() : 'logistique', niveauMin = carte ? Number(carte.niveau_min) || 1 : 2;
  if ((acces[module] || 0) < niveauMin) return null;
  var contrats = enr ? FichesEval.contratsEnExecution(enr, TB.cleStatut) : [], fiches = [], lecture = 'ok', message = '';
  try { fiches = fichesEvalLire_(); }
  catch (e) { lecture = 'indisponible'; message = 'Lecture des fiches impossible : l\'autorisation Google « Drive » de la passerelle n\'est pas activée (docs/RAPPORTS-MEDIAS.md).'; }
  var etat = FichesEval.etat(auj, contrats, fiches); if (!etat) return null;
  etat.lecture = lecture; etat.message = message; etat.url = carte ? String(carte.url || '') : ''; etat.sansContrats = !enr;
  return etat;
}
