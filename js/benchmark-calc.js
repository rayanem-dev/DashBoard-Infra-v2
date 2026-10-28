/**
 * Benchmark des prix (normativité des prix) : compare le bordereau d'une offre reçue aux prix pratiqués par les autres régions sur des contrats comparables.
 * Module PUR (aucun accès à la page) : testé en Node (apps-script/gateway/test/benchmark.test.js), utilisé par benchmark.html.
 *
 * Méthode (voir aussi le tableau d'origine « benchmark.xlsx ») :
 *  1. chaque prix reçu est ACTUALISÉ à l'année de référence : prix × coefficient (coefficient saisi, sinon (1 + taux annuel) ^ nombre d'années) ;
 *  2. pour chaque article, la RÉFÉRENCE est la médiane (ou la moyenne / le minimum, au choix) des prix actualisés ;
 *  3. l'ÉCART de l'offre = (prix de l'offre − référence) / référence : positif = l'offre est plus chère que la référence ;
 *  4. l'écart GLOBAL est pondéré par les montants : (Σ qté × prix de l'offre − Σ qté × référence) / Σ qté × référence — un article pèse son poids dans le marché ;
 *  5. le verdict global n'est rendu que si les articles fiables couvrent au moins couvertureMin du montant de l'offre ;
 *  6. un article n'est jugé que s'il a assez de sources (nMin) et si ses prix ne sont pas incohérents entre eux (facteur de dispersion).
 * Les seuils (écart toléré, nombre mini de sources, dispersion, taux d'actualisation) sont des PARAMÈTRES à valider, jamais des règles figées.
 */
var Benchmark = (function () {
  var PARAMS_DEFAUT = { anneeRef: 2026, taux: 0.09, statistique: 'mediane', seuil: 0.20, nMin: 2, dispersion: 3, exclureSuspects: false, couvertureMin: 0.5 };

  /** « 1 200,50 » / « 1200.5 » / 1200 → 1200.5 ; null si vide, illisible ou ≤ 0 (un prix nul n'est pas un prix). */
  function nombre(x) {
    if (x === null || x === undefined || x === '') return null;
    if (typeof x === 'number') return isFinite(x) && x > 0 ? x : null;
    var s = String(x).replace(/[\s  ]/g, '').replace(/DA|DZD/gi, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = Number(s); return n > 0 ? n : null;
  }
  /** Quantité : comme nombre() mais 0 autorisé (article sans quantité). */
  function quantite(x) { if (x === null || x === undefined || x === '') return 0; var n = nombre(x); return n === null ? 0 : n; }
  function parametres(p) {
    var o = {}; p = p || {};
    Object.keys(PARAMS_DEFAUT).forEach(function (k) { o[k] = p[k] === undefined || p[k] === null || p[k] === '' ? PARAMS_DEFAUT[k] : p[k]; });
    o.anneeRef = Math.round(Number(o.anneeRef)) || PARAMS_DEFAUT.anneeRef;
    o.taux = isFinite(Number(o.taux)) && Number(o.taux) >= 0 ? Number(o.taux) : PARAMS_DEFAUT.taux;
    o.seuil = isFinite(Number(o.seuil)) && Number(o.seuil) >= 0 ? Number(o.seuil) : PARAMS_DEFAUT.seuil;
    o.couvertureMin = isFinite(Number(o.couvertureMin)) && Number(o.couvertureMin) >= 0 && Number(o.couvertureMin) <= 1 ? Number(o.couvertureMin) : PARAMS_DEFAUT.couvertureMin;
    o.nMin = Math.max(1, Math.round(Number(o.nMin)) || PARAMS_DEFAUT.nMin);
    o.dispersion = Number(o.dispersion) > 1 ? Number(o.dispersion) : PARAMS_DEFAUT.dispersion;
    if (['mediane', 'moyenne', 'min'].indexOf(o.statistique) === -1) o.statistique = 'mediane';
    o.exclureSuspects = o.exclureSuspects === true || o.exclureSuspects === 'true' || o.exclureSuspects === 1;
    return o;
  }
  /** Coefficient d'actualisation d'une source : celui saisi, sinon (1 + taux) ^ (année de référence − année du contrat) (jamais < 1 : on n'« actualise » pas vers le passé). */
  function coefficient(src, p) {
    var c = nombre(src && src.coef); if (c) return c;
    var a = Math.round(Number(src && src.annee)); if (!a) return 1;
    return Math.pow(1 + p.taux, Math.max(0, p.anneeRef - a));
  }
  function mediane(v) { var t = v.slice().sort(function (a, b) { return a - b; }), n = t.length; return n ? (n % 2 ? t[(n - 1) / 2] : (t[n / 2 - 1] + t[n / 2]) / 2) : null; }
  function moyenne(v) { return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null; }
  function stat(v, nom) { return nom === 'moyenne' ? moyenne(v) : nom === 'min' ? Math.min.apply(null, v) : mediane(v); }
  function arrondi(x, d) { var k = Math.pow(10, d === undefined ? 2 : d); return Math.round(x * k) / k; }

  /**
   * doc = { params, items: [{ id, n, des, u, qte, pu }], sources: [{ id, nom, contrat, annee, coef, prix: { [idArticle]: pu } }] }
   * Retourne { params, sources: [{ id, nom, coef }], lignes, totaux }.
   * Verdict d'un article : 'conforme' | 'eleve' (offre au-dessus de la référence de plus que le seuil) | 'bas' (en dessous de plus que le seuil)
   *   | 'verifier' (prix incohérents entre eux) | 'insuffisant' (moins de nMin sources) | 'sans_ref' (aucune source).
   */
  function calculer(doc) {
    doc = doc || {}; var p = parametres(doc.params), items = doc.items || [], sources = doc.sources || [];
    var coefs = sources.map(function (s) { return { id: s.id, nom: s.nom, coef: coefficient(s, p) }; });
    var montantOffre = 0, montantRef = 0, montantRefFiable = 0, montantOffreFiable = 0, montantOffreCouvert = 0, nFiables = 0, sommeFeuille = 0, nFeuille = 0;
    var lignes = items.map(function (it, k) {
      var pu = nombre(it.pu), qte = quantite(it.qte), montant = (pu || 0) * qte; montantOffre += montant;
      var valeurs = [];
      sources.forEach(function (s, j) {
        var brut = nombre(s.prix && s.prix[it.id]); if (brut === null) return;
        var act = brut * coefs[j].coef; valeurs.push({ source: s.id, brut: brut, actualise: act, suspect: false });
      });
      // incohérences : à partir de 3 prix, un prix très éloigné de la médiane est suspect ; à 2 prix, l'article entier est « à vérifier »
      var dispersionItem = null, suspects = 0;
      if (valeurs.length >= 2) {
        var m = mediane(valeurs.map(function (x) { return x.actualise; }));
        if (valeurs.length >= 3) valeurs.forEach(function (x) { if (x.actualise / m > p.dispersion || m / x.actualise > p.dispersion) { x.suspect = true; suspects += 1; } });
        var a = valeurs.map(function (x) { return x.actualise; }); dispersionItem = Math.max.apply(null, a) / Math.min.apply(null, a);
      }
      var retenus = valeurs.filter(function (x) { return !(p.exclureSuspects && x.suspect); });
      var ref = retenus.length ? stat(retenus.map(function (x) { return x.actualise; }), p.statistique) : null;
      var ecart = ref && pu ? (pu - ref) / ref : null;
      var verdict, n = retenus.length;
      if (!valeurs.length) verdict = 'sans_ref';
      else if (n < p.nMin) verdict = 'insuffisant';
      else if ((valeurs.length === 2 && dispersionItem > p.dispersion) || (valeurs.length >= 3 && suspects >= Math.ceil(valeurs.length / 2))) verdict = 'verifier';
      else if (ecart === null) verdict = 'sans_ref';
      else verdict = ecart > p.seuil ? 'eleve' : ecart < -p.seuil ? 'bas' : 'conforme';
      var fiable = verdict === 'conforme' || verdict === 'eleve' || verdict === 'bas';
      if (ref && pu) { montantRef += ref * qte; montantOffreCouvert += montant; }
      if (fiable) { montantRefFiable += ref * qte; montantOffreFiable += montant; nFiables += 1; }
      // méthode du tableau d'origine, gardée pour comparaison : écart de chaque source par rapport à l'offre (source − offre) / offre, puis moyenne simple
      var moyFeuille = null;
      if (pu && valeurs.length) { moyFeuille = moyenne(valeurs.map(function (x) { return (x.actualise - pu) / pu; })); sommeFeuille += moyFeuille; nFeuille += 1; }
      return {
        id: it.id, n: it.n, des: it.des, u: it.u, qte: qte, pu: pu, montant: montant, poids: 0,
        valeurs: valeurs, nSources: valeurs.length, nRetenus: n, min: valeurs.length ? Math.min.apply(null, valeurs.map(function (x) { return x.actualise; })) : null,
        max: valeurs.length ? Math.max.apply(null, valeurs.map(function (x) { return x.actualise; })) : null,
        ref: ref, ecart: ecart, dispersion: dispersionItem, verdict: verdict, ecartFeuille: moyFeuille
      };
    });
    lignes.forEach(function (l) { l.poids = montantOffre ? l.montant / montantOffre : 0; });
    var ecartGlobal = montantRef ? (montantOffreCouvert - montantRef) / montantRef : null;
    var ecartFiable = montantRefFiable ? (montantOffreFiable - montantRefFiable) / montantRefFiable : null;
    var couverture = montantOffre ? montantOffreFiable / montantOffre : 0;
    // l'écart global ne conclut que si les articles fiables représentent une part suffisante du marché (sinon il ne parle que d'une petite partie de l'offre)
    var verdictGlobal = ecartFiable === null || couverture < p.couvertureMin ? 'insuffisant' : ecartFiable > p.seuil ? 'eleve' : ecartFiable < -p.seuil ? 'bas' : 'conforme';
    return {
      params: p, sources: coefs, lignes: lignes,
      totaux: {
        montantOffre: montantOffre, montantRef: montantRef, montantOffreCouvert: montantOffreCouvert, ecartGlobal: ecartGlobal,
        montantRefFiable: montantRefFiable, montantOffreFiable: montantOffreFiable, ecartFiable: ecartFiable, verdictGlobal: verdictGlobal,
        couverture: couverture, nFiables: nFiables, nArticles: items.length,
        nVerifier: lignes.filter(function (l) { return l.verdict === 'verifier'; }).length,
        nInsuffisant: lignes.filter(function (l) { return l.verdict === 'insuffisant' || l.verdict === 'sans_ref'; }).length,
        moyenneSimpleFeuille: nFeuille ? sommeFeuille / nFeuille : null
      }
    };
  }

  /** Texte collé depuis Excel (tabulations) → articles. Colonnes : N°, désignation, unité, quantité, prix unitaire (la première ligne d'en-tête est ignorée). */
  function lireArticles(texte) {
    var out = [];
    String(texte || '').split(/\r?\n/).forEach(function (ligne) {
      if (!ligne.trim()) return;
      var c = ligne.split('\t').map(function (x) { return x.trim(); });
      if (c.length < 2) return;
      if (/^(n°|n°|no|num|item)/i.test(c[0]) && /d[ée]signation|libell/i.test(c[1] || '')) return;
      out.push({ n: c[0], des: c[1] || '', u: c[2] || '', qte: quantite(c[3]) || '', pu: nombre(c[4]) || '' });
    });
    return out;
  }
  /** Une colonne de prix collée (un prix par ligne, dans l'ordre des articles ; ligne vide = pas de prix) → tableau de nombres ou null. */
  function lireColonne(texte) {
    var l = String(texte || '').replace(/\s+$/, '').split(/\r?\n/);
    return l.map(function (x) { return nombre(x.split('\t')[0]); });
  }

  function fmt(x, d) { return x === null || x === undefined ? '' : arrondi(x, d === undefined ? 2 : d).toFixed(d === undefined ? 2 : d).replace('.', ','); }
  function pct(x) { return x === null || x === undefined ? '' : fmt(x * 100, 1) + ' %'; }
  var LIBELLES = { conforme: 'Conforme', eleve: 'Au-dessus de la référence', bas: 'En dessous de la référence', verifier: 'À vérifier (prix incohérents)', insuffisant: 'Sources insuffisantes', sans_ref: 'Aucune référence' };
  /** Export Excel (CSV à points-virgules, UTF-8) du résultat. */
  function versCsv(doc, res) {
    var e = function (s) { s = String(s == null ? '' : s).replace(/\r?\n/g, ' '); return /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var l = [['N°', 'Désignation', 'U', 'Qté', 'PU offre (DA)', 'Montant (DA)', '% du marché'].concat(res.sources.map(function (s) { return 'PU ' + s.nom + ' (DA)'; }), res.sources.map(function (s) { return s.nom + ' actualisé (×' + fmt(s.coef, 3) + ')'; }), ['Référence (' + res.params.statistique + ')', 'Écart offre / référence', 'Verdict'])];
    res.lignes.forEach(function (r) {
      var parSrc = function (s) { return r.valeurs.filter(function (v) { return v.source === s.id; })[0]; };
      l.push([r.n, r.des, r.u, r.qte, fmt(r.pu), fmt(r.montant), pct(r.poids)].concat(res.sources.map(function (s) { var v = parSrc(s); return v ? fmt(v.brut) : ''; }), res.sources.map(function (s) { var v = parSrc(s); return v ? fmt(v.actualise) : ''; }), [fmt(r.ref), pct(r.ecart), LIBELLES[r.verdict]]));
    });
    var t = res.totaux;
    l.push([]); l.push(['', 'Montant total de l\'offre HT (DA)', '', '', '', fmt(t.montantOffre)]);
    l.push(['', 'Montant au prix de référence (articles chiffrés) (DA)', '', '', '', fmt(t.montantRef)]);
    l.push(['', 'Écart global pondéré (articles fiables)', '', '', '', pct(t.ecartFiable)]);
    return '﻿' + l.map(function (r) { return r.map(e).join(';'); }).join('\r\n');
  }
  return { PARAMS_DEFAUT: PARAMS_DEFAUT, LIBELLES: LIBELLES, nombre: nombre, quantite: quantite, parametres: parametres, coefficient: coefficient, mediane: mediane, calculer: calculer, lireArticles: lireArticles, lireColonne: lireColonne, versCsv: versCsv, fmt: fmt, pct: pct };
})();
if (typeof module !== 'undefined') module.exports = Benchmark;
