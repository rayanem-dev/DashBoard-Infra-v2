/**
 * Benchmark des prix (page benchmark.html, catégorie Marchés) : enregistre les benchmarks établis (bordereau de l'offre reçue + prix des autres régions)
 * pour les retrouver, les corriger et les réimprimer. Le calcul est fait dans la page (js/benchmark-calc.js) ; la passerelle ne garde que les données saisies.
 * Droits (module « benchmark ») : 1 = consulter · 2 = créer / modifier · 3 = supprimer.
 * Partie PURE (nettoyage du document, testée en Node : test/benchmarkserveur.test.js) puis les actions de la passerelle.
 */
var BenchmarkDoc = (function () {
  var MAX_ARTICLES = 80, MAX_SOURCES = 8, MAX_JSON = 45000;   // une cellule Google Sheets tient 50 000 caractères
  function texte(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
  function nombre(x, max) { if (x === null || x === undefined || x === '') return ''; var n = Number(String(x).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n >= 0 && n <= max ? n : ''; }
  function ident(s, repli) { var t = String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16); return t || repli; }
  /** Garde uniquement les champs connus, bornés et typés : ce que la page envoie n'est jamais stocké tel quel. */
  function nettoyer(doc) {
    doc = doc || {}; var p = doc.params || {};
    var items = (Array.isArray(doc.items) ? doc.items : []).slice(0, MAX_ARTICLES).map(function (a, i) {
      return { id: ident(a && a.id, 'a' + (i + 1)), n: texte(a && a.n, 12), des: texte(a && a.des, 400), u: texte(a && a.u, 12), qte: nombre(a && a.qte, 1e9), pu: nombre(a && a.pu, 1e10) };
    });
    var ids = {}; items.forEach(function (a) { ids[a.id] = true; });
    var sources = (Array.isArray(doc.sources) ? doc.sources : []).slice(0, MAX_SOURCES).map(function (s, j) {
      var prix = {}; Object.keys((s && s.prix) || {}).forEach(function (k) { var v = nombre(s.prix[k], 1e10); if (ids[k] && v !== '') prix[k] = v; });
      return { id: ident(s && s.id, 's' + (j + 1)), nom: texte(s && s.nom, 60), contrat: texte(s && s.contrat, 80), courrier: texte(s && s.courrier, 80), recu: texte(s && s.recu, 10), annee: nombre(s && s.annee, 2100), coef: nombre(s && s.coef, 100), prix: prix };
    });
    var out = {
      titre: texte(doc.titre, 160), reference: texte(doc.reference, 160), entreprise: texte(doc.entreprise, 120), objet: texte(doc.objet, 300), date: texte(doc.date, 10),
      params: { anneeRef: nombre(p.anneeRef, 2100), taux: nombre(p.taux, 1), statistique: ['mediane', 'moyenne', 'min'].indexOf(p.statistique) >= 0 ? p.statistique : 'mediane', seuil: nombre(p.seuil, 10), nMin: nombre(p.nMin, 20), dispersion: nombre(p.dispersion, 1000), exclureSuspects: p.exclureSuspects === true, couvertureMin: nombre(p.couvertureMin, 1) },
      items: items, sources: sources
    };
    if (!out.titre) throw new Error('Donnez un titre au benchmark');
    if (JSON.stringify(out).length > MAX_JSON) throw new Error('Benchmark trop volumineux : réduisez le nombre d\'articles ou de désignations');
    return out;
  }
  return { nettoyer: nettoyer, MAX_ARTICLES: MAX_ARTICLES, MAX_SOURCES: MAX_SOURCES, MAX_JSON: MAX_JSON };
})();
if (typeof module !== 'undefined') module.exports = BenchmarkDoc;

// ---------- passerelle ----------
var BENCHMARK_ENTETES_ = ['id', 'titre', 'reference', 'nb_articles', 'nb_sources', 'maj_par', 'maj_le', 'json'];
function benchmarkFeuille_() { return cpmFeuille_('Benchmarks', BENCHMARK_ENTETES_); }
function benchmarkDroit_(req, min) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).benchmark || 0) < min) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function benchmarkLignes_() {
  var v = benchmarkFeuille_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i += 1) { if (!v[i][0]) continue; var o = { ligne: i + 1 }; BENCHMARK_ENTETES_.forEach(function (c, k) { o[c] = v[i][k]; }); out.push(o); }
  return out;
}
function benchmarkListe_(req) {
  var u = benchmarkDroit_(req, 1), niv = acces_(u).benchmark || 0;
  var l = benchmarkLignes_().map(function (x) { return { id: String(x.id), titre: String(x.titre), reference: String(x.reference), nb_articles: Number(x.nb_articles) || 0, nb_sources: Number(x.nb_sources) || 0, maj_par: String(x.maj_par), maj_le: String(x.maj_le) }; });
  l.sort(function (a, b) { return a.maj_le < b.maj_le ? 1 : a.maj_le > b.maj_le ? -1 : 0; });
  return { benchmarks: l, peut_modifier: niv >= 2, peut_supprimer: niv >= 3, defauts: benchmarkDefauts_() };
}
/** Réglages proposés aux nouveaux benchmarks (page Paramètres) : taux et seuil en fractions, couverture en fraction du marché. */
function benchmarkDefauts_() {
  return { taux: parametreNombre_('benchmark.taux', 9) / 100, seuil: parametreNombre_('benchmark.seuil', 20) / 100, nMin: parametreNombre_('benchmark.nmin', 2), dispersion: parametreNombre_('benchmark.dispersion', 3), couvertureMin: parametreNombre_('benchmark.couverture', 50) / 100 };
}
function benchmarkLire_(req) {
  benchmarkDroit_(req, 1);
  var l = benchmarkLignes_().filter(function (x) { return String(x.id) === String(req.id); })[0];
  if (!l) throw new Error('Benchmark introuvable');
  var doc; try { doc = JSON.parse(String(l.json)); } catch (e) { throw new Error('Benchmark illisible'); }
  doc.id = String(l.id); doc.maj_par = String(l.maj_par); doc.maj_le = String(l.maj_le);
  return { doc: doc };
}
function benchmarkEnregistrer_(req) {
  var u = benchmarkDroit_(req, 2), doc = BenchmarkDoc.nettoyer(req.doc), par = Annuaire.nomAffichable(u.nom, u.email), maintenant = new Date().toISOString();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = benchmarkFeuille_(), id = String(req.id || ''), ex = id ? benchmarkLignes_().filter(function (x) { return String(x.id) === id; })[0] : null;
    if (id && !ex) throw new Error('Benchmark introuvable');
    var ligne = [ex ? id : Utilities.getUuid().slice(0, 8), doc.titre, doc.reference, doc.items.length, doc.sources.length, par, maintenant, JSON.stringify(doc)];
    var rng = ex ? sh.getRange(ex.ligne, 1, 1, BENCHMARK_ENTETES_.length) : sh.getRange(sh.getLastRow() + 1, 1, 1, BENCHMARK_ENTETES_.length);
    rng.setNumberFormat('@'); rng.setValues([ligne]);
    Store.journal(ex ? 'benchmark_maj' : 'benchmark_creation', u.email, doc.titre + ' (' + doc.items.length + ' articles, ' + doc.sources.length + ' source(s))');
    return { id: String(ligne[0]), maj_par: par, maj_le: maintenant };
  } finally { lock.releaseLock(); }
}
function benchmarkSupprimer_(req) {
  var u = benchmarkDroit_(req, 3), id = String(req.id || '');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var l = benchmarkLignes_().filter(function (x) { return String(x.id) === id; })[0];
    if (!l) throw new Error('Benchmark introuvable');
    benchmarkFeuille_().deleteRow(l.ligne);
    Store.journal('benchmark_suppr', u.email, String(l.titre));
    return {};
  } finally { lock.releaseLock(); }
}
