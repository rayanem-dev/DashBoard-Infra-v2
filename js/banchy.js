/**
 * BANCHY — moteur de benchmark des prix (normativité des prix) : brique réutilisable du dépôt `lib`, sans dépendance.
 *
 *   Banchy.calculer(doc)            calcul : actualisation, référence par article (médiane), écart de l'offre, écart global pondéré, verdicts
 *   Banchy.lireArticles(texte)      articles collés depuis Excel          Banchy.lireColonne(texte)   une colonne de prix collée
 *   Banchy.versCsv(doc, résultat)   export Excel (CSV)
 *   Banchy.Lecture.depuisTableau(lignes)   lit une feuille Excel : articles, prix de l'offre, colonnes de prix des régions (contrat, année)
 *   Banchy.Lecture.depuisTexte(texte)      lit le texte d'un PDF / d'un scan (OCR) : N°, désignation, unité, quantité, prix unitaire, montant, total
 *   Banchy.Lecture.metadonnees(texte)      contrat, année, n° de courrier, région, référence de la consultation
 *   Banchy.Lecture.rapprocher(offre, lus)  met en face les articles d'une région et ceux de l'offre (N°, désignation, ordre)
 *
 * La partie « lecture » reçoit du TEXTE ou des LIGNES (la page lit le fichier : pdf.js, OCR, SheetJS) : tout le moteur est pur et testé en Node.
 * Une lecture automatique n'est jamais enregistrée sans vérification par l'utilisateur. Voir README.md et APPRENTISSAGE.md.
 */
var Banchy = (function () {
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

Banchy.Lecture = (function () {
  function vide(s) { return String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function norm(s) { return vide(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  /** « 3 690 000,00 » / « 1200.5 » / 738 → nombre ; null si illisible ou ≤ 0. */
  function nombre(x) {
    if (typeof x === 'number') return isFinite(x) && x > 0 ? x : null;
    var s = vide(x).replace(/\s/g, '').replace(/(DA|DZD)$/i, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null; var n = Number(s); return n > 0 ? n : null;
  }
  var UNITE = /^(m2|m²|m3|m³|ml|m\.l|u|un|unit[ée]|ens|ensemble|kg|t|l|ft|fft|forfait|h|j|jour|pce|pi[èe]ce|lot|km|m)$/i;
  var BRUIT = /montant\s+total|arr[êe]t[ée]|en\s+lettre|en\s+chiffre|^\s*page\s+\d|bordereau\s+des\s+prix|^\s*n°?\s*d[ée]signation|d[ée]signations?\s+unit[ée]|consultation\s+(nationale|de\s+fournisseurs)|^\s*annexe\s+\d+|(millions?|milliers?|mille)\b.*(dinars?|\bDA\b)/i;

  /** Ligne sans chiffre dont moins de 40 % des mots ont 3 lettres et dont aucun mot n'a 6 lettres : traits de tableau, tampons ou taches lus comme du texte. */
  function bruitOcr(l) { if (/\d{2}/.test(l) || UNITE_OCR.test(vide(l).replace(/[|\/]/g, ''))) return false; var m = vide(l).split(' ').filter(Boolean); if (!m.length) return true; var vrais = m.filter(function (x) { return /[A-Za-zÀ-ÿ]{3}/.test(x); }).length, long = m.some(function (x) { return /[A-Za-zÀ-ÿ]{6}/.test(x); }); return vrais / m.length < 0.4 && !long; }
  // ---------- nombres français coupés en morceaux par les espaces des milliers ----------
  function segmentations(t) {
    var res = [];
    (function rec(i, acc) {
      if (i === t.length) { res.push(acc.slice()); return; }
      var a = t[i], options = [];
      if (/^(0|[1-9]\d*)([,.]\d{1,3})?$/.test(a)) options.push([a, i + 1]);
      if (/^[1-9]\d{0,2}$/.test(a)) {
        var cumul = a, k = i + 1;
        while (k < t.length && /^\d{3}$/.test(t[k])) { cumul += t[k]; k += 1; options.push([cumul, k]); }
        if (k < t.length && /^\d{3}[,.]\d{1,3}$/.test(t[k])) options.push([cumul + t[k], k + 1]);
      }
      options.forEach(function (o) { acc.push(o[0]); rec(o[1], acc); acc.pop(); });
    })(0, []);
    return res.map(function (r) { return r.map(function (x) { return nombre(x); }); }).filter(function (r) { return r.every(function (x) { return x !== null; }); });
  }
  /** [prix, montant] sans quantité lisible (« 1 200,00 600 000,00 ») : la quantité est le rapport, s'il est entier. */
  function deduireQte(c) {
    var r = c.filter(function (x) { return x.length === 2 && x[1] / x[0] >= 1 && Math.abs(x[1] / x[0] - Math.round(x[1] / x[0])) < 0.001; })[0];
    return r ? [Math.round(r[1] / r[0]), r[0], r[1]] : null;
  }
  function coherent(n) { return n.length === 3 && Math.abs(n[0] * n[1] - n[2]) <= Math.max(1, n[2] * 0.02); }

  var NUM_ARTICLE = /^(\d{1,3}|[IVX]+(\.\d+)+|\d+(\.\d+)+|[A-Z]\d{1,3})$/;
  var UNITE_OCR = /^(m|m[?î²2³3]|u|ml|m\.l|ens|ensemble|kg|t|l|ft|fft|forfait|lot)$/i;
  /** Montant lu par l'OCR : « 10:500;00 », « 5.800,00 », « 10 000.00 » → 10500, 5800, 10000 (les 2 derniers chiffres après un séparateur sont les décimales). null si illisible (« 000;06 »). */
  function montantOcr(entiers, decimales) { var v = Number(String(entiers).replace(/\D/g, '') + '.' + decimales); return v >= 1 ? v : null; }
  /** Dans les 3 derniers mots d'une ligne, un mot fait de chiffres et de lettres que l'OCR confond avec des chiffres (S→5, O→0, I/l→1) est lu comme un nombre : « 10S00:00 » → « 10500:00 ». */
  function chiffresOcr(l) {
    var t = l.split(' '), d = Math.max(0, t.length - 3);
    for (var i = d; i < t.length; i += 1) if (/^[\dSOoIl.,:;']+$/.test(t[i]) && /\d{2}/.test(t[i].replace(/[SOoIl]/g, ''))) t[i] = t[i].replace(/[Ss]/g, '5').replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
    return t.join(' ');
  }
  /**
   * Une ligne du tableau : { avant, unite, jetons } si elle se termine par une unité suivie de nombres (lecture propre) ;
   * { avant, unite, ocr } si elle se termine par un montant à 2 décimales, éventuellement bruité par l'OCR, et porte un N° ou une unité ; null sinon.
   */
  function ligneChiffree(txt) {
    var t = vide(txt.replace(/\t/g, ' ').replace(/[|‘’`´]/g, ' ')).split(' ');
    for (var u = 0; u < t.length - 1; u += 1) {
      if (!UNITE.test(t[u])) continue;
      var queue = t.slice(u + 1);
      if (queue.length > 9 || !queue.every(function (x) { return /^\d[\d.,]*$/.test(x); })) continue;
      if (!segmentations(queue).length) continue;
      return { avant: t.slice(0, u), unite: /^m[?î²2³3]?$/i.test(t[u]) ? 'M2' : t[u], jetons: queue };
    }
    var propre = chiffresOcr(vide(txt.replace(/\t/g, ' ').replace(/[|‘’`´]/g, ' ')));
    // quantité + prix unitaire + montant lus par l'OCR (« 7000 600.00 4 200 000.00 »), ou prix + montant sans quantité (« 1 200.00 30 000.00 » : quantité déduite)
    var AMT = "(?:\\d{1,3}(?:[ .,:;']\\d{3})*|\\d+)[.,:;]\\s?\\d{2}", val = function (a) { var d = a.replace(/\D/g, ''); return d.length > 2 ? Number(d.slice(0, -2) + '.' + d.slice(-2)) : null; };
    var mA = new RegExp('(?:^|\\s)(\\d{1,6})\\s+(' + AMT + ')\\s+(' + AMT + ')\\s*$').exec(propre), mC = new RegExp('(?:^|\\s)(' + AMT + ')\\s+(' + AMT + ')\\s*$').exec(propre), trois = null, debut = -1;
    var deduit = mC && val(mC[1]) && val(mC[2]) && val(mC[2]) / val(mC[1]) >= 1 && Math.abs(val(mC[2]) / val(mC[1]) - Math.round(val(mC[2]) / val(mC[1]))) < 0.001;
    if (mA && val(mA[2]) && val(mA[3])) { var q = Number(mA[1]), pu = val(mA[2]), mo = val(mA[3]); trois = { qte: q, pu: pu, montant: mo, ok: coherent([q, pu, mo]) }; debut = mA.index;
      if (!trois.ok && q > 0 && mo / q >= 1 && Math.abs(mo / q - Math.round(mo / q)) < 0.001 && Math.round(mo / q) % 50 === 0) { trois.pu = Math.round(mo / q); trois.repare = true; } }   // prix abîmé (4800 pour 1600) : le montant et la quantité, plus longs à lire, donnent le prix
    if ((!trois || !trois.ok) && deduit) { trois = { qte: Math.round(val(mC[2]) / val(mC[1])), pu: val(mC[1]), montant: val(mC[2]), ok: true, deduit: true }; debut = mC.index; }   // « 1 200.00 600 000.00 » : le 1 n'est pas la quantité, elle est perdue (500)
    if (trois) {
      var rest3 = propre.slice(0, debut).split(' ').filter(function (x) { return /[A-Za-z0-9À-ÿ]/.test(x); }), un3 = '';
      if (rest3.length && UNITE_OCR.test(rest3[rest3.length - 1])) un3 = rest3.pop();
      return { avant: rest3, unite: /^m[?î²2³3]?$/i.test(un3) ? 'M2' : un3, trois: trois, ocr: trois.pu };
    }
    var m = /(?:^|[\s=«"'])((?:\d{1,3}(?:[ .,:;']?\d{3})*|\d+))[.,:;]\s?(\d{2})\s*$/.exec(propre);
    if (!m) return null;
    var reste = propre.slice(0, m.index).split(' ').filter(function (x) { return /[A-Za-z0-9À-ÿ]/.test(x); }), unite = '';
    if (reste.length && UNITE_OCR.test(reste[reste.length - 1])) unite = reste.pop();
    if (!unite && !(reste.length && NUM_ARTICLE.test(reste[0]))) return null;
    return { avant: reste, unite: /^m[?î²2³3]?$/i.test(unite) ? 'M2' : unite, ocr: montantOcr(m[1], m[2]) };
  }

  /**
   * Texte d'un PDF / d'un scan → articles. Les lignes qui finissent par « unité + nombres » portent le N°, l'unité et les prix ; le reste du texte est la désignation
   * (le N° est au milieu de la cellule : les lignes entre deux articles sont partagées entre eux, à la fin d'une phrase de préférence).
   * mode = nombre de colonnes chiffrées : 1 (prix unitaire seul : canevas d'une région), 2 (quantité, PU), 3 (quantité, PU, montant : bordereau).
   */
  function depuisTexte(texte) {
    var brut = String(texte || '').replace(/\f/g, '\n\n').split(/\r?\n/).map(function (l) { return l.replace(/\s+$/, ''); });
    // tout ce qui précède l'en-tête du tableau (titre, intitulé de la consultation…) n'est pas une désignation
    for (var h = 0; h < Math.min(brut.length, 60); h += 1) if (/d[ée]signation/i.test(brut[h]) && /unit[ée]|p\.?u|prix/i.test(brut[h])) { brut = brut.slice(h + 1); break; }
    var lignes = [], sep = [], blanc = false;   // sep[i] : une ligne vide précède la ligne i (séparateur de lignes d'un tableau)
    brut.forEach(function (l) { if (!vide(l)) { blanc = true; return; } if (BRUIT.test(vide(l)) || !/[A-Za-zÀ-ÿ]{3}|\d/.test(l) || bruitOcr(l)) return;   // lignes de bruit d'OCR (traits du tableau lus comme des lettres isolées)
       lignes.push(l); sep.push(blanc); blanc = false; });
    var info = lignes.map(ligneChiffree);
    var cand = info.map(function (x) { return x && x.jetons ? segmentations(x.jetons) : []; });
    // mode du document : 3 si des lignes vérifient quantité × PU = montant ; 2 si une quantité à 4 chiffres ou plus apparaît seule ; sinon 1
    var mode = 1, trois = 0, deux = 0;
    cand.forEach(function (c, i) { if (!info[i]) return; if (c.some(coherent)) trois += 1; else if (c.some(function (r) { return r.length === 2 && r[0] >= 1000 && Number.isInteger(r[0]); })) deux += 1; });
    var nb = info.filter(function (x) { return x && x.jetons; }).length;
    var troisOcr = info.filter(function (x) { return x && x.trois && x.trois.ok; }).length;   // lignes lues par l'OCR dont quantité × prix = montant
    if ((trois && trois >= nb / 2) || troisOcr >= 2) mode = 3; else if (deux && deux >= nb / 3) mode = 2;
    var arts = [];
    info.forEach(function (x, i) {
      if (!x) return;
      var c = cand[i], choix = null;
      if (x.ocr !== undefined) {   // ligne lue par l'OCR : prix souvent bruités
        var t3 = mode === 3 && x.trois ? x.trois : null;
        var ar = { n: '', des: '', u: x.unite, qte: t3 ? t3.qte : '', pu: t3 ? t3.pu : (mode === 3 ? '' : (x.ocr === null ? '' : x.ocr)), montant: t3 ? t3.montant : '', ligne: i, verifier: !(t3 && t3.ok && !t3.deduit) }, av = x.avant.slice();
        if (av.length && NUM_ARTICLE.test(av[0])) ar.n = av.shift(); ar.des = av.join(' '); arts.push(ar); return;
      }
      if (mode === 3) choix = c.filter(coherent)[0] || deduireQte(c) || c.filter(function (r) { return r.length === 3; })[0];
      else if (mode === 2) choix = c.filter(function (r) { return r.length === 2; })[0];
      else choix = c.filter(function (r) { return r.length === 1; }).sort(function (p, q) { return 0; })[0];
      if (!choix) choix = c.sort(function (p, q) { return p.length - q.length; })[0]; if (!choix) return;
      var avant = x.avant.slice(), n = '';
      if (avant.length && NUM_ARTICLE.test(avant[0])) n = avant.shift();
      var a = { n: n, des: avant.join(' '), u: x.unite, qte: '', pu: '', montant: '', ligne: i, verifier: false };
      if (choix.length === 1) a.pu = choix[0]; else if (choix.length === 2) { a.qte = choix[0]; a.pu = choix[1]; } else { a.qte = choix[0]; a.pu = choix[1]; a.montant = choix[2]; a.verifier = !coherent(choix); }
      if (!a.n) a.verifier = true;
      arts.push(a);
    });
    // désignations : lignes de texte entre deux articles
    var texteLigne = function (i) { return vide(lignes[i].replace(/\t/g, ' ')); };
    var apres = [];
    arts.forEach(function (a, k) {
      var debut = a.ligne + 1, fin = k + 1 < arts.length ? arts[k + 1].ligne : lignes.length, g = [];
      for (var i = debut; i < fin; i += 1) if (!info[i]) g.push(i);
      var coupe = g.length, cible = Math.round(g.length / 2);
      if (k + 1 < arts.length) {
        var best = -1, bs = -9;
        for (var c = 0; c <= g.length; c += 1) {
          var fin = c > 0 && /[.;:]$/.test(texteLigne(g[c - 1])), haut = c < g.length && /^[A-ZÉÈÀÂÊÎÔÛÇ]/.test(texteLigne(g[c]));
          var sc = c === 0 ? 0.5 : c === g.length ? (fin ? 2 : 0.5) : fin ? (haut ? 2.5 : 2) : haut ? 1 : -1;   // une phrase finie vaut mieux qu'une simple majuscule
          if (c < g.length && sep[g[c]] && c > 0) sc = 3;
          if (sc > bs || (sc === bs && Math.abs(c - cible) < Math.abs(best - cible))) { bs = sc; best = c; }
        }
        coupe = best < 0 ? cible : best;
      } else coupe = Math.min(g.length, k > 0 ? arts[k - 1].avantNext.length : 1);   // dernier article : autant de lignes après son N° que l'article précédent en avait avant (pas le pied de page)
      a.suite = g.slice(0, coupe).map(texteLigne); a.avantNext = g.slice(coupe).map(texteLigne);
    });
    arts.forEach(function (a, k) {
      var avant = k > 0 ? arts[k - 1].avantNext : [];
      if (k === 0) { avant = []; for (var i = a.ligne - 1; i >= 0 && !info[i] && avant.length < a.suite.length + 2; i -= 1) avant.unshift(texteLigne(i)); }   // pas plus de lignes avant le 1er article qu'après (le reste est le courrier ou le titre)
      a.des = vide(avant.concat([a.des], a.suite).join(' ').replace(/[|‘’`´]+/g, ' ').replace(/\s+([.,;])/g, '$1'));
    });
    // l'OCR confond parfois un chiffre du N° (« 93 » pour « 03 ») : la suite 01, 02, ?, 04 corrige ; un prix dont les décimales ne sont pas « ,00 » est à vérifier
    arts.forEach(function (a, k) {
      var p = arts[k - 1], q = arts[k + 1], num = function (x) { return x && /^\d+$/.test(x.n) ? Number(x.n) : null; };
      if (p && q && num(a) !== null && num(p) !== null && num(q) === num(p) + 2 && num(a) !== num(p) + 1) { var v = String(num(p) + 1); a.n = a.n.length > v.length ? ('000' + v).slice(-a.n.length) : v; a.verifier = true; }
      if (a.pu !== '' && Math.round(a.pu * 100) % 100 !== 0) a.verifier = true;
      if (a.pu === '') a.verifier = true;
    });
    arts.forEach(function (a) { delete a.ligne; delete a.suite; delete a.avantNext;  });
    var mt = String(texte || '').match(/montant\s+total[^\d\n]*([\d][\d  .,]*)/i);
    // canevas VIERGE (la demande envoyée aux régions) : des lignes numérotées et des unités, mais aucun prix
    var numerotees = 0, unites = 0;
    lignes.forEach(function (l) { var t = vide(l.replace(/[|\/‘’`´]/g, ' ')).split(' ').filter(Boolean); if (t.length >= 3 && NUM_ARTICLE.test(t[0]) && /[A-Za-zÀ-ÿ]{3}/.test(t[1])) numerotees += 1; else if (t.length === 1 && UNITE_OCR.test(t[0])) unites += 1; });
    var vierge = !arts.length && numerotees >= 3 && unites >= 1;
    return { articles: arts, total: mt ? nombre(mt[1].replace(/[., ]+$/, '')) : null, mode: mode, vierge: vierge };
  }

  // ---------- tableur ----------
  var RE_DES = /d[ée]signation|libell[ée]|intitul[ée]|description|nature des/i;
  var RE_PU = /^(p\.?\s?u\.?|prix\s+unit)/i;
  function colonnesEntete(l) {
    var o = { n: -1, des: -1, u: -1, qte: -1, pus: [] };
    l.forEach(function (c, j) {
      var s = vide(c); if (!s) return;
      if (RE_DES.test(s) && o.des < 0) o.des = j;
      else if (/^(n°|no|num|item|art|poste|r[ée]f)/i.test(s) && o.n < 0) o.n = j;
      else if (/^(u|unit[ée]|unite)\.?$/i.test(s) && o.u < 0) o.u = j;
      else if (/^(qt[ée]?|quantit[ée])/i.test(s) && o.qte < 0) o.qte = j;
      else if (RE_PU.test(s) && !/[ée]volution/i.test(s)) o.pus.push(j);
    });
    return o;
  }
  /** Libellé d'une colonne de prix : première cellule non vide au-dessus de l'en-tête (à gauche si la cellule est fusionnée). */
  function libelleColonne(lignes, h, j) {
    for (var r = h - 1; r >= Math.max(0, h - 6); r -= 1) {
      for (var c = j; c >= Math.max(0, j - 2); c -= 1) { var s = vide(lignes[r] && lignes[r][c]); if (s && !/^(offre|bunchmark|benchmark)/i.test(s)) return s; }
    }
    return '';
  }
  function depuisTableau(lignes) {
    lignes = (lignes || []).map(function (l) { return (l || []).map(function (c) { return c == null ? '' : c; }); });
    var h = -1, col = null;
    for (var i = 0; i < Math.min(60, lignes.length); i += 1) { var c = colonnesEntete(lignes[i]); if (c.des >= 0 && c.pus.length) { h = i; col = c; break; } }
    if (h < 0) return { articles: [], offres: [], entete: '' };
    var arts = [], offres = col.pus.slice(1).map(function (j) { return { colonne: j, libelle: libelleColonne(lignes, h, j), prix: [] }; });
    for (var r = h + 1; r < lignes.length; r += 1) {
      var l = lignes[r], des = vide(l[col.des]), n = col.n >= 0 ? vide(l[col.n]) : '', pu = nombre(l[col.pus[0]]);
      if (/montant\s+total|total\s+g[ée]n[ée]ral|^total/i.test(des || n || vide(l[0]))) break;
      if (!des && !n && pu === null && offres.every(function (o) { return nombre(l[o.colonne]) === null; })) continue;
      if (!n && !pu && arts.length && des && col.qte >= 0 && nombre(l[col.qte]) === null) { arts[arts.length - 1].des += ' ' + des; continue; }   // suite de désignation
      if (!des && !pu) continue;
      arts.push({ n: n, des: des, u: col.u >= 0 ? vide(l[col.u]) : '', qte: col.qte >= 0 ? (nombre(l[col.qte]) || '') : '', pu: pu || '', montant: '', verifier: !n });
      offres.forEach(function (o) { o.prix.push(nombre(l[o.colonne])); });
    }
    offres.forEach(function (o) { var m = /(\d{1,4}\s*\/\s*[\w\-\/.]*\/?\s*(20\d\d))/.exec(o.libelle) || /contrat[^\d]*([\w\/\-.]+)/i.exec(o.libelle); o.contrat = (/n°\s*([\w\/\-.]+)/i.exec(o.libelle) || [])[1] || (m ? m[1] : ''); var y = /(20\d\d)/.exec(o.contrat || ''); o.annee = y ? Number(y[1]) : ''; });
    return { articles: arts, offres: offres, entete: lignes.slice(0, h).map(function (l) { return l.map(vide).filter(Boolean).join(' '); }).join(' ') };
  }

  // ---------- métadonnées d'un courrier de réponse ----------
  function metadonnees(texte) {
    var t = String(texte || ''), m, o = { reference: '', contrat: '', annee: '', courrier: '', region: '', date: '' };
    if ((m = /\b(CF|AO|AOON|AOOI|CN)\s*(?:n°|no|num[ée]ro)?\s*:?\s*(\d+\s*\/\s*[\w\-\/.&]+)/i.exec(t))) o.reference = m[1].toUpperCase() + ' N° ' + m[2].replace(/\s+/g, '').replace(/[.,;:]+$/, '');
    if ((m = /contrat[^\n]{0,40}?(?:n°|no|num[ée]ro)\s*:?\s*([0-9A-Z][\w\-.&]*(?:\s?\/\s?[\w\-.&]+)+)/i.exec(t))) { o.contrat = m[1].replace(/\s+/g, ''); var y = /(20\d\d)\s*$/.exec(o.contrat) || /\/(\d{2})$/.exec(o.contrat); if (y) o.annee = Number(y[1].length === 2 ? '20' + y[1] : y[1]); }
    o.contrat = o.contrat.replace(/(?<=[A-Z])0(?=[A-Z])/g, 'O');   // OCR : « L0G-HMD » → « LOG-HMD »
    var cours = [], rc = /\bN°\s*(\d{1,5})\s?[\/I1l|]\s?([A-Z][\w\-\/.&]*\/20\d\d)/g, mc;   // plusieurs N° dans un courrier : le nôtre (RNS / INFRA) est rappelé en référence
    while ((mc = rc.exec(t))) cours.push(mc[1] + '/' + mc[2].replace(/^[I1l]?SH/, 'SH'));
    var cour = cours.filter(function (x) { return !/RNS/.test(x); })[0];   // jamais notre propre référence (rappelée dans le courrier de la région)
    if (cour) o.courrier = cour.replace(/\s+/g, '');
    var re = /Direction\s+R[ée]gionale\s+([A-ZÉa-zé][\wÀ-ÿ'\- ]{2,30})/g, r;
    while ((r = re.exec(t))) { var nom = r[1].replace(/\s+(N°|Division|BP).*$/i, '').trim(); if (!/rhourde/i.test(nom)) { var nn = norm(nom), moitie = /^(.+?) \1$/.exec(nn); o.region = moitie ? nom.split(/[ -]+/).slice(0, moitie[1].split(' ').length).join(' ') : nom; break; } }
    if (!o.region && o.courrier) { var code = (o.courrier.split('/').filter(function (x) { return /^[A-Z]{3,4}$/.test(x); })[0] || ''); if (code) o.region = code; }
    if ((m = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d\d)\b/.exec(t))) o.date = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return o;
  }

  /**
   * Nature d'un document, pour expliquer pourquoi rien n'est importé :
   * 'demande' (la lettre « Normativité des prix » envoyée aux régions, canevas vierge joint) · 'reponse' (courrier d'une région) · 'canevas-vierge' · 'offre' (bordereau chiffré avec quantités et montants)
   * · 'canevas-chiffre' (prix unitaires seuls) · 'inconnu'.
   */
  function nature(texte) {
    var t = String(texte || ''), d = depuisTexte(t);
    if (d.articles.length) return d.mode >= 2 ? 'offre' : /en r[ée]ponse|nous vous transmettons|canevas d[ûu]ment rempli/i.test(t) ? 'reponse' : 'canevas-chiffre';
    if (/vous demandons de bien vouloir nous communiquer|Messieurs\s+(les\s+)?Directeurs\s+R[ée]gionaux/i.test(t)) return 'demande';
    if (d.vierge) return 'canevas-vierge';
    return 'inconnu';
  }
  // ---------- rapprochement avec les articles de l'offre ----------
  function cleN(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+(?=\d)/, ''); }
  function mots(s) { var o = {}; norm(s).split(' ').filter(function (w) { return w.length >= 4; }).forEach(function (w) { o[w] = 1; }); return o; }
  function similarite(a, b) { var x = mots(a), y = mots(b), ka = Object.keys(x), kb = Object.keys(y); if (!ka.length || !kb.length) return 0; var com = ka.filter(function (w) { return y[w]; }).length; return com / (ka.length + kb.length - com); }
  /** Retourne un tableau aligné sur offre : { i: index de la ligne lue ou -1, methode: 'n°' | 'désignation' | 'ordre' | '' }. */
  function rapprocher(offre, lus) {
    var pris = {}, out = offre.map(function () { return { i: -1, methode: '' }; });
    offre.forEach(function (a, k) { if (!cleN(a.n)) return; for (var j = 0; j < lus.length; j += 1) if (!pris[j] && cleN(lus[j].n) === cleN(a.n)) { out[k] = { i: j, methode: 'n°' }; pris[j] = 1; break; } });
    offre.forEach(function (a, k) {
      if (out[k].i >= 0) return; var best = -1, bs = 0.35;
      for (var j = 0; j < lus.length; j += 1) { if (pris[j]) continue; var s = similarite(a.des, lus[j].des); if (s > bs) { bs = s; best = j; } }
      if (best >= 0) { out[k] = { i: best, methode: 'désignation' }; pris[best] = 1; }
    });
    var libresO = out.map(function (o, k) { return o.i < 0 ? k : -1; }).filter(function (k) { return k >= 0; }), libresL = lus.map(function (_, j) { return pris[j] ? -1 : j; }).filter(function (j) { return j >= 0; });
    if (libresO.length && libresO.length === libresL.length) libresO.forEach(function (k, z) { out[k] = { i: libresL[z], methode: 'ordre' }; });
    return out;
  }
  var api = { nature: nature, depuisTexte: depuisTexte, depuisTableau: depuisTableau, metadonnees: metadonnees, rapprocher: rapprocher, nombre: nombre, segmentations: segmentations };
  return api;
})();
if (typeof module !== 'undefined') module.exports = Banchy;
